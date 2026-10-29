import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {discoveryFixture} from './discovery-browser-fixture.mjs';
const root=process.cwd(),origin='https://fromastoryteller.com';
const {publicContentResponse}=await import(pathToFileURL(path.join(root,'systems/content/public-cache-worker.mjs')).href);
const {readingResponse}=await import(pathToFileURL(path.join(root,'cloudflare-worker.mjs')).href);
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.avif':'image/avif','.webp':'image/webp','.woff':'font/woff','.ttf':'font/ttf'};
const env={ASSETS:{async fetch(request){let file=new URL(request.url).pathname;if(file==='/account/runtime-config.json')return Response.json({mode:'production',enabled:true,url:'https://vzdicnufhidelaoeqbza.supabase.co',key:'sb_publishable_fixture',signup:true,lifecycle:true,policyRelease:'fixture'});if(file.endsWith('/'))file+='index.html';try{return new Response(await fs.readFile(path.join(root,'dist',file)),{headers:{'Content-Type':types[path.extname(file)]??'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}}};
const fetcher=async(url,options)=>{
 if(url.endsWith('fas_public_content_revision'))return Response.json('aa000000-0000-0000-0000-000000000001');
 if(url.endsWith('fas_public_story_catalog'))return Response.json({items:[],next_cursor:null});
 if(url.endsWith('fas_public_file_catalog'))return Response.json([]);
 if(url.endsWith('fas_public_discovery'))return Response.json({files:[],stories:{items:[],next_cursor:null}});
 if(url.endsWith('fas_query_public_content'))return Response.json(discoveryFixture(undefined,JSON.parse(options.body).options));
 if(url.endsWith('fas_public_file_content'))return Response.json({id:'aa000000-0000-0000-0000-000000000002',url:'/stories/tea-at-the-summit/',title:'Tea at the Summit',author:{public_id:'aa000000-0000-0000-0000-000000000003',display_name:'Writer',social_links:[]}});
 return Response.json([]);
};

const browser=await chromium.launch();
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[],queries=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{window.qaReady=new Promise(r=>addEventListener('DOMContentLoaded',()=>r(performance.now()),{once:true}));});
  await context.route('https://vzdicnufhidelaoeqbza.supabase.co/**',r=>r.fulfill({json:[]}));
  await context.route(origin+'/**',async route=>{
   const req=route.request();if(req.url().includes('/api/public/browse?'))queries.push(req.url());
   const response=await publicContentResponse(new Request(req.url(),{method:req.method(),headers:req.headers()}),env,readingResponse,{fetcher,cache:null});
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  for(const pathname of ['/','/stories/','/search/?q=Tea']){
   queries.length=0;await page.goto(origin+pathname);
   await page.locator(pathname==='/'?'#home-grid[aria-busy="false"]':pathname==='/stories/'?'#stories-grid[aria-busy="false"]':'#search-results-grid[aria-busy="false"]').waitFor();
   if(pathname.startsWith('/search/'))await page.locator('#search-results-grid article').first().waitFor();
   const result=await page.evaluate(async()=>({dom:await window.qaReady,started:performance.getEntriesByType('resource').find(r=>r.name.includes('/api/public/browse?'))?.startTime,preloads:[...document.querySelectorAll('link[rel="modulepreload"]')].map(l=>l.href),pending:Boolean(globalThis[Symbol.for('fas.public-discovery')])}));
   assert.ok(result.preloads.length>0);assert.ok(!result.preloads.some(p=>p.endsWith('/account/vendor/supabase-client.js')||p.endsWith('/interactive-package.mjs')),'deferred SDK/editor must not be statically preloaded');
   assert.equal(queries.length,1,'one initial anonymous discovery request: '+queries);
   assert.ok(result.started<result.dom,'public read starts before module initialization settles');
   assert.equal(result.pending,false);
   console.log('EARLY_DISCOVERY '+JSON.stringify({width,pathname,...result,preloads:result.preloads.length}));
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 // Isolated loader proves that a metadata decision precedes executable player code.
 for(const replacement of [false,true]){
  const context=await browser.newContext(),page=await context.newPage(),seen=[],errors=[];
  let decide;const decision=new Promise(r=>decide=r);page.on('request',r=>seen.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://vzdicnufhidelaoeqbza.supabase.co/**',async route=>{await decision;await route.fulfill({json:replacement?{package:{version:1,orientation:'landscape',js:'window.qaReplacement=true;',css:'',assets:[]}}:null});});
  await context.route(origin+'/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/__startup_loader/')return route.fulfill({contentType:'text/html',body:'<!doctype html><main class="game-page"><section class="game-play-section"><div class="game-shell"><div class="game-shell-main"><div class="game-shell-frame"><div id="rally-clash-game" class="game-canvas" style="width:640px;height:360px"></div></div></div></div></section></main><script type="module">import {mountLegacyPage} from "/systems/community/legacy-page.mjs";await mountLegacyPage("rally-clash",()=>import("/games/rally-clash/game.js"));window.qaMounted=true;</script>'});
   const response=await env.ASSETS.fetch(new Request(req.url()));await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  await page.goto(origin+'/__startup_loader/',{waitUntil:'commit'});
  await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/account/runtime-config.json')));await page.waitForTimeout(200);
  assert.ok(!seen.some(p=>/p5-|p5.sound|rally-clash\/game.js|interactive-package.mjs/.test(p)),'player/editor downloads wait for the public decision');
  decide();await page.waitForFunction(()=>window.qaMounted);
  if(replacement){assert.ok(seen.some(p=>p.endsWith('/interactive-package.mjs')));assert.ok(!seen.some(p=>/p5-|p5.sound|rally-clash\/game.js/.test(p)));await page.getByRole('button',{name:'Start / restart',exact:true}).waitFor();}
  else{await page.locator('.game-canvas canvas').waitFor();assert.ok(!seen.some(p=>p.endsWith('/interactive-package.mjs')));assert.equal(await page.locator('link[rel="preload"][as="script"]').count(),2);assert.equal(seen.filter(p=>p.endsWith('.mp3')).length,0,'no sound media before interaction');await page.locator('.menu-label').filter({hasText:/^Play$/}).click();await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('.mp3')));}
  assert.deepEqual(errors,[]);console.log('PLAYER_STARTUP '+JSON.stringify({replacement,requests:seen.filter(p=>/p5-|p5.sound|game.js|interactive-package/.test(p))}));await context.close();
 }
}finally{await browser.close();}
