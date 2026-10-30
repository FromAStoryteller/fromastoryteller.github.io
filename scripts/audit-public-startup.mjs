// Read-only live public measurements; account responses are fictional and intercepted.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin='https://fromastoryteller.com',out={location:'GitHub ubuntu-latest hosted runner',public:[],account:[],api:[]};
if(process.env.GITHUB_EVENT_NAME==='push'){
 const manifest=JSON.parse(await fs.readFile('dist/content/asset-manifest.json','utf8'));let ready=false;
 for(let i=0;i<36;i++){try{const response=await fetch(origin+'/content/asset-manifest.json',{cache:'no-store'}),current=await response.json();if(['/systems/content/public-query.mjs','/systems/community/legacy-page.mjs'].every(p=>current[p]===manifest[p])){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,10000));}
 assert.ok(ready,'expected startup release must be deployed');
}
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
  const result={path,slow,sample,visit,contentReady,playerReady,queryStart:metrics.resources.find(r=>r.url.includes('/api/public/browse?'))?.start,...metrics,wireBytes:responses.reduce((s,r)=>s+r.bytes,0),requests:responses.length,cached:responses.filter(r=>r.cached).length,fonts:responses.filter(r=>r.url.includes('/fonts/')),images:responses.filter(r=>r.type==='Image'),largest:responses.toSorted((a,b)=>b.bytes-a.bytes).slice(0,12),api:responses.filter(r=>r.url.includes('/api/')),errors,failed};
  out.public.push(result);console.log('PUBLIC '+JSON.stringify({...result,resources:undefined,images:undefined,largest:undefined,fonts:result.fonts.map(f=>({name:f.url.split('/').at(-1),bytes:f.bytes}))}));
 }
 await context.close();
}

try{
 for(const path of ['/','/search/?q=Tea','/games/rally-clash/'])for(let i=1;i<=3;i++)await publicPair(path,true,i);
 for(const r of out.public){assert.deepEqual(r.errors,[]);assert.deepEqual(r.failed,[]);assert.equal(r.horizontalOverflow,false);if(r.path==='/')assert.equal(r.api.filter(a=>a.url.includes('/api/public/browse?')).length,1,'one fresh initial public query');}
 await fs.writeFile('startup-audit.json',JSON.stringify(out,null,2));
}finally{await browser.close();}
