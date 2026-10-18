import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const registry=JSON.parse(readFileSync('account/policy-versions.json','utf8')),version=registry.communityUpdateVersion,entry=registry.versions[version];
const origin='https://fromastoryteller.com';
async function get(path){const r=await fetch(origin+path,{signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});assert.equal(r.status,200,path);return r;}
let last;
for(let attempt=0;attempt<12;attempt++){
 try{
  for(const kind of ['terms','privacy']){
   const document=entry.documents[kind],body=await (await get(document.path.replace(/index.html$/,''))).text();
   assert.equal(createHash('sha256').update(body.replace(/\r\n/g,'\n')).digest('hex'),document.sha256,'public '+kind+' snapshot');
  }
  for(const path of ['/terms/','/privacy/','/terms/contributors/','/account/agreements/']){
   const body=await (await get(path)).text();assert.match(body,/<h1/);
   if(path!=='/account/agreements/')assert.ok(body.includes(version),path+' version');
   assert.ok(body.includes('/terms/contributors/'),path+' contributor navigation');
  }
  const config=await (await get('/account/runtime-config.json')).json();
  assert.equal(config.policyRelease,process.env.FAS_EXPECTED_RUNTIME??process.env.FAS_EXPECTED_POLICY);
  const r=await fetch(config.url+'/rest/v1/rpc/fas_current_policy_requirement',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
  assert.equal(r.status,200);const requirement=await r.json();assert.equal(requirement.release_id,process.env.FAS_EXPECTED_POLICY);
  if(requirement.release_id===version)for(const kind of ['terms','privacy'])assert.equal(requirement[kind+'_sha256'],entry.documents[kind].sha256);
  console.log('PASS public policy bytes and required routes; runtime '+config.policyRelease+'; server '+requirement.release_id);last=null;break;
 }catch(error){last=error;if(attempt<11)await new Promise(resolve=>setTimeout(resolve,5000));}
}
if(last)throw last;
