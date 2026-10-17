// Disposable FAS DEV accounts only. Uses the same service as the browser editor.
// Never prints credentials/response bodies and never sends email.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {createClient} from '@supabase/supabase-js';
import {securityTarget,checkLegacyProjectKey} from './fas-security-target.mjs';
import {createStudioService,StudioAccessError,StudioConflictError} from '../systems/community/studio-service.mjs';
const {base}=securityTarget(['--hosted-dev'],process.env.FAS_TEST_CONFIRM);
const key=process.env.FAS_TEST_ANON_KEY,secret=process.env.FAS_TEST_SERVICE_KEY;
assert.ok(key&&secret,'Process-only DEV credentials required.');checkLegacyProjectKey(key,'anon');checkLegacyProjectKey(secret,'service_role');
const options={auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Origin:'http://127.0.0.1:55410'},fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(15000)])})}},setup=createClient(base,secret,options),anonymous=createClient(base,key,options);
function fixturePng(){
 const chunk=(name,data)=>{const type=Buffer.from(name),payload=Buffer.concat([type,data]);let crc=0xffffffff;for(const byte of payload){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}const length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([length,payload,checksum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(16,0);header.writeUInt32BE(9,4);header[8]=8;header[9]=2;const pixels=Buffer.alloc(9*(1+16*3));for(let y=0;y<9;y++)for(let x=0;x<16;x++){const at=y*49+1+x*3;pixels[at]=90;pixels[at+1]=70;pixels[at+2]=30;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
const run=randomUUID(),users=[],clients=[],storyIds=[];let stage='fixture setup',failed=false;
const good=result=>{assert.ok(!result.error,'Studio API request failed at '+stage);return result.data;};
async function fixture(label,contributor=true){
 const email=`fas-studio-${run}-${label}@example.invalid`,password='Studio9!'+randomBytes(32).toString('base64url');
 const release=good(await anonymous.rpc('fas_current_policy_requirement'));
 const metadata=release?{fas_policy_agreement:{mode:'published_terms_agreement',release_id:release.release_id,terms_version:release.terms_version,privacy_version:release.privacy_version,terms_sha256:release.terms_sha256,privacy_sha256:release.privacy_sha256,terms_agreed:true,privacy_notice_seen:true,age_16_or_over:true}}:{};
 const created=good(await setup.auth.admin.createUser({email,password,email_confirm:true,user_metadata:metadata})).user;users.push(created.id);
 if(contributor)good(await setup.from('user_roles').insert({user_id:created.id,role:'member'}));
 const client=createClient(base,key,options);clients.push(client);good(await client.auth.signInWithPassword({email,password}));
 return {id:created.id,client,service:createStudioService(client,{ownerId:created.id})};
}
const text={slug:'fas-studio-'+run,title:'Synthetic Studio story',summary:'Synthetic description',body:'Synthetic original prose',genre:'Fantasy',tags:['test','fiction'],warning_ids:['violence'],warning_reviewed:true,content_warning:'Violence',cover_asset_id:null};
try {
 const owner=await fixture('owner'),other=await fixture('other'),viewer=await fixture('viewer',false);
 stage='private draft creation';let saved=await owner.service.save(text,null);storyIds.push(saved.id);assert.equal(saved.status,'draft');assert.equal(saved.genre,text.genre);assert.ok(saved.slug);const catalogs=await owner.service.catalogs();assert.ok(catalogs.types.some(t=>t.id==='story'&&t.enabled));assert.deepEqual(saved.tags,text.tags);
 assert.equal(good(await anonymous.rpc('fas_public_story',{story_slug:saved.slug})),null);
 assert.ok((await owner.service.list()).items.some(row=>row.id===saved.id));
 const read=await owner.service.read(saved.id);assert.equal(read.story.body,text.body);assert.deepEqual(read.assets,[]);
 stage='owner and viewer denial';await assert.rejects(other.service.read(saved.id),StudioConflictError);await assert.rejects(viewer.service.list(),StudioAccessError);
 const tamper=await other.client.from('stories').update({genre:'Tampered'}).eq('id',saved.id).select('id');assert.ok(tamper.error||tamper.data.length===0);
 stage='private normalized cover upload';const asset=await owner.service.uploadCover(saved.id,new File([fixturePng()],'synthetic.png',{type:'image/png'}),'Synthetic private cover',{x:.5,y:.5});assert.equal(asset.pixel_width,1600);assert.equal(asset.pixel_height,900);assert.equal(asset.approved_at,null);const object=good(await setup.from('story_assets').select('object_path').eq('id',asset.id).single());const uploaded=good(await setup.storage.from('fas-story-images').download(object.object_path));const jpeg=new Uint8Array(await uploaded.arrayBuffer());assert.equal(jpeg[0],255);assert.equal(jpeg[1],216);
 stage='cover ownership and public approval';
 const otherText={...text,slug:text.slug+'-other'};const otherStory=await other.service.save(otherText,null);storyIds.push(otherStory.id);
 await assert.rejects(other.service.save({...otherText,cover_asset_id:asset.id},otherStory));
 saved=await owner.service.save({...text,cover_asset_id:asset.id},saved);assert.equal(saved.cover_asset_id,asset.id);assert.equal((await owner.service.read(saved.id)).assets[0].id,asset.id);
 stage='required cover clearance';await assert.rejects(owner.service.save({...text,cover_asset_id:asset.id},saved,'published'));good(await setup.from('story_assets').update({pixel_width:1600,pixel_height:900,approved_at:new Date().toISOString(),approved_by:owner.id}).eq('id',asset.id));
 stage='publication and live metadata';saved=await owner.service.save({...text,cover_asset_id:asset.id},saved,'published');let published=good(await anonymous.rpc('fas_public_story',{story_slug:saved.slug}));assert.equal(published.genre,'Fantasy');assert.equal(published.content_warning,text.content_warning);assert.equal(published.cover.asset_id,asset.id);assert.ok(!('author_id' in published));
 const original=saved;saved=await owner.service.save({...text,genre:'Mystery',genres:['mystery'],body:'Synthetic live edit',cover_asset_id:asset.id},saved,'published');assert.equal(good(await anonymous.rpc('fas_public_story',{story_slug:saved.slug})).body,'Synthetic live edit');
 stage='stale version rejection';await assert.rejects(owner.service.save(text,original,'published'),StudioConflictError);
 stage='unpublication';saved=await owner.service.save(text,saved,'draft');assert.equal(good(await anonymous.rpc('fas_public_story',{story_slug:saved.slug})),null);
 stage='scheduling';saved=await owner.service.save({...text,cover_asset_id:asset.id,scheduled_at:new Date(Date.now()+3600000).toISOString()},saved);assert.ok(saved.scheduled_at);assert.equal(good(await anonymous.rpc('fas_public_story',{story_slug:saved.slug})),null);saved=await owner.service.save(text,saved);assert.equal(saved.scheduled_at,null);
 stage='moderation lock';good(await setup.from('stories').update({status:'archived'}).eq('id',saved.id));await assert.rejects(owner.service.save(text,saved,'draft'));assert.equal((await owner.service.read(saved.id)).story.status,'archived');
 stage='contributor revocation';good(await setup.from('user_roles').delete().eq('user_id',owner.id).eq('role','member'));await assert.rejects(owner.service.list(),StudioAccessError);
 console.log('PASS DEV Studio creates/loads private drafts, preserves metadata, enforces required cleared 16:9 covers, schedules privately, self-publishes, saves live edits, rejects stale versions, unpublishes, respects moderation and contributor removal');
}catch {failed=true;console.error('FAIL DEV Story Studio at '+stage+'; confidential details suppressed.');}
finally {
 for(const client of clients)await client.auth.signOut({scope:'global'}).catch(()=>{});
 if(users.length){const owned=await setup.from('stories').select('id').in('author_id',users);if(owned.error)failed=true;for(const row of owned.data??[])if(!storyIds.includes(row.id))storyIds.push(row.id);}
 const objects=[];if(storyIds.length){const rows=await setup.from('story_assets').select('story_id,object_path').in('story_id',storyIds);if(rows.error)failed=true;for(const row of rows.data??[]){const parts=row.object_path.split('/');if(parts.length===3&&users.includes(parts[0])&&parts[1]===row.story_id&&/^[a-f0-9-]{36}\.jpg$/.test(parts[2]))objects.push(row.object_path);else failed=true;}}
 if(objects.length){const removed=await setup.storage.from('fas-story-images').remove(objects);if(removed.error)failed=true;else for(const path of objects){const check=await setup.storage.from('fas-story-images').download(path);if(!check.error)failed=true;}}
 for(const id of storyIds){const result=await setup.from('stories').delete().eq('id',id);if(result.error)failed=true;}
 for(const id of users){const result=await setup.auth.admin.deleteUser(id);if(result.error)failed=true;}
 if(users.length){const remaining=await setup.from('profiles').select('id').in('id',users);if(remaining.error||remaining.data?.length)failed=true;}
 if(storyIds.length){const remaining=await setup.from('stories').select('id').in('id',storyIds);if(remaining.error||remaining.data?.length)failed=true;}
 console.log(failed?'Studio API checks failed; inspect DEV fixture cleanup.':'Studio API fixture cleanup verified. Disposable cover bytes removed; no real accounts or files were targeted.');
}
process.exitCode=failed?1:0;
