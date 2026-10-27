import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../account/presentation-startup.js',import.meta.url),'utf8');
const prefix='fas-account-vzdicnufhidelaoeqbza-supabase-co',tab='aa000000-0000-4000-8000-000000000001';
const session=JSON.stringify({user:{id:'reader'},access_token:'presentation-only-not-a-verified-token'});
function paint({shared={},local={},pathname='/',origin='https://fromastoryteller.com',blocked=false}={}){
 const dataset={};
 const storage=values=>({getItem(key){if(blocked)throw Error('storage blocked');return values[key]??null;}});
 runInNewContext(source,{location:{origin,pathname},sessionStorage:storage(local),localStorage:storage(shared),document:{documentElement:{dataset}}});
 return dataset;
}
test('remembered credentials reserve account and home presentation before any auth modules load',()=>{
 assert.deepEqual(paint({shared:{[prefix+'-remembered']:session}}),{fasAccountStartup:'pending',fasHomeStartup:'pending'});
 assert.deepEqual(paint({shared:{[prefix+'-remembered']:session},pathname:'/account/profile/'}),{fasAccountStartup:'pending'});
});
test('active tab persistence takes precedence over another remembered account',()=>{
 const shared={[prefix+'-remembered']:session},local={[prefix+'-mode']:'tab',[prefix+'-tab-id']:tab};
 assert.deepEqual(paint({shared,local}),{});
 local[prefix+'-'+tab]=session;
 assert.equal(paint({shared,local}).fasHomeStartup,'pending');
});
test('guests, malformed hints, other origins and blocked storage keep the public first paint',()=>{
 for(const options of [{},{blocked:true},{shared:{[prefix+'-remembered']:'broken'}},{shared:{[prefix+'-remembered']:'{}'}},{shared:{[prefix+'-remembered']:session},origin:'https://preview.workers.dev'}])assert.deepEqual(paint(options),{});
});
