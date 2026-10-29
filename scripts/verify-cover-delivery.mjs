// Read-only exact-release and live homepage image verification.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {importedCoverImages} from '../systems/community/public-story-catalog.mjs';
const origin='https://fromastoryteller.com',expected=JSON.parse(await fs.readFile('dist/content/asset-manifest.json','utf8'))['/systems/community/public-story-catalog.mjs'];
let ready=false;for(let i=0;i<36;i++){try{const r=await fetch(origin+'/content/asset-manifest.json',{cache:'no-store'});if((await r.json())['/systems/community/public-story-catalog.mjs']===expected){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,10000));}assert.ok(ready,'expected public card release must be deployed');
const browser=await chromium.launch();
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),requests=[],errors=[],failed=[];
 page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
 await page.goto(origin+'/');await page.locator('#home-grid[aria-busy="false"]').waitFor();
 await page.waitForFunction(()=>document.querySelector('.content-featured-card img')?.complete&&document.querySelector('.content-featured-card img')?.naturalWidth>0);
 await page.waitForTimeout(600);
 const result=await page.locator('.content-featured-card img').first().evaluate(i=>({src:i.currentSrc,width:i.naturalWidth,resources:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='img').map(r=>({url:r.name,bytes:r.transferSize,body:r.encodedBodySize}))}));
 const original=Object.entries(importedCoverImages).find(([,entry])=>result.src.includes(entry.src.split('/').at(-1).replace('.jpg','.')));
 if(original){assert.equal(requests.filter(u=>u===result.src).length,1,'featured cover downloaded once');assert.ok(!requests.some(u=>u.includes('/api/public/image?')&&u.includes(original[0])),'no second original-cover JPEG');}
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log('LIVE_COVER '+JSON.stringify({width,original:Boolean(original),...result}));
 await context.close();
}}finally{await browser.close();}
