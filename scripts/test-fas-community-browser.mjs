// Synthetic editor/browser integration. Never connects to a real account or publishes.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
const origin='http://127.0.0.1:55410';
async function saved(page){await page.waitForFunction(()=>document.querySelector('[data-status]')?.dataset.saveState==='saved');}
async function openOwner(page){
 await page.locator('[data-library] button').filter({hasText:'The lantern keeper'}).click();
 await page.locator('[data-workspace]:not([hidden])').waitFor();
}
async function preview(page){
 const button=page.locator('[data-preview]');await button.focus();await page.keyboard.press('Enter');
 await page.locator('.ss-preview-dialog[open]').waitFor();assert.match(await page.locator('[data-page-preview]').innerText(),/lantern keeper/i);
 await page.keyboard.press('Escape');await page.locator('.ss-preview-dialog').waitFor({state:'hidden'});
 assert.equal(await button.evaluate(node=>node===document.activeElement),true,'Preview returns keyboard focus');
}
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>{errors.push(e.message);console.log('Synthetic editor error: '+e.message);});
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(origin+'/tests/studio-preview/?fixture-persist');
  await openOwner(page);
  const details=page.getByRole('tab',{name:'Details',exact:true}),cover=page.getByRole('tab',{name:'Cover',exact:true}),publish=page.getByRole('tab',{name:'Publish',exact:true});
  await details.focus();await page.keyboard.press('ArrowRight');
  assert.equal(await cover.getAttribute('aria-selected'),'true');assert.equal(await details.getAttribute('tabindex'),'-1');
  assert.equal(await cover.evaluate(n=>n===document.activeElement),true);
  await page.keyboard.press('End');assert.equal(await publish.getAttribute('aria-selected'),'true');
  await page.keyboard.press('Home');assert.equal(await details.getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('[role=tab][tabindex="0"]').count(),1);
  await preview(page);console.log('PASS '+width+'px keyboard and private preview');
  await page.getByText('Preview test controls',{exact:true}).click();
  await page.getByRole('button',{name:'Simulate next save failure',exact:true}).click();
  const text='Recovery proof: the lantern stayed lit through a failed save.';
  await page.locator('[data-manuscript]').fill(text);
  await page.waitForFunction(()=>document.querySelector('[data-status]')?.textContent.includes('Sample save failure'));
  assert.equal(await page.locator('[data-manuscript]').innerText(),text);
  await page.reload();
  await page.locator('[data-recovery-notice]:not([hidden])').waitFor();
  await page.locator('[data-resume-recovery]').click();
  assert.equal(await page.locator('[data-manuscript]').innerText(),text);
  await page.locator('[data-manuscript]').focus();await page.keyboard.press('Control+s');await saved(page);
  assert.ok(await page.evaluate(text=>window.__studioPreview.rows().some(r=>r.body===text),text));
  // Actual browser offline mode leaves the words recoverable and does not pretend to save.
  console.log('PASS '+width+'px failed save and reload recovery');await context.setOffline(true);
  const offline=text+' Offline addition.';
  await page.locator('[data-manuscript]').fill(offline);await page.keyboard.press('Control+s');
  await page.waitForFunction(()=>document.querySelector('[data-status]')?.textContent.includes('You are offline'));
  assert.equal(await page.locator('[data-manuscript]').innerText(),offline);
  await context.setOffline(false);await page.keyboard.press('Control+s');await saved(page);
  console.log('PASS '+width+'px offline retry');await page.getByText('Preview test controls',{exact:true}).click();
  const sessionText=offline+' Session-expiry addition.';
  await page.locator('[data-manuscript]').fill(sessionText);
  await page.getByRole('button',{name:'Expire session',exact:true}).click();
  await page.getByRole('heading',{name:'Recover your unsaved writing',exact:true}).waitFor();
  assert.ok(!(await page.locator('[data-studio-root]').innerText()).includes(sessionText),'Locked recovery hides text');
  await page.locator('[data-studio-root] input[name=email]').fill('writer@example.invalid');
  await page.locator('[data-studio-root] input[name=password]').fill('recovery-demo');
  await page.getByRole('button',{name:'Sign in and recover',exact:true}).click();
  await page.locator('[data-resume-recovery]:not([hidden])').waitFor();await page.locator('[data-resume-recovery]').click();
  assert.equal(await page.locator('[data-manuscript]').innerText(),sessionText);
  await page.locator('[data-save]').click();await saved(page);
  console.log('PASS '+width+'px session recovery');await publish.click();await page.locator('[data-publish]').click();
  await page.waitForFunction(()=>document.querySelector('[data-state]')?.dataset.state==='published').catch(async()=>{throw new Error('Publication check: '+await page.locator('[data-status]').innerText()+'; checklist: '+await page.locator('[data-checklist]').innerText());});
  assert.equal(await page.locator('[data-save]').innerText(),'Save live changes');
  await page.locator('[data-unpublish]').click();
  await page.waitForFunction(()=>document.querySelector('[data-state]')?.dataset.state==='draft');
  await page.getByText('Archive & restore',{exact:true}).click();await page.locator('[data-archive]').click();
  await page.waitForFunction(()=>document.querySelector('[data-state]')?.dataset.state==='archived');
  await page.locator('[data-restore]').click();
  await page.waitForFunction(()=>document.querySelector('[data-state]')?.dataset.state==='draft');
  // A concurrent writer rejection retains local edits and offers copying rather than overwrite.
  await page.getByRole('button',{name:'Simulate conflicting edit',exact:true}).click();
  const conflictText=sessionText+' Conflicting change.';
  await page.locator('[data-manuscript]').fill(conflictText);await page.keyboard.press('Control+s');
  await page.waitForFunction(()=>document.querySelector('[data-status]')?.textContent.includes('changed elsewhere'));
  assert.equal(await page.locator('[data-manuscript]').innerText(),conflictText);
  await page.reload();await page.locator('[data-copy-recovery]').click();
  assert.equal(await page.locator('[data-manuscript]').innerText(),conflictText);
  await page.locator('[data-save]').click();await saved(page);
  // Delete a never-published recovered copy; cancelling must preserve it first.
  await page.locator('[data-delete-draft]').click();await page.locator('[data-keep-draft]').waitFor();
  assert.equal(await page.locator('[data-keep-draft]').evaluate(n=>n===document.activeElement),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('[data-workspace]').isVisible(),true);
  await page.locator('[data-delete-draft]').click();await page.locator('[data-confirm-delete]').click();
  await page.locator('[data-library-view]:not([hidden])').waitFor();
  assert.match(await page.locator('[data-library-feedback]').innerText(),/Draft deleted/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS Community browser '+width+'px: keyboard tabs/preview, failed save, offline retry, reload recovery, session expiry, lifecycle, conflict copy and confirmed deletion');
  await context.close();
 }
}finally{await browser.close();}
