import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch(),origin=process.argv[2]??'http://127.0.0.1:55410';
async function cookies(page){const b=page.getByRole('button',{name:'Essentials only',exact:true});if(await b.isVisible())await b.click();}
try{
 for(const width of [1920,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  for(const mode of ['contributor','viewer']){
   await page.goto(origin+'/tests/profile-preview/?mode='+mode);await cookies(page);const input=page.locator('[name=display_name]');await input.waitFor();await page.waitForFunction(()=>!document.querySelector('form fieldset').disabled);
   const signOut=async()=>{const menu=page.locator('main .account-navigation-menu');if(await menu.getAttribute('open')===null)await menu.locator('summary').click();await page.locator('main [data-account-sign-out]').click();};
   const original=await input.inputValue();await input.fill(original+' changed');
   let prompts=0;const dismiss=async dialog=>{prompts++;await dialog.dismiss();};page.on('dialog',dismiss);
   await signOut();assert.equal(prompts,1);assert.equal(await page.evaluate(()=>__profilePreview.signOuts()),0);
   await page.evaluate(()=>__profilePreview.profileFail(true));await page.locator('form.profile-editor [type=submit]').click();await page.getByText('Your profile could not be saved. Please try again.',{exact:true}).waitFor();
   await signOut();assert.equal(prompts,2,'failed saves remain protected');
   await page.evaluate(()=>__profilePreview.profileFail(false));await page.locator('form.profile-editor [type=submit]').click();await page.getByText('Your profile was saved.',{exact:true}).waitFor();
   // Synthetic beforeunload checks avoid navigating away from the fixture.
   assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;}),false);
   await input.fill(original+' another');assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;}),true);
   await page.evaluate(()=>__profilePreview.profileDelay(500));await page.evaluate(()=>{document.querySelector('form.profile-editor').requestSubmit();document.querySelector('main [data-account-sign-out]').click();});assert.equal(await page.evaluate(()=>__profilePreview.signOuts()),0,'pending save blocks signout');await page.getByText('Your profile was saved.',{exact:true}).waitFor();
   if(mode==='viewer'){assert.equal(await page.locator('[data-profile-image]').count(),0,'viewer photo controls are absent');await page.evaluate(()=>__profilePreview.dispose());page.off('dialog',dismiss);continue;}
   const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');x.fillStyle='#182a46';x.fillRect(0,0,160,160);return c.toDataURL('image/png').split(',')[1];});
   await context.route('**/functions/v1/fas-story-image**',route=>route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')}));
   await page.locator('#profile-image-file').setInputFiles({name:'crop.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('[data-profile-image] [data-upload]:enabled').waitFor();
   assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;}),true,'staged image crop is protected');
   await signOut();assert.equal(await page.evaluate(()=>__profilePreview.signOuts()),0);
   await page.evaluate(()=>__profilePreview.fail(true));await page.locator('[data-profile-image] [data-upload]').click();await page.getByText('Image changed or session expired. Reload its saved state.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;}),true,'failed image upload remains protected');
   await page.evaluate(()=>{__profilePreview.fail(false);__profilePreview.imageDelay(500);document.querySelector('[data-profile-image] [data-upload]').click();document.querySelector('main [data-account-sign-out]').click();});assert.equal(await page.evaluate(()=>__profilePreview.signOuts()),0,'pending image upload blocks signout');await page.locator('[data-profile-image] [data-reload]:enabled').waitFor();
   assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;}),false,'saved image clears protection');
   await page.locator('#profile-image-alt').fill('An updated image description');assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;}),true,'image description is protected');await page.locator('[data-profile-image] [data-alt]').click();await page.locator('[data-profile-image] [data-reload]:enabled').waitFor();assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;}),false);
   await context.unroute('**/functions/v1/fas-story-image**');
   await page.evaluate(()=>__profilePreview.dispose());assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});dispatchEvent(e);return e.defaultPrevented;}),false,'dispose removes guard');page.off('dialog',dismiss);
  }
  await page.goto(origin+'/tests/studio-preview/');await cookies(page);await page.locator('[data-library] button').filter({hasText:'Writing the spaces between'}).click();await page.locator('[data-workspace]:not([hidden])').waitFor();
  const old=await page.locator('[name=title]').inputValue();await page.locator('[name=title]').fill('A revised published title');await page.locator('[data-save]').click();await page.locator('[data-review-confirm]').click();await page.waitForFunction(()=>document.querySelector('[data-status]')?.dataset.saveState==='saved');
  await page.locator('.ss-content-history:visible summary').click();await page.locator('.ss-content-history:visible [data-history-load]').click();await page.getByRole('button',{name:'Restore this version',exact:true}).waitFor();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download this version',exact:true}).click();assert.match((await download).suggestedFilename(),/writing-the-spaces-between.txt/);
  page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Restore this version',exact:true}).click();await page.locator('[data-review-confirm]').click();await page.waitForFunction(t=>document.querySelector('[name=title]')?.value===t,old);
  assert.equal(await page.locator('[name=title]').inputValue(),old);await page.locator('.ss-content-history:visible summary').click();await page.locator('.ss-content-history:visible [data-history-load]').click();await page.getByText(/A revised published title/,{exact:false}).first().waitFor();assert.deepEqual(errors,[]);
  console.log('PASS '+width+'px profile guards, failed/pending saves, downloadable versions, live restore and undo history');await context.close();
 }
}finally{await browser.close();}
