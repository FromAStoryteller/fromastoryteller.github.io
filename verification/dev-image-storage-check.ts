import {cleanImages} from '../_shared/image-cleanup.mjs';
import {inspectRaster} from '../fas-studio-cover/handler.mjs';
const base=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY'),origin='http://127.0.0.1:55410';
Deno.serve(async request=>{
 if(base!=='https://oqmmvjjycpyxvxipcyli.supabase.co'||request.method!=='POST')return new Response('Unavailable',{status:404});
 const token=request.headers.get('X-FAS-Cleanup');if(!/^[a-f0-9-]{72}$/.test(token??''))return new Response('Unauthorized',{status:401});
 const auth=await fetch(base+'/rest/v1/rpc/fas_consume_cleanup_token',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({cleanup_token:token})});
 if(!auth.ok||await auth.json()!==true)return new Response('Unauthorized',{status:401});
 const users=[],storyIds=[],checks=[];let stage='fixture setup',failed=false,cleanup=true;
 const req=(path,{token=secret,body,method='POST',form=false}={})=>fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(25000),headers:{apikey:token===secret?secret:anon,Authorization:'Bearer '+token,Origin:origin,...(!form?{'Content-Type':'application/json'}:{}),Prefer:'return=representation'},body:form?body:body===undefined?undefined:JSON.stringify(body)});
 const good=async r=>{if(!r.ok)throw new Error('Request failed');return await r.json();};
 const rpc=(name,body,token=secret)=>req('/rest/v1/rpc/'+name,{body,token}).then(good);
 const check=(condition,label)=>{stage=label;if(!condition)throw new Error('Check failed');checks.push(label);};
 const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR4nGOIcpMjCTGMahgUGgA2zWrhijW97QAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0));
 const run=crypto.randomUUID();
 async function fixture(label,member){
  stage='fixture '+label+' policy';
  const release=await rpc('fas_current_policy_requirement',{},anon),email='fas-image-check-'+run+'-'+label+'@example.invalid',password='Image9!'+crypto.randomUUID()+crypto.randomUUID().slice(0,12);
  const metadata=release?{fas_policy_agreement:{mode:'published_terms_agreement',release_id:release.release_id,terms_version:release.terms_version,privacy_version:release.privacy_version,terms_sha256:release.terms_sha256,privacy_sha256:release.privacy_sha256,terms_agreed:true,privacy_notice_seen:true,age_16_or_over:true}}:{};
  stage='fixture '+label+' creation';
  const user=await good(await req('/auth/v1/admin/users',{body:{email,password,email_confirm:true,user_metadata:metadata}}));users.push(user.id);
  if(member)await good(await req('/rest/v1/user_roles',{body:{user_id:user.id,role:'member'}}));
  stage='fixture '+label+' sign-in';
  const session=await good(await req('/auth/v1/token?grant_type=password',{token:anon,body:{email,password}}));
  return {id:user.id,token:session.access_token};
 }
 async function upload(user,kind,version,story){
  const form=new FormData();form.set('image',new Blob([png],{type:'image/png'}),'synthetic.png');form.set('alt','A fictional wine and gold image');form.set('focus_x','0');form.set('focus_y','1');
  form.set(kind==='profile'?'expected_version':'story_id',kind==='profile'?version:story);
  return req('/functions/v1/'+(kind==='profile'?'fas-profile-upload':'fas-studio-cover'),{token:user.token,body:form,form:true});
 }
 const image=(kind,id,token=anon)=>req('/functions/v1/'+(kind==='profile'?'fas-profile-image':'fas-story-image')+'?asset_id='+id,{token,method:'GET'});
 const profilePath=async id=>(await good(await req('/rest/v1/profiles?id=eq.'+id+'&select=image_path',{method:'GET'})))[0].image_path;
 const bytes=path=>req('/storage/v1/object/authenticated/fas-story-images/'+path,{method:'GET'});
 try{
  const owner=await fixture('owner',true),other=await fixture('other',true),viewer=await fixture('viewer',false);
  stage='create owned draft';
  let story=(await good(await req('/rest/v1/stories',{token:owner.token,body:{author_id:owner.id,title:'Disposable image check '+run,summary:'A fictional description for private verification',body:'Fictional prose only.',genres:['fantasy'],warning_reviewed:true}})))[0];storyIds.push(story.id);
  stage='cover normalized upload';const cover=(await good(await upload(owner,'cover',null,story.id))).asset;
  check(cover.pixel_width===1600&&cover.pixel_height===900&&!!cover.verified_at&&!cover.approved_at,'cover verified 16:9 without approval');
  const coverPath=(await good(await req('/rest/v1/story_assets?id=eq.'+cover.id+'&select=object_path',{method:'GET'})))[0].object_path;
  check((await image('cover',cover.id)).status===404,'draft cover private');
  check((await image('cover',cover.id,owner.token)).status===200,'owned draft cover readable');
  check((await image('cover',cover.id,other.token)).status===404,'other contributor cover denied');
  const dims=inspectRaster(new Uint8Array(await (await bytes(coverPath)).arrayBuffer()));check(dims.width===1600&&dims.height===900,'stored cover bytes decoded as 1600 by 900');
  stage='raw storage upload denial';
  const raw=await fetch(base+'/storage/v1/object/fas-story-images/'+owner.id+'/'+story.id+'/'+crypto.randomUUID()+'.png',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+owner.token,'Content-Type':'image/png'},body:png});
  check(raw.status>=400,'raw byte upload cannot bypass normalizer');
  stage='publish cover';
  story=(await good(await req('/rest/v1/stories?id=eq.'+story.id+'&updated_at=eq.'+encodeURIComponent(story.updated_at),{method:'PATCH',token:owner.token,body:{cover_asset_id:cover.id,status:'published'}})))[0];
  check((await image('cover',cover.id)).status===200,'published selected cover public');
  story=(await good(await req('/rest/v1/stories?id=eq.'+story.id,{method:'PATCH',token:owner.token,body:{status:'draft'}})))[0];
  check((await image('cover',cover.id)).status===404,'unpublish revokes cover visibility');
  stage='remove selected cover denial';
  check((await req('/rest/v1/rpc/fas_change_cover_image',{token:owner.token,body:{target_story:story.id,asset_key:cover.id,expected_version:story.updated_at,image_alt:'Cover',remove_image:true}})).status>=400,'selected cover deletion refused');
  check((await req('/rest/v1/rpc/fas_change_cover_image',{token:other.token,body:{target_story:story.id,asset_key:cover.id,expected_version:story.updated_at,image_alt:'Tampered',remove_image:false}})).status>=400,'cross-owner cover mutation denied');
  stage='replace cover';const next=(await good(await upload(owner,'cover',null,story.id))).asset;
  story=(await good(await req('/rest/v1/stories?id=eq.'+story.id,{method:'PATCH',token:owner.token,body:{cover_asset_id:next.id}})))[0];
  story=await rpc('fas_change_cover_image',{target_story:story.id,asset_key:cover.id,expected_version:story.updated_at,image_alt:'Cover',remove_image:true},owner.token);
  await cleanImages({base,serviceKey:secret},fetch,owner.id);
  check((await bytes(coverPath)).status>=400,'unused cover bytes removed through Storage API');
  check((await image('cover',next.id,owner.token)).status===200,'replacement cover retained');
  stage='profile normalized upload';let own=await rpc('fas_my_profile_image',{},owner.token),first=(await good(await upload(owner,'profile',own.version))).asset;
  const firstPath=await profilePath(owner.id);let profileResponse=await image('profile',first.asset_id);
  check(profileResponse.status===200,'contributor profile image public');
  const square=inspectRaster(new Uint8Array(await profileResponse.arrayBuffer()));check(square.width===512&&square.height===512,'stored profile crop is 512 square');
  check((await req('/rest/v1/rpc/fas_profile_image_path',{token:anon,body:{asset_key:first.asset_id}})).status>=400,'public cannot resolve private profile paths');
  stage='stale profile replacement';
  check((await upload(owner,'profile',own.version)).status===409,'stale profile replacement refused');
  check((await image('profile',first.asset_id)).status===200,'stale replacement keeps saved bytes');
  stage='profile replacement';
  const second=(await good(await upload(owner,'profile',first.version))).asset;
  await cleanImages({base,serviceKey:secret},fetch,owner.id);
  check((await bytes(firstPath)).status>=400,'replaced profile bytes removed');
  check((await image('profile',first.asset_id)).status===404,'retired profile address revoked');
  check((await image('profile',second.asset_id)).status===200,'new profile address readable');
  stage='profile alt description';
  const edited=await rpc('fas_change_profile_image',{expected_version:second.version,image_alt:'An updated fictional portrait',remove_image:false},owner.token);
  check(edited.alt==='An updated fictional portrait','profile description saved');
  stage='viewer privacy';
  let privateProfile=await rpc('fas_my_profile_image',{},viewer.token);privateProfile=(await good(await upload(viewer,'profile',privateProfile.version))).asset;
  check((await image('profile',privateProfile.asset_id)).status===404,'viewer profile image private');
  check((await image('profile',privateProfile.asset_id,viewer.token)).status===200,'viewer reads own profile image');
  check((await image('profile',privateProfile.asset_id,other.token)).status===404,'other account cannot read viewer image');
  stage='viewer content export';
  const exported=await req('/functions/v1/fas-account-lifecycle',{token:viewer.token,body:{action:'export'}});
  check(exported.status===200&&exported.headers.get('Content-Type')?.includes('zip'),'viewer profile bytes included in owned-content ZIP');
  stage='session expiry';await req('/auth/v1/logout?scope=global',{token:owner.token});
  check((await upload(owner,'profile',edited.version)).status>=400,'expired session cannot replace profile');
  check((await image('profile',edited.asset_id)).status===200,'expired write retains public profile bytes');
 }catch{failed=true;}
 finally{
  for(const id of storyIds){try{const r=await req('/rest/v1/stories?id=eq.'+id,{method:'DELETE'});if(!r.ok)cleanup=false;}catch{cleanup=false;}}
  for(const id of users){try{const r=await req('/auth/v1/admin/users/'+id,{method:'DELETE'});if(!r.ok)cleanup=false;}catch{cleanup=false;}}
  for(const id of users){try{const r=await cleanImages({base,serviceKey:secret},fetch,id);if(r.pending)cleanup=false;
   const folders=await good(await req('/storage/v1/object/list/fas-story-images',{body:{prefix:id+'/',limit:100}}));if(folders.length)cleanup=false;
   const remaining=await good(await req('/rest/v1/profiles?id=eq.'+id+'&select=id',{method:'GET'}));if(remaining.length)cleanup=false;
  }catch{cleanup=false;}}
 }
 return Response.json({passed:!failed&&cleanup,stage:failed?stage:'complete',checks,cleanup_verified:cleanup},{status:!failed&&cleanup?200:500,headers:{'Cache-Control':'no-store'}});
});