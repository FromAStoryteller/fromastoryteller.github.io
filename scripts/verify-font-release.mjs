// Read-only checks against production after the normal main-branch deployment.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const origin='https://fromastoryteller.com';
const expected=JSON.parse(await readFile('dist/content/asset-manifest.json','utf8'));
const names=Object.keys(expected).filter(p=>p.startsWith('/assets/fonts/')&&p.endsWith('.latin.woff2'));
let ready=false,last;
for(let attempt=0;attempt<36;attempt++){
 try{
  const response=await fetch(origin+'/content/asset-manifest.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200);
  const current=await response.json();
  for(const name of [...names,'/css/foundations.css'])assert.equal(current[name],expected[name],'waiting for deployed '+name);
  ready=true;break;
 }catch(e){last=e;console.log('Waiting for font release: '+e.message);await new Promise(r=>setTimeout(r,10000));}
}
if(!ready)throw last;
for(const name of names){
 const response=await fetch(origin+expected[name],{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,name);
 const bytes=Buffer.from(await response.arrayBuffer()),local=await readFile('dist'+expected[name]);
 const sha=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(sha(bytes),sha(local),name+' exact deployed font');
 assert.ok(response.headers.get('cache-control')?.includes('immutable'),name+' versioned caching');
 console.log('DEPLOYED_FONT '+JSON.stringify({name,bytes:bytes.length,sha256:sha(bytes)}));
}
const browser=await chromium.launch();
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
 if(width===390){await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:90000});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 for(const path of ['/stories/tea-at-the-summit/','/']){
  await page.goto(origin+path);await page.locator(path==='/'?'#home-grid[aria-busy="false"]':'.story-page').waitFor();
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(5000);
  const fonts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/fonts/')&&r.name.endsWith('.woff2')).map(r=>({name:r.name.split('/').at(-1),bytes:r.transferSize,body:r.encodedBodySize})));
  assert.ok(fonts.length>=2);
  assert.ok(fonts.every(f=>f.name.includes('.latin.woff2')),'common page should use common subsets: '+JSON.stringify(fonts));
  if(path.includes('/stories/'))assert.ok(fonts.reduce((n,f)=>n+f.body,0)<400000,'common story font budget');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  console.log('LIVE_FONT_DELIVERY '+JSON.stringify({width,path,fonts,fontBodyBytes:fonts.reduce((n,f)=>n+f.body,0)}));
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await context.close();
}}finally{await browser.close();}
console.log('PASS exact deployed font hashes, immutable URLs, story/home browser loading and font budget');
