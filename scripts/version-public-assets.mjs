import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {transformSync} from 'esbuild';
const asset=/\.(?:js|mjs|css|json|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp3|mp4|webm|ogg|wav)$/i;
const textual=/\.(?:html|js|mjs|css|json|svg)$/i;
const reference=/(?<![A-Za-z0-9_:/.~-])(?:\/(?!\/)|\.\.?\/)[A-Za-z0-9_./-]+\.(?:js|mjs|css|json|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp3|mp4|webm|ogg|wav)\b/g;
const digest=value=>createHash('sha256').update(value).digest('hex').slice(0,24);
export function versionPublicAssets(output,files,workerSource=''){
 const assets=files.filter(file=>asset.test(file)&&file!=='account/runtime-config.json').sort(),known=new Set(assets);
 const source=new Map(assets.map(file=>[file,fs.readFileSync(path.join(output,file))]));
 const resolve=(file,url)=>{const value=url.startsWith('/')?url.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(file),url));return known.has(value)?value:null;};
 const dependencies=new Map(assets.map(file=>[file,textual.test(file)?[...new Set([...source.get(file).toString().matchAll(reference)].map(m=>resolve(file,m[0])).filter(Boolean))].sort():[]]));
 // Hash strongly connected import groups together. An unrelated file changes
 // neither these URLs nor their bytes; a changed dependency invalidates parents.
 let next=0;const stack=[],active=new Set(),index=new Map(),low=new Map(),groups=[],groupOf=new Map();
 function visit(file){index.set(file,next);low.set(file,next++);stack.push(file);active.add(file);
  for(const dep of dependencies.get(file)){if(!index.has(dep)){visit(dep);low.set(file,Math.min(low.get(file),low.get(dep)));}else if(active.has(dep))low.set(file,Math.min(low.get(file),index.get(dep)));}
  if(low.get(file)===index.get(file)){const members=[];let member;do{member=stack.pop();active.delete(member);members.push(member);groupOf.set(member,groups.length);}while(member!==file);groups.push(members.sort());}
 }
 for(const file of assets)if(!index.has(file))visit(file);
 const hashes=new Map();
 function groupHash(id){if(hashes.has(id))return hashes.get(id);const hash=createHash('sha256').update('fas-assets-v2');
  for(const file of groups[id]){hash.update(file+'\0');hash.update(source.get(file));for(const dep of dependencies.get(file))if(groupOf.get(dep)!==id)hash.update(dep+groupHash(groupOf.get(dep)));}
  const value=hash.digest('hex').slice(0,24);hashes.set(id,value);return value;
 }
 const mapping=new Map(assets.map(file=>['/'+file,'/_assets/'+groupHash(groupOf.get(file))+'/'+file]));
 const rewrite=(file,value)=>value.replace(reference,url=>{const target=resolve(file,url);return target?mapping.get('/'+target):url;});
 for(const file of assets){
  const target=path.join(output,mapping.get('/'+file).slice(1));fs.mkdirSync(path.dirname(target),{recursive:true});
  let data=source.get(file);if(textual.test(file))data=rewrite(file,data.toString());
  if(/\.(?:js|mjs|css)$/.test(file)&&!file.startsWith('assets/vendor/'))data=transformSync(data.toString(),{loader:file.endsWith('.css')?'css':'js',minifyWhitespace:true,minifySyntax:true,legalComments:'inline',target:'es2022'}).code;
  fs.writeFileSync(target,data);
 }
 for(const file of files.filter(file=>/\.(?:html|json)$/i.test(file)&&file!=='account/runtime-config.json'&&!file.startsWith('account/policy-history/'))){const target=path.join(output,file);fs.writeFileSync(target,rewrite(file,fs.readFileSync(target,'utf8')));}
 const releaseHash=createHash('sha256').update(workerSource);for(const file of [...files].sort()){releaseHash.update(file+'\0');releaseHash.update(fs.readFileSync(path.join(output,file)));}
 const release=releaseHash.digest('hex').slice(0,24);
 fs.mkdirSync(path.join(output,'content'),{recursive:true});
 fs.writeFileSync(path.join(output,'content/build-release.json'),JSON.stringify({release})+'\n');
 fs.writeFileSync(path.join(output,'content/asset-manifest.json'),JSON.stringify(Object.fromEntries(mapping))+'\n');
 return {release,assetCount:assets.length,assets:Object.fromEntries(mapping)};
}
