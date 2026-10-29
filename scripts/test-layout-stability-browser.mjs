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
try{for(const width of [320,390,1440])for(const pathname of ['/games/rally-clash/','/stories/tea-at-the-summit/','/search/?q=Tea']){
 const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
 let release;const gate=new Promise(r=>release=r);
 const search=pathname.startsWith('/search/'),blocked=search?'/search/search.js':'/systems/core/site-shell.js';
 await context.route('https://vzdicnufhidelaoeqbza.supabase.co/**',r=>r.fulfill({json:[]}));
 page.on('pageerror',e=>errors.push(e.message));
 await context.route(origin+'/**',async route=>{
  const req=route.request();if(new URL(req.url()).pathname.endsWith(blocked))await gate;
  const response=await publicContentResponse(new Request(req.url(),{method:req.method(),headers:req.headers()}),env,readingResponse,{fetcher,cache:null});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto(origin+pathname,{waitUntil:'commit'});
 const target=search?'.search-results-section':pathname.startsWith('/games/')?'.game-play-section':'.story-details';
 await page.locator(target).waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
 const before=await page.locator(target).evaluate(e=>e.getBoundingClientRect().top);
 release();
 if(search)await page.locator('#search-results-grid[aria-busy="false"]').waitFor();
 else await page.locator('main .viewer-content-actions [data-copy-link]').waitFor();
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
 const after=await page.locator(target).evaluate(e=>e.getBoundingClientRect().top);
 assert.ok(Math.abs(after-before)<2,'late controls moved '+pathname+' at '+width+': '+before+' -> '+after);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.deepEqual(errors,[]);
 console.log('STABLE_LAYOUT '+JSON.stringify({width,pathname,before,after}));
 await context.close();
}}finally{await browser.close();}
