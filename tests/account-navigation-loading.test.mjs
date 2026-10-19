import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAccount,loadProfileAccount} from '../account/settings-controller.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture({roles=['member'],state='active',roleError=null,identityError=null}={}){
 const profile=deferred(),declaration=deferred(),verified=deferred();
 const user={id:'verified-owner',email:'reader@example.invalid'};
 return {profile,declaration,verified,client:{auth:{refreshSession:async()=>({data:{session:{}}}),getUser:()=>verified.promise},
 from(table){return {select(){return this;},eq(){return this;},single(){return profile.promise;},then(resolve,reject){return Promise.resolve({data:roles.map(role=>({role})),error:roleError}).then(resolve,reject);}};},
 rpc(name){return name==='fas_my_account_state'?Promise.resolve({data:state}):name==='fas_my_registration_declaration'?declaration.promise:Promise.resolve({data:[]});}},verify(){verified.resolve(identityError?{error:identityError}:{data:{user}});}};
}
for(const loader of [loadAccount,loadProfileAccount])test(loader.name+' exposes verified navigation before slow profile or declaration requests finish',async()=>{
 const f=fixture(),visible=deferred();let calls=0,finished=false;
 const loading=loader(f.client,{onNavigation:access=>{calls++;visible.resolve(access);}}).then(value=>{finished=true;return value;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0,'cached identity never enables links');
 f.verify();const access=await visible.promise;assert.equal(access.contributor,true);assert.equal(access.admin,false);assert.equal(finished,false);
 f.profile.resolve({data:{display_name:'Reader',public_id:'public-profile'}});f.declaration.resolve({data:null});
 await loading;assert.equal(calls,1);
});
for(const options of [{roles:[]},{roles:['admin']},{state:'closing'},{roleError:{status:503}}])test('navigation handles '+JSON.stringify(options)+' without granting contributor access',async()=>{
 const f=fixture(options);let access;const loading=loadProfileAccount(f.client,{onNavigation:value=>access=value});f.verify();f.profile.resolve({data:{display_name:'Reader'}});
 if(options.roleError)await assert.rejects(loading);else await loading;
 if(options.state==='closing'||options.roleError)assert.equal(access,undefined);else {assert.equal(access.contributor,false);assert.equal(access.admin,options.roles.includes('admin'));}
});
test('a rejected server identity never emits navigation',async()=>{
 const f=fixture({identityError:{status:403}});let called=false;const loading=loadProfileAccount(f.client,{onNavigation:()=>called=true});f.verify();await assert.rejects(loading);assert.equal(called,false);
});
