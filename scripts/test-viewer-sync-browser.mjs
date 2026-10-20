// Actual pages and BroadcastChannel; account reads/writes stay in fictional fixtures.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.argv[2]??'http://127.0.0.1:55410';
const browser=await chromium.launch(),context=await browser.newContext();
const story='/stories/onto-the-stage/',states=new Map(),catalog=new Map(),calls=[],held=new Map(),gates=new Map(),failures=new Set();
let order=0;
function state(owner,key){const id=owner+'|'+key;if(!states.has(id))states.set(id,{key,id:key,saved:false,experienced:false,loved:false,order:0});return states.get(id);}
function item(key,type='story'){return {id:key,source:'file',type,url:key,title:'Collection '+key,summary:'A fictional saved piece',image:'/assets/images/covers/onto-the-stage.jpg',image_alt:'Fixture'};}
catalog.set(story,item(story));
function hold(tab,name){let release;const wait=new Promise(r=>release=r);gates.set(tab+'|'+name,{wait,release});}
function release(tab,name){const gate=held.get(tab+'|'+name);assert.ok(gate,'request reached gate');held.delete(tab+'|'+name);gate.release();}
async function reached(tab,name){for(let i=0;i<200;i++){if(held.has(tab+'|'+name))return;await new Promise(r=>setTimeout(r,20));}throw Error('No gated request '+tab+' '+name);}
const count=(tab,name)=>calls.filter(c=>c.tab===tab&&c.name===name).length;
async function until(check,label){for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+label);}
await context.route('**/account/local-auth-client.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export async function loadLocalAuthClient(){return {hadSession:false,storage:{clear(){}},client:{auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}};}`}));
await context.route('**/systems/core/site-shell.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace(/\binitViewerActions\(\);/g,'/* manual account fixture */')});});
await context.route('**/systems/community/viewer-collections.mjs*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace(/if\s*\(root\)\s*void\s+mountViewerCollection\(root\);/,'/* manual collection fixture */')});});
await context.route('**/__fas_viewer_sync_fixture/**',async route=>{
 const [owner,tab,name]=new URL(route.request().url()).pathname.split('/').slice(2).map(decodeURIComponent),args=route.request().postDataJSON();calls.push({owner,tab,name,args});
 let data;
 if(name==='fas_my_viewer_actions')data=args.content_keys.map(key=>({...state(owner,key)}));
 else if(name==='fas_my_viewer_collection'){
  const rows=[...catalog.values()].filter(i=>state(owner,i.url).saved&&(['game','tool'].includes(i.type)===(args.collection_key==='favourites'))).sort((a,b)=>state(owner,b.url).order-state(owner,a.url).order);
  const start=args.after_id?rows.findIndex(i=>i.id===args.after_id)+1:0,items=rows.slice(start,start+48),last=items.at(-1);
  data={items,next_cursor:start+48<rows.length?{id:last.id,saved_at:'2026-10-20T00:00:00Z'}:null};
 }
 const key=tab+'|'+name,gate=gates.get(key);if(gate){gates.delete(key);held.set(key,gate);await gate.wait;}
 if(name==='fas_set_viewer_action'){const s=state(owner,args.content_key);s[args.action_key]=args.enabled;if(args.action_key==='saved'&&args.enabled)s.order=++order;data={...s};}
 await route.fulfill({contentType:'application/json',body:JSON.stringify(failures.has(tab)?{error:{message:'fixture offline'}}:{data})});
});
async function open(tab,owner,path=story,{channel=true,settled=true}={}){
 const page=await context.newPage();page.setDefaultTimeout(8000);
 if(!channel)await page.addInitScript(()=>Object.defineProperty(window,'BroadcastChannel',{value:undefined,configurable:true}));
 await page.goto(origin+path);const consent=page.getByRole('button',{name:'Essentials only',exact:true});if(await consent.isVisible())await consent.click();
 await page.evaluate(async({tab,owner,path})=>{
  window.viewerLoadedKeys=new Set();window.viewerEndCallbacks=[];window.endViewerFixture=()=>window.viewerEndCallbacks.forEach(fn=>fn());
  const account={imageBase:'https://example.invalid/image',subscribe(fn){window.viewerEndCallbacks.push(fn);return ()=>{};},client:{rpc:async(name,args)=>{const result=await(await fetch(['','__fas_viewer_sync_fixture',owner,tab,name].join('/'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)})).json();if(name==='fas_my_viewer_actions'&&!result.error)args.content_keys.forEach(key=>window.viewerLoadedKeys.add(key));return result;}}};
  if(path.startsWith('/account/')){const {mountViewerCollection}=await import('/systems/community/viewer-collections.mjs');await mountViewerCollection(document.querySelector('[data-viewer-collection]'),{connect:async()=>account});}
  const {initViewerActions}=await import('/systems/community/viewer-actions.mjs');initViewerActions({connect:async()=>account});
 },{tab,owner,path});
 if(!path.startsWith('/account/'))await page.waitForFunction(()=>{const b=document.querySelector('main .viewer-content-actions [data-viewer-action=saved]');return b&&!b.disabled;});
 if(settled&&!path.startsWith('/account/')){await page.locator('#related-content-grid article').first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[data-viewer-key]')].every(h=>window.viewerLoadedKeys.has(h.dataset.viewerKey)));}
 return page;
}
const action=(page,name)=>page.locator('main .viewer-content-actions [data-viewer-action='+name+']');
async function selected(page,name,on){await page.waitForFunction(({name,on})=>document.querySelector('main .viewer-content-actions [data-viewer-action='+name+']')?.getAttribute('aria-pressed')===String(on),{name,on});}
async function signal(page){await page.evaluate(()=>{const channel=new BroadcastChannel('fas-viewer-actions-v1');channel.postMessage('changed');channel.close();});}
try{
 const left=await open('left','alice'),right=await open('right','alice'),other=await open('other','bob');
 await other.evaluate(()=>{window.syncMessages=[];window.syncMonitor=new BroadcastChannel('fas-viewer-actions-v1');window.syncMonitor.onmessage=e=>window.syncMessages.push(e.data);});
 for(const name of ['saved','experienced','loved']){await action(left,name).click();await selected(left,name,true);await selected(right,name,true);await selected(other,name,false);}
 await action(right,'loved').click();await selected(left,'loved',false);
 assert.ok(await other.evaluate(()=>window.syncMessages.length>=3&&window.syncMessages.every(x=>x==='changed')),'messages carry no choices, keys or account identity');
 assert.ok(calls.filter(c=>c.tab==='other').every(c=>c.owner==='bob'));console.log('PASS bidirectional save/read/loved updates and account isolation');
 const before=count('left','fas_my_viewer_actions');await right.evaluate(()=>{const channel=new BroadcastChannel('fas-viewer-actions-v1');for(let i=0;i<30;i++)channel.postMessage('changed');channel.close();});
 await until(()=>count('left','fas_my_viewer_actions')>before,'broadcast refresh');assert.ok(count('left','fas_my_viewer_actions')>before&&count('left','fas_my_viewer_actions')<=before+2,'bursts are coalesced');
 hold('right','fas_my_viewer_actions');await right.evaluate(()=>dispatchEvent(new Event('focus')));await reached('right','fas_my_viewer_actions');
 await action(right,'loved').click();await selected(right,'loved',true);release('right','fas_my_viewer_actions');await right.waitForTimeout(150);await selected(right,'loved',true);
 console.log('PASS a late refresh cannot undo a newer local write');
 hold('right','fas_set_viewer_action');await action(right,'experienced').click();await reached('right','fas_set_viewer_action');
 await action(left,'loved').click();await selected(left,'loved',false);await right.waitForTimeout(1200);release('right','fas_set_viewer_action');
 await selected(right,'experienced',false);await selected(right,'loved',false);await selected(left,'experienced',false);
 console.log('PASS changes arriving during a pending write are reread afterwards');
 const fallback=await open('fallback','alice',story,{channel:false});await selected(fallback,'loved',false);
 await fallback.evaluate(()=>Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}));
 await action(left,'loved').click();await selected(left,'loved',true);const hiddenCount=count('fallback','fas_my_viewer_actions');await fallback.evaluate(()=>dispatchEvent(new Event('online')));await fallback.waitForTimeout(150);assert.equal(count('fallback','fas_my_viewer_actions'),hiddenCount);
 await fallback.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'));dispatchEvent(new Event('focus'));});await selected(fallback,'loved',true);
 failures.add('fallback');state('alice',story).loved=false;await fallback.evaluate(()=>dispatchEvent(new Event('focus')));await fallback.waitForFunction(()=>document.querySelector('.story-header + .viewer-content-actions [data-viewer-status]')?.textContent.includes('could not load'));await selected(fallback,'loved',true);
 failures.delete('fallback');await fallback.evaluate(()=>dispatchEvent(new Event('online')));await selected(fallback,'loved',false);
 console.log('PASS visibility/reconnect fallback and confirmed-state preservation after failed reads');
 hold('late','fas_my_viewer_actions');const late=await open('late','alice',story,{settled:false});await reached('late','fas_my_viewer_actions');
 state('alice',story).loved=true;await signal(left);await selected(late,'loved',true);release('late','fas_my_viewer_actions');await late.waitForTimeout(150);await selected(late,'loved',true);
 console.log('PASS a late initial read cannot replace a newer refresh');
 hold('right','fas_my_viewer_actions');await right.evaluate(()=>dispatchEvent(new Event('focus')));await reached('right','fas_my_viewer_actions');await right.evaluate(()=>window.endViewerFixture());release('right','fas_my_viewer_actions');await right.waitForTimeout(150);await selected(right,'saved',false);assert.equal(await action(right,'saved').isDisabled(),true);const endedCount=count('right','fas_my_viewer_actions');await signal(left);await right.evaluate(()=>dispatchEvent(new Event('focus')));await right.waitForTimeout(150);assert.equal(count('right','fas_my_viewer_actions'),endedCount);
 console.log('PASS session end cancels refresh results and removes sync listeners');
 if(await action(left,'saved').getAttribute('aria-pressed')==='true'){await action(left,'saved').click();await selected(left,'saved',false);}
 for(let i=0;i<50;i++){const key='/stories/sync-fixture-'+i+'/';catalog.set(key,item(key));Object.assign(state('alice',key),{saved:true,order:++order});}
 const collection=await open('collection','alice','/account/saved/'),grid=collection.locator('.viewer-collection-grid');
 await collection.waitForFunction(()=>document.querySelectorAll('.viewer-collection-grid article').length===48);await collection.getByRole('button',{name:'Load more',exact:true}).click();await collection.waitForFunction(()=>document.querySelectorAll('.viewer-collection-grid article').length===50);
 await collection.evaluate(()=>{window.keptCard=document.querySelector('.viewer-collection-grid article');window.keptLink=window.keptCard.querySelector('a');window.keptLink.focus();});
 await action(left,'saved').click();await selected(left,'saved',true);await collection.waitForFunction(()=>document.querySelectorAll('.viewer-collection-grid article').length===51);
 assert.equal(await collection.evaluate(()=>window.keptCard===document.querySelectorAll('.viewer-collection-grid article')[1]&&document.activeElement===window.keptLink),true,'preserve card identity, focus and loaded pagination');
 await collection.waitForFunction(()=>document.querySelector('.viewer-collection-grid article[data-viewer-content="/stories/onto-the-stage/"] [data-viewer-action=saved]')?.getAttribute('aria-pressed')==='true');
 await action(left,'saved').click();await selected(left,'saved',false);await collection.waitForFunction(()=>document.querySelectorAll('.viewer-collection-grid article').length===50);
 const removalKey=await grid.locator('article').first().getAttribute('data-viewer-content');
 hold('collection','fas_my_viewer_collection');await collection.evaluate(()=>dispatchEvent(new Event('focus')));await reached('collection','fas_my_viewer_collection');
 await grid.locator('article').first().locator('[data-viewer-action=saved]').click();await collection.waitForFunction(()=>document.querySelectorAll('.viewer-collection-grid article').length===49);release('collection','fas_my_viewer_collection');
 await collection.waitForTimeout(250);assert.equal(await grid.locator('article').count(),49);assert.equal(await grid.locator('article[data-viewer-content="'+removalKey+'"]').count(),0);
 const flags={experienced:state('alice',removalKey).experienced,loved:state('alice',removalKey).loved};
 await collection.locator('[data-viewer-undo]').click();await collection.waitForFunction(()=>document.querySelectorAll('.viewer-collection-grid article').length===50);assert.equal(state('alice',removalKey).saved,true);assert.deepEqual({experienced:state('alice',removalKey).experienced,loved:state('alice',removalKey).loved},flags);
 console.log('PASS collection additions/removals, retained pagination/focus, Undo and no stale card resurrection');
 hold('collection','fas_my_viewer_collection');await collection.evaluate(()=>dispatchEvent(new Event('focus')));await reached('collection','fas_my_viewer_collection');await collection.evaluate(()=>window.endViewerFixture());release('collection','fas_my_viewer_collection');await collection.waitForTimeout(150);assert.equal(await collection.locator('.viewer-collection-grid').count(),0);assert.match(await collection.locator('[data-viewer-collection]').textContent(),/account changed/);
 console.log('PASS collection session changes cannot restore private cards from a late response');
 const game='/games/rally-clash/';catalog.set(game,item(game,'game'));
 const gamePage=await open('game','alice',game),favourites=await open('favourites','alice','/account/favourites/');
 await favourites.waitForFunction(()=>document.querySelector('[data-viewer-collection]')?.textContent.includes('Nothing here yet'));
 await action(gamePage,'saved').click();await selected(gamePage,'saved',true);
 await favourites.waitForFunction(()=>document.querySelectorAll('.viewer-collection-grid article').length===1);
 await favourites.waitForFunction(()=>document.querySelector('.viewer-collection-grid [data-viewer-action=saved]')?.getAttribute('aria-pressed')==='true');
 await action(gamePage,'saved').click();await selected(gamePage,'saved',false);await favourites.waitForFunction(()=>!document.querySelector('.viewer-collection-grid article'));
 await action(gamePage,'saved').click();await selected(gamePage,'saved',true);await favourites.waitForFunction(()=>document.querySelector('.viewer-collection-grid [data-viewer-action=saved]')?.getAttribute('aria-pressed')==='true');
 await favourites.locator('.viewer-collection-grid [data-viewer-action=saved]').click();await selected(gamePage,'saved',false);await favourites.locator('[data-viewer-undo]').click();await selected(gamePage,'saved',true);await favourites.waitForFunction(()=>document.querySelector('.viewer-collection-grid [data-viewer-action=saved]')?.getAttribute('aria-pressed')==='true');
 await favourites.locator('.viewer-collection-grid [data-viewer-action=saved]').click();await favourites.locator('[data-viewer-undo]').waitFor();hold('favourites','fas_set_viewer_action');await favourites.locator('[data-viewer-undo]').click();await reached('favourites','fas_set_viewer_action');await favourites.evaluate(()=>window.endViewerFixture());release('favourites','fas_set_viewer_action');await favourites.waitForTimeout(150);assert.equal(await favourites.locator('.viewer-collection-grid').count(),0);assert.match(await favourites.locator('[data-viewer-collection]').textContent(),/account changed/);
 console.log('PASS Favourites updates and Undo sync across tabs; late Undo cannot reopen a signed-out collection');
}finally{for(const gate of held.values())gate.release();await context.close();await browser.close();}
