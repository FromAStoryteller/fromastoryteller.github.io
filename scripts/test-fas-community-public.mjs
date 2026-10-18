// Public read-only production checks. No identity, draft or email is created.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
if(process.argv.slice(2).join(' ')!=='--production-read-only')throw Error('Explicit read-only production mode required');
const origin='https://fromastoryteller.com',base='https://vzdicnufhidelaoeqbza.supabase.co';
const configResponse=await fetch(origin+'/account/runtime-config.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
assert.equal(configResponse.status,200);const config=await configResponse.json();
assert.equal(config.url,base);assert.equal(config.mode,'production');assert.ok(config.key);
const call=async(path,{post=false,body={}}={})=>{
 const r=await fetch(base+path,{method:post?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:config.key,...(post?{'Content-Type':'application/json',Origin:origin}:{})},body:post?JSON.stringify(body):undefined});
 return {status:r.status,ok:r.ok,data:await r.json().catch(()=>null)};
};
const requirement=await call('/rest/v1/rpc/fas_current_policy_requirement',{post:true});assert.equal(requirement.status,200);assert.equal(requirement.data.release_id,config.policyRelease);
for(const kind of ['terms','privacy']){
 const p=requirement.data[kind+'_path'];assert.match(p,new RegExp('^/account/policy-history/[a-z0-9-]+/'+kind+'/$'));
 const r=await fetch(origin+p,{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);
 assert.equal(createHash('sha256').update((await r.text()).replace(/\r\n/g,'\n')).digest('hex'),requirement.data[kind+'_sha256']);
}
for(const table of ['profiles','user_roles','invites']){
 const r=await call('/rest/v1/'+table+'?select=id&limit=1');
 assert.ok([401,403].includes(r.status)||r.status===200&&Array.isArray(r.data)&&r.data.length===0,table+' anonymous privacy boundary');
}
const drafts=await call('/rest/v1/stories?select=id,status&status=eq.draft&limit=1');assert.ok([401,403].includes(drafts.status)||drafts.status===200&&Array.isArray(drafts.data)&&drafts.data.length===0);
for(const name of ['fas_admin_overview','fas_admin_accounts','fas_my_policy_agreements']){
 const r=await call('/rest/v1/rpc/'+name,{post:true});assert.ok([401,403].includes(r.status),name+' anonymous denial');
}
for(const name of ['fas-contributor-email','fas-email-events']){
 const r=await call('/functions/v1/'+name,{post:true});assert.equal(r.status,401,name+' unsigned or unauthenticated denial');
}
for(const path of ['/stories/','/storytellers/','/account/studio/','/account/admin/','/account/agreements/']){
 const r=await fetch(origin+path,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,path);
}
const catalog=await call('/rest/v1/rpc/fas_public_story_catalog',{post:true});assert.equal(catalog.status,200);assert.ok(Array.isArray(catalog.data.items));
console.log('PASS production read-only: public policy hashes/runtime, anonymous profile/role/invitation/draft/admin denials, unsigned email endpoints and public catalogue/routes');
