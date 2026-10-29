import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {discoveryFixture} from './discovery-browser-fixture.mjs';
const root=process.cwd(),origin='https://fromastoryteller.com';
const {publicContentResponse}=await import(pathToFileURL(path.join(root,'systems/content/public-cache-worker.mjs')).href);
const {readingResponse}=await import(pathToFileURL(path.join(root,'cloudflare-worker.mjs')).href);
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.avif':'image/avif','.webp':'image/webp','.woff':'font/woff','.ttf':'font/ttf'};
const env={ASSETS:{async fetch(request){let file=new URL(request.url).pathname;if(file==='/account/runtime-config.json')return Response.json({mode:'production',enabled:true,url:'https://vzdicnufhidelaoeqbza.supabase.co',key:'sb_publishable_fixture',signup:true,lifecycle:true,policyRelease:'fixture'});if(file.endsWith('/'))file+='index.html';try{return new Response(await fs.readFile(path.join(root,'dist',file)),{headers:{'Content-Type':types[path.extname(file)]??'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}}};
const fetcher=async(url,options)=>{
 if(url.endsWith('fas_public_content_revision'))return Response.json('aa000000-0000-0000-0000-000000000001');
 if(url.endsWith('fas_public_story_catalog'))return Response.json({items:[],next_cursor:null});
 if(url.endsWith('fas_public_file_catalog'))return Response.json([]);
 if(url.endsWith('fas_public_discovery'))return Response.json({files:[],stories:{items:[],next_cursor:null}});
 if(url.endsWith('fas_query_public_content'))return Response.json(discoveryFixture(undefined,JSON.parse(options.body).options));
 if(url.endsWith('fas_public_file_content'))return Response.json({id:'aa000000-0000-0000-0000-000000000002',url:'/stories/tea-at-the-summit/',title:'Tea at the Summit',author:{public_id:'aa000000-0000-0000-0000-000000000003',display_name:'Writer',social_links:[]}});
 return Response.json([]);
};

// Before/after uses the same page, fixture API and browser; only font delivery
// changes. It never writes to a real account or depends on production API data.
const base=process.env.FAS_FONT_BASE;
const original=file=>execFileSync('git',['show',base+':'+file],{maxBuffer:8*1024*1024});
let variant='after';
const assetFetch=env.ASSETS.fetch.bind(env.ASSETS);
env.ASSETS.fetch=async request=>{
 const file=new URL(request.url).pathname.replace(/^\/_assets\/[a-f0-9]+\//,'/');
 if(variant==='before'&&base&&file==='/css/foundations.css')return new Response(original('css/foundations.css').toString().replaceAll('../assets/fonts/','/assets/fonts/'),{headers:{'Content-Type':'text/css'}});
 if(variant==='before'&&base&&file.startsWith('/assets/fonts/')&&file.endsWith('.woff2'))return new Response(original(file.slice(1)),{headers:{'Content-Type':'font/woff2'}});
 return assetFetch(request);
};
const browser=await chromium.launch();
const results=[];
try {
 for(const width of [390,1440])for(const theme of ['light','dark']){
  for(const mode of (base?['before','after']:['after'])){
   variant=mode;
   const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[],failed=[],fonts=new Map();
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
   await context.route('https://vzdicnufhidelaoeqbza.supabase.co/**',route=>route.fulfill({json:[]}));
   await context.route(origin+'/**',async route=>{
    try {
     const req=route.request(),response=await publicContentResponse(new Request(req.url(),{method:req.method(),headers:req.headers()}),env,readingResponse,{fetcher,cache:null}),body=Buffer.from(await response.arrayBuffer());
     if(req.url().endsWith('.woff2'))fonts.set(new URL(req.url()).pathname.split('/').at(-1),body.length);
     await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body});
    }catch(e){errors.push(e.stack);await route.abort();}
   });
   await page.goto(origin+'/stories/tea-at-the-summit/');
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   await page.locator('.story-page').waitFor();
   await page.waitForFunction(()=>document.querySelector('.story-content')?.textContent.includes('Eleanor'));
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
   const initial=[...fonts].map(([name,bytes])=>({name,bytes})),fontBytes=initial.reduce((n,f)=>n+f.bytes,0);
   if(mode==='after')assert.ok(!initial.some(f=>/^(source-sans-3|literata|montecarlo).*?(?<!\.latin)\.woff2$/.test(f.name)),'common story must not fetch full fonts: '+JSON.stringify(initial));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   if(mode==='after'){
    await page.screenshot({path:'font-story-'+width+'-'+theme+'.png',fullPage:true});
    // Less-common Latin, Vietnamese and Greek must still use their original font.
    const fallback=await page.evaluate(async()=>{
     const text='Ǎ Ḍ ệ Ελληνικά';
     for(const family of ['Source Sans 3','Literata']){
      const probe=document.createElement('p');probe.style.fontFamily='"'+family+'"';probe.textContent=text;document.querySelector('main').append(probe);
      await document.fonts.load('400 24px "'+family+'"',text);
     }
     return document.fonts.status;
    });
    assert.equal(fallback,'loaded');
    for(const name of ['source-sans-3-variable.woff2','literata-variable.woff2'])assert.ok(fonts.has(name),'extended text must retain '+name);
    // Compare actual glyph rasterization, not only CSS family names or widths.
    const proof=await page.evaluate(async()=>{
     const specs=[
      ['MonteCarlo','montecarlo/montecarlo-regular','normal',[400],'from, A Storyteller'],
      ['Source Sans 3','source-sans-3/source-sans-3-variable','normal',[200,400,700,900],'Ǎ Ḍ ệ Ελληνικά Āā Ēē Īī Ōō Ūū — “Story” ← → ✦ ◆'],
      ['Source Sans 3','source-sans-3/source-sans-3-italic-variable','italic',[200,400,700,900],'Ǎ Ḍ ệ Ελληνικά Āā Ēē Īī Ōō Ūū — “Story”'],
      ['Literata','literata/literata-variable','normal',[200,400,700,900],'Ǎ Ḍ ệ Ελληνικά Āā Ēē Īī Ōō Ūū — “Story” • ◆'],
      ['Literata','literata/literata-italic-variable','italic',[200,400,700,900],'Ǎ Ḍ ệ Ελληνικά Āā Ēē Īī Ōō Ūū — “Story”']
     ];
     let count=0;
     for(const [family,file,style,weights,text]of specs){
      const ref='FontReference'+count,face=new FontFace(ref,'url(/assets/fonts/'+file+'.woff2)',{style,weight:family==='MonteCarlo'?'400':'200 900'});
      await face.load();document.fonts.add(face);
      for(const weight of weights){
       await document.fonts.load(style+' '+weight+' 24px "'+family+'"',text);
       const render=name=>{const c=document.createElement('canvas');c.width=1200;c.height=70;const x=c.getContext('2d');x.font=style+' '+weight+' 24px "'+name+'"';x.fillText(text,5,45);return c.toDataURL();};
       if(render(family)!==render(ref))throw Error('Glyph appearance differs: '+file+' '+weight);
       count++;
      }
     }
     return count;
    });
    assert.equal(proof,17);

   }
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   results.push({width,theme,mode,fontBytes,fonts:initial});
   await context.close();
  }
 }
 for(const width of [390,1440])for(const theme of ['light','dark']){
  const before=results.find(r=>r.width===width&&r.theme===theme&&r.mode==='before'),after=results.find(r=>r.width===width&&r.theme===theme&&r.mode==='after');
  if(before)assert.ok(after.fontBytes<before.fontBytes-200000,'save at least 200 KB on the common story');
 }
 console.log('FONT_DELIVERY '+JSON.stringify(results));
 console.log('PASS story font bytes, original glyph rasterization at 17 style/weight combinations, extended-character fallback, both themes and phone/desktop');
}finally{await browser.close();}
