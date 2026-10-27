import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStorage, createBrowserSessionStorage, SESSION_KEY } from '../account/session-storage.mjs';
import { watchSessionEnd } from '../account/session-events.mjs';
import { restoreSession, restoredIdentity, invalidateSessionRestoration } from '../account/session-controller.mjs';

function fakeStorage() {
  const data = new Map([['unrelated-theme', 'dark']]);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('Remembered sign-in is shared by new tabs and survives a fresh browser context', () => {
  const sharedStorage=fakeStorage();
  const first=createBrowserSessionStorage({namespace:'prod',sharedStorage,tabStorage:fakeStorage()});
  assert.equal(first.remembered,true);
  first.adapter.setItem(first.key,'synthetic remembered session');
  const next=createBrowserSessionStorage({namespace:'prod',sharedStorage,tabStorage:fakeStorage()});
  assert.equal(next.key,first.key);assert.equal(next.hasSession,true);
  assert.equal(next.adapter.getItem(next.key),'synthetic remembered session');
  next.clear();assert.equal(first.hasSession,false);
  assert.equal(sharedStorage.getItem('unrelated-theme'),'dark');
});

test('Unchecking persistence isolates the tab and never writes credentials to local storage', () => {
  const sharedStorage=fakeStorage(),tabStorage=fakeStorage();
  const first=createBrowserSessionStorage({namespace:'prod',remember:false,sharedStorage,tabStorage});
  first.adapter.setItem(first.key,'synthetic private tab session');
  const reload=createBrowserSessionStorage({namespace:'prod',sharedStorage,tabStorage});
  assert.equal(reload.key,first.key);assert.equal(reload.hasSession,true);assert.equal(reload.remembered,false);
  const next=createBrowserSessionStorage({namespace:'prod',sharedStorage,tabStorage:fakeStorage()});
  assert.equal(next.hasSession,false);assert.notEqual(next.key,first.key);
  assert.ok(![...sharedStorage.data.values()].includes('synthetic private tab session'));
});

test('Existing tab sessions migrate without silently becoming remembered or crossing projects', () => {
  const sharedStorage=fakeStorage(),tabStorage=fakeStorage();
  const old=createSessionStorage(tabStorage);old.adapter.setItem(old.key,'synthetic old session');
  const migrated=createBrowserSessionStorage({namespace:'prod',sharedStorage,tabStorage});
  assert.equal(migrated.hasSession,true);assert.equal(migrated.remembered,false);
  assert.equal(old.hasSession,false);
  assert.equal(createBrowserSessionStorage({namespace:'dev',sharedStorage,tabStorage:fakeStorage()}).hasSession,false);
  assert.ok(![...sharedStorage.data.values()].includes('synthetic old session'));
});

test('Unavailable persistent storage falls back to tab storage, then memory if both are blocked', () => {
  const blocked={setItem(){throw Error('blocked');}},tabStorage=fakeStorage();
  const tab=createBrowserSessionStorage({namespace:'prod',sharedStorage:blocked,tabStorage});
  assert.equal(tab.remembered,false);assert.equal(tab.persistent,true);
  tab.adapter.setItem(tab.key,'synthetic fallback');
  assert.equal(createBrowserSessionStorage({namespace:'prod',sharedStorage:blocked,tabStorage}).hasSession,true);
  const memory=createBrowserSessionStorage({namespace:'prod',sharedStorage:blocked,tabStorage:blocked});
  assert.equal(memory.persistent,false);memory.adapter.setItem(memory.key,'synthetic memory');assert.equal(memory.hasSession,true);
});

test('A removed shared credential is not resurrected from a stale in-memory fallback', () => {
  const backing=fakeStorage(),first=createSessionStorage(backing,{shared:true}),other=createSessionStorage(backing,{shared:true});
  first.adapter.setItem(first.key,'synthetic session');assert.equal(other.hasSession,true);
  first.clear();assert.equal(other.hasSession,false);
  backing.getItem=()=>{throw Error('blocked');};assert.equal(other.hasSession,false);
});

test('Cross-tab logout clears private UI via Auth or storage events, without touching unrelated keys', () => {
  const events=new EventTarget();let authListener,cleared=0,unsubscribed=false;
  const local={storage:{remembered:true,key:'fixture-auth'},client:{auth:{onAuthStateChange:fn=>{authListener=fn;return{data:{subscription:{unsubscribe(){unsubscribed=true;}}}};}}}};
  const dispose=watchSessionEnd(local,()=>cleared++,events);
  const storageEvent=(key,newValue)=>{const e=new Event('storage');Object.assign(e,{key,newValue});events.dispatchEvent(e);};
  storageEvent('theme',null);storageEvent('fixture-auth','synthetic refresh');assert.equal(cleared,0);
  storageEvent('fixture-auth',null);assert.equal(cleared,1);
  authListener('SIGNED_OUT');assert.equal(cleared,2);
  storageEvent(null,null);assert.equal(cleared,3);
  local.storage.remembered=false;storageEvent('fixture-auth',null);assert.equal(cleared,3);
  dispose();assert.equal(unsubscribed,true);
});

test('Tab storage survives a new adapter and clears only owned Auth keys', () => {
  const backing=fakeStorage();
  const first=createSessionStorage(backing);
  first.adapter.setItem(first.key,'synthetic SDK session');
  first.adapter.setItem(first.key+'-user','synthetic user');
  const next=createSessionStorage(backing);
  assert.equal(next.persistent,true);assert.equal(next.hasSession,true);
  assert.equal(next.adapter.getItem(next.key),'synthetic SDK session');
  assert.equal(next.key,first.key);
  next.clear();assert.equal(next.hasSession,false);
  assert.equal(backing.getItem('unrelated-theme'),'dark');
});

test('Unavailable or later-blocked storage falls back to page memory without throwing', () => {
  const blocked={setItem(){throw new Error('blocked');}};
  const session=createSessionStorage(blocked);
  assert.equal(session.persistent,false);
  session.adapter.setItem(session.key,'synthetic session');
  assert.equal(session.hasSession,true);
  session.clear();assert.equal(session.hasSession,false);
  const backing=fakeStorage();const runtime=createSessionStorage(backing);
  backing.setItem=()=>{throw new Error('quota');};
  assert.doesNotThrow(()=>runtime.adapter.setItem(runtime.key,'synthetic session'));
  assert.equal(runtime.persistent,false);assert.equal(runtime.hasSession,true);
});

test('Independent tabs use separate SDK event channels and old local cache migrates within its tab', () => {
  const firstBacking=fakeStorage();firstBacking.setItem(SESSION_KEY,'synthetic legacy session');
  const first=createSessionStorage(firstBacking);
  const other=createSessionStorage(fakeStorage());
  assert.notEqual(first.key,other.key);
  assert.equal(first.adapter.getItem(first.key),'synthetic legacy session');
  assert.equal(firstBacking.getItem(SESSION_KEY),null);
  assert.equal(createSessionStorage(firstBacking).key,first.key);
});

test('Restoration refreshes and verifies with the server, ignoring cached identity/roles', async () => {
  const calls=[];
  const result=await restoreSession({
    getSession:async()=>{calls.push('cache');return {data:{session:{user:{id:'forged',email:'forged@example.invalid',user_metadata:{role:'admin'}}}}};},
    refreshSession:async()=>{calls.push('refresh');return {data:{session:{}}};},
    getUser:async()=>{calls.push('user');return {data:{user:{id:'viewer',email:'reader@example.invalid'}}};},
  },true);
  assert.deepEqual(calls,['cache','refresh','user']);
  assert.deepEqual(result,{state:'signed-in',message:'You’re signed in.',email:'reader@example.invalid'});
});

test('Revoked/expired refresh tokens end the session and clear the local Auth cache', async () => {
  let cleared=false;
  const result=await restoreSession({getSession:async()=>({data:{session:{}}}),refreshSession:async()=>({error:{status:400,code:'session_expired'}}),signOut:async()=>({error:null})},true,()=>{cleared=true;});
  assert.equal(result.state,'session-ended');assert.equal(cleared,true);assert.equal(result.email,'');
});

test('Connection and rate failures are retryable and do not delete a potentially valid session', async () => {
  for(const error of [{status:503},{status:429},{}]) {
    let cleared=false;
    const result=await restoreSession({getSession:async()=>({data:{session:{}}}),refreshSession:async()=>({error})},true,()=>{cleared=true;});
    assert.equal(result.state,'session-unavailable');assert.equal(cleared,false);
    if (error.status === 429) assert.match(result.message,/Wait a moment/);
  }
});

test('Missing stored sessions are neutral for new visitors and informative after an SDK expiry cleanup', async () => {
  const auth={getSession:async()=>({data:{session:null}}),signOut:async()=>({error:null})};
  assert.equal((await restoreSession(auth,false)).state,'guest');
  assert.equal((await restoreSession(auth,true)).state,'session-ended');
});

test('Server user rejection cannot display cached identity, even when refreshing succeeded', async () => {
  let cleared=false;
  const result=await restoreSession({getSession:async()=>({data:{session:{}}}),refreshSession:async()=>({data:{session:{}}}),getUser:async()=>({error:{status:403}}),signOut:async()=>({error:null})},true,()=>{cleared=true;});
  assert.equal(result.state,'session-ended');assert.equal(cleared,true);
});

test('concurrent startup consumers share one refresh and verification; later checks verify again', async () => {
  let refreshes=0, users=0;
  const user={id:'verified-reader',email:'reader@example.invalid'};
  const auth={getSession:async()=>({data:{session:{}}}),refreshSession:async()=>{refreshes++;return {data:{session:{}}};},getUser:async()=>{users++;return {data:{user}};}};
  const results=await Promise.all(Array.from({length:4},()=>restoreSession(auth,true)));
  assert.ok(results.every(result=>result.state==='signed-in'));
  assert.equal(refreshes,1);assert.equal(users,1);
  assert.equal(restoredIdentity(auth),user);assert.equal(restoredIdentity(auth),user);
  await restoreSession(auth,true);assert.equal(refreshes,2);assert.equal(users,2);
});

test('shared revoked restoration clears every caller and transient failures can retry', async () => {
  let cleared=0, refreshes=0;
  const auth={getSession:async()=>({data:{session:{}}}),refreshSession:async()=>{refreshes++;return {error:{status:401}};},signOut:async()=>({error:null})};
  await Promise.all(Array.from({length:3},()=>restoreSession(auth,true,()=>cleared++)));
  assert.equal(cleared,3);assert.equal(refreshes,1);assert.equal(restoredIdentity(auth),null);
  auth.refreshSession=async()=>({error:{status:503}});
  assert.equal((await restoreSession(auth,true)).state,'session-unavailable');
  auth.refreshSession=async()=>({data:{session:{}}});auth.getUser=async()=>({data:{user:{id:'reader',email:'reader@example.invalid'}}});
  assert.equal((await restoreSession(auth,true)).state,'signed-in');
});

test('sign-out or account changes during a slow verification cannot restore stale identity', async () => {
  let finish;
  const auth={getSession:async()=>({data:{session:{}}}),refreshSession:async()=>({data:{session:{}}}),getUser:()=>new Promise(resolve=>finish=resolve)};
  const pending=restoreSession(auth,true);
  await new Promise(resolve=>setImmediate(resolve));
  invalidateSessionRestoration(auth);
  finish({data:{user:{id:'old-owner',email:'old@example.invalid'}}});
  assert.equal((await pending).state,'session-unavailable');assert.equal(restoredIdentity(auth),null);
  auth.getUser=async()=>({data:{user:{id:'new-owner',email:'new@example.invalid'}}});
  assert.equal((await restoreSession(auth,true)).state,'signed-in');
  invalidateSessionRestoration(auth);assert.equal(restoredIdentity(auth),null);
});
