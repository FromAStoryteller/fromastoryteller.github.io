import test from 'node:test';import assert from 'node:assert/strict';
import {makePageViewHandler} from '../supabase/functions/fas-page-view/handler.mjs';
import {trafficSource} from '../systems/privacy/audience-insights.mjs';
import {parseChoice,setChoice} from '../systems/privacy/storage-choice.mjs';
const id='81000000-0000-4000-8000-000000000001',config={base:'https://db.invalid',anonKey:'sb_publishable_fixture' ,serviceKey:'private-service-key',origins:['https://site.invalid']};
function request(data={kind:'profile',id,source:'social',device:'mobile',consent:true},headers={}){return new Request('https://db.invalid/functions/v1/fas-page-view',{method:'POST',headers:{Origin:'https://site.invalid',apikey:'sb_publishable_fixture' ,Authorization:'Bearer sb_publishable_fixture','Content-Type':'application/json',...headers},body:JSON.stringify(data)});}
test('page-view ingestion passes only bounded anonymous dimensions to a service-only counter',async()=>{
 const calls=[],handler=makePageViewHandler({...config,fetcher:async(url,options)=>{if(!url.endsWith('/auth/v1/settings'))calls.push({url,options});return Response.json(true);}});
 assert.equal((await handler(request())).status,204);assert.equal(calls.length,1);
 assert.deepEqual(JSON.parse(calls[0].options.body),{page_kind:'profile',page_key:id,source_key:'social',device_key:'mobile'});
 assert.equal(calls[0].options.headers.Authorization,'Bearer private-service-key');
 for(const data of [{kind:'profile',id,source:'social',device:'mobile',consent:false},{kind:'profile',id,source:'https://private.invalid/query',device:'mobile',consent:true},{kind:'profile',id,source:'social',device:'mobile',consent:true,email:'private@example.invalid'},{kind:'content',id:'not-a-page',source:'direct',device:'desktop',consent:true}])assert.equal((await handler(request(data))).status,400);
 assert.equal((await handler(request(undefined,{Origin:'https://evil.invalid'}))).status,403);
 assert.equal((await handler(request(undefined,{Authorization:'Bearer account-session'}))).status,401);
 assert.equal((await handler(request(undefined,{'User-Agent':'Googlebot'}))).status,204);
 assert.equal(calls.length,1);assert.equal((await handler(request({padding:'x'.repeat(600)}))).status,400);
});
test('known referrers become broad groups without query strings or path storage',()=>{
 assert.equal(trafficSource('https://www.google.co.nz/search?q=private','https://site.invalid'),'search');assert.equal(trafficSource('https://m.facebook.com/private','https://site.invalid'),'social');assert.equal(trafficSource('https://site.invalid/account/?secret=true','https://site.invalid'),'internal');assert.equal(trafficSource('https://random.invalid/private','https://site.invalid'),'other');assert.equal(trafficSource('','https://site.invalid'),'direct');assert.equal(trafficSource('https://google.com.evil.invalid/','https://site.invalid'),'other');
});
test('previous Accept all never opts a visitor into newly introduced insights',()=>{
 const expiresAt=Date.now()+86400000;assert.equal(parseChoice(JSON.stringify({version:1,preferences:true,gameRecords:true,analytics:true,expiresAt})).analytics,false);
 const map=new Map(),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k)};
 assert.equal(setChoice({preferences:true,gameRecords:true},storage).analytics,false);assert.equal(setChoice({preferences:false,gameRecords:false,analytics:true},storage).analytics,true);
 assert.equal(parseChoice(JSON.stringify({version:2,preferences:true,gameRecords:true,expiresAt})),null);
});
