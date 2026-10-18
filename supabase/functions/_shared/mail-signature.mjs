export async function verifyMailSignature(payload,headers,secret,now=Date.now()){
 try{
  const id=headers.get('svix-id'),stamp=headers.get('svix-timestamp'),signatures=headers.get('svix-signature');
  if(!id||id.length>200||!/^\d{10,12}$/.test(stamp??'')||!signatures||Math.abs(now/1000-Number(stamp))>300||!secret?.startsWith('whsec_'))return false;
  const bytes=Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0));
  if(bytes.length<16)return false;
  const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const entry of signatures.split(/\s+/)){
   if(!entry.startsWith('v1,'))continue;
   const signature=Uint8Array.from(atob(entry.slice(3)),c=>c.charCodeAt(0));
   if(await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(id+'.'+stamp+'.'+payload)))return true;
  }
 }catch{}return false;
}
export async function mailBody(request,max=131072){
 const reader=request.body?.getReader();if(!reader)throw new Error('Body required');let count=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>max){await reader.cancel();throw new Error('Body too large');}chunks.push(value);}
 const all=new Uint8Array(count);let offset=0;for(const part of chunks){all.set(part,offset);offset+=part.length;}return new TextDecoder().decode(all);
}
