import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFollowedIds} from '../systems/community/following-service.mjs';
const ids=Array.from({length:5000},(_,i)=>'bf000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
test('homepage following membership uses one IDs-only read for 100 or 5000 follows',async()=>{
 for(const count of [0,100,5000]){
  const calls=[];const data=ids.slice(0,count);
  const result=await loadFollowedIds({rpc:async(name,args)=>{calls.push({name,args});return {data};}});
  assert.deepEqual(calls,[{name:'fas_my_following_ids',args:{}}]);assert.deepEqual([...result],data);
 }
});
test('following IDs reject errors, profiles, malformed values and oversized results',async()=>{
 for(const response of [{error:{}},{data:null},{data:{}},{data:[{public_id:ids[0]}]},{data:['not-an-id']},{data:[...ids,ids[0]]}]){
  await assert.rejects(loadFollowedIds({rpc:async()=>response}),/Following could not be loaded/);
 }
 assert.deepEqual([...await loadFollowedIds({rpc:async()=>({data:[ids[0].toUpperCase(),ids[0]]})})],[ids[0]]);
});
test('ending an account view prevents reads and discards late membership responses',async()=>{
 let called=0,ended=true,finish;
 const client={rpc:()=>{called++;return new Promise(resolve=>finish=resolve);}};
 assert.equal((await loadFollowedIds(client,{isEnded:()=>ended})).size,0);assert.equal(called,0);
 ended=false;const pending=loadFollowedIds(client,{isEnded:()=>ended});ended=true;finish({data:ids.slice(0,100)});
 assert.equal((await pending).size,0);assert.equal(called,1);
});
