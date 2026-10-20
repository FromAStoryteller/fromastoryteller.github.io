import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.argv[2]??'http://127.0.0.1:55410',browser=await chromium.launch();
async function dismiss(page){const b=page.getByRole('button',{name:'Essentials only',exact:true});if(await b.isVisible())await b.click();}
try{
 for(const viewport of [{width:1920,height:1040},{width:1024,height:768},{width:390,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport});await page.goto(origin+'/tools/countdown/');await dismiss(page);
  const controls=page.locator('.countdown-preset,.countdown-add,.countdown-action-button:visible');
  assert.ok(await controls.count()>=11);
  for(const e of await controls.all()){const r=await e.boundingBox();assert.ok(r.width>=43&&r.height>=43,'controls retain usable touch targets');assert.ok(await e.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'button labels fit');}
  const positions=await page.locator('.countdown-actions').evaluate(e=>[...e.querySelectorAll('button:not([hidden])')].map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,y:r.y}}));assert.ok(positions.every(r=>Math.abs(r.w-r.h)<1&&r.y===positions[0].y),'action buttons stay circular and aligned');
  const widget=await page.locator('.tool-widget').boundingBox(),frame=await page.locator('.tool-shell-frame').boundingBox();assert.ok(widget.width<=frame.width);assert.ok(await page.locator('.tool-shell-frame').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'no horizontal tool scrolling');
  await page.locator('[data-seconds="300"]').click();assert.equal(await page.locator('#countdown-minutes').inputValue(),'5');await page.locator('[data-add-seconds="60"]').click();assert.equal(await page.locator('#countdown-minutes').inputValue(),'6');await page.locator('#tool-action-button').click();await page.getByRole('button',{name:'Pause countdown',exact:true}).waitFor();await page.getByRole('button',{name:'Pause countdown',exact:true}).click();await page.getByRole('button',{name:'Resume countdown',exact:true}).waitFor();await page.close();console.log('PASS Countdown controls at '+viewport.width+'×'+viewport.height);
 }
 const page=await browser.newPage();await page.goto(origin+'/tests/studio-preview/');await dismiss(page);
 for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const selected=page.locator('.ss-library-scopes [aria-pressed="true"]');await selected.hover();await page.waitForTimeout(200);const colours=await selected.evaluate(e=>{const s=getComputedStyle(e),probe=document.createElement('span');probe.style.color='var(--colour-button-primary-text)';probe.style.background='var(--colour-accent-primary-hover)';e.append(probe);const p=getComputedStyle(probe),result={actual:[s.color,s.backgroundColor],expected:[p.color,p.backgroundColor]};probe.remove();return result;});assert.deepEqual(colours.actual,colours.expected);}
 await page.evaluate(async()=>{const {mountTemplateDownloads}=await import('/systems/community/template-downloads.mjs');const host=document.createElement('section');host.className='ss-template-downloads';host.id='template-polish';document.querySelector('main').append(host);mountTemplateDownloads(host);});
 assert.equal(await page.locator('#template-polish option[value="tool"]').count(),0);const check=await page.locator('[data-template-saves]').boundingBox(),label=await page.locator('#template-polish .ss-check span').boundingBox();assert.ok(Math.abs(check.y+check.height/2-label.y-label.height/2)<2);assert.ok(label.x>check.x+check.width);await page.close();console.log('PASS selected button themes, checkbox alignment and non-admin templates');
 // The large account/Auth module is deliberately stalled. The small shell must
 // already display the current session's verified navigation destinations.
 for(const destination of ['settings','profile','studio','admin']){
  const context=await browser.newContext();await context.addInitScript(()=>{const prefix='fas-account-test-supabase-co',user='81000000-0000-0000-0000-000000000001',session='82000000-0000-0000-0000-000000000001';sessionStorage.setItem(prefix+'-mode','remembered');localStorage.setItem(prefix+'-remembered',JSON.stringify({user:{id:user},access_token:'e30.'+btoa(JSON.stringify({session_id:session}))+'.fixture'}));sessionStorage.setItem('fas-account-navigation-v1',JSON.stringify({user,session,key:prefix+'-remembered',store:'localStorage',admin:true,contributor:true,publicId:user,expires:Date.now()+600000}));});
  await context.route('**/account/local-auth-client.mjs',route=>route.fulfill({contentType:'text/javascript',body:'await new Promise(()=>{});export function loadLocalAuthClient(){}'}));
  const page=await context.newPage();await page.goto(origin+'/account/'+destination+'/',{waitUntil:'commit'});const nav=page.locator('[data-navigation-shell]');await nav.getByRole('link',{name:'Storyteller Studio',exact:true}).waitFor({timeout:5000});assert.equal(await nav.getByRole('link',{name:'Admin tools',exact:true}).count(),1);assert.equal(await nav.getByRole('link',{name:'View public profile',exact:true}).count(),1);if(destination==='settings'){
   await context.unroute('**/account/local-auth-client.mjs');
   await context.route('**/account/local-auth-client.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
    const user={id:'81000000-0000-0000-0000-000000000001',email:'fixture@example.invalid'};
    const stalled=()=>new Promise(()=>{}),auth={getSession:async()=>({data:{session:{}}}),refreshSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})};
    const client={auth,from(){return {select(){return this},eq(){return this},single:stalled,then(resolve,reject){return Promise.resolve({data:[{role:'member'}]}).then(resolve,reject)}}},rpc:async name=>name==='fas_my_account_state'?{data:'active'}:stalled()};
    export async function loadLocalAuthClient(){return {mode:'local',hadSession:true,storage:{clear(){}},client};}
   `}));
   await page.goto(origin+'/account/settings/');await page.locator('.account-navigation:not([data-navigation-shell])').getByRole('button',{name:'Sign out',exact:true}).waitFor();assert.equal(await page.locator('.account-navigation').getByRole('link',{name:'Admin tools',exact:true}).count(),0);assert.equal(await page.locator('.account-navigation').getByRole('link',{name:'View public profile',exact:true}).count(),1);assert.equal(await page.evaluate(async()=>{const{navigationSnapshot}=await import('/account/navigation-shell.mjs');return navigationSnapshot().admin;}),false);console.log('PASS fresh verification removes a stale admin presentation hint');
  }
  await context.close();console.log('PASS immediate '+destination+' navigation before account SDK is ready');
 }
}finally{await browser.close();}
