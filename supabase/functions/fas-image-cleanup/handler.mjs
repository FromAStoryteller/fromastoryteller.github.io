import {cleanImages} from '../_shared/image-cleanup.mjs';
export function makeCleanupHandler(config,fetcher=fetch){
 return async request=>{
  const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST')return reply(405,{error:'POST required'});
  const token=request.headers.get('X-FAS-Cleanup');
  if(!/^[a-f0-9-]{72}$/.test(token??''))return reply(401,{error:'Cleanup authorization required'});
  try{
   const r=await fetcher(config.base+'/rest/v1/rpc/fas_consume_cleanup_token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:config.serviceKey,Authorization:`Bearer ${config.serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({cleanup_token:token})});
   if(!r.ok||await r.json()!==true)return reply(401,{error:'Cleanup authorization expired'});
   return reply(200,await cleanImages(config,fetcher));
  }catch{return reply(503,{error:'Cleanup will retry'});}
 };
}
