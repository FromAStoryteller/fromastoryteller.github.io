// Public aggregate ingestion. Never accept account tokens or log request payloads.
export function makePageViewHandler({base,serviceKey,origins=[],fetcher=fetch,now=Date.now}){
 let windowStart=0,count=0;const checkedKeys=new Map();
 return async request=>{
  const origin=request.headers.get('origin'),allowed=origins.includes(origin);
  const headers={'Cache-Control':'no-store','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'apikey, authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
  const reply=status=>new Response(null,{status,headers});
  if(!allowed)return reply(403);
  if(request.method==='OPTIONS')return reply(204);
  if(request.method!=='POST')return reply(405);
  // Authenticate public project keys ourselves: modern publishable keys are not JWTs.
  // No account token is accepted or forwarded. The private report RPC stays service-only.
  const publicKey=request.headers.get('apikey'),authorization=request.headers.get('authorization');
  if(!publicKey||publicKey.length>2048||!serviceKey||authorization&&authorization!=='Bearer '+publicKey)return reply(401);
  let publicShape=/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey);
  if(!publicShape){try{const claims=JSON.parse(atob(publicKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));publicShape=claims.role==='anon'&&claims.ref===new URL(base).hostname.split('.')[0];}catch{}}
  if(!publicShape)return reply(401);
  if(!request.headers.get('content-type')?.startsWith('application/json')||Number(request.headers.get('content-length'))>512)return reply(400);
  if(/bot|crawler|spider|headless|preview|facebookexternalhit/i.test(request.headers.get('user-agent')??''))return reply(204);
  if(now()-windowStart>=60000){windowStart=now();count=0;}if(++count>600)return reply(429);
  try{
   if((checkedKeys.get(publicKey)??0)<=now()){
    const verified=await fetcher(base+'/auth/v1/settings',{headers:{apikey:publicKey},redirect:'manual',signal:AbortSignal.timeout(5000)});
    if(!verified.ok)return reply(401);
    for(const [key,expires]of checkedKeys)if(expires<=now())checkedKeys.delete(key);
    if(checkedKeys.size>=20)checkedKeys.clear();checkedKeys.set(publicKey,now()+60000);
   }
   // Stream bound also covers chunked bodies without Content-Length.
   const reader=request.body?.getReader();if(!reader)return reply(400);let size=0,chunks=[];
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512){await reader.cancel();return reply(400);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   const data=JSON.parse(new TextDecoder().decode(bytes));
   if(Object.keys(data).some(k=>!['kind','id','source','device','consent'].includes(k))||data.consent!==true||!['content','profile'].includes(data.kind)||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(data.id)||!['direct','internal','search','social','other'].includes(data.source)||!['mobile','tablet','desktop','unknown'].includes(data.device))return reply(400);
   const result=await fetcher(base+'/rest/v1/rpc/fas_record_page_view',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(5000),headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({page_kind:data.kind,page_key:data.id,source_key:data.source,device_key:data.device})});
   return reply(result.ok?204:503);
  }catch{return reply(400);}
 };
}
