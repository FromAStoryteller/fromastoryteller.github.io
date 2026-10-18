import {mailBody,verifyMailSignature} from '../_shared/mail-signature.mjs';
import {mailRpc} from '../_shared/mail-worker.mjs';
export function makeEmailEvents(config,fetcher=fetch){
 return async request=>{
  const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST')return reply(405,{error:'POST required'});
  if(!config.webhookSecret)return reply(503,{error:'Delivery tracking not configured'});
  try{
   const payload=await mailBody(request),valid=await verifyMailSignature(payload,request.headers,config.webhookSecret);
   if(!valid)return reply(401,{error:'Invalid event signature'});
   const event=JSON.parse(payload);
   if(!['email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed'].includes(event.type))return reply(200,{received:true});
   if(!/^[a-f0-9-]{36}$/i.test(event.data?.email_id??'')||!Number.isFinite(Date.parse(event.created_at)))return reply(400,{error:'Invalid event'});
   const ok=await mailRpc(config,fetcher)('fas_record_email_event',{event_key:request.headers.get('svix-id'),message_key:event.data.email_id,event_type:event.type,event_time:event.created_at});
   return reply(ok?200:503,{received:ok===true});
  }catch{return reply(503,{error:'Event not recorded; retry required'});}
 };
}
