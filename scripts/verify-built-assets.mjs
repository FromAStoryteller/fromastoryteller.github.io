import fs from 'node:fs';
import path from 'node:path';
export function verifyBuiltAssets(root,files){
 let references=0;const missing=[];
 const check=(file,value)=>{
  if(!value||/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(value)||/[{}<>$]/.test(value))return;
  const clean=value.split(/[?#]/)[0];if(!clean)return;
  const target=clean.startsWith('/')?path.join(root,clean.slice(1)):path.resolve(root,path.dirname(file),clean);
  references++;if(!fs.existsSync(target))missing.push(file+': '+value);
 };
 for(const file of files){
  if(!/\.(?:html|js|mjs|css)$/.test(file))continue;
  const source=fs.readFileSync(path.join(root,file),'utf8');
  if(/\.(?:js|mjs)$/.test(file)&&!file.includes('assets/vendor/'))for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g))if(/^[./]/.test(match[1]))check(file,match[1]);
  if(file.endsWith('.html'))for(const tag of source.matchAll(/<(?:script|img|source|link)\b[^>]*>/gi))for(const match of tag[0].matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi))check(file,match[1]);
  if(file.endsWith('.html'))for(const match of source.matchAll(/\bsrcset=["']([^"']+)["']/gi))for(const candidate of match[1].split(','))check(file,candidate.trim().split(/\s+/)[0]);
  if(file.endsWith('.css'))for(const match of source.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g))check(file,match[1]);
 }
 if(missing.length)throw Error('Broken deployed asset references:\n'+missing.join('\n'));
 return references;
}
