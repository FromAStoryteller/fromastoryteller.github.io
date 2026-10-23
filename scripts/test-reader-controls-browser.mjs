import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.argv[2]??'http://127.0.0.1:55410',browser=await chromium.launch();
try{for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/tests/reader-discovery-preview/expanded.html');
 const filters=page.locator('#expanded-filters'),grid=page.locator('#expanded-grid'),history=page.locator('#history'),panel=page.locator('.story-author-panel');
 await panel.locator('[data-following-toggle]').waitFor();assert.equal(await panel.locator('.storyteller-follow-state').count(),0);
 assert.deepEqual((await grid.locator('h3').allTextContents()).slice(0,3),['Followed story','Solo game','Writing notes']);
 assert.deepEqual(await history.locator('.content-grid-card h3').allTextContents(),['Newest discovery','Solo game']);
 await filters.getByLabel('Content type',{exact:true}).selectOption('games');await filters.getByLabel('Players',{exact:true}).selectOption('single');await filters.getByLabel('Progress',{exact:true}).selectOption('yes');assert.deepEqual(await grid.locator('h3').allTextContents(),['Solo game']);assert.equal(await filters.getByLabel('Reading length',{exact:true}).count(),0);
 await filters.getByLabel('Content type',{exact:true}).selectOption('tools');await filters.getByLabel('Purpose',{exact:true}).selectOption('Productivity');await filters.getByLabel('Topic',{exact:true}).selectOption('Focus');assert.deepEqual(await grid.locator('h3').allTextContents(),['Focus timer']);
 await filters.getByLabel('Content type',{exact:true}).selectOption('stories');await filters.getByLabel('Reading length',{exact:true}).selectOption('quick');assert.deepEqual(await grid.locator('h3').allTextContents(),['Newest discovery']);
 await page.reload();assert.deepEqual(await grid.locator('h3').allTextContents(),['Newest discovery']);
 await filters.getByRole('button',{name:'Reset filters',exact:true}).click();
 const nav=page.locator('#navigation');assert.equal(await nav.getByRole('link',{name:'Storyteller Studio',exact:true}).isVisible(),false);await nav.locator('summary').click();await nav.getByRole('link',{name:'Your history',exact:true}).waitFor();await nav.locator('summary').press('Escape');assert.equal(await nav.getByRole('link',{name:'Your history',exact:true}).isVisible(),false);
 await panel.locator('[data-following-toggle]').click();await panel.getByRole('button',{name:'Unfollow',exact:true}).click();await panel.getByRole('button',{name:'Follow',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#expanded-grid h3')?.textContent==='Newest discovery');
 await panel.getByRole('button',{name:'Follow',exact:true}).click();await panel.locator('[data-following-toggle]').waitFor();assert.equal(await panel.locator('.storyteller-follow-state').count(),0);await page.waitForFunction(()=>document.querySelector('#expanded-grid h3')?.textContent==='Followed story');
 const metrics=await panel.getByRole('link',{name:'More by this storyteller',exact:true}).evaluate(e=>{const s=getComputedStyle(e);return {height:e.getBoundingClientRect().height,border:s.borderStyle};});assert.ok(metrics.height>=44);assert.equal(metrics.border,'solid');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.getByRole('button',{name:'End fictional session',exact:true}).click();await history.getByText('Your account changed. Sign in again to see your history.',{exact:true}).waitFor();assert.equal(await history.locator('.content-grid-card h3').count(),0);assert.equal((await grid.locator('h3').allTextContents())[0],'Newest discovery');
 assert.deepEqual(errors,[]);await page.close();console.log('PASS type-aware filters, URL restore, follow-first home, private history, compact navigation and game author follow panel at '+width+'px');
}
// Actual category entry points all use the shared discovery component.
const page=await browser.newPage();for(const path of ['/','/stories/','/games/','/tools/','/blog/','/videos/','/gallery/']){await page.goto(origin+path);await page.getByRole('form',{name:'Find content',exact:true}).waitFor();assert.ok(await page.getByRole('combobox',{name:path==='/stories/'?'Sort stories':'Sort content',exact:true}).isVisible());}await page.close();
}finally{await browser.close();}
