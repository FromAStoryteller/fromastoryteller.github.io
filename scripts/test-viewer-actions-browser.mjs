// Real published layouts and modules; fictional account RPCs only. No live writes.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.argv[2]??'http://127.0.0.1:55410',browser=await chromium.launch();
try{
 for(const width of [1440,390,320])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/systems/core/site-shell.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/\binitViewerActions\(\);/g,'/* manual fictional account below */')});});
  await page.goto(origin+'/stories/onto-the-stage/');
  await page.locator('.story-header').waitFor();
  const cookies=page.getByRole('button',{name:'Essentials only',exact:true});if(await cookies.isVisible())await cookies.click();
  await page.evaluate(async theme=>{
   document.documentElement.dataset.theme=theme;
   const {initViewerActions}=await import('/systems/community/viewer-actions.mjs');
   const state=new Map();window.viewerCalls=[];window.viewerFail=false;
   const stateFor=key=>{const s=state.get(key)||{id:key,key,saved:false,experienced:false,loved:false};state.set(key,s);return s;};
   const account={client:{rpc:async(name,args)=>{
    window.viewerCalls.push({name,args});
    const snapshot=name==='fas_my_viewer_actions'?args.content_keys.map(k=>({...stateFor(k)})):null;
    await new Promise(resolve=>setTimeout(resolve,name==='fas_my_viewer_actions'&&args.content_keys.length>1?180:35));
    if(name==='fas_my_viewer_actions')return {data:snapshot};
    if(name==='fas_set_viewer_action'){if(window.viewerFail)return {error:{message:'fixture offline'}};const s=stateFor(args.content_key);s[args.action_key]=args.enabled;return {data:{...s}};}
    throw Error('Unexpected fixture RPC '+name);
   }},subscribe(fn){window.endViewerFixture=fn;return ()=>{};}};
   initViewerActions({connect:async()=>account});
  },theme);
  const save=page.locator('.story-header + .viewer-content-actions [data-viewer-action=saved]');
  await save.waitFor();await page.waitForFunction(()=>!document.querySelector('.story-header + .viewer-content-actions [data-viewer-action=saved]').disabled);
  assert.equal(await save.getAttribute('aria-pressed'),'false');await save.click();await page.waitForFunction(()=>document.querySelector('.story-header + .viewer-content-actions [data-viewer-action=saved]').getAttribute('aria-pressed')==='true');
  await page.waitForTimeout(200);assert.equal(await save.getAttribute('aria-pressed'),'true','late initial reads preserve a confirmed save');if(process.env.FAS_VIEWER_SCREENSHOT_DIR){await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:process.env.FAS_VIEWER_SCREENSHOT_DIR+'/viewer-top-'+width+'-'+theme+'.png'});}
  const read=page.locator('.story-footer [data-viewer-action=experienced]'),love=page.locator('.story-footer [data-viewer-action=loved]');
  assert.match(await read.textContent(),/Mark as read/);assert.equal(await read.getAttribute('aria-pressed'),'false');
  await read.click();await page.waitForFunction(()=>document.querySelector('.story-footer [data-viewer-action=experienced]').getAttribute('aria-pressed')==='true');
  await love.click();await page.waitForFunction(()=>document.querySelector('.story-footer [data-viewer-action=loved]').getAttribute('aria-pressed')==='true');
  await read.click();await page.waitForFunction(()=>document.querySelector('.story-footer [data-viewer-action=experienced]').getAttribute('aria-pressed')==='false');
  assert.equal(await love.getAttribute('aria-pressed'),'true','undoing acknowledgement preserves appreciation');
  await page.evaluate(()=>{window.viewerFail=true;});await love.click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-viewer-status]')].some(n=>n.textContent.includes('could not be saved')));
  assert.equal(await love.getAttribute('aria-pressed'),'true','failed writes retain confirmed state');
  await page.evaluate(()=>{window.viewerFail=false;});
  const card=page.locator('.content-grid-card').first(),bookmark=card.locator('[data-viewer-action=saved]');await bookmark.waitFor();const url=page.url();await bookmark.click();await page.waitForFunction(()=>document.querySelector('.content-grid-card [data-viewer-action=saved]').getAttribute('aria-pressed')==='true');assert.equal(page.url(),url,'card save does not navigate');
  const positions=await page.evaluate(()=>({save:document.querySelector('.story-header + .viewer-content-actions [data-viewer-action=saved]').getBoundingClientRect().top+scrollY,body:document.querySelector('.story-content').getBoundingClientRect().top+scrollY,bottom:document.querySelector('.story-footer [data-viewer-action=loved]').getBoundingClientRect().top+scrollY,bodyEnd:document.querySelector('.story-content').getBoundingClientRect().bottom+scrollY,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  assert.ok(positions.save<positions.body&&positions.bottom>=positions.bodyEnd);assert.equal(positions.overflow,false);
  if(process.env.FAS_VIEWER_SCREENSHOT_DIR)await card.screenshot({path:process.env.FAS_VIEWER_SCREENSHOT_DIR+'/viewer-card-'+width+'-'+theme+'.png'});
  await page.evaluate(()=>window.endViewerFixture());assert.equal(await love.getAttribute('aria-pressed'),'false');assert.match(await page.locator('.story-footer [data-viewer-status]').textContent(),/account changed/);
  // Repeat-use content has favourite and played/used wording, before Explore Next.
  for(const [path,word]of [['/games/rally-clash/','played'],['/tools/genre-randomizer/','used']]){
   await page.goto(origin+path);await page.locator('main [data-content-layout]').first().waitFor();
   await page.evaluate(async theme=>{document.documentElement.dataset.theme=theme;const {initViewerActions}=await import('/systems/community/viewer-actions.mjs');initViewerActions({connect:async()=>({client:{rpc:async(name,args)=>({data:name==='fas_my_viewer_actions'?args.content_keys.map(key=>({key,id:key,saved:false,experienced:false,loved:false})):{key:args.content_key,id:args.content_key,saved:args.action_key==='saved',experienced:args.action_key==='experienced',loved:args.action_key==='loved'}})},subscribe(){return ()=>{};}})});},theme);
   assert.match(await page.locator('main [data-content-layout] + .viewer-content-actions [data-viewer-action=saved]').textContent(),/Add to favourites/);
   const ack=page.locator('main > .viewer-content-actions [data-viewer-action=experienced]');await ack.waitFor();assert.ok((await ack.textContent()).includes(word));
   assert.ok(await ack.evaluate(el=>el.getBoundingClientRect().top<document.querySelector('.content-next-section').getBoundingClientRect().top));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  assert.deepEqual(errors,[]);await context.close();console.log('PASS viewer actions '+width+' '+theme);
 }

 // Collection controls use a fictional account and the real page, grid and controller.
 for(const path of ['/account/saved/','/account/favourites/']){
  const page=await browser.newPage();
  await page.route('**/systems/core/site-shell.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace(/\binitViewerActions\(\);/g,'/* fixture mounted below */')});});
  await page.route('**/systems/community/viewer-collections.mjs*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace(/if\s*\(root\)\s*void\s+mountViewerCollection\(root\);/,'/* fixture mounted below */')});});
  await page.goto(origin+path);
  const choice=page.getByRole('button',{name:'Essentials only',exact:true});if(await choice.isVisible())await choice.click();
  await page.evaluate(async()=>{
   const {mountViewerCollection}=await import('/systems/community/viewer-collections.mjs');
   await mountViewerCollection(document.querySelector('[data-viewer-collection]'),{connect:async()=>null});
  });
  await page.locator('[data-viewer-collection] a').filter({hasText:'Sign in'}).waitFor();
  assert.ok((await page.locator('[data-viewer-collection] a').getAttribute('href')).includes(encodeURIComponent(path)));
  await page.evaluate(async()=>{
   const {mountViewerCollection}=await import('/systems/community/viewer-collections.mjs'),{initViewerActions}=await import('/systems/community/viewer-actions.mjs'),favourite=location.pathname.includes('favourites'),url=favourite?'/games/rally-clash/':'/stories/onto-the-stage/';
   let saved=true;const account={imageBase:'https://example.invalid/functions/v1/fas-story-image',subscribe(end){window.endCollectionFixture=end;return ()=>{};},client:{rpc:async(name,args)=>{
    if(name==='fas_my_viewer_collection')return {data:{items:saved?[{id:'fixture-id',source:'file',type:favourite?'game':'story',url,title:'A private collection fixture',summary:'Saved for another day',image:'/assets/images/covers/onto-the-stage.jpg',image_alt:'Fixture'}]:[],next_cursor:null}};
    if(name==='fas_my_viewer_actions')return {data:args.content_keys.map(key=>({key,id:'fixture-id',saved,experienced:true,loved:false}))};
    if(name==='fas_set_viewer_action'){saved=args.enabled;return {data:{key:args.content_key,id:'fixture-id',saved,experienced:true,loved:false}};}
    throw Error('Unexpected collection fixture RPC '+name);
   }}};
   await mountViewerCollection(document.querySelector('[data-viewer-collection]'),{connect:async()=>account});initViewerActions({connect:async()=>account});
  });
  const card=page.locator('.viewer-collection-grid .content-grid-card');await card.waitFor();await page.waitForFunction(()=>document.querySelector('.viewer-collection-grid [data-viewer-action=saved]').getAttribute('aria-pressed')==='true');
  assert.equal(await card.locator('[data-viewer-experienced]').textContent(),path.includes('favourites')?'✓ Played':'✓ Read');
  await card.locator('[data-viewer-action=saved]').click();await page.waitForFunction(()=>!document.querySelector('.viewer-collection-grid .content-grid-card'));assert.match(await page.locator('[data-viewer-collection]').textContent(),/Nothing here yet/);
  await page.close();
 }
}finally{await browser.close();}
