// Synthetic local fixtures only. Never creates accounts or publishes production content.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const browser=await chromium.launch(),origin='http://127.0.0.1:55410';
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tests/studio-preview/');const essential=page.getByRole('button',{name:'Essential only',exact:true});if(await essential.isVisible())await essential.click();await page.getByRole('button',{name:'Add content',exact:false}).click();
  await page.locator('[data-type-choices]').getByRole('button',{name:'Game',exact:true}).click();
  assert.equal(await page.locator('.ss-writing').isVisible(),false);
  assert.equal(await page.locator('.ss-creation-switcher #ss-type').inputValue(),'game');
  await page.locator('#ss-publishing-name').selectOption('fas');await page.locator('#ss-publishing-name').selectOption('personal');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download starter ZIP'}).click();const download=await downloadEvent;assert.match(download.suggestedFilename(),/game-landscape-starter.zip/);
  const offlineDir='.preview-cache/interactive/offline-'+width;await mkdir(offlineDir,{recursive:true});const zipPath=offlineDir+'/starter.zip';await download.saveAs(zipPath);const zip=await readFile(zipPath);let offset=0;while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),n=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28),name=zip.subarray(offset+30,offset+30+n).toString(),start=offset+30+n+extra;assert.match(name,/^[A-Za-z0-9_.-]+$/);await writeFile(offlineDir+'/'+name,zip.subarray(start,start+size));offset=start+size;}
  const offline=await context.newPage(),offlineErrors=[];offline.on('pageerror',e=>offlineErrors.push(e.message));await offline.goto(pathToFileURL(resolve(offlineDir,'index.html')).href);assert.equal(await offline.locator('canvas').evaluate(()=>FAS.width),1920);assert.deepEqual(offlineErrors,[]);await offline.close();
  await page.locator('[data-package-files]').setInputFiles([{name:'main.js',mimeType:'text/javascript',buffer:Buffer.from('const {ctx,width,height}=FAS;ctx.fillStyle="gold";ctx.fillRect(0,0,width,height);document.body.dataset.fixture="ran";try { parent.document.body.dataset.escaped="yes"; } catch {}')},{name:'style.css',mimeType:'text/css',buffer:Buffer.from('canvas { border-radius: 4px; }')}]);
  await page.getByRole('button',{name:'Preview uploaded files'}).click();await page.getByRole('button',{name:'Start / restart',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow!=null);
  const frame=page.frameLocator('iframe');await frame.locator('body[data-fixture="ran"]').waitFor();assert.equal(await page.locator('body').getAttribute('data-escaped'),null);assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts');
  const dims=await frame.locator('canvas').evaluate(c=>({width:c.width,height:c.height,logical:FAS.width,ratio:FAS.width/FAS.height}));assert.equal(dims.logical,1920);assert.equal(dims.ratio,16/9);
  await page.getByRole('button',{name:'Stop',exact:true}).click();assert.equal(await page.locator('iframe').getAttribute('srcdoc'),null);
  await page.locator('[data-package-orientation]').selectOption('portrait');await page.getByRole('button',{name:'Preview uploaded files'}).click();await page.getByRole('button',{name:'Start / restart',exact:true}).click();await frame.locator('body[data-fixture="ran"]').waitFor();assert.equal(await frame.locator('canvas').evaluate(()=>FAS.width/FAS.height),9/16);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  await mkdir('.preview-cache/interactive',{recursive:true});await page.screenshot({path:'.preview-cache/interactive/studio-'+width+'.png',fullPage:true});
  // Switching type hides the package while preserving the writing workflow.
  await page.locator('#ss-type').selectOption('tool');assert.equal(await page.locator('#ss-publishing-name').inputValue(),'fas');assert.equal(await page.locator('#ss-publishing-name').isDisabled(),true);
  await page.locator('#ss-type').selectOption('story');assert.equal(await page.locator('.ss-writing').isVisible(),true);assert.equal(await page.locator('.ss-package-panel').isVisible(),false);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS admin game/tool workflow, isolation, ZIP and responsive player at '+width+'px');
 }
 const page=await browser.newPage();page.setDefaultTimeout(8000);await page.goto(origin+'/tests/studio-preview/?fixture-role=contributor');await page.getByRole('button',{name:'Add content',exact:false}).click();assert.equal(await page.locator('[data-type-choices]').getByRole('button',{name:'Tool',exact:true}).count(),0);await page.locator('[data-type-choices]').getByRole('button',{name:'Game',exact:true}).click();assert.equal(await page.locator('#ss-type option[value="tool"]').count(),0);assert.equal(await page.locator('[data-publishing-choice]').isVisible(),false);await page.close();console.log('PASS contributor game creation; tool and FAS identity controls hidden');
}finally{await browser.close();}
