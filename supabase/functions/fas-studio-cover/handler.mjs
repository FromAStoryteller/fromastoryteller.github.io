const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function inspectRaster(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width,height;
 if(bytes.length>=24&&view.getUint32(0)===0x89504e47&&view.getUint32(4)===0x0d0a1a0a&&view.getUint32(12)===0x49484452){width=view.getUint32(16);height=view.getUint32(20);}
 else if(bytes.length>4&&view.getUint16(0)===0xffd8){let pos=2;while(pos+4<bytes.length){if(bytes[pos++]!==255)throw new Error('Invalid JPEG');while(bytes[pos]===255)pos++;const marker=bytes[pos++];if(marker===0xda||marker===0xd9)break;if(marker===1||marker>=0xd0&&marker<=0xd7)continue;const length=view.getUint16(pos);if(length<2||pos+length>bytes.length)throw new Error('Invalid JPEG');if([0xc0,0xc1,0xc2].includes(marker)){if(length<8)throw new Error('Invalid JPEG');height=view.getUint16(pos+3);width=view.getUint16(pos+5);break;}pos+=length;}}
 if(!width||!height||width>16384||height>16384||width*height>8000000)throw new Error('Choose a JPEG or PNG with at most 8 million pixels.');return {width,height};
}
async function limitedBody(request,max){const reader=request.body?.getReader();if(!reader)throw new Error('Image required');const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('Image upload too large');}chunks.push(value);}const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return data;}
export function makeCoverHandler({base,anonKey,serviceKey,origins,kind='cover'},normalize,fetcher=fetch){
 const profile=kind==='profile';
 const headers=origin=>({'Cache-Control':'no-store','Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'});
 return async request=>{
  const origin=request.headers.get('Origin');if(!origins?.includes(origin))return new Response('Origin unavailable',{status:403});
  const reply=(status,data)=>Response.json(data,{status,headers:headers(origin)});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});if(request.method!=='POST')return reply(405,{error:'POST required'});
  if(!base||!anonKey||!serviceKey||!request.headers.get('Authorization')?.startsWith('Bearer '))return reply(401,{error:'Sign in required'});
  const authorization=request.headers.get('Authorization'),call=async(path,{privileged=false,method='POST',body,bytes,contentType='application/json'}={})=>{const r=await fetcher(base+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:privileged?serviceKey:anonKey,Authorization:privileged?`Bearer ${serviceKey}`:authorization,...(method!=='GET'?{'Content-Type':contentType}:{})},body:bytes??(body?JSON.stringify(body):undefined)});return r;};
  let path,stored=false;
  try{
   const identity=await call('/auth/v1/user',{method:'GET'});if(!identity.ok)return reply(401,{error:'Sign in again'});const user=await identity.json();if(!uuid.test(user.id)||user.is_anonymous)return reply(401,{error:'Sign in required'});
   let session;try{const payload=authorization.slice(7).split('.')[1].replace(/-/g,'+').replace(/_/g,'/');session=JSON.parse(atob(payload.padEnd(Math.ceil(payload.length/4)*4,'='))).session_id;}catch{return reply(401,{error:'Session unavailable'});}if(!uuid.test(session??''))return reply(401,{error:'Session required'});
   if(!request.headers.get('Content-Type')?.startsWith('multipart/form-data'))return reply(400,{error:'Image form required'});
   const raw=await limitedBody(request,5*1024*1024+16384),form=await new Response(raw,{headers:{'Content-Type':request.headers.get('Content-Type')}}).formData();
   if([...form.keys()].some(k=>form.getAll(k).length!==1)||[...form.keys()].some(k=>!(profile?['image','alt','focus_x','focus_y','expected_version']:['story_id','image','alt','focus_x','focus_y']).includes(k)))return reply(400,{error:'Unexpected cover field'});
   const story=form.get('story_id'),alt=form.get('alt'),file=form.get('image'),x=Number(form.get('focus_x')??.5),y=Number(form.get('focus_y')??.5);
   if((profile?!uuid.test(form.get('expected_version')??''):!uuid.test(story??''))||typeof alt!=='string'||!alt.trim()||[...alt].length>500||!(file instanceof Blob)||!['image/jpeg','image/png'].includes(file.type)||file.size>5*1024*1024||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return reply(400,{error:'Valid image, description and crop required'});
   const context=await call('/rest/v1/rpc/'+(profile?'fas_begin_profile_upload':'fas_begin_cover_upload'),{body:profile?{}:{target_story:story}});if(!context.ok)return reply(403,{error:'Active contributor access to editable content required'});const owner=await context.json();if(owner.author_id!==user.id)return reply(403,{error:'Owner mismatch'});
   const bytes=new Uint8Array(await file.arrayBuffer());inspectRaster(bytes);const encoded=await normalize(bytes,{x,y});if(!(encoded instanceof Uint8Array)||encoded.length>5*1024*1024)return reply(400,{error:'Image normalization failed'});const dimensions=inspectRaster(encoded);if(encoded[0]!==255||encoded[1]!==216||dimensions.width!==(profile?512:1600)||dimensions.height!==(profile?512:900))return reply(400,{error:'Verified 16:9 crop required'});
   path=`${user.id}/${profile?owner.public_id:story}/${crypto.randomUUID()}.jpg`;
   const reserved=await call('/rest/v1/rpc/fas_reserve_image_upload',{privileged:true,body:{owner_key:user.id,session_key:session,image_path:path,image_kind:kind}});
   if(!reserved.ok)throw new Error('Upload reservation failed');
   const upload=await call('/storage/v1/object/fas-story-images/'+path,{privileged:true,bytes:encoded,contentType:'image/jpeg'});if(!upload.ok)return reply(503,{error:'Cover storage unavailable'});stored=true;
   const registered=await call('/rest/v1/rpc/'+(profile?'fas_register_profile_image':'fas_register_verified_cover'),{privileged:true,body:{...(profile?{expected_version:form.get('expected_version')}:{target_story:story}),owner_key:user.id,session_key:session,image_path:path,image_alt:alt.trim()}});
   if(!registered.ok)return reply(409,{error:'This image changed or access expired. Reload before trying again; the saved image is unchanged.'});const asset=await registered.json();stored=false;return reply(201,{asset});
  }catch{return reply(400,{error:'Image could not be processed. Use a JPEG or PNG up to 5 MiB and 8 million pixels.'});}
  finally{if(path)await call('/rest/v1/rpc/fas_abandon_image_upload',{privileged:true,body:{image_path:path}}).catch(()=>{});}
 };
}
