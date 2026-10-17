import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {isProductionAuthConfig} from '../account/auth-settings.mjs';
const base='https://fromastoryteller.com';
const normalize=s=>s.replace(/\r\n/g,'\n').trimEnd();
const get=path=>fetch(base+path,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
const configResponse=await get('/account/runtime-config.json');assert.equal(configResponse.status,200);
const config=await configResponse.json();assert.ok(isProductionAuthConfig(config));
async function rpc(name,args={}){
 const r=await fetch(config.url+'/rest/v1/rpc/'+name,{method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(args)});
 assert.equal(r.status,200,'Public projection '+name);return r.json();
}
const catalog=await rpc('fas_public_file_catalog');assert.equal(catalog.length,14);
const publicOnly=value=>{if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){assert.ok(!['owner_id','author_id','user_id','email','object_path'].includes(key),'Private ownership field exposed');publicOnly(child);}};
publicOnly(catalog);
const items=new Map(catalog.map(item=>[item.url,item]));
const metaPaths=JSON.parse(await readFile('content/content-index.json','utf8'));let count=0;
for(const path of metaPaths){
 const meta=JSON.parse(await readFile(path.replace(/^\//,''),'utf8')),item=items.get(meta.url);assert.ok(item);
 const name=meta.type==='tool'?'From A Storyteller':'Ry';
 assert.equal(item.author.display_name,name);assert.equal(item.author.kind,meta.type==='tool'?'organization':'person');
 const response=await get(meta.url);assert.equal(response.status,200,meta.url);assert.equal(response.headers.get('Cache-Control'),'no-store',meta.url+' must reach the worker');
 const html=await response.text();assert.ok(html.includes('data-content-id="'+item.id+'"'),meta.url+' stable content identifier');assert.ok(html.includes('By '+name),meta.url+' live byline');
 assert.ok(html.includes('/storytellers/?author='+item.author.public_id),meta.url+' linked profile');
 assert.ok(html.includes(meta.canonicalUrl),meta.url+' canonical URL');
 const schema=JSON.parse(html.match(/<script[^>]*data-file-schema[^>]*>([\s\S]*?)<\/script>/i)?.[1]||'null');assert.ok(schema,meta.url+' structured metadata');
 assert.equal(schema.author.name,name);assert.equal(schema.author['@type'],meta.type==='tool'?'Organization':'Person');assert.equal(schema.identifier,item.id);assert.equal(schema.url,meta.canonicalUrl);
 for(const social of item.author.social_links??[])assert.ok(html.includes(social.url),meta.url+' selected social links');
 count++;console.log('PASS public page '+meta.url+' · '+name+' · stable address and identity');
}
const personal=await rpc('fas_public_profile',{profile_key:'9acaaa0d-24ea-4c2b-a398-ead0d4231a4d',page_offset:0});
const brand=await rpc('fas_public_profile',{profile_key:'fa500000-0000-4000-8000-000000000001',page_offset:0});
assert.equal(personal.stories.length,12);assert.equal(brand.stories.length,2);assert.equal(personal.next_offset,null);assert.equal(brand.next_offset,null);publicOnly(personal);publicOnly(brand);
for(const path of ['systems/community/studio-editor.mjs','systems/community/studio-service.mjs','css/studio.css']){
 const expected=normalize(await readFile(path,'utf8'));const response=await get('/'+path);assert.equal(response.status,200);assert.equal(normalize(await response.text()),expected,'Live source '+path);console.log('PASS live source '+path);
}
const studio=await get('/account/studio/');assert.equal(studio.status,200);assert.match(await studio.text(),/data-studio-root/);
console.log(JSON.stringify({verifiedPages:count,personalPublishedItems:personal.stories.length,fasPublishedItems:brand.stories.length,privateFieldsExposed:false,authenticatedRequests:0,contentMutations:0}));
