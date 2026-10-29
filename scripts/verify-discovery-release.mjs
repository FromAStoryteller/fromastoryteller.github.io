import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const registry=JSON.parse(await readFile(new URL('../account/policy-versions.json',import.meta.url),'utf8'));
const version=registry.activePublishedVersion;
const release=registry.versions[version];
async function get(path){const response=await fetch('https://fromastoryteller.com'+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,path);return response;}
let last;
for(let attempt=0;attempt<30;attempt++){
 try{
  for(const [kind,doc]of Object.entries(release.documents)){
   const bytes=await(await get(doc.path)).text();
   const hash=createHash('sha256').update(bytes.replace(/\r\n/g,'\n')).digest('hex');
   assert.equal(hash,doc.sha256,kind+' public snapshot checksum');
   const current=await(await get('/'+kind+'/')).text();
   assert.equal(createHash('sha256').update(current.replace(/\r\n/g,'\n')).digest('hex'),doc.sha256,kind+' current document checksum');
   console.log(kind+' verified '+hash);
  }
  const browse=await(await get('/api/public/browse?limit=2')).json();
  assert.ok(Array.isArray(browse.items)&&browse.items.length<=2&&browse.items.length>0);
  assert.ok(Number.isInteger(browse.total)&&browse.total>=browse.items.length);
  const searched=await(await get('/api/public/browse?q='+encodeURIComponent(String(browse.items[0].title).slice(0,64))+'&limit=2')).json();
  assert.ok(searched.items.length>0);
  const invalid=await fetch('https://fromastoryteller.com/api/public/browse?limit=999',{signal:AbortSignal.timeout(15000)});
  assert.equal(invalid.status,400);
  console.log('Published discovery route, search, bounds and exact policy checksums verified.');
  process.exit(0);
 }catch(error){last=error;console.log('Waiting for release: '+error.message);await new Promise(resolve=>setTimeout(resolve,10000));}
}
throw last;
