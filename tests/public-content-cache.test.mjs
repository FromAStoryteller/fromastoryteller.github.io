import test from 'node:test';
import assert from 'node:assert/strict';
import {publicContentResponse,publicCatalogRequest} from '../systems/content/public-cache-worker.mjs';
const origin='https://fromastoryteller.com',config={mode:'production',enabled:true,url:'https://vzdicnufhidelaoeqbza.supabase.co',key:'sb_publishable_fixture',signup:true,lifecycle:true,policyRelease:'fixture'};
function fixture(){
 let revision='aa000000-0000-0000-0000-000000000001',release='a'.repeat(24),published=true,failed=false,renders=0,checks=0,reads=0;
 const values=new Map(),cache={async match(key){return values.get(key.url)?.clone();},async put(key,value){values.set(key.url,value.clone());}};
 const env={ASSETS:{async fetch(req){return Response.json(req.url.includes('runtime-config')?config:{release});}}};
 const fetcher=async(url,options)=>{assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Cookie,undefined);assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');if(url.endsWith('fas_public_content_revision')){checks++;return failed?new Response(null,{status:503}):Response.json(revision);}reads++;return Response.json(published?['public']:[]);};
 const render=async(req)=>{renders++;assert.equal(req.headers.get('Cookie'),null);assert.equal(req.headers.get('Authorization'),null);return new Response(published?'Published manuscript':'Unavailable',{status:published?200:404,headers:{'Cache-Control':'no-store'}});};
 const run=(path='/stories/fixture/',options={})=>publicContentResponse(new Request(origin+path,options),env,render,{fetcher,cache});
 return {run,cache,env,fetcher,render,get counts(){return {renders,checks,reads};},withdraw(){published=false;revision='bb000000-0000-0000-0000-000000000001';},release(){release='b'.repeat(24);},fail(){failed=true;}};
}
test('public rendered pages reuse the edge cache with a fresh revision check on every request',async()=>{
 const f=fixture();let r=await f.run(undefined,{headers:{Cookie:'private-session',Authorization:'Bearer reader'}});assert.equal(await r.text(),'Published manuscript');assert.equal(r.headers.get('X-FAS-Public-Cache'),'MISS');
 r=await f.run();assert.equal(await r.text(),'Published manuscript');assert.equal(r.headers.get('X-FAS-Public-Cache'),'HIT');assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(f.counts,{renders:1,checks:2,reads:0});
 const head=await f.run(undefined,{method:'HEAD'});assert.equal(await head.text(),'');assert.equal(head.headers.get('X-FAS-Public-Cache'),'HIT');
 f.withdraw();r=await f.run();assert.equal(r.status,404);assert.equal(r.headers.get('X-FAS-Public-Cache'),'MISS');assert.equal(f.counts.renders,2);
});
test('release changes invalidate cached HTML; outages never return a cached manuscript',async()=>{
 const f=fixture();await f.run();f.release();assert.equal((await f.run()).headers.get('X-FAS-Public-Cache'),'MISS');assert.equal(f.counts.renders,2);f.fail();const r=await f.run();assert.equal(r.status,503);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.ok(!(await r.text()).includes('manuscript'));
});
test('catalogues share anonymous cached projections and withdrawals immediately replace them',async()=>{
 const f=fixture();assert.deepEqual(await(await f.run('/api/public/stories')).json(),['public']);assert.equal((await f.run('/api/public/stories')).headers.get('X-FAS-Public-Cache'),'HIT');assert.deepEqual(f.counts,{renders:0,checks:2,reads:1});f.withdraw();assert.deepEqual(await(await f.run('/api/public/stories')).json(),[]);
 const head=await f.run('/api/public/files',{method:'HEAD'});assert.equal(await head.text(),'');
 for(const path of ['/api/public/unknown','/api/public/files?x=1','/api/public/stories?after_id=bad','/api/public/stories?before_time=x&after_id=x','/api/public/stories?after_id=x&after_id=y'])assert.equal((await f.run(path)).status,400);
 assert.equal((await f.run('/api/public/files',{method:'POST'})).status,405);
 assert.equal(publicCatalogRequest(new URL(origin+'/account/settings/')),null);
});
test('cache storage failures preserve successful fresh public reads',async()=>{
 const f=fixture(),cache={match(){throw Error('unavailable');},put(){throw Error('full');}};
 const r=await publicContentResponse(new Request(origin+'/stories/fixture/'),f.env,f.render,{cache,fetcher:f.fetcher});assert.equal(r.status,200);assert.equal(await r.text(),'Published manuscript');
});

test('public images cache anonymous bytes in Sydney, revalidate visibility, and never expose stored browser caching',async()=>{
 const f=fixture();let images=0;const fetcher=async(url,options)=>{if(!url.includes('/functions/'))return f.fetcher(url,options);images++;assert.equal(options.headers['x-region'],'ap-southeast-2');assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Cookie,undefined);return new Response('jpeg bytes',{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','CDN-Cache-Control':'no-store'}});};
 const req=()=>new Request(origin+'/api/public/image?asset_id=aa000000-0000-0000-0000-000000000001&width=480',{headers:{Cookie:'reader-private',Authorization:'Bearer private'}});
 const run=()=>publicContentResponse(req(),f.env,f.render,{fetcher,cache:f.cache});
 let r=await run();assert.equal(r.status,200);assert.equal(await r.text(),'jpeg bytes');assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal((await run()).headers.get('X-FAS-Public-Cache'),'HIT');assert.equal(images,1);
 f.withdraw();assert.equal((await run()).headers.get('X-FAS-Public-Cache'),'MISS');assert.equal(images,2);f.fail();assert.equal((await run()).status,503);assert.equal(images,2);
 for(const query of ['asset_id=bad','asset_id=aa000000-0000-0000-0000-000000000001&width=9999','asset_id=aa000000-0000-0000-0000-000000000001&path=private'])assert.throws(()=>publicCatalogRequest(new URL(origin+'/api/public/image?'+query)));
});
