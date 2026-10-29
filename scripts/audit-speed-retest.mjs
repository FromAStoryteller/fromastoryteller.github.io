// Read-only live public measurements; account responses are fictional and intercepted.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='https://fromastoryteller.com',out={location:'GitHub ubuntu-latest hosted runner',public:[],account:[],api:[]};
const browser=await chromium.launch();
async function observers(context){await context.addInitScript(()=>{
 window.qa={lcp:0,cls:0,shifts:[],longTasks:0,longTaskMs:0};
 new PerformanceObserver(list=>{for(const e of list.getEntries()){window.qa.lcp=e.startTime;window.qa.lcpElement={tag:e.element?.tagName,className:String(e.element?.className??'').slice(0,120),url:e.url};}}).observe({type:'largest-contentful-paint',buffered:true});
 new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){const t=e.startTime;if(t-(window.qa.lastShift??-Infinity)>1000||t-(window.qa.sessionStart??0)>5000){window.qa.sessionValue=e.value;window.qa.sessionStart=t;}else window.qa.sessionValue=(window.qa.sessionValue??0)+e.value;window.qa.lastShift=t;window.qa.cls=Math.max(window.qa.cls,window.qa.sessionValue);window.qa.shifts.push({at:t,value:e.value,sources:e.sources.map(s=>({tag:s.node?.tagName,className:String(s.node?.className??'').slice(0,100)}))});}}).observe({type:'layout-shift',buffered:true});
 new PerformanceObserver(list=>{for(const e of list.getEntries()){window.qa.longTasks++;window.qa.longTaskMs+=e.duration;}}).observe({type:'longtask',buffered:true});
});}
async function publicPair(path,slow,sample){
 const context=await browser.newContext({viewport:{width:slow?390:1440,height:950},isMobile:slow});
 await observers(context);const page=await context.newPage(),cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 if(slow){await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:90000,connectionType:'cellular4g'});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 let responses=[],pending=new Map(),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
 cdp.on('Network.responseReceived',e=>pending.set(e.requestId,{url:e.response.url,type:e.type,status:e.response.status,cached:Boolean(e.response.fromDiskCache||e.response.fromPrefetchCache),edge:String(e.response.headers['cf-ray']??e.response.headers['CF-RAY']??'').slice(-3),publicCache:e.response.headers['x-fas-public-cache']??e.response.headers['X-FAS-Public-Cache'],contentType:e.response.mimeType}));
 cdp.on('Network.loadingFinished',e=>{const r=pending.get(e.requestId);if(r)responses.push({...r,bytes:e.encodedDataLength});});
 for(const visit of ['fresh','reload']){
  responses=[];pending=new Map();errors=[];failed=[];const start=Date.now();
  if(visit==='fresh')await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:60000});else await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  let contentReady=null;
  try{if(path==='/')await page.locator('#home-grid[aria-busy="false"] article').first().waitFor({timeout:20000});
   else if(path==='/stories/')await page.locator('#stories-grid[aria-busy="false"] article').first().waitFor({timeout:20000});
   else if(path.startsWith('/search/'))await page.locator('#search-results-grid article').first().waitFor({timeout:20000});
   else await page.locator('main h1').first().waitFor({timeout:10000});contentReady=Date.now()-start;
  }catch(e){errors.push('readiness: '+e.message.slice(0,180));}
  let playerReady=null;if(path.startsWith('/games/')){try{await page.locator('.game-canvas canvas,.fas-player-frame').first().waitFor({timeout:20000});playerReady=Date.now()-start;}catch(e){errors.push('player readiness: '+e.message.slice(0,180));}}
  await page.waitForTimeout(slow?5000:3000);await page.evaluate(()=>document.fonts.ready);
  const metrics=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0],r=performance.getEntriesByType('resource');return {...window.qa,ttfb:n.responseStart,serverWait:n.responseStart-n.requestStart,dns:n.domainLookupEnd-n.domainLookupStart,connect:n.connectEnd-n.connectStart,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,dom:n.domContentLoadedEventEnd,load:n.loadEventEnd,resources:r.map(e=>({url:e.name,ms:Math.round(e.duration),start:Math.round(e.startTime),transfer:e.transferSize,decoded:e.decodedBodySize})),horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};});
  const result={path,slow,sample,visit,contentReady,playerReady,...metrics,wireBytes:responses.reduce((s,r)=>s+r.bytes,0),requests:responses.length,cached:responses.filter(r=>r.cached).length,fonts:responses.filter(r=>r.url.includes('/fonts/')),images:responses.filter(r=>r.type==='Image'),largest:responses.toSorted((a,b)=>b.bytes-a.bytes).slice(0,12),api:responses.filter(r=>r.url.includes('/api/')),errors,failed};
  out.public.push(result);console.log('PUBLIC '+JSON.stringify({...result,resources:undefined,images:undefined,largest:undefined,fonts:result.fonts.map(f=>({name:f.url.split('/').at(-1),bytes:f.bytes}))}));
 }
 await context.close();
}
const owner='aa000000-0000-4000-8000-000000000001',user={id:owner,email:'audit-fixture@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
function token(){const exp=Math.floor(Date.now()/1000)+3600;return {access_token:[{alg:'HS256',typ:'JWT'},{sub:owner,email:user.email,role:'authenticated',aud:'authenticated',session_id:owner,exp}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.fictional',refresh_token:'fictional-refresh-token',token_type:'bearer',expires_in:3600,expires_at:exp,user};}
async function accountProbe(delayMs){
 const context=await browser.newContext({viewport:{width:390,height:950}});await context.addInitScript(session=>{const p='fas-account-vzdicnufhidelaoeqbza-supabase-co';sessionStorage.setItem(p+'-mode','remembered');localStorage.setItem(p+'-remembered',JSON.stringify(session));},token());
 const calls=[],errors=[];let signed=true;
 await context.route('https://vzdicnufhidelaoeqbza.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1);calls.push({name,at:Date.now()});await new Promise(r=>setTimeout(r,delayMs));
  let body;
  if(name==='token')body=token();else if(name==='user')body=user;
  else if(name==='user_roles')body=[{role:'member'}];else if(name==='profiles')body={public_id:owner,display_name:'Fixture reader',bio:'',social_links:[]};
  else if(name==='fas_my_account_state')body='active';
  else if(name==='fas_my_following_ids')body=Array.from({length:100},(_,i)=>'bf000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
  else if(name==='fas_my_viewer_actions')body=(request.postDataJSON()?.content_keys??[]).map(key=>({key,saved:false,loved:false,experienced:false}));
  else if(name==='logout'){signed=false;body={};}else body=[];
  await route.fulfill({json:body});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const start=Date.now();
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>[...document.querySelectorAll('.header-account-panel button')].some(b=>b.textContent==='Sign out'&&!b.disabled),null,{timeout:20000});
 const headerReady=Date.now()-start;
 await page.waitForFunction(()=>document.querySelector('.home-following-status')?.textContent.startsWith('From storytellers you follow first'),null,{timeout:20000});
 const followingReady=Date.now()-start;await page.waitForTimeout(1000);
 const counts=Object.fromEntries([...new Set(calls.map(c=>c.name))].map(n=>[n,calls.filter(c=>c.name===n).length]));
 out.account.push({delayMs,headerReady,followingReady,calls:calls.map(c=>({name:c.name,at:c.at-start})),counts,errors});
 console.log('ACCOUNT '+JSON.stringify(out.account.at(-1)));
 const consent=page.getByRole('button',{name:'Essentials only',exact:true});if(await consent.isVisible())await consent.click();
 await page.locator('[data-account-toggle]').click();await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.home-following-status'),null,{timeout:10000});assert.equal(signed,false);
 await context.close();
}
try{
 for(let i=1;i<=3;i++)await publicPair('/',false,i);
 for(let i=1;i<=3;i++)await publicPair('/',true,i);
 for(const path of ['/stories/','/stories/tea-at-the-summit/','/search/?q=Tea','/games/rally-clash/'])for(let i=1;i<=3;i++)await publicPair(path,true,i);
 await accountProbe(150);await accountProbe(600);
 for(const path of ['/api/public/browse?limit=23&sort=oldest','/api/public/browse?limit=23&sort=oldest','/api/public/browse?q=Tea&limit=2','/api/public/browse?q=Tea&limit=2']){
  const start=performance.now(),r=await fetch(origin+path,{cache:'no-store',signal:AbortSignal.timeout(15000)}),body=await r.json();
  out.api.push({path,status:r.status,ms:Math.round(performance.now()-start),cache:r.headers.get('x-fas-public-cache'),edge:r.headers.get('cf-ray')?.slice(-3),items:body.items?.length});
 }
 console.log('API '+JSON.stringify(out.api));
 await fs.writeFile('loading-audit.json',JSON.stringify(out,null,2));
}finally{await browser.close();}
