import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const asset=/\.(?:js|mjs|css|json|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|mp4|webm|ogg|wav)$/i;
const text=/\.(?:html|js|mjs|css|json|svg)$/i;
export function versionPublicAssets(output,files,workerSource=''){
 const assets=files.filter(file=>asset.test(file)&&file!=='account/runtime-config.json').sort();
 const hash=createHash('sha256').update(workerSource);for(const file of [...files].sort()){hash.update(file+'\0');hash.update(fs.readFileSync(path.join(output,file)));}
 const release=hash.digest('hex').slice(0,24),prefix='/_assets/'+release+'/';
 const mapping=new Map(assets.map(file=>['/'+file,prefix+file]));
 // Preserve directory structure for relative imports, CSS URLs and import.meta.url.
 // Absolute references are rewritten only when they name a known public asset.
 const rewrite=value=>value.replace(/(?<![A-Za-z0-9_:/.~-])\/[A-Za-z0-9_./-]+\.(?:js|mjs|css|json|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|mp4|webm|ogg|wav)\b/g,source=>mapping.get(source)??source);
 for(const file of assets){
  const target=path.join(output,prefix.slice(1),file);fs.mkdirSync(path.dirname(target),{recursive:true});
  const data=fs.readFileSync(path.join(output,file));fs.writeFileSync(target,text.test(file)?rewrite(data.toString('utf8')):data);
 }
 for(const file of files.filter(file=>/\.(?:html|json)$/i.test(file)&&file!=='account/runtime-config.json'&&!file.startsWith('account/policy-history/'))){
  const target=path.join(output,file);fs.writeFileSync(target,rewrite(fs.readFileSync(target,'utf8')));
 }
 fs.mkdirSync(path.join(output,'content'),{recursive:true});
 fs.writeFileSync(path.join(output,'content/build-release.json'),JSON.stringify({release})+'\n');
 return {release,assetCount:assets.length};
}
