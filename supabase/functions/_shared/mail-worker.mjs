import {invitationEmail,MAIL_FROM} from './invitation-email-v1.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function mailRpc(config,fetcher=fetch){
 return async(name,body={},authorization=null)=>{
  const r=await fetcher(config.base+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:authorization?config.anonKey:config.serviceKey,Authorization:authorization??'Bearer '+config.serviceKey,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error('Mail operation unavailable');return await r.json();
 };
}
export async function sendInvitationJob(config,jobId=null,fetcher=fetch){
 const rpc=mailRpc(config,fetcher),job=await rpc('fas_claim_invitation_email',{job_key:jobId});if(!job)return null;
 let provider=null,retry=null,reason='provider_rejected';
 try{
  if(!uuid.test(job.id??'')||!uuid.test(job.lease??'')||!/^\S+@\S+[.]\S+$/.test(job.recipient??'')||Date.parse(job.expires_at)<=Date.now())throw new Error('Invalid job');
  if(config.dev&&!config.testRecipients?.includes(job.recipient))reason='configuration';
  else{
   const message=invitationEmail(job,{site:config.dev?'http://127.0.0.1:55410':'https://fromastoryteller.com',dev:config.dev});
   const r=await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json','Idempotency-Key':'fas-contributor-invitation/'+job.id},body:JSON.stringify({from:MAIL_FROM,to:[job.recipient],...message,tags:[{name:'fas_kind',value:'contributor_invitation'}]})});
   if(r.ok){const data=await r.json();if(uuid.test(data.id??''))provider=data.id;else retry=60;}
   else if(r.status===409){const details=await r.json().catch(()=>({}));if(details.name==='concurrent_idempotent_requests')retry=60;else reason='invalid_payload';}
   else if(r.status===429||r.status>=500){retry=Math.min(900,Math.max(60,Number(r.headers.get('Retry-After'))||60*2**(job.attempts-1)));}
   else reason=r.status===401||r.status===403?'configuration':'provider_rejected';
  }
 }catch{retry=Math.min(900,60*2**(job.attempts-1));}
 const ack=await rpc('fas_finish_invitation_email',{job_key:job.id,lease_key:job.lease,provider_key:provider,retry_delay:retry,failure_reason:reason});
 if(!ack)return {id:job.id,state:'canceled'};
 return {id:job.id,state:provider?'accepted':retry&&job.attempts<6?'retrying':'failed'};
}
