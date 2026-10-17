import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryRecord,parseRecovery,canResumeRecovery,createRecoveryStore,clearRecoveryStorage} from '../systems/community/studio-recovery.mjs';
import {plainDocument} from '../systems/community/manuscript.mjs';
const owner='81000000-0000-0000-0000-000000000001',other='81000000-0000-0000-0000-000000000002',now=Date.parse('2026-10-18T00:00:00Z');
const values={title:'Recovered words',body_document:plainDocument('First words\n\n***\n\nLast words'),summary:'Private description',genres:['fantasy'],tags:['Magic'],drop_caps:true,scene_style:'diamond',warning_ids:['violence'],warning_reviewed:true,metadata:{}};
const story={id:owner,updated_at:'2026-10-17T23:00:00Z',status:'draft',scheduled_at:null};
function storage(){const map=new Map();return {map,get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('recovery roundtrip preserves safe manuscript/metadata, including untitled writing',()=>{
 const record=recoveryRecord(values,{ownerId:owner,story,now});const parsed=parseRecovery(JSON.stringify(record),{ownerId:owner,now});
 assert.deepEqual(parsed.values.body_document,values.body_document);assert.deepEqual(parsed.values.tags,['Magic']);assert.equal(parsed.values.drop_caps,true);assert.equal(parsed.values.scene_style,'diamond');
 assert.equal(recoveryRecord({...values,title:''},{ownerId:owner,now}).values.title,'');
 assert.throws(()=>recoveryRecord({...values,access_token:'private'},{ownerId:owner,now}),/Only content/);
});
test('untrusted or other-account recovery files cannot grant access or inject manuscript HTML',()=>{
 const record=recoveryRecord(values,{ownerId:owner,story,now});
 for(const raw of ['{broken',JSON.stringify({...record,owner:other}),JSON.stringify({...record,format:'other'}),JSON.stringify({...record,source_id:'not-a-uuid'}),JSON.stringify({...record,values:{...record.values,body_document:{version:1,blocks:[{type:'paragraph',html:'<script>bad()</script>'}]}}})])assert.throws(()=>parseRecovery(raw,{ownerId:owner,now}));
 assert.throws(()=>parseRecovery('x'.repeat(1024*1024+1),{ownerId:owner,now}),/1 MiB/);
});
test('only an unchanged unscheduled draft can be resumed in place; published/stale work requires a copy',()=>{
 const record=recoveryRecord(values,{ownerId:owner,story,now});assert.equal(canResumeRecovery(record,story),true);
 for(const change of [{id:other},{updated_at:'newer'},{status:'published'},{status:'archived'},{scheduled_at:'2026-11-01T00:00:00Z'}])assert.equal(canResumeRecovery(record,{...story,...change}),false);
});
test('tab recovery is explicit, survives store recreation, expires and can be discarded without touching unrelated data',()=>{
 const s=storage(),record=recoveryRecord(values,{ownerId:owner,story,now}),store=createRecoveryStore(s,{ownerId:owner,now:()=>now});
 s.setItem('account-token','unrelated');assert.equal(store.enabled,false);assert.equal(store.write(record),false);
 assert.equal(store.enable(true),true);assert.equal(store.write(record),true);
 const reloaded=createRecoveryStore(s,{ownerId:owner,now:()=>now});assert.deepEqual(reloaded.read(),record);
 assert.equal(createRecoveryStore(s,{ownerId:other,now:()=>now}).read(),null);
 assert.equal(store.write({...record,owner:other}),false);
 assert.equal(createRecoveryStore(s,{ownerId:owner,now:()=>now+25*60*60*1000}).read(),null);
 store.write(record);assert.equal(store.enable(false),true);assert.equal(store.read(),null);assert.equal(s.getItem('account-token'),'unrelated');
});
test('portable recovery files remain importable after tab expiry; blocked/quota storage never claims to save',()=>{
 const record=recoveryRecord(values,{ownerId:owner,story,now});
 assert.throws(()=>parseRecovery(JSON.stringify(record),{ownerId:owner,now:now+25*60*60*1000}),/expired/);
 assert.equal(parseRecovery(JSON.stringify(record),{ownerId:owner,now:now+25*60*60*1000,checkAge:false}).values.title,values.title);
 const blocked={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};
 const store=createRecoveryStore(blocked,{ownerId:owner});assert.equal(store.enable(true),false);assert.equal(store.write(record),false);assert.equal(store.read(),null);assert.doesNotThrow(()=>store.clear());
 const s=storage(),full=createRecoveryStore(s,{ownerId:owner});full.enable(true);s.setItem=()=>{throw Error('quota');};assert.equal(full.write(record),false);
});
test('account switching clears only Studio recovery namespaces',()=>{
 const s=storage();s.setItem('account-token','keep');for(const id of [owner,other]){const store=createRecoveryStore(s,{ownerId:id,now:()=>now});store.enable(true);store.write(recoveryRecord(values,{ownerId:id,now}));}
 clearRecoveryStorage(s,owner);assert.ok(createRecoveryStore(s,{ownerId:owner,now:()=>now}).read());assert.equal(createRecoveryStore(s,{ownerId:other,now:()=>now}).read(),null);
 clearRecoveryStorage(s);assert.equal(s.length,1);assert.equal(s.getItem('account-token'),'keep');
});

test('recovery can repair a repeated genre without losing manuscript formatting',()=>{
 const record=recoveryRecord({...values,genres:['fantasy','fantasy']},{ownerId:owner,now});
 assert.deepEqual(record.values.genres,['fantasy']);assert.deepEqual(record.values.body_document,values.body_document);
 const textOnly={...record,source_id:owner,base_version:story.updated_at,text_only:true};
 assert.equal(parseRecovery(JSON.stringify(textOnly),{ownerId:owner,now}).text_only,true);assert.equal(canResumeRecovery(textOnly,story),false);
});
