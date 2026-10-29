import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.cwd(),origin='https://fromastoryteller.com';
const {publicContentResponse}=await import(pathToFileURL(path.join(root,'systems/content/public-cache-worker.mjs')).href);
const {readingResponse}=await import(pathToFileURL(path.join(root,'cloudflare-worker.mjs')).href);
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.avif':'image/avif','.webp':'image/webp','.woff':'font/woff','.ttf':'font/ttf'};
const env={ASSETS:{async fetch(request){let file=new URL(request.url).pathname;if(file==='/account/runtime-config.json')return Response.json({mode:'production',enabled:true,url:'https://vzdicnufhidelaoeqbza.supabase.co',key:'sb_publishable_fixture',signup:true,lifecycle:true,policyRelease:'fixture'});if(file.endsWith('/'))file+='index.html';try{return new Response(await fs.readFile(path.join(root,'dist',file)),{headers:{'Content-Type':types[path.extname(file)]??'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}}};
const fetcher=async(url)=>{
 if(url.endsWith('fas_public_content_revision'))return Response.json('aa000000-0000-0000-0000-000000000001');
 if(url.endsWith('fas_public_story_catalog'))return Response.json({items:[],next_cursor:null});
 if(url.endsWith('fas_public_file_catalog'))return Response.json([]);
 if(url.endsWith('fas_public_file_content'))return Response.json({id:'aa000000-0000-0000-0000-000000000002',url:'/stories/tea-at-the-summit/',title:'Tea at the Summit',author:{public_id:'aa000000-0000-0000-0000-000000000003',display_name:'Writer',social_links:[]}});
 return Response.json([]);
};
const browser=await chromium.launch({headless:true});
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[],failed=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});page.on('request',r=>requests.push(r.url()));
 await context.route('https://vzdicnufhidelaoeqbza.supabase.co/**',route=>route.fulfill({json:[]}));
 await context.route(origin+'/**',async route=>{try{const req=route.request();const response=await publicContentResponse(new Request(req.url(),{method:req.method(),headers:req.headers()}),env,readingResponse,{fetcher,cache:null});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});}catch(e){errors.push(e.stack);await route.abort();}});
 await page.goto(origin+'/');await page.waitForFunction(()=>document.querySelector('#home-grid')?.getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('#home-grid .content-grid-card').count(),14);
 assert.ok(await page.locator('#home-grid picture source[type="image/avif"]').count());
 await page.waitForFunction(()=>document.querySelector('#home-grid img')?.complete);
 assert.ok(await page.locator('#home-grid img').first().evaluate(img=>img.naturalWidth>0));
 assert.equal(await page.locator('.menu-toggle').isVisible(),true);await page.locator('.menu-toggle').click();await page.locator('.sidebar a[href="/stories/"]').click();await page.waitForFunction(()=>document.querySelector('.content-grid')?.getAttribute('aria-busy')==='false');
 await page.goto(origin+'/stories/tea-at-the-summit/');await page.locator('.story-page').waitFor();assert.ok((await page.locator('.story-page').textContent()).includes('Eleanor'));
 await page.goto(origin+'/account/sign-in/');await page.locator('input[type="email"]').waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.ok(requests.some(u=>u.includes('/_assets/')&&u.endsWith('.js')));assert.ok(requests.some(u=>u.endsWith('/api/public/discovery')));assert.ok(!requests.some(u=>u.endsWith('/api/public/files')||u.endsWith('/api/public/stories')));assert.ok(!requests.some(u=>u.endsWith('/meta.json')));
 console.log('PASS production asset graph, home/category/story/sign-in, anonymous catalogue and navigation at '+width+'px; '+requests.length+' requests');await context.close();
}}finally{await browser.close();}
