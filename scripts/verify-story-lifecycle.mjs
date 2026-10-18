import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173'],{stdio:'ignore'});let browser;
const url='http://127.0.0.1:5173/tests/studio-preview/?fixture-persist=1';
try{
 for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch();await mkdir('.preview-cache/studio-lifecycle',{recursive:true});
 async function fresh(width=1440){const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await page.locator('[data-essential]').click();await page.locator('[data-library] button').first().waitFor();return{context,page,errors};}
 async function open(page,title='The lantern keeper'){await page.getByRole('button',{name:'Open '+title,exact:true}).click();await page.locator('[data-workspace]').waitFor({state:'visible'});await page.locator('#ss-tab-publish').click();}
 async function state(page,label){try{await page.waitForFunction(label=>document.querySelector('.ss-badge[data-state]')?.textContent===label,label,{timeout:7000});}catch(error){console.log('STATE DEBUG',await page.locator('[data-status]').innerText(),await page.locator('[data-checklist]').innerText(),await page.locator('.ss-badge[data-state]').allTextContents());throw error;}}
 async function lifecycle(page){if(!(await page.locator('[data-lifecycle-options]').getAttribute('open')))await page.locator('[data-lifecycle-options] summary').click();}
 async function cancelNext(page){page.removeAllListeners('dialog');page.once('dialog',d=>d.dismiss());}
 const rows=page=>page.evaluate(()=>window.__studioPreview.rows());
 {
  const {context,page,errors}=await fresh();await open(page);const original=(await rows(page))[0];
  await page.locator('[data-publish]').click();await state(page,'Published');assert.equal(await page.locator('[data-delete-draft]').isVisible(),false);
  await cancelNext(page);await page.locator('[data-unpublish]').click();assert.equal((await rows(page))[0].status,'published');page.on('dialog',d=>d.accept());await page.locator('[data-unpublish]').click();await state(page,'Private draft');
  await page.locator('[data-publish]').click();await state(page,'Published');await lifecycle(page);
  await cancelNext(page);await page.locator('[data-archive]').click();assert.equal((await rows(page))[0].status,'published');page.on('dialog',d=>d.accept());await page.locator('[data-archive]').click();await state(page,'Archived');
  assert.equal(await page.locator('[data-manuscript]').getAttribute('contenteditable'),'false');assert.equal((await rows(page))[0].scheduled_at,null);
  await page.locator('[data-restore]').click();await state(page,'Private draft');assert.equal((await rows(page))[0].id,original.id);assert.equal((await rows(page))[0].slug,original.slug);assert.equal((await rows(page))[0].cover_asset_id,original.cover_asset_id);await page.waitForTimeout(2200);assert.equal((await rows(page))[0].status,'draft');
  await page.locator('[data-publish]').click();await state(page,'Published');await page.locator('[data-archive]').click();await state(page,'Archived');await page.locator('[data-delete-draft]').click();
  await page.locator('#ss-delete-confirm-title').fill('Wrong title');await page.locator('[data-confirm-delete]').click();assert.equal(await page.locator('[data-delete-dialog]').getAttribute('open'),'');assert.equal((await rows(page)).length,5);
  await page.locator('[data-keep-draft]').click();assert.equal((await rows(page)).length,5);
  await page.locator('[data-delete-draft]').click();await page.locator('#ss-delete-confirm-title').fill(original.title);await page.locator('[data-confirm-delete]').click();await page.getByText('Archived piece permanently deleted.',{exact:true}).waitFor();assert.equal((await rows(page)).length,4);assert.equal(await page.getByRole('button',{name:'Open '+original.title,exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('fas-studio-recovery-v1:')).length),0);assert.deepEqual(errors,[]);console.log('PASS self-publish, confirmed unpublish/archive, private restore, stable ID/cover/address and typed permanent deletion');await context.close();
 }
 {
  const {context,page,errors}=await fresh(390);await open(page);
  const when=new Date(Date.now()+86400000).toISOString().slice(0,16);await page.locator('#ss-publish-time').fill(when);await page.locator('[data-schedule]').click();await state(page,'Scheduled');
  await lifecycle(page);await page.locator('[data-archive]').click();await state(page,'Archived');await page.locator('[data-restore]').click();await state(page,'Private draft');assert.equal((await rows(page))[0].scheduled_at,null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'.preview-cache/studio-lifecycle/mobile-restore.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS scheduled archive cancels publication; restore stays unscheduled; mobile controls fit');await context.close();
 }
 {
  const {context,page,errors}=await fresh();await open(page,'The locked door');await lifecycle(page);await state(page,'Moderation lock');
  for(const key of ['archive','restore','delete-draft'])assert.equal(await page.locator('[data-'+key+']').isVisible(),false);
  assert.equal(await page.locator('[data-manuscript]').getAttribute('contenteditable'),'false');assert.match(await page.locator('[data-lifecycle-note]').innerText(),/Only an administrator/);assert.deepEqual(errors,[]);console.log('PASS moderation locks have no author restore/delete or editable manuscript');await context.close();
 }
 {
  const {context,page,errors}=await fresh();await open(page);await lifecycle(page);await page.getByText('Preview test controls',{exact:true}).click();await page.getByRole('button',{name:'Simulate next save failure',exact:true}).click();await page.locator('[data-archive]').click();
  await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Sample lifecycle failure'));assert.equal((await rows(page))[0].status,'draft');
  await page.getByRole('button',{name:'Simulate conflicting edit',exact:true}).click();await page.locator('[data-archive]').click();await page.locator('[data-conflict]').waitFor({state:'visible'});assert.equal((await rows(page))[0].status,'draft');assert.equal(await page.locator('[data-archive]').isDisabled(),true);
  assert.deepEqual(errors,[]);console.log('PASS failed and stale lifecycle actions never falsely archive content');await context.close();
 }
 {
  const {context,page,errors}=await fresh();await open(page);await lifecycle(page);await page.locator('[data-manuscript]').fill('Unsaved words before archive.');await page.locator('[data-archive]').click();assert.match(await page.locator('[data-status]').innerText(),/Save your writing changes/);assert.equal((await rows(page))[0].status,'draft');assert.deepEqual(errors,[]);console.log('PASS archive protects unsaved edits by requiring an explicit save first');await context.close();
 }
}finally{await browser?.close();server.kill();}
