import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173'],{stdio:'ignore'});let browser;
try{
 const base='http://127.0.0.1:5173/tests/profile-preview/';
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch();await mkdir('.preview-cache/image-storage',{recursive:true});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1100}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const portrait=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR4nGOIcpMjCTGMahgUGgA2zWrhijW97QAAAABJRU5ErkJggg==','base64');
  await page.route('https://oqmmvjjycpyxvxipcyli.supabase.co/functions/v1/fas-profile-image**',route=>route.fulfill({status:200,contentType:'image/png',body:portrait,headers:{'Access-Control-Allow-Origin':'*'}}));
  await page.goto(base);if(await page.locator('[data-essential]').isVisible())await page.locator('[data-essential]').click();
  await page.locator('#profile-display-name').waitFor();await page.waitForFunction(()=>!document.querySelector('.profile-editor fieldset').disabled&&!document.querySelector('.profile-image-fields').disabled);
  assert.equal(await page.locator('#profile-display-name').inputValue(),'Alex Morgan');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=400;const ctx=c.getContext('2d');ctx.fillStyle='#6d2336';ctx.fillRect(0,0,400,400);ctx.fillStyle='#dfc389';ctx.fillRect(400,0,400,400);return c.toDataURL().split(',')[1];});
  await page.locator('#profile-image-file').setInputFiles({name:'wide.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('[data-profile-image] canvas').waitFor({state:'visible'});
  await page.locator('#profile-image-x').focus();await page.keyboard.press('End');assert.equal(await page.locator('#profile-image-x').inputValue(),'100');
  await page.locator('#profile-image-alt').fill('A fictional gold and wine portrait');await page.locator('[data-profile-image] [data-upload]').click();await page.waitForFunction(()=>window.__profilePreview.uploads().length===1);
  assert.deepEqual(await page.evaluate(()=>{const {width,height,type}=window.__profilePreview.uploads()[0];return {width,height,type};}),{width:512,height:512,type:'image/jpeg'});
  await page.locator('[data-current]').waitFor({state:'visible'});const old=await page.evaluate(()=>window.__profilePreview.image().asset_id);
  await page.locator('#profile-image-alt').fill('Updated fictional description');await page.locator('[data-profile-image] [data-alt]').click();await page.waitForFunction(()=>window.__profilePreview.image().alt==='Updated fictional description');
  await page.evaluate(()=>window.__profilePreview.fail(true));await page.locator('[data-profile-image] [data-alt]').click();await page.getByText('Image changed or session expired. Reload its saved state.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__profilePreview.image().asset_id),old);
  await page.evaluate(()=>window.__profilePreview.fail(false));await page.locator('[data-profile-image] [data-reload]').click();await page.waitForFunction(()=>!document.querySelector('.profile-image-fields').disabled);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.screenshot({path:`.preview-cache/image-storage/profile-${width}.png`,fullPage:true});
  page.once('dialog',d=>d.dismiss());await page.locator('[data-profile-image] [data-remove]').click();assert.equal(await page.evaluate(()=>window.__profilePreview.image().asset_id),old);
  page.once('dialog',d=>d.accept());await page.locator('[data-profile-image] [data-remove]').click();await page.waitForFunction(()=>window.__profilePreview.image().asset_id===null);
  await page.locator('#profile-image-file').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.getByText('Choose a JPEG or PNG up to 5 MiB.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__profilePreview.uploads().length),1);
  await page.locator('#profile-display-name').fill('Edited pen name');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByText('Your profile was saved.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);await context.close();console.log('PASS profile upload/crop/alt/failure/reload/removal/text save at '+width);
 }

 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1100}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/tests/studio-preview/');if(await page.locator('[data-essential]').isVisible())await page.locator('[data-essential]').click();
  await page.getByRole('button',{name:'Open The lantern keeper',exact:true}).click();await page.locator('#ss-tab-cover').click();await page.getByText('Manage attached images',{exact:true}).click();
  await page.locator('#ss-manage-alt').fill('A revised lantern description');await page.locator('[data-save-image-alt]').click();await page.getByText('Image description saved.',{exact:true}).waitFor();assert.match(await page.locator('#ss-cover').innerText(),/A revised lantern description/);
  page.once('dialog',d=>d.accept());await page.locator('[data-remove-image]').click();await page.getByText('Choose and save another cover before removing this image.',{exact:true}).waitFor();
  await page.locator('#ss-cover').selectOption('');await page.locator('[data-save]').click();await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Private draft saved.'));
  page.once('dialog',d=>d.dismiss());await page.locator('[data-remove-image]').click();assert.equal(await page.locator('#ss-manage-asset option').count(),1);
  page.once('dialog',d=>d.accept());await page.locator('[data-remove-image]').click();await page.getByText('Unused image removed. Stored bytes will be cleaned up automatically.',{exact:true}).waitFor();assert.equal(await page.locator('#ss-manage-asset option').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);await context.close();console.log('PASS cover description/reference guard/confirmation/removal at '+width);
 }
 const page=await browser.newPage();await page.goto(base+'?mode=viewer');await page.getByText('Only you can see your image while your account is a viewer.',{exact:false}).waitFor();await page.close();console.log('PASS viewer image privacy disclosure');
}finally{await browser?.close();server.kill();}
