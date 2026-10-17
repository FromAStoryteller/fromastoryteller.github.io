import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioService,validateStory,storySlug,StudioAccessError,StudioConflictError} from '../systems/community/studio-service.mjs';
import {wordCount} from '../systems/community/studio-editor.mjs';
const owner='81000000-0000-0000-0000-000000000001';
const input={slug:'a-story',title:'A story',summary:'A description',body:'Once upon a time.',genre:'Fantasy',tags:'magic, discovery',content_warning:'',cover_asset_id:''};
function fixture(response={data:{id:owner},error:null}) {
 const calls=[];const query={};for(const key of ['select','eq','order','range','update','insert'])query[key]=(...args)=>{calls.push([key,...args]);return query;};query.maybeSingle=async()=>response;query.single=async()=>response;query.then=(resolve,reject)=>Promise.resolve(response).then(resolve,reject);
 let account={user:{id:owner},state:'active',contributor:true};
 const service=createStudioService({from:table=>{calls.push(['from',table]);return query;}},{ownerId:owner,checkAccount:async()=>account});return {service,calls,account:value=>{account=value;}};
}
test('story input accepts bounded metadata and rejects ownership, status, markup fields and invalid covers',()=>{
 assert.deepEqual(validateStory(input).tags,['magic','discovery']);assert.equal(storySlug('Échos in the Dark!'),'echos-in-the-dark');assert.equal(wordCount(' One\n\n two '),'2 words');
 for(const changes of [{author_id:owner},{status:'published'},{body_html:'<script>'},{cover_asset_id:'https://example.com/image'},{tags:Array(13).fill('x')},{title:' '},{body:'x'.repeat(200001)}])assert.throws(()=>validateStory({...input,...changes}));
});
test('story updates bind the owner, ID and previous timestamp; database values confirm success',async()=>{
 const f=fixture({data:{id:owner,status:'draft',updated_at:'next'},error:null});const saved=await f.service.save(input,{id:owner,updated_at:'previous',status:'draft'});
 assert.equal(saved.updated_at,'next');for(const filter of [['eq','author_id',owner],['eq','id',owner],['eq','updated_at','previous']])assert.ok(f.calls.some(call=>JSON.stringify(call)===JSON.stringify(filter)));
 assert.equal(f.calls.find(call=>call[0]==='update')[1].status,'draft');
});
test('new stories are drafts; public writes require content and moderation locks cannot save',async()=>{
 const f=fixture();await f.service.save(input,null);assert.equal(f.calls.find(call=>call[0]==='insert')[1].author_id,owner);
 assert.equal('status' in f.calls.find(call=>call[0]==='insert')[1],false);
 await assert.rejects(f.service.save(input,null,'published'),/Save a draft/);
 await assert.rejects(f.service.save({...input,body:' '},{id:owner,updated_at:'x'},'published'),/manuscript/);
 await assert.rejects(f.service.save(input,{id:owner,status:'archived',updated_at:'x'}),/locked/);
});
test('zero rows, failed requests and duplicate addresses never report a successful save',async()=>{
 await assert.rejects(fixture({data:null,error:null}).service.save(input,{id:owner,updated_at:'x'}),StudioConflictError);
 await assert.rejects(fixture({data:null,error:{code:'23505'}}).service.save(input,null),/already in use/);
 await assert.rejects(fixture({data:null,error:{code:'42501'}}).service.save(input,null),/unsaved words remain here/);
});
test('role removal, account closure and identity changes stop reads and writes before querying stories',async()=>{
 for(const account of [{user:{id:owner},state:'active',contributor:false},{user:{id:owner},state:'deleting',contributor:true},{user:{id:'other'},state:'active',contributor:true}]){
  const f=fixture();f.account(account);await assert.rejects(f.service.save(input,null),StudioAccessError);assert.equal(f.calls.length,0);await assert.rejects(f.service.list(),StudioAccessError);
 }
});
