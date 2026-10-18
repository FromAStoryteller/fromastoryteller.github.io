// Claims tombstone paths before Storage I/O. No caller-provided prefix is used.
export async function cleanImages({base,serviceKey},fetcher=fetch,owner=null){
 const call=async(path,body,method='POST')=>{
  const r=await fetcher(base+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error('Image cleanup unavailable');return r;
 };
 const items=await (await call('/rest/v1/rpc/fas_claim_image_cleanup',{owner_key:owner})).json();
 let completed=0;
 for(const item of items){
  if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]+[.](jpg|jpeg|png|webp)$/.test(item.path)||!/^[-a-f0-9]{36}$/.test(item.lease))continue;
  try{
   await call('/storage/v1/object/fas-story-images',{prefixes:[item.path]},'DELETE');
   await call('/rest/v1/rpc/fas_ack_image_cleanup',{image_path:item.path,claim_key:item.lease});completed++;
  }catch{/* A durable lease expires for automatic retry; don't log paths or keys. */}
 }
 return {completed,pending:items.length-completed};
}
