import test from 'node:test';
import assert from 'node:assert/strict';
import {invitationEmail,MAIL_FROM} from '../supabase/functions/_shared/invitation-email-v1.mjs';
import {sendInvitationJob} from '../supabase/functions/_shared/mail-worker.mjs';
import {verifyMailSignature} from '../supabase/functions/_shared/mail-signature.mjs';
import {makeEmailEvents} from '../supabase/functions/fas-email-events/handler.mjs';
import {makeContributorEmail} from '../supabase/functions/fas-contributor-email/handler.mjs';
import {createAdminService} from '../systems/community/admin-service.mjs';
const id='a1000000-0000-0000-0000-000000000001',lease='a2000000-0000-0000-0000-000000000001',provider='a3000000-0000-0000-0000-000000000001';
const config={base:'https://vzdicnufhidelaoeqbza.supabase.co',anonKey:'public-fixture',serviceKey:'service-fixture',apiKey:'provider-fixture',webhookSecret:'whsec_'+Buffer.alloc(32,7).toString('base64')};
const job={id,lease,token:'a'.repeat(72),recipient:'invited@example.invalid',expires_at:new Date(Date.now()+604800000).toISOString(),attempts:1};
async function signature(body,{time=String(Math.floor(Date.now()/1000)),eventId='event-fixture'}={}){
 const key=await crypto.subtle.importKey('raw',Buffer.alloc(32,7),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(eventId+'.'+time+'.'+body));
 return new Headers({'svix-id':eventId,'svix-timestamp':time,'svix-signature':'v1,'+Buffer.from(digest).toString('base64')});
}
function workerFixture(response){
 const calls=[];let finish;
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('fas_claim_invitation_email'))return Response.json({...job});
  if(url==='https://api.resend.com/emails'){if(response instanceof Error)throw response;return typeof response==='function'?response():response;}
  if(url.endsWith('fas_finish_invitation_email')){finish=JSON.parse(options.body);return Response.json(true);}
  throw new Error('Unexpected fixture endpoint');
 };return {fetcher,calls,finish:()=>finish};
}
test('invitation HTML/text contain one fragment credential, absolute UTC expiry and explicit consent',()=>{
 const result=invitationEmail(job),link=[...result.html.matchAll(/href="([^"]+)"/g)].find(m=>m[1].includes('#invite='))[1],url=new URL(link);
 assert.equal(url.origin,'https://fromastoryteller.com');assert.equal(url.pathname,'/account/invitation/');assert.equal(url.search,'');assert.equal(url.hash,'#invite='+job.token);
 assert.match(result.text,/Expires .* UTC/);assert.match(result.text,/not administrator access/);assert.match(result.html,/<html lang="en" dir="ltr">/);assert.match(result.html,/role="presentation" lang="en" dir="ltr"/);assert.match(result.html,/<title>/);assert.equal((result.html.match(/<h1/g)??[]).length,1);assert.doesNotMatch(result.html,/<script|<form|<img|tracking|\.RedirectTo/);
 assert.match(MAIL_FROM,/@auth.fromastoryteller.com/);assert.throws(()=>invitationEmail({...job,token:'<script>'}));assert.throws(()=>invitationEmail(job,{site:'https://attacker.invalid'}));
});
test('provider acceptance is not delivery and retries preserve the exact message/key',async()=>{
 const seen=[];
 for(let attempt=0;attempt<2;attempt++){
  const f=workerFixture(()=>Response.json({id:provider}));assert.equal((await sendInvitationJob(config,id,f.fetcher)).state,'accepted');
  const send=f.calls.find(c=>c.url==='https://api.resend.com/emails');seen.push(send);
  assert.equal(send.options.headers['Idempotency-Key'],'fas-contributor-invitation/'+id);assert.equal(f.finish().provider_key,provider);assert.equal(f.finish().retry_delay,null);
 }assert.equal(seen[0].options.body,seen[1].options.body);
});
test('temporary provider failures retry; permanent errors fail without exposing provider diagnostics',async()=>{
 for(const [response,retry]of [[()=>Response.json({},{status:429,headers:{'Retry-After':'120'}}),true],[()=>Response.json({},{status:503}),true],[new Error('network'),true],[()=>Response.json({name:'concurrent_idempotent_requests'},{status:409}),true],[()=>Response.json({name:'invalid_idempotent_request'},{status:409}),false],[()=>Response.json({sensitive:'details'},{status:422}),false],[()=>Response.json({},{status:403}),false]]){
  const f=workerFixture(response),result=await sendInvitationJob(config,id,f.fetcher);assert.equal(result.state,retry?'retrying':'failed');assert.equal(f.finish().retry_delay!==null,retry);assert.equal(f.finish().provider_key,null);assert.doesNotMatch(JSON.stringify(result),/sensitive|details|provider-fixture|token/);
 }
});
test('DEV allowlist blocks accidental mail to an unapproved real recipient',async()=>{
 const f=workerFixture(()=>Response.json({id:provider}));assert.equal((await sendInvitationJob({...config,dev:true,testRecipients:['someone-else@example.invalid']},id,f.fetcher)).state,'failed');assert.ok(!f.calls.some(c=>c.url==='https://api.resend.com/emails'));assert.equal(f.finish().failure_reason,'configuration');
});
test('webhook HMAC rejects changed, unsigned, stale and future messages',async()=>{
 const now=Date.UTC(2026,9,18,0,0,0),seconds=now/1000;
 const body=JSON.stringify({type:'email.delivered',data:{email_id:provider}}),headers=await signature(body,{time:String(seconds)});
 assert.equal(await verifyMailSignature(body,headers,config.webhookSecret,now),true);assert.equal(await verifyMailSignature(body+' ',headers,config.webhookSecret,now),false);assert.equal(await verifyMailSignature(body,new Headers(),config.webhookSecret,now),false);
 for(const offset of [-301,301]){const h=await signature(body,{time:String(seconds+offset)});assert.equal(await verifyMailSignature(body,h,config.webhookSecret,now),false);}
 // Freeze the verifier clock: wall-clock rollover must not change the expected boundary.
 for(const offset of [-300,300]){
  const h=await signature(body,{time:String(seconds+offset)});
  assert.equal(await verifyMailSignature(body,h,config.webhookSecret,now),true);
  assert.equal(await verifyMailSignature(body,h,config.webhookSecret,now+(offset<0?1:-1)),false);
 }
});
test('signed event handling stores only event metadata and requires durable success before acknowledging',async()=>{
 const body=JSON.stringify({type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:provider,to:['private@example.invalid'],html:'PRIVATE CONTENT'}});
 for(const ok of [true,false]){
  let args;const handler=makeEmailEvents(config,async(_url,options)=>{args=JSON.parse(options.body);return Response.json(true,{status:ok?200:503});});
  const response=await handler(new Request(config.base,{method:'POST',headers:await signature(body),body}));assert.equal(response.status,ok?200:503);assert.doesNotMatch(JSON.stringify(args),/private@|PRIVATE CONTENT|html|recipient/);
 }
});
test('unconfigured invitation sending and invalid admin/worker auth never queue messages',async()=>{
 let queue=0;
 const fetcher=async(url)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id});
  if(url.endsWith('fas_admin_email_jobs'))return Response.json([]);
  if(url.endsWith('fas_consume_email_worker_token'))return Response.json(false);
  if(url.includes('queue_invitation'))queue++;
  throw new Error('No mutation expected');
 };
 const req=body=>new Request(config.base,{method:'POST',headers:{Origin:'https://fromastoryteller.com',Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await makeContributorEmail({...config,apiKey:''},fetcher)(req({action:'create',email:job.recipient,days:7,request_id:id}))).status,503);assert.equal(queue,0);
 const denied=await makeContributorEmail(config,fetcher)(new Request(config.base,{method:'POST',headers:{'X-FAS-Mail':'a'.repeat(72)}}));assert.equal(denied.status,401);
 assert.equal((await makeContributorEmail(config,fetcher)(new Request(config.base,{method:'POST'}))).status,401);
});
test('admin client reuses the request reference after an uncertain send and blocks account switching',async()=>{
 let current=id,fail=true;const requests=[];
 const client={auth:{refreshSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{id:current}}})},functions:{invoke:async(_name,{body})=>{requests.push(body);if(fail){fail=false;return {error:{message:'PRIVATE'}};}return {data:{job:{id,state:'accepted'}}};}}};
 const service=createAdminService(client,{ownerId:id});await assert.rejects(service.sendInvitation(job.recipient,7),/not confirmed/);await service.sendInvitation(job.recipient,7);assert.equal(requests[0].request_id,requests[1].request_id);
 current=provider;await assert.rejects(service.sendInvitation(job.recipient,7),/account changed/);assert.equal(requests.length,2);
});
