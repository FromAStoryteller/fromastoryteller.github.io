// Real UI modules with fictional accounts; never calls production account services.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.argv[2]??'http://127.0.0.1:55410',browser=await chromium.launch();
try{for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/tests/reader-discovery-preview/');
 const badge=page.locator('#preview-grid [data-viewer-experienced]:not([hidden])');await badge.waitFor();assert.equal(await badge.innerText(),'Read');
 assert.equal(await page.locator('#preview-featured .content-featured-segment').count(),2,'one story and one blog from the contributor');
 await page.locator('.story-author-panel').getByRole('link',{name:'Mara Vale',exact:true}).waitFor();
 await page.getByLabel('Genre',{exact:true}).selectOption({label:'Fantasy'});assert.equal(await page.locator('#preview-grid article').count(),2);
 await page.getByLabel('Reading length',{exact:true}).selectOption({label:'Under 5 minutes'});assert.equal(await page.locator('#preview-grid article').count(),1);assert.match(await page.locator('#preview-grid').innerText(),/A Quiet Summit/);
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();assert.equal(await page.locator('#preview-grid article').count(),3);
 const read=page.locator('.story-footer [data-viewer-action="experienced"]');await read.click();await page.waitForFunction(()=>document.querySelectorAll('#preview-grid [data-viewer-experienced]:not([hidden])').length===0);await read.click();await badge.waitFor();
 const feed=page.locator('#following-work-grid');assert.deepEqual(await feed.locator('h3').allTextContents(),['Behind the Mountain','A Quiet Summit','The Long Road']);assert.equal(await feed.locator('[data-viewer-experienced]:not([hidden])').innerText(),'Read');
 assert.equal(await page.getByRole('button',{name:'Try again',exact:true}).isVisible(),false);assert.equal(await page.getByRole('button',{name:'More storytellers',exact:true}).isVisible(),false);
 if(width>1024){const link=page.locator('.sidebar-item').first();await link.focus();await page.locator('.sidebar-label-tooltip:not([hidden])').waitFor();assert.equal(await page.locator('.sidebar-label-tooltip').innerText(),'Stories');await page.keyboard.press('Escape');assert.equal(await page.locator('.sidebar-label-tooltip').isVisible(),false);}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.getByRole('button',{name:'End fictional session',exact:true}).click();await page.getByText('Your account changed. Sign in again to view Following.',{exact:true}).waitFor();assert.equal(await feed.count(),0);assert.equal(await badge.count(),0);
 await page.goto(origin+'/tests/reader-discovery-preview/profile.html?author=aa000000-0000-4000-8000-000000000001');await page.getByRole('region',{name:'Featured work by Mara Vale',exact:true}).waitFor();assert.equal(await page.locator('#storyteller-featured-carousel .content-featured-segment').count(),2);await page.getByRole('button',{name:'Show latest-story',exact:true}).click();assert.equal(await page.locator('#storyteller-featured-carousel h2').innerText(),'latest-story');assert.equal(await page.getByRole('button',{name:'Show earlier-story',exact:true}).count(),0);
 assert.deepEqual(errors,[]);await page.close();console.log('PASS discovery, labelled read status, featured types, author panel, Following feed, navigation and session clear at '+width+'px');
}
 // Delayed catalogue responses must never present a false empty search state.
 const page=await browser.newPage();await page.route('**/content/catalogue.json',async route=>{await new Promise(resolve=>setTimeout(resolve,800));await route.continue();});
 await page.goto(origin+'/search/?q=tea');await page.getByText('Loading published content…',{exact:true}).waitFor();assert.equal(await page.getByText('No content results found for "tea".',{exact:true}).count(),0);await page.getByText('1 content result found for "tea".',{exact:true}).waitFor();await page.close();
}finally{await browser.close();}
