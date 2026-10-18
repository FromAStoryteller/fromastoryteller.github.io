// Local fictional content and existing games only. No Supabase identity or publishing.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch(),origin='http://127.0.0.1:55410';
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
  await page.goto(origin+'/stories/the-deal/');
  const essential=page.getByRole('button',{name:'Essential only',exact:true});if(await essential.isVisible())await essential.click();
  const before=await page.locator('.story-hero').boundingBox();assert.ok(before.width>200);
  assert.equal(await page.locator('[data-content-layout="story"] h1').textContent(),'The Deal');
  const original=await page.locator('.story-content').textContent();assert.ok(original.includes('Dina'));
  const metrics=await page.evaluate(()=>{const el=document.querySelector('.story-content');return {font:getComputedStyle(el).fontFamily,width:el.getBoundingClientRect().width};});
  await page.evaluate(async()=>{
   const {renderPublicStory}=await import('/systems/community/public-profile.mjs');
   const root=document.querySelector('main');root.replaceChildren();
   renderPublicStory(root,{id:'81000000-0000-0000-0000-000000000001',slug:'synthetic',content_type:'story',title:'Synthetic Studio story',summary:'A fictional description.',body_document:{version:1,blocks:[{type:'paragraph',text:'Opening words.'},{type:'paragraph',text:'Second paragraph.'},{type:'scene'},{type:'paragraph',text:'After the scene.'}]},scene_style:'diamond',drop_caps:true,genres:['fantasy'],content_warning:'Fictional warning',author:{public_id:'81000000-0000-0000-0000-000000000002',display_name:'Fictional Writer',social_links:[{platform:'website',url:'https://example.com/'}]},cover:{asset_id:'81000000-0000-0000-0000-000000000003',alt:'Fictional cover',width:1600,height:900}},{imageBase:'http://127.0.0.1:55321/functions/v1/fas-story-image'});
   const img=document.querySelector('.story-feature-image img');if(img)img.src='/assets/images/stories/the-deal.png';
  });
  await page.locator('.story-feature-image img').waitFor();
  const after=await page.locator('.story-hero').boundingBox();assert.ok(Math.abs(before.width-after.width)<2,'Legacy/Studio hero widths match');
  const next=await page.locator('.story-content').evaluate(el=>({font:getComputedStyle(el).fontFamily,width:el.getBoundingClientRect().width}));
  assert.equal(next.font,metrics.font);assert.ok(Math.abs(next.width-metrics.width)<2);
  assert.equal(await page.locator('.story-content [data-indent="true"]').count(),1);
  assert.equal(await page.locator('.story-content hr+p').getAttribute('data-indent'),'false');
  assert.equal(await page.locator('main h1').count(),1);assert.equal(await page.locator('.story-warning').count(),1);
  assert.ok(await page.locator('.storyteller-socials a').count()>0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  console.log('LAYOUT_VISUAL_'+width+'='+ (await page.screenshot({type:'jpeg',quality:45})).toString('base64'));
  for(const game of ['rally-clash','brick-blitz']){
   const requests=[];const handler=r=>requests.push(new URL(r.url()).pathname);page.on('request',handler);
   await page.goto(origin+'/games/'+game+'/');await page.locator('#'+game+'-game canvas').waitFor();await page.locator('.menu-panel .menu-title').waitFor();
   await page.locator('.menu-row').filter({has:page.locator('.menu-label',{hasText:/^Play$/})}).click();
   await page.waitForTimeout(3600);await page.keyboard.press('Escape');await page.getByRole('heading',{name:'Paused',exact:true}).waitFor();
   await page.locator('.menu-row').filter({has:page.locator('.menu-label',{hasText:/^Settings$/})}).click();
   await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
   await page.getByRole('button',{name:'Off',exact:true}).click();
   await page.locator('.menu-row').filter({has:page.locator('.menu-label',{hasText:/^Back$/})}).click();
   await page.locator('.menu-row').filter({has:page.locator('.menu-label',{hasText:/^Resume$/})}).click();
   assert.equal(await page.locator('.menu-overlay:not(.hidden)').count(),0);
   assert.equal(requests.some(path=>path.startsWith('/systems/games/')),false,'Single game bundle owns runtime/menu dependencies');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   page.off('request',handler);
  }
  // Ignore neither game exceptions nor authoring exceptions.
  assert.deepEqual(errors,[]);console.log('PASS shared legacy/Studio layout and independent game Play/Pause/Settings/Resume at '+width+'px');
  await context.close();
 }
}finally{await browser.close();}
