// Real page modules and SDK, fictional account, no live backend calls.
// Optional source root permits a before/after comparison with the same latency.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(process.argv[2]??fileURLToPath(new URL('../',import.meta.url)));
const origin='http://127.0.0.1:55410',backend='https://oqmmvjjycpyxvxipcyli.supabase.co';
const owner='aa000000-0000-4000-8000-000000000001';
const user={id:owner,email:'fictional-reader@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const token=()=>{
 const exp=Math.floor(Date.now()/1000)+3600;
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:owner,email:user.email,role:'authenticated',aud:'authenticated',session_id:owner,exp}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.fictional';
 return {access_token:jwt,refresh_token:'fictional-refresh-token',token_type:'bearer',expires_in:3600,expires_at:exp,user};
};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,origin);
  if(url.pathname==='/__fas/local-auth'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode:'development',url:backend,key:'sb_publishable_fictional_fixture'}));return;}
  const relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),target=path.resolve(root,relative+(url.pathname.endsWith('/')?'index.html':''));
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(target);
  // Deliberately modest latency exposes dependency waterfalls reproducibly.
  if(/\.(?:mjs|js|json)$/.test(target))await delay(25);
  res.setHeader('Content-Type',mime[path.extname(target)]??'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(55410,'127.0.0.1',resolve);});
let browser;
try{
 browser=await chromium.launch();
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:950}});
  await context.addInitScript(({session})=>{const prefix='fas-account-oqmmvjjycpyxvxipcyli-supabase-co';sessionStorage.setItem(prefix+'-mode','remembered');localStorage.setItem(prefix+'-remembered',JSON.stringify(session));},{session:token()});
  const page=await context.newPage(),calls=[],errors=[];
  let releaseModules;
  const modulesReady=new Promise(resolve=>releaseModules=resolve);
  if(!process.argv[2]) for(const entry of ['/home.js','/systems/core/site-shell.js'])await page.route(origin+entry,async route=>{await modulesReady;await route.continue();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(backend+'/**',async route=>{
   const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1);calls.push(name);
   await delay(name==='fas_my_following'&&!process.argv[2]?800:150);
   let body;
   if(url.pathname==='/auth/v1/token')body=token();
   else if(url.pathname==='/auth/v1/user')body=user;
   else if(name==='user_roles')body=[{role:'member'}];
   else if(name==='profiles')body={public_id:owner,display_name:'Fictional reader',bio:'',social_links:[]};
   else if(name==='fas_my_account_state')body='active';
   else if(name==='fas_public_file_catalog')body=[];
   else if(name==='fas_public_story_catalog')body={items:[],next_cursor:null};
   else if(name==='fas_my_following')body={items:[{public_id:owner,display_name:'Fictional writer'}],next_cursor:null};
   else if(name==='fas_my_viewer_actions')body=(request.postDataJSON()?.content_keys??[]).map(key=>({id:owner,key,saved:false,loved:false,experienced:false}));
   else if(name==='logout')body={};
   else throw Error('Unexpected backend request: '+name);
   await route.fulfill({json:body});
  });
  // Deny every external request that is not the intercepted fictional backend.
  await page.route(/https?:\/\/(?!127\.0\.0\.1:55410\/|oqmmvjjycpyxvxipcyli\.supabase\.co\/)/,route=>route.abort());
  await page.goto(origin+'/',{waitUntil:process.argv[2]?'domcontentloaded':'commit'});
  let initialLibraryHeight;
  if(!process.argv[2]){
   // Hold both page entry modules: this checks the actual first painted HTML,
   // not a fast script that corrects a guest layout just before the assertion.
   await page.waitForFunction(()=>document.querySelector('#home-grid > *')&&getComputedStyle(document.querySelector('#home-grid > *')).visibility==='hidden');
   assert.equal(await page.locator('html').getAttribute('data-fas-account-startup'),'pending');
   initialLibraryHeight=await page.locator('[data-viewer-library]').evaluate(el=>el.getBoundingClientRect().height);
   assert.ok(initialLibraryHeight>100,'account navigation space exists before modules execute');
   assert.equal(await page.locator('.header-account-panel > a').first().evaluate(el=>getComputedStyle(el).visibility),'hidden');
   releaseModules();
   await page.waitForFunction(()=>document.querySelector('.home-following-status')&&document.querySelector('#home-grid')?.getAttribute('aria-busy')==='true');
   assert.equal(await page.locator('#home-grid > *').first().evaluate(el=>getComputedStyle(el).visibility),'hidden','public feed is not painted while following is pending');
  }
  await page.waitForFunction(()=>[...document.querySelectorAll('.header-account-panel button')].some(b=>b.textContent==='Sign out'&&!b.disabled));
  const accountReady=await page.evaluate(()=>Math.round(performance.now()));
  await page.waitForFunction(()=>{
   const following=document.querySelector('.home-following-status');
   const action=document.querySelector('.viewer-card-actions button');
   const signOut=[...document.querySelectorAll('.header-account-panel button')].find(b=>b.textContent==='Sign out');
   return following?.textContent.startsWith('From storytellers you follow first')&&action&&!action.disabled&&signOut&&!signOut.disabled;
  });
  const ready=await page.evaluate(()=>Math.round(performance.now()));
  const refreshes=calls.filter(x=>x==='token').length,verifications=calls.filter(x=>x==='user').length;
  console.log(JSON.stringify({width,accountNavigationReadyMs:accountReady,loggedInReadyMs:ready,refreshes,verifications,root}));
  assert.deepEqual(errors,[]);
  assert.equal(await page.locator('[data-viewer-library]').getAttribute('hidden'),null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  // Current implementation shares startup restoration; comparison may request more.
  if(!process.argv[2]){assert.equal(refreshes,1);assert.equal(verifications,1);}
  if(!process.argv[2]){
   assert.equal(await page.locator('html').getAttribute('data-fas-home-startup'),null);
   assert.equal(await page.locator('#home-grid > *').first().evaluate(el=>getComputedStyle(el).visibility),'visible');
   const finalHeight=await page.locator('[data-viewer-library]').evaluate(el=>el.getBoundingClientRect().height);
   assert.ok(Math.abs(finalHeight-initialLibraryHeight)<1,'account verification does not change sidebar geometry');
  }
  if(width===1440)await page.locator('[data-account-toggle]').hover();
  else await page.locator('[data-account-toggle]').click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-viewer-library]')?.hidden===true);
  assert.equal(await page.locator('.home-following-status').count(),0);
  await context.close();
 }
 // Guests must retain the ordinary first paint without waiting for account services.
 const guest=await browser.newPage();
 await guest.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await guest.goto(origin+'/',{waitUntil:'domcontentloaded'});
 assert.equal(await guest.locator('html').getAttribute('data-fas-home-startup'),null);
 assert.equal(await guest.locator('#home-grid > *').first().evaluate(el=>getComputedStyle(el).visibility),'visible');
 await guest.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
