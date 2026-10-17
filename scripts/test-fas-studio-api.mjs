// Disposable FAS DEV accounts only. Uses the same service as the browser editor.
// Never prints credentials/response bodies and never sends email.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {securityTarget,checkLegacyProjectKey} from './fas-security-target.mjs';
import {createStudioService,StudioAccessError,StudioConflictError} from '../systems/community/studio-service.mjs';
const {base}=securityTarget(['--hosted-dev'],process.env.FAS_TEST_CONFIRM);
const key=process.env.FAS_TEST_ANON_KEY,secret=process.env.FAS_TEST_SERVICE_KEY;
assert.ok(key&&secret,'Process-only DEV credentials required.');checkLegacyProjectKey(key,'anon');checkLegacyProjectKey(secret,'service_role');
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(15000)])})}},setup=createClient(base,secret,options),anonymous=createClient(base,key,options);
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
const text={slug:'fas-studio-'+run,title:'Synthetic Studio story',summary:'Synthetic description',body:'Synthetic original prose',genre:'Fantasy',tags:['test','fiction'],content_warning:'Synthetic warning',cover_asset_id:null};
try {
 const owner=await fixture('owner'),other=await fixture('other'),viewer=await fixture('viewer',false);
 stage='private draft creation';let saved=await owner.service.save(text,null);storyIds.push(saved.id);assert.equal(saved.status,'draft');assert.equal(saved.genre,text.genre);assert.deepEqual(saved.tags,text.tags);
 assert.equal(good(await anonymous.rpc('fas_public_story',{story_slug:text.slug})),null);
 assert.ok((await owner.service.list()).some(row=>row.id===saved.id));
 const read=await owner.service.read(saved.id);assert.equal(read.story.body,text.body);assert.deepEqual(read.assets,[]);
 stage='owner and viewer denial';await assert.rejects(other.service.read(saved.id),StudioConflictError);await assert.rejects(viewer.service.list(),StudioAccessError);
 const tamper=await other.client.from('stories').update({genre:'Tampered'}).eq('id',saved.id).select('id');assert.ok(tamper.error||tamper.data.length===0);
 stage='cover ownership and public approval';const asset=good(await owner.client.from('story_assets').insert({story_id:saved.id,object_path:`${owner.id}/${saved.id}/${randomUUID()}.png`,alt_text:'Synthetic private cover'}).select('id').single());
 const otherText={...text,slug:text.slug+'-other'};const otherStory=await other.service.save(otherText,null);storyIds.push(otherStory.id);
 await assert.rejects(other.service.save({...otherText,cover_asset_id:asset.id},otherStory));
 saved=await owner.service.save({...text,cover_asset_id:asset.id},saved);assert.equal(saved.cover_asset_id,asset.id);assert.equal((await owner.service.read(saved.id)).assets[0].id,asset.id);
 stage='publication and live metadata';saved=await owner.service.save({...text,cover_asset_id:asset.id},saved,'published');let published=good(await anonymous.rpc('fas_public_story',{story_slug:text.slug}));assert.equal(published.genre,'Fantasy');assert.equal(published.content_warning,text.content_warning);assert.equal(published.cover,null);assert.ok(!('author_id' in published));
 const original=saved;saved=await owner.service.save({...text,genre:'Mystery',body:'Synthetic live edit',cover_asset_id:asset.id},saved,'published');assert.equal(good(await anonymous.rpc('fas_public_story',{story_slug:text.slug})).body,'Synthetic live edit');
 stage='stale version rejection';await assert.rejects(owner.service.save(text,original,'published'),StudioConflictError);
 stage='unpublication';saved=await owner.service.save(text,saved,'draft');assert.equal(good(await anonymous.rpc('fas_public_story',{story_slug:text.slug})),null);
 stage='moderation lock';good(await setup.from('stories').update({status:'archived'}).eq('id',saved.id));await assert.rejects(owner.service.save(text,saved,'draft'));assert.equal((await owner.service.read(saved.id)).story.status,'archived');
 stage='contributor revocation';good(await setup.from('user_roles').delete().eq('user_id',owner.id).eq('role','member'));await assert.rejects(owner.service.list(),StudioAccessError);
 console.log('PASS DEV Studio creates/loads private drafts, preserves metadata, selects only own covers, self-publishes, saves live edits, rejects stale versions, unpublishes, respects moderation and contributor removal');
}catch {failed=true;console.error('FAIL DEV Story Studio at '+stage+'; confidential details suppressed.');}
finally {
 for(const client of clients)await client.auth.signOut({scope:'global'}).catch(()=>{});
 if(users.length){const owned=await setup.from('stories').select('id').in('author_id',users);if(owned.error)failed=true;for(const row of owned.data??[])if(!storyIds.includes(row.id))storyIds.push(row.id);}
 for(const id of storyIds){const result=await setup.from('stories').delete().eq('id',id);if(result.error)failed=true;}
 for(const id of users){const result=await setup.auth.admin.deleteUser(id);if(result.error)failed=true;}
 if(users.length){const remaining=await setup.from('profiles').select('id').in('id',users);if(remaining.error||remaining.data?.length)failed=true;}
 if(storyIds.length){const remaining=await setup.from('stories').select('id').in('id',storyIds);if(remaining.error||remaining.data?.length)failed=true;}
 console.log(failed?'Studio API checks failed; inspect DEV fixture cleanup.':'Studio API fixture cleanup verified. No Storage bytes or real accounts were targeted.');
}
process.exitCode=failed?1:0;
