import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProfileAccount } from '../account/settings-controller.mjs';

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
