import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:55410/tests/admin-preview/');
  const send=page.locator('[data-email-invite]');
  await send.waitFor();await assert.doesNotReject(()=>send.click({trial:true}));
  await page.getByLabel('Email address',{exact:true}).fill('controlled@example.invalid');
  await send.click();
  await page.getByText('Email: Accepted by email provider',{exact:true}).waitFor();
  assert.equal(await page.getByText('Email: Delivered',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>window.__adminEmailPreview.fail(true));
  await page.getByLabel('Email address',{exact:true}).fill('failed@example.invalid');
  await page.locator('[data-email-invite]').click();
  await page.getByRole('status').filter({hasText:'Email delivery was not confirmed'}).waitFor();
  assert.equal(await page.locator('[data-email-invite]').isEnabled(),true);
  await page.evaluate(()=>{window.__adminEmailPreview.fail(false);window.__adminEmailPreview.ready(false);});
  await page.getByRole('button',{name:'Refresh delivery status',exact:true}).click();
  assert.equal(await page.locator('[data-email-invite]').isDisabled(),true);
  await page.getByText('Create a private link instead',{exact:true}).click();
  await page.getByLabel('Email address',{exact:true}).fill('manual@example.invalid');
  await page.getByRole('button',{name:'Create invitation link',exact:true}).click();
  await page.getByRole('heading',{name:'Invitation link ready'}).waitFor();
  assert.match(await page.getByLabel('Private contributor invitation link').inputValue(),/\/account\/invitation\/#invite=/);
  assert.equal(await page.locator('[data-email-invite]').isDisabled(),true);
  console.log('PASS admin invitation controls '+width+'px: accepted versus delivered, failed send, disabled setup, private-link fallback, no overflow');
  await page.close();
 }
 const results=await Promise.all(['fas-contributor-email','fas-email-events'].map(async name=>{
  const response=await fetch('https://oqmmvjjycpyxvxipcyli.supabase.co/functions/v1/'+name,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(response.status,name==='fas-contributor-email'?401:503);return name+' safely disabled';
 }));console.log('PASS deployed DEV endpoints: '+results.join('; '));
} finally {await browser.close();}
