import {inspectRaster} from '../fas-studio-cover/handler.mjs';

const widths=[480,800,1200,1600,2400];
const pathPattern=/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]+\.jpg$/;
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function boundedBytes(body,max){
 const reader=body?.getReader();if(!reader)throw Error('Missing body');const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Oversized body');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
// Operator-only, short-lived deployment. No codecs, SQL writes, arbitrary paths,
// master overwrites or user credentials. Retire the deployment after the run.
export function makeCoverBackfillHandler({base,serviceKey,tokenHash,expiresAt,assets},fetcher=fetch,now=Date.now){
 const selected=new Map(assets.map(asset=>{if(!pathPattern.test(asset.object_path)||![1600,2400,3200].includes(asset.pixel_width)||asset.pixel_height*16!==asset.pixel_width*9)throw Error('Unsupported master');return [asset.id,asset];}));
 const reply=(status,message)=>new Response(message,{status,headers:{'Cache-Control':'no-store'}});
 return async request=>{
  if(now()>=expiresAt)return reply(410,'Backfill retired');
  const token=request.headers.get('X-FAS-Backfill-Token');
  if(!/^[a-f0-9]{64}$/.test(token??'')||await sha256(new TextEncoder().encode(token))!==tokenHash)return reply(403,'Operator access required');
  const params=new URL(request.url).searchParams,keys=[...params.keys()],asset=selected.get(params.get('asset_id'));
  if(!asset||keys.some(k=>!['asset_id','width'].includes(k))||new Set(keys).size!==keys.length)return reply(400,'Invalid backfill target');
  const width=params.has('width')?Number(params.get('width')):null;
  if(request.method!=='GET'&&request.method!=='PUT')return reply(405,'GET or PUT required');
  if(request.method==='GET'&&width!==null||request.method==='PUT'&&(!widths.includes(width)||width>=asset.pixel_width))return reply(400,'Unsupported size');
  const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`};
  const call=(path,options={})=>fetcher(base+path,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),...options,headers:{...headers,...options.headers}});
  try{
   const metadata=await call('/rest/v1/story_assets?id=eq.'+asset.id+'&select=object_path,pixel_width,pixel_height,verified_at');
   if(!metadata.ok)return reply(503,'Metadata unavailable');const rows=await metadata.json();
   if(rows.length!==1||rows[0].object_path!==asset.object_path||rows[0].pixel_width!==asset.pixel_width||rows[0].pixel_height!==asset.pixel_height||!rows[0].verified_at)return reply(409,'Master changed or unavailable');
   const object=asset.object_path.replace(/\.jpg$/,width===null?'.jpg':'-'+width+'.jpg');
   const read=()=>call('/storage/v1/object/authenticated/fas-story-images/'+object);
   if(request.method==='GET'){
    const response=await read();if(!response.ok)return reply(404,'Master unavailable');
    const bytes=await boundedBytes(response.body,5242880),shape=inspectRaster(bytes);
    if(bytes[0]!==255||bytes[1]!==216||shape.width!==asset.pixel_width||shape.height!==asset.pixel_height)return reply(409,'Unexpected master');
    return new Response(bytes,{headers:{'Cache-Control':'no-store','Content-Type':'image/jpeg'}});
   }
   if(request.headers.get('Content-Type')!=='image/jpeg')return reply(400,'JPEG required');
   const bytes=await boundedBytes(request.body,1048576),shape=inspectRaster(bytes);
   if(bytes[0]!==255||bytes[1]!==216||shape.width!==width||shape.height!==width*9/16)return reply(400,'Invalid derivative dimensions');
   const expected=await sha256(bytes),existing=await read();let created=false;
   if(existing.status===404||existing.status===400){
    // No upsert: even an unexpected existing sibling cannot be overwritten.
    const upload=await call('/storage/v1/object/fas-story-images/'+object,{method:'POST',headers:{'Content-Type':'image/jpeg','x-upsert':'false'},body:bytes});
    if(!upload.ok)return reply(409,'Derivative upload not confirmed');created=true;
   }else if(!existing.ok)return reply(503,'Storage unavailable');
   const stored=created?await read():existing;if(!stored.ok)return reply(503,'Derivative verification unavailable');
   if(await sha256(await boundedBytes(stored.body,1048576))!==expected)return reply(409,'Existing derivative differs; nothing overwritten');
   return Response.json({verified:true,width,sha256:expected,created},{headers:{'Cache-Control':'no-store'}});
  }catch{return reply(400,'Backfill could not be verified');}
 };
}
