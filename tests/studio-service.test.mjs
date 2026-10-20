import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioService,validateStory,storySlug,StudioAccessError,StudioConflictError,canDeleteDraft,canArchiveStory,canRestoreStory,canDeleteArchivedStory} from '../systems/community/studio-service.mjs';
import {wordCount} from '../systems/community/studio-editor.mjs';
const owner='81000000-0000-0000-0000-000000000001';
const input={slug:'a-story',title:'A story',summary:'A description',body:'Once upon a time.',genre:'Fantasy',tags:'magic, discovery',content_warning:'',cover_asset_id:''};
function fixture(response={data:{id:owner},error:null}) {
 const calls=[];const query={};for(const key of ['select','eq','or','order','range','update','insert','delete','is'])query[key]=(...args)=>{calls.push([key,...args]);return query;};query.maybeSingle=async()=>response;query.single=async()=>response;query.then=(resolve,reject)=>Promise.resolve(response).then(resolve,reject);
 let account={user:{id:owner},state:'active',contributor:true};
 const service=createStudioService({rpc:async(name,args)=>{calls.push(['rpc',name,args]);return response;},from:table=>{calls.push(['from',table]);return query;}},{ownerId:owner,checkAccount:async()=>account});return {service,calls,account:value=>{account=value;}};
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

const deletable={id:owner,status:'draft',updated_at:'previous',slug_locked:false,published_at:null,scheduled_at:null};
test('draft deletion binds owner, version and never-published unscheduled state',async()=>{
 const f=fixture();await f.service.deleteDraft(deletable);assert.ok(f.calls.some(c=>c[0]==='delete'));
 for(const filter of [['eq','author_id',owner],['eq','id',owner],['eq','updated_at','previous'],['eq','status','draft'],['eq','slug_locked',false],['is','published_at',null],['is','scheduled_at',null]])assert.ok(f.calls.some(c=>JSON.stringify(c)===JSON.stringify(filter)));
 assert.ok(f.calls.some(c=>c[0]==='select'&&c[1]==='id'));
});
test('delete controls exclude unsaved, published, scheduled, previously published and locked content',async()=>{
 assert.equal(canDeleteDraft(deletable),true);
 for(const change of [{id:null},{status:'published'},{status:'archived'},{slug_locked:true},{published_at:'2026-10-01'},{scheduled_at:'2026-12-01'}]){const s={...deletable,...change};assert.equal(canDeleteDraft(s),false);const f=fixture();await assert.rejects(f.service.deleteDraft(s),/Only saved/);assert.equal(f.calls.length,0);}
});
test('deletion never reports success for stale, missing, rejected or mismatched rows',async()=>{
 for(const response of [{data:null,error:null},{data:{id:'other'},error:null}])await assert.rejects(fixture(response).service.deleteDraft(deletable),StudioConflictError);
 await assert.rejects(fixture({data:null,error:{code:'42501'}}).service.deleteDraft(deletable),/could not be deleted/);
 await assert.rejects(fixture().service.deleteDraft({...deletable,updated_at:null}),/Only saved/);
});
test('draft deletion checks current contributor identity and account state before querying',async()=>{
 for(const account of [{user:{id:owner},state:'active',contributor:false},{user:{id:owner},state:'deleting',contributor:true},{user:{id:'other'},state:'active',contributor:true}]){const f=fixture();f.account(account);await assert.rejects(f.service.deleteDraft(deletable),StudioAccessError);assert.equal(f.calls.length,0);}
});

test('lifecycle eligibility separates own archives from moderation locks and file-backed pages',()=>{
 assert.equal(canArchiveStory(deletable),true);assert.equal(canArchiveStory({...deletable,status:'published'}),true);
 assert.equal(canArchiveStory({...deletable,source_kind:'file'}),false);
 const archive={...deletable,status:'archived',author_archived_at:'2026-10-18'};
 assert.equal(canRestoreStory(archive),true);assert.equal(canDeleteArchivedStory(archive),true);
 assert.equal(canRestoreStory({...archive,author_archived_at:null}),false);assert.equal(canDeleteArchivedStory({...archive,author_archived_at:null}),false);
});
test('archive, restore and deletion use explicit version-bound server actions after reauthorization',async()=>{
 const previous={...deletable,title:'A story'},archived={...previous,status:'archived',author_archived_at:'2026-10-18'};
 for(const [action,old,data,title]of [['archive',previous,{id:owner,status:'archived',author_archived_at:'now'},'A story'],['restore',archived,{id:owner,status:'draft',author_archived_at:null},null],['delete',archived,{id:owner,deleted:true},'A story']]){
  const f=fixture({data,error:null});await f.service.lifecycle(old,action,title);const call=f.calls.find(c=>c[0]==='rpc');
  assert.equal(call[1],'fas_story_lifecycle');assert.deepEqual(call[2],{target_story:owner,expected_version:'previous',action,confirmation_title:title});
 }
});
test('lifecycle rejects stale, failed, mismatched or unconfirmed responses and never reports success',async()=>{
 const previous={...deletable,title:'A story'};
 await assert.rejects(fixture({data:null,error:{code:'P0002'}}).service.lifecycle(previous,'archive','A story'),StudioConflictError);
 await assert.rejects(fixture({data:null,error:{code:'42501'}}).service.lifecycle(previous,'archive','A story'),/could not finish/);
 for(const data of [null,{id:'other'},{id:owner,status:'draft'}])await assert.rejects(fixture({data,error:null}).service.lifecycle(previous,'archive','A story'),StudioConflictError);
 const f=fixture();await assert.rejects(f.service.lifecycle(previous,'archive','wrong'),/Confirm/);assert.equal(f.calls.length,0);
});
test('moderation, forged actions, removed roles and expired account verification cannot use lifecycle RPC',async()=>{
 const previous={...deletable,title:'A story'};
 for(const [old,action,title]of [[{...previous,status:'archived'},'restore',null],[{...previous,status:'archived'},'delete','A story'],[previous,'delete','A story'],[previous,'publish','A story']]){
  const f=fixture();await assert.rejects(f.service.lifecycle(old,action,title),/eligible/);assert.equal(f.calls.length,0);
 }
 for(const account of [{user:{id:owner},state:'active',contributor:false},{user:{id:'other'},state:'active',contributor:true},{user:{id:owner},state:'deleting',contributor:true}]){
  const f=fixture();f.account(account);await assert.rejects(f.service.lifecycle(previous,'archive','A story'),StudioAccessError);assert.equal(f.calls.length,0);
 }
});

test('admin shared-FAS saves retain the original author and cannot reattribute personal work',async()=>{
 const other='81000000-0000-0000-0000-000000000002',f=fixture({data:{id:owner,author_id:other,publishing_identity:'fas'},error:null});f.account({user:{id:owner},state:'active',contributor:true,admin:true});
 await f.service.save({...input,publishing_identity:'fas'},{id:owner,author_id:other,publishing_identity:'fas',updated_at:'previous'});
 assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='author_id'&&c[2]===other));
 await assert.rejects(f.service.save(input,{id:owner,author_id:other,publishing_identity:'personal',updated_at:'previous'}),StudioAccessError);
 await assert.rejects(f.service.save(input,{id:owner,author_id:other,publishing_identity:'fas',updated_at:'previous'}),StudioAccessError);
});
test('library requests keep their server-checked scope and pagination together',async()=>{
 const f=fixture({data:{items:[]},error:null});await f.service.list({scope:'fas',search:'Timer',type:'tool',cursor:{id:owner,updated_at:'previous'}});
 const rpc=f.calls.find(c=>c[0]==='rpc');assert.equal(rpc[1],'fas_studio_library');assert.deepEqual(rpc[2],{library_scope:'fas',search_text:'Timer',type_filter:'tool',state_filter:'',before_time:'previous',after_id:owner});
});

test('version restoration keeps current ownership, address, cover, publication and account-save contracts',async()=>{
 const id='82000000-0000-0000-0000-000000000001',previous={...validateStory(input),id:owner,author_id:owner,updated_at:'current',slug:'permanent-address',status:'published',cover_asset_id:id,publishing_identity:'fas'},snapshot={title:'Earlier title',body:'Earlier manuscript',body_document:null};
 const calls=[],q={update(v){calls.push(['update',v]);return this;},eq(...v){calls.push(['eq',...v]);return this;},select(){return this;},maybeSingle:async()=>({data:{...previous,title:snapshot.title}})};
 const client={from:()=>q,rpc:async(name,args)=>{calls.push([name,args]);return {data:{id,snapshot}};}};
 const service=createStudioService(client,{ownerId:owner,checkAccount:async()=>({user:{id:owner},state:'active',contributor:true,admin:true})});await service.restoreRevision(previous,id);
 const changed=calls.find(c=>c[0]==='update')[1];assert.equal(changed.title,snapshot.title);assert.equal(changed.body,snapshot.body);assert.equal(changed.cover_asset_id,previous.cover_asset_id);assert.equal(changed.publishing_identity,'fas');assert.equal(changed.status,'published');assert.equal('slug' in changed,false);assert.equal('author_id' in changed,false);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='updated_at'&&c[2]==='current'));
 const {starterPackage}=await import('../systems/community/interactive-package.mjs');previous.content_type='game';previous.executable_package=starterPackage();snapshot.executable_package=starterPackage();snapshot.executable_package.settings.saves=true;calls.length=0;await assert.rejects(service.restoreRevision(previous,id),/different account-save/);assert.ok(!calls.some(c=>c[0]==='update'));
});
