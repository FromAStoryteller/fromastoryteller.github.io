import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStorage, SESSION_KEY } from '../account/session-storage.mjs';
import { restoreSession } from '../account/session-controller.mjs';

function fakeStorage() {
  const data = new Map([['unrelated-theme', 'dark']]);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('Tab storage survives a new adapter and clears only owned Auth keys', () => {
  const backing=fakeStorage();
  const first=createSessionStorage(backing);
  first.adapter.setItem(SESSION_KEY,'synthetic SDK session');
  first.adapter.setItem(SESSION_KEY+'-user','synthetic user');
  const next=createSessionStorage(backing);
  assert.equal(next.persistent,true);assert.equal(next.hasSession,true);
  assert.equal(next.adapter.getItem(SESSION_KEY),'synthetic SDK session');
  next.clear();assert.equal(next.hasSession,false);
  assert.equal(backing.getItem('unrelated-theme'),'dark');
});

test('Unavailable or later-blocked storage falls back to page memory without throwing', () => {
  const blocked={setItem(){throw new Error('blocked');}};
  const session=createSessionStorage(blocked);
  assert.equal(session.persistent,false);
  session.adapter.setItem(SESSION_KEY,'synthetic session');
  assert.equal(session.hasSession,true);
  session.clear();assert.equal(session.hasSession,false);
  const backing=fakeStorage();const runtime=createSessionStorage(backing);
  backing.setItem=()=>{throw new Error('quota');};
  assert.doesNotThrow(()=>runtime.adapter.setItem(SESSION_KEY,'synthetic session'));
  assert.equal(runtime.persistent,false);assert.equal(runtime.hasSession,true);
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
