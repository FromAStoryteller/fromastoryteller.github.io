import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.argv[2]??'http://127.0.0.1:55410',browser=await chromium.launch();
try{
 for(const width of [1440,390,320])for(const theme of ['dark','light']){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({colorScheme:theme});await page.goto(origin+'/tests/viewer-history-preview/');await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  const root=page.locator('#history'),cards=root.locator('.content-grid-card');await cards.first().waitFor();
  assert.equal(await cards.count(),48);await root.getByRole('button',{name:'Load more',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.content-grid-card').length===52);
  // Opt-in only; loading the history page never records a visit.
  await page.evaluate(()=>window.historyFixture.track());assert.equal(await page.evaluate(()=>window.historyFixture.calls.filter(c=>c.name==='fas_record_content_visit').length),0);
  await root.getByRole('button',{name:'Enable Recent Activity',exact:true}).click();await root.getByRole('button',{name:'Pause recording',exact:true}).waitFor();
  await page.evaluate(()=>window.historyFixture.track());await page.waitForFunction(()=>window.historyFixture.calls.some(c=>c.name==='fas_record_content_visit'));
  const params=await page.evaluate(()=>window.historyFixture.calls.find(c=>c.name==='fas_record_content_visit').args);assert.deepEqual(params,{content_key:'/stories/the-deal/',expected_version:1});
  await root.getByRole('button',{name:'Pause recording',exact:true}).click();await root.getByRole('button',{name:'Enable Recent Activity',exact:true}).waitFor();
  await root.getByRole('searchbox',{name:'Search history',exact:true}).fill('story 52');await page.waitForFunction(()=>document.querySelectorAll('.content-grid-card').length===1);assert.equal(await cards.locator('h3').innerText(),'Fictional story 52');
  await root.getByRole('button',{name:'Clear filters',exact:true}).click();await cards.first().waitFor();
  // Failed removal leaves the confirmed entry and offers a readable error.
  await page.evaluate(()=>window.historyFixture.fail=true);await root.getByRole('button',{name:'Remove Fictional story 1 from recent activity',exact:true}).click();await root.getByText('Your change could not be saved. Please try again.',{exact:true}).waitFor();assert.ok(await cards.count()>0);
  await page.evaluate(()=>window.historyFixture.fail=false);await root.getByRole('button',{name:'Try again',exact:true}).click();
  await root.getByRole('button',{name:'Remove Fictional story 1 from recent activity',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-activity-entry="a6940000-0000-4000-8000-000000000001"]'));assert.equal(await root.getByRole('button',{name:'Remove Fictional story 1 from recent activity',exact:true}).count(),0);
  await root.getByRole('button',{name:'Clear recent activity',exact:true}).click();await root.getByRole('dialog').waitFor();await root.getByRole('button',{name:'Keep activity',exact:true}).press('Escape');assert.equal(await root.getByRole('dialog').isVisible(),false);assert.ok(await cards.count()>0);
  await root.getByRole('button',{name:'Clear recent activity',exact:true}).click();await root.getByRole('dialog').getByRole('button',{name:'Clear recent activity',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.content-grid-card').length===0);
  assert.equal(await page.evaluate(()=>window.historyFixture.completed.length),3);
  // Real section URLs preserve direct links and normal browser navigation.
  await root.getByRole('link',{name:'Completed / Used / Played',exact:true}).evaluate(a=>a.href=location.pathname+'?view=completed');
  await root.getByRole('link',{name:'Completed / Used / Played',exact:true}).click();await cards.first().waitFor();
  assert.equal(await cards.count(),3);await root.getByText('Date not recorded',{exact:true}).first().waitFor();assert.equal(await root.getByRole('button',{name:'Enable Recent Activity',exact:true}).count(),0);
  await root.getByLabel('Content type',{exact:true}).selectOption('tool');await page.waitForFunction(()=>document.querySelectorAll('.content-grid-card').length===1);assert.equal(await cards.locator('h3').innerText(),'Useful timer');
  await root.getByLabel('Activity date',{exact:true}).selectOption('week');assert.equal(await cards.count(),0);
  await root.getByRole('button',{name:'Clear filters',exact:true}).click();await cards.first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:'../../outputs/history-'+width+'-'+theme+'.png',fullPage:true});
  await page.getByRole('button',{name:'End fictional session',exact:true}).click();await root.getByText('Your account changed. Sign in again to see your history.',{exact:true}).waitFor();assert.equal(await cards.count(),0);assert.deepEqual(errors,[]);
  await page.close();console.log('PASS history sections, consent, paging, search, failure, removal, clear isolation, dates, session clearing and layout '+width+' '+theme);
 }
 const page=await browser.newPage();await page.goto(origin+'/tests/viewer-history-preview/');await page.locator('.content-grid-card').first().waitFor();
 await page.evaluate(()=>{window.historyFixture.wait=true;window.dispatchEvent(new Event('focus'));});
 await page.waitForFunction(()=>typeof window.historyFixture.resolve==='function');
 await page.evaluate(()=>{window.historyFixture.end();window.historyFixture.resolve();});await page.getByText('Your account changed. Sign in again to see your history.',{exact:true}).waitFor();assert.equal(await page.locator('.content-grid-card').count(),0);await page.close();
 console.log('PASS delayed history response cannot restore another account’s private list');
}finally{await browser.close();}
