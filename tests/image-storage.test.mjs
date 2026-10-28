import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCoverHandler} from '../supabase/functions/fas-studio-cover/handler.mjs';
import {makeImageHandler} from '../supabase/functions/fas-story-image/handler.mjs';
import {cleanImages} from '../supabase/functions/_shared/image-cleanup.mjs';
import {makeCleanupHandler} from '../supabase/functions/fas-image-cleanup/handler.mjs';
import {profileImageUrl,createProfileImageService} from '../systems/community/profile-image-service.mjs';
import {squareCrop} from '../systems/community/profile-image-editor.mjs';
const owner='81000000-0000-0000-0000-000000000001',publicId='82000000-0000-0000-0000-000000000001',version='83000000-0000-0000-0000-000000000001';
const jwt='h.'+Buffer.from(JSON.stringify({session_id:version})).toString('base64url')+'.s';
const jpeg=(width=512,height=512)=>new Uint8Array([255,216,255,192,0,8,8,height>>8,height&255,width>>8,width&255,1,255,217]);
const config={base:'https://fixture.invalid',anonKey:'anon-fixture',serviceKey:'service-fixture',origins:['https://site.invalid'],kind:'profile'};
function request({alt='A fictional portrait',type='image/jpeg',bytes=jpeg(),duplicate=false}={}){
 const body=new FormData();body.set('image',new Blob([bytes],{type}),'image.jpg');body.set('alt',alt);body.set('expected_version',version);
 if(duplicate)body.append('alt','duplicate');
 return new Request(config.base,{method:'POST',headers:{Origin:config.origins[0],Authorization:'Bearer '+jwt},body});
}
function uploadFixture({register=true,normalize=async()=>jpeg()}={}){
 const calls=[];const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:owner});
  if(url.endsWith('fas_begin_profile_upload'))return Response.json({author_id:owner,public_id:publicId});
  if(url.endsWith('fas_reserve_image_upload'))return Response.json(true);
  if(url.includes('/storage/'))return Response.json({});
  if(url.endsWith('fas_register_profile_image'))return Response.json({asset_id:publicId,version},{status:register?200:409});
  if(url.endsWith('fas_abandon_image_upload'))return Response.json(register?false:true);
  throw new Error('Unexpected request');
 };return {calls,handler:makeCoverHandler(config,normalize,fetcher)};
}
test('profile upload reserves an immutable owned path, requires a version and rechecks session on registration',async()=>{
 const f=uploadFixture();assert.equal((await f.handler(request())).status,201);
 const reserve=JSON.parse(f.calls.find(c=>c.url.endsWith('fas_reserve_image_upload')).options.body);
 assert.equal(reserve.owner_key,owner);assert.equal(reserve.session_key,version);assert.equal(reserve.image_kind,'profile');assert.ok(reserve.image_path.startsWith(owner+'/'+publicId+'/'));
 const registered=JSON.parse(f.calls.find(c=>c.url.endsWith('fas_register_profile_image')).options.body);assert.equal(registered.expected_version,version);assert.equal(registered.image_path,reserve.image_path);
 assert.ok(!f.calls.some(c=>c.options.method==='DELETE'));
});
test('profile uploads reject unsupported, malformed, oversized-dimension and duplicate fields before storage',async()=>{
 for(const input of [{type:'image/svg+xml'},{alt:''},{bytes:jpeg(4000,4000)},{duplicate:true}]){
  const f=uploadFixture();assert.equal((await f.handler(request(input))).status,400);assert.ok(!f.calls.some(c=>c.url.includes('/storage/')));
 }
 const f=uploadFixture({normalize:async()=>jpeg(1600,900)});assert.equal((await f.handler(request())).status,400);
});
test('stale profile replacement cannot blindly delete a possibly registered image',async()=>{
 const f=uploadFixture({register:false});assert.equal((await f.handler(request())).status,409);assert.ok(f.calls.some(c=>c.url.endsWith('fas_abandon_image_upload')));assert.ok(!f.calls.some(c=>c.options.method==='DELETE'));
});
test('profile reader checks visibility again after bytes arrive and never exposes private paths',async()=>{
 for(const revoke of [false,true]){
  let reads=0;const handler=makeImageHandler(config,async url=>{
   if(url.includes('fas_visible_profile_image'))return Response.json(!(++reads===2&&revoke));
   if(url.includes('fas_profile_image_path'))return Response.json(owner+'/'+publicId+'/'+version+'.jpg');
   return new Response(jpeg(),{headers:{'Content-Type':'image/jpeg'}});
  });
  const r=await handler(new Request(config.base+'?asset_id='+publicId));assert.equal(r.status,revoke?404:200);assert.match(r.headers.get('Cache-Control'),/no-store/);
 }
});
test('cleanup removes only claimed exact paths; failed Storage deletes retain a retryable lease',async()=>{
 const path=owner+'/'+publicId+'/'+version+'.jpg';const calls=[];
 const result=await cleanImages(config,async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  if(url.endsWith('fas_claim_image_cleanup'))return Response.json([{path,lease:version},{path:'../other-user',lease:version}]);
  if(options.method==='DELETE')return Response.json({});
  return Response.json(true);
 });assert.equal(result.completed,1);assert.deepEqual(calls.find(c=>c.url.includes('/storage/')).body,{prefixes:[path,...[480,800,1200,1600,2400].map(w=>path.replace('.jpg','-'+w+'.jpg'))]});
 let ack=false;const failed=await cleanImages(config,async(url,options)=>{
  if(url.endsWith('fas_claim_image_cleanup'))return Response.json([{path,lease:version}]);
  if(options.method==='DELETE')return Response.json({},{status:503});
  ack=true;return Response.json(true);
 });assert.equal(failed.pending,1);assert.equal(ack,false);
});
test('cleanup endpoint requires an unexpired one-use token before claiming any objects',async()=>{
 let claims=0;const handler=makeCleanupHandler(config,async url=>{if(url.endsWith('fas_consume_cleanup_token'))return Response.json(false);claims++;return Response.json([]);});
 assert.equal((await handler(new Request(config.base,{method:'POST'}))).status,401);
 assert.equal((await handler(new Request(config.base,{method:'POST',headers:{'X-FAS-Cleanup':version+version}}))).status,401);assert.equal(claims,0);
});
test('square geometry and image URLs are bounded, and changed accounts stop image mutations',async()=>{
 assert.deepEqual(squareCrop(800,400,100,0),{x:400,y:0,width:400,height:400,travelX:400,travelY:0});
 assert.equal(profileImageUrl({asset_id:publicId},'https://attacker.invalid/functions/v1/fas-story-image'),'');
 assert.match(profileImageUrl({asset_id:publicId},'https://oqmmvjjycpyxvxipcyli.supabase.co/functions/v1/fas-story-image'),/fas-profile-image/);
 const client={auth:{getUser:async()=>({data:{user:{id:publicId}}})},rpc:()=>{throw new Error('Must not mutate');}};
 await assert.rejects(createProfileImageService(client,{ownerId:owner}).change(version,'Description'),/session changed/);
});
