import {mailBody} from '../_shared/mail-signature.mjs';
import {mailRpc,sendInvitationJob} from '../_shared/mail-worker.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function makeContributorEmail(config,fetcher=fetch){
 const prod=config.base==='https://vzdicnufhidelaoeqbza.supabase.co',dev=config.base==='https://oqmmvjjycpyxvxipcyli.supabase.co',origin=prod?'https://fromastoryteller.com':'http://127.0.0.1:55410';
 const ready=!!config.apiKey&&!!config.webhookSecret&&(prod||dev&&config.testRecipients?.length>0);
 return async request=>{
  const headers={'Cache-Control':'no-store','Content-Type':'application/json','Access-Control-Allow-Origin':origin,Vary:'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  const reply=(status,data)=>Response.json(data,{status,headers});
  if(!prod&&!dev)return reply(503,{error:'Email environment unavailable'});
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==origin)return reply(403,{error:'Origin unavailable'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'POST required'});
  const rpc=mailRpc(config,fetcher),worker=request.headers.get('X-FAS-Mail');
  try{
   if(worker){
    if(!/^[a-f0-9-]{72}$/.test(worker)||!await rpc('fas_consume_email_worker_token',{worker_token:worker}))return reply(401,{error:'Worker authorization expired'});
    if(!ready)return reply(503,{error:'Email setup incomplete'});
    return reply(200,{job:await sendInvitationJob({...config,dev},null,fetcher)});
   }
   const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply(401,{error:'Sign in required'});
   const identity=await fetcher(config.base+'/auth/v1/user',{redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:config.anonKey,Authorization:authorization}});
   if(!identity.ok)return reply(401,{error:'Sign in again'});
   const user=await identity.json();if(!uuid.test(user.id??'')||user.is_anonymous)return reply(401,{error:'Verified account required'});
   // Authoritative RPC rechecks the current session and independent admin role.
   try{await rpc('fas_admin_email_jobs',{page_offset:0},authorization);}catch{return reply(403,{error:'Active administrator session required'});}
   const body=JSON.parse(await mailBody(request,4096));
   if(body.action==='status'){
    await rpc('fas_set_email_ready',{project_url:config.base,is_ready:ready});
    return reply(200,{ready,reason:ready?null:'Server email credentials and delivery tracking need configuration'});
   }
   if(!ready)return reply(503,{error:'Email setup incomplete. Create a private invitation link instead.'});
   if(!['create','resend'].includes(body.action)||!uuid.test(body.request_id??'')||body.action==='create'&&(typeof body.email!=='string'||body.email.length>254||![7,14,30].includes(body.days))||body.action==='resend'&&!uuid.test(body.invite_id??''))return reply(400,{error:'Valid invitation request required'});
   let queued;
   try{queued=await rpc('fas_queue_invitation_email',{email_address:body.action==='create'?body.email:null,valid_days:body.days??7,target_invite:body.action==='resend'?body.invite_id:null,request_key:body.request_id},authorization);}
   catch{return reply(409,{error:'The invitation could not be queued. Refresh invitations and check its expiry, current access and email retry limits.'});}
   const result=await sendInvitationJob({...config,dev},queued.id,fetcher);
   return reply(202,{job:{...queued,...result}});
  }catch{return reply(503,{error:'Email request was not confirmed. Retry the same request or refresh delivery status before creating another invitation.'});}
 };
}
