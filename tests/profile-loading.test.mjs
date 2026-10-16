import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAccount, loadProfileAccount } from '../account/settings-controller.mjs';
import { restoreSession, takeRestoredIdentity } from '../account/session-controller.mjs';

test('profile loading runs independent requests together and skips unrelated account history',async()=>{
  const pending=[];
  const calls=[];
  const request=(name,data)=>{calls.push(name);return new Promise(resolve=>pending.push(()=>resolve({data,error:null})));};
  const client={auth:{refreshSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{id:'owner'}}})},
    from(table){const query={select(){return query;},eq(_key,id){assert.equal(id,'owner');return query;},single(){return request(table,{display_name:'Alex',public_id:'public'});},then(resolve,reject){return request(table,[{role:'member'}]).then(resolve,reject);}};return query;},
    rpc(name){return request(name,'active');}};
  const loading=loadProfileAccount(client);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(calls.sort(),['fas_my_account_state','profiles','user_roles']);
  assert.equal(pending.length,3);
  pending.forEach(resolve=>resolve());
  const account=await loading;
  assert.equal(account.role,'member');
  assert.equal(account.state,'active');
});

test('revoked sessions stop profile queries before any private data is requested',async()=>{
  const client={auth:{refreshSession:async()=>({error:new Error('revoked')})},from(){throw new Error('Private query must not run');}};
  await assert.rejects(loadProfileAccount(client),/session has ended/);
});

test('server-verified restoration can be consumed once and a later failed restoration clears it',async()=>{
  const user={id:'owner',email:'owner@example.invalid'};
  let revoked=false;
  const auth={getSession:async()=>({data:{session:{user:{id:'untrusted-cache'}}}}),
    refreshSession:async()=>revoked?{error:{status:401}}:{data:{session:{}}},
    getUser:async()=>({data:{user}}),signOut:async()=>({error:null})};
  await restoreSession(auth,true);
  assert.equal(takeRestoredIdentity(auth),user);
  assert.equal(takeRestoredIdentity(auth),null);
  await restoreSession(auth,true);
  revoked=true;
  assert.equal((await restoreSession(auth,true)).state,'session-ended');
  assert.equal(takeRestoredIdentity(auth),null);
});

test('settings skips unused policy history while full account/export loading keeps it',async()=>{
  for (const includePolicyHistory of [false,true]) {
    const calls=[];
    const client={auth:{refreshSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{id:'owner'}}})},
      from(table){const query={select(){return query;},eq(){return query;},single:async()=>({data:{display_name:'Alex'}}),then(resolve,reject){return Promise.resolve({data:[{role:'member'}]}).then(resolve,reject);}};return query;},
      rpc:async name=>{calls.push(name);return {data:name==='fas_my_policy_agreements'?[]:name==='fas_my_account_state'?'active':null};}};
    await loadAccount(client,includePolicyHistory?{}:{includePolicyHistory:false});
    assert.equal(calls.includes('fas_my_policy_agreements'),includePolicyHistory);
  }
});
