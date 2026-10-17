import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5173/tests/studio-preview/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({headless:true});await mkdir('.preview-cache/publishing-interface',{recursive:true});
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/tests/studio-preview/');await page.locator('[data-essential]').click();await page.getByRole('button',{name:'Open The lantern keeper',exact:true}).click();
  await page.locator('[data-delete-draft]').waitFor({state:'visible'});
  const buttons=await page.locator('[data-download],[data-delete-draft]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};}));
  console.log(JSON.stringify({stage:'draft-actions',width,buttons}));assert.equal(buttons.length,2);assert.ok(Math.abs(buttons[0].top-buttons[1].top)<2,'draft actions must align');assert.ok(buttons[0].right<=buttons[1].left,'draft actions must not overlap');
  for(const b of buttons)assert.ok(b.left>=0&&b.right<=width+1&&b.height>=44,'touch targets must fit viewport');
  await page.locator('[data-publishing-choice]').waitFor({state:'visible'});
  await page.selectOption('#ss-publishing-name','fas');await page.locator('[data-preview]').click();
  assert.match(await page.locator('[data-page-preview]').innerText(),/By From A Storyteller/);await page.locator('[data-close-preview]').click();
  await page.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('saved'));
  await page.screenshot({path:'.preview-cache/publishing-interface/editor-'+width+'.png',fullPage:true});
  await page.locator('[data-return-library]').click();await page.getByRole('button',{name:'Open Fictional game',exact:true}).click();
  await page.locator('[data-file-view]').waitFor({state:'visible'});assert.equal(await page.locator('#ss-file-identity').isDisabled(),false);
  await page.selectOption('#ss-file-identity','fas');await page.locator('[data-file-save]').click();await page.waitForFunction(()=>document.querySelector('[data-file-status]').textContent.includes('saved'));
  await page.locator('[data-file-insights]').click();assert.match(await page.locator('#ss-insights-title').innerText(),/Fictional game/);assert.ok((await page.locator('#ss-report-page option').allTextContents()).includes('From A Storyteller page'));await page.locator('[data-back]').click();
  assert.equal(await page.locator('#ss-file-identity').inputValue(),'fas');await page.locator('[data-file-back]').click();
  await page.getByRole('button',{name:'Open Fictional game',exact:true}).click();assert.equal(await page.locator('#ss-file-identity').inputValue(),'fas');await page.locator('[data-file-back]').click();
  await page.getByRole('button',{name:'Open Fictional tool',exact:true}).click();assert.equal(await page.locator('#ss-file-identity').inputValue(),'fas');assert.equal(await page.locator('#ss-file-identity').isDisabled(),true);assert.equal(await page.locator('[data-file-save]').isVisible(),false);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'page must not overflow');
  await page.screenshot({path:'.preview-cache/publishing-interface/file-'+width+'.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,draftActions:buttons,selectionPersists:true,toolBylineFixed:true,errors}));await page.close();
 }
}finally{await browser?.close();server.kill();}
