import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173'],{stdio:'ignore'});let browser;
const url='http://127.0.0.1:5173/tests/studio-preview/?fixture-persist=1';
try{
 for(let i=0;i<60;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch();await mkdir('.preview-cache/studio-recovery',{recursive:true});
 async function fresh(width=1440){const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(url);await page.locator('[data-essential]').click();await page.locator('[data-library] button').first().waitFor();return{context,page,errors};}
 async function open(page,title='The lantern keeper'){await page.getByRole('button',{name:'Open '+title,exact:true}).click();await page.locator('[data-workspace]').waitFor({state:'visible'});}
 async function controls(page){await page.getByText('Preview test controls',{exact:true}).click();}
 async function saved(page){await page.waitForFunction(()=>document.querySelector('[data-status]')?.textContent.includes('Private draft saved.'));}
 const body=page=>page.locator('[data-manuscript]');
 {
  const {context,page,errors}=await fresh();await page.locator('[data-new]').click();await page.locator('[data-type-choices]').getByRole('button',{name:'Story',exact:true}).click();
  await page.locator('#ss-title').fill('Autosave and reload');await body(page).fill('First saved writing.');await saved(page);
  const id=new URL(page.url()).searchParams.get('draft');assert.ok(id);await page.reload();await page.waitForFunction(()=>document.querySelector('#ss-title')?.value==='Autosave and reload');assert.equal(await body(page).innerText(),'First saved writing.');
  await body(page).fill('Unsaved preview words.');await page.locator('[data-preview]').click();assert.match(await page.locator('[data-page-preview]').innerText(),/Unsaved preview words/);await page.locator('[data-close-preview]').click();
  assert.deepEqual(errors,[]);console.log('PASS create, autosave, reload and preview of newest words');await context.close();
 }
 {
  const {context,page,errors}=await fresh();await open(page);await controls(page);await page.locator('[data-tab-recovery]').check();
  await page.getByRole('button',{name:'Simulate next save failure',exact:true}).click();await body(page).fill('Failed save: first words.');await page.locator('[data-save]').click();
  await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Sample save failure'));await body(page).fill('Failed save: newest recovered words.');await page.waitForTimeout(2200);
  assert.ok(!(await page.evaluate(()=>window.__studioPreview.rows()[0].body)).includes('newest recovered'));await page.reload();await page.locator('[data-recovery-notice]').waitFor({state:'visible'});
  await page.locator('[data-resume-recovery]').click();await page.locator('[data-workspace]').waitFor({state:'visible'});assert.equal(await body(page).innerText(),'Failed save: newest recovered words.');
  await page.waitForTimeout(2200);assert.ok(!(await page.evaluate(()=>window.__studioPreview.rows()[0].body)).includes('newest recovered'));await page.locator('[data-save]').click();await saved(page);
  await page.getByText('Preview test controls',{exact:true}).click();await page.getByRole('button',{name:'Delay next save',exact:true}).click();
  await body(page).fill('Earlier save payload.');await page.locator('[data-save]').click();await body(page).fill('Newest words typed during the save.');await page.keyboard.press('Control+s');await saved(page);
  assert.equal(await page.evaluate(()=>window.__studioPreview.rows()[0].body),'Newest words typed during the save.');assert.deepEqual(errors,[]);console.log('PASS failed save, no silent retries, tab reload recovery and typing during save');await context.close();
 }
 {
  const {context,page,errors}=await fresh(390);await open(page);await controls(page);await page.getByRole('button',{name:'Simulate conflicting edit',exact:true}).click();await body(page).fill('My protected stale version.');await page.locator('[data-save]').click();
  await page.locator('[data-conflict]').waitFor({state:'visible'});await page.locator('[data-conflict-copy]').click();assert.equal(await body(page).innerText(),'My protected stale version.');await page.waitForTimeout(2200);
  assert.equal(await page.evaluate(()=>window.__studioPreview.rows().length),5);await page.locator('[data-save]').click();await saved(page);
  const rows=await page.evaluate(()=>window.__studioPreview.rows());assert.equal(rows.length,6);assert.equal(rows[0].status,'draft');assert.notEqual(rows[0].id,rows[1].id);assert.ok(!rows[1].body.includes('My protected stale'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:'.preview-cache/studio-recovery/mobile-copy.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS stale save becomes a separate private draft; mobile fits');await context.close();
 }
 for(const wrong of [false,true]){
  const {context,page,errors}=await fresh();await open(page);await body(page).fill('PRIVATE UNSAVED SESSION WORDS');await page.evaluate(()=>window.__studioPreview.expire());
  await page.locator('[data-recovery-locked]').waitFor();assert.ok(!(await page.locator('[data-studio-root]').innerText()).includes('PRIVATE UNSAVED'));assert.equal(await page.locator('[data-manuscript]').count(),0);
  await page.locator('#ss-recovery-email').fill(wrong?'other@example.invalid':'owner@example.invalid');await page.locator('#ss-recovery-password').fill('recovery-demo');await page.getByRole('button',{name:'Sign in and recover',exact:true}).click();
  if(wrong){await page.getByText('Recovery discarded.',{exact:true}).waitFor();assert.ok(!(await page.locator('[data-studio-root]').innerText()).includes('PRIVATE UNSAVED'));assert.equal(await page.locator('[data-manuscript]').count(),0);}
  else{await page.locator('[data-recovery-notice]').waitFor({state:'visible'});await page.locator('[data-resume-recovery]').click();assert.equal(await body(page).innerText(),'PRIVATE UNSAVED SESSION WORDS');await page.locator('[data-save]').click();await saved(page);}
  assert.deepEqual(errors,[]);console.log('PASS expired-session recovery '+(wrong?'rejects a different account':'requires the verified original account'));await context.close();
 }
 {
  const {context,page,errors}=await fresh();await open(page);await context.setOffline(true);await body(page).fill('Offline writing survives.');await page.locator('[data-save]').click();assert.match(await page.locator('[data-status]').innerText(),/offline/);await context.setOffline(false);
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-export-current]').click();const download=await downloadPromise;const bytes=await readFile(await download.path());const recovery=JSON.parse(bytes);assert.equal(recovery.format,'fas-studio-recovery-v1');assert.equal(recovery.values.body,'Offline writing survives.');
  await page.locator('#ss-import-recovery').setInputFiles({name:'copy.fas-recovery.json',mimeType:'application/json',buffer:bytes});await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Recovered locally'));assert.equal(await body(page).innerText(),'Offline writing survives.');
  await page.locator('[data-save]').click();await saved(page);assert.deepEqual(errors,[]);console.log('PASS offline save, portable recovery download/import and explicit retry');await context.close();
 }
}finally{await browser?.close();server.kill();}
