import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const origin='https://fromastoryteller.com',normalize=s=>s.replace(/\r\n/g,'\n').trimEnd();
for(const path of ["systems/community/studio-editor.mjs","systems/community/studio-service.mjs","systems/community/profile-image-editor.mjs","systems/community/profile-image-service.mjs","systems/community/profile-editor.mjs","systems/community/profile-page.mjs","systems/community/public-profile.mjs","account/settings-controller.mjs","account/account-data-download.mjs","css/profiles.css"]){
 const expected=normalize(await readFile(path,'utf8'));let matched=false;
 for(let attempt=0;attempt<16;attempt++){
  const response=await fetch(origin+'/'+path+'?image-storage-release='+process.env.GITHUB_SHA,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000),redirect:'error'});
  if(response.ok&&normalize(await response.text())===expected){matched=true;break;}
  await new Promise(r=>setTimeout(r,10000));
 }
 assert.ok(matched,path+' differs from reviewed sources');console.log('PASS exact live source '+path);
}
for(const path of ['/account/studio/','/account/profile/','/account/settings/','/','/stories/','/search/']){
 const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);
 if(path==='/account/studio/')assert.match(await response.text(),/data-studio-root/);
}console.log('PASS public Studio, home, story category and search shells');
const configResponse=await fetch(origin+'/account/runtime-config.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});assert.ok(configResponse.ok);const config=await configResponse.json();assert.equal(config.url,'https://vzdicnufhidelaoeqbza.supabase.co');
const rpc=async(name,body={})=>fetch(config.url+'/rest/v1/rpc/'+name,{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
const response=await rpc('fas_public_story_catalog');assert.ok(response.ok);const catalog=await response.json();assert.ok(Array.isArray(catalog.items));assert.ok(catalog.items.length<=60);
for(const row of catalog.items){assert.equal(row.status,'published');assert.ok(!('body' in row));assert.ok(!('author_id' in row));assert.ok(!('email' in row.author));}console.log('PASS live anonymous published-only discovery projection');
const denied=await rpc('fas_story_lifecycle',{target_story:'00000000-0000-0000-0000-000000000001',expected_version:'2026-10-18T00:00:00Z',action:'restore'});assert.ok([401,403].includes(denied.status));assert.equal((await denied.json()).code,'42501');console.log('PASS anonymous lifecycle execution is denied by the real HTTP API');
const filesResponse=await rpc('fas_public_file_catalog');assert.ok(filesResponse.ok);const files=await filesResponse.json();assert.ok(files.length>=14);
await Promise.all(files.map(async item=>{assert.match(item.url,/^\/(stories|games|tools|blog|videos)\/[a-z0-9-]+\/$/);const page=await fetch(origin+item.url,{redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(page.status,200);assert.ok((await page.text()).includes(item.author.public_id));}));
console.log('PASS all '+files.length+' existing public file pages and linked bylines remain available');
console.log('Read-only verification complete; no signed-in sessions or content writes used.');

for(const name of ['fas-profile-image','fas-story-image']){
 const r=await fetch(config.url+'/functions/v1/'+name+'?asset_id=00000000-0000-0000-0000-000000000001',{credentials:'omit',signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,404);assert.match(r.headers.get('Cache-Control'),/no-store/);
}
console.log('PASS missing/private image readers return uncached 404');
for(const name of ['fas-profile-upload','fas-studio-cover']){
 const r=await fetch(config.url+'/functions/v1/'+name,{method:'POST',headers:{Origin:origin},signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,401);
}
const profileDenied=await rpc('fas_change_profile_image',{expected_version:'00000000-0000-0000-0000-000000000001',image_alt:'Untrusted',remove_image:true});assert.ok([401,403].includes(profileDenied.status));
const cleanup=await fetch(config.url+'/functions/v1/fas-image-cleanup',{method:'POST',signal:AbortSignal.timeout(15000)});assert.equal(cleanup.status,401);
console.log('PASS anonymous image writes and maintenance requests are denied');
const key=files[0]?.author?.public_id;assert.ok(key,'A public profile must be checked');
if(key){
 const r=await rpc('fas_public_profile',{profile_key:key,page_offset:0});assert.ok(r.ok);const profile=await r.json();assert.ok(Object.hasOwn(profile,'image'));assert.ok(!JSON.stringify(profile).includes('image_path'));assert.ok(!Object.hasOwn(profile,'id'));console.log('PASS public profile image projection excludes private paths and account IDs');
}

const settings=await fetch(origin+'/account/settings/',{redirect:'error',signal:AbortSignal.timeout(15000)});assert.ok((await settings.text()).includes('stored profile-image and cover crops'));console.log('PASS canonical settings page describes the stored crops');
