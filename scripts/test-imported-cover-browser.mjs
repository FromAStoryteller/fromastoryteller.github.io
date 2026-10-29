import fs from 'node:fs/promises';
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
let replacement=false,withdrawn=false;
const fetcher=async(url,options)=>{
 if(url.endsWith('fas_public_content_revision'))return Response.json('aa000000-0000-0000-0000-000000000001');
 if(url.endsWith('fas_public_story_catalog'))return Response.json({items:[],next_cursor:null});
 if(url.endsWith('fas_public_file_catalog'))return Response.json([]);
 if(url.endsWith('fas_public_discovery'))return Response.json({files:[],stories:{items:[],next_cursor:null}});
 if(url.endsWith('fas_query_public_content')){const result=discoveryFixture(undefined,JSON.parse(options.body).options);for(const row of [...result.items,...result.featured])if(row.slug==='michaels-choice'){row.cover={asset_id:replacement?'aa000000-0000-4000-8000-000000000099':'05cbe008-99d6-edd3-5357-1c8e0fb9e19d',width:1600,height:900,alt:'Live cover description'};delete row.preview_image;}
if(withdrawn){result.items=result.items.filter(r=>r.slug!=='michaels-choice');result.featured=result.featured.filter(r=>r.slug!=='michaels-choice');}
return Response.json(result);}
 if(url.endsWith('fas_public_file_content'))return Response.json({id:'aa000000-0000-0000-0000-000000000002',url:'/stories/tea-at-the-summit/',title:'Tea at the Summit',author:{public_id:'aa000000-0000-0000-0000-000000000003',display_name:'Writer',social_links:[]}});
 return Response.json([]);
};

const browser=await chromium.launch();
try{
 // Compare each public imported original against the checked-in source; no accounts or writes.
 const {importedCoverImages}=await import('../systems/community/public-story-catalog.mjs');
 const proof=await browser.newPage();
 for(const [id,entry]of Object.entries(importedCoverImages)){
  const response=await fetch(origin+'/api/public/image?asset_id='+id+'&width=1600');
  if(response.status===404){console.log('Original is no longer public: '+id);continue;}
  assert.equal(response.status,200,id);
  const live=Buffer.from(await response.arrayBuffer()),source=await fs.readFile(path.join(root,entry.src));
  const difference=await proof.evaluate(async([a,b])=>{
   const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
   const images=await Promise.all([a,b].map(load)),pixels=images.map(img=>{const c=document.createElement('canvas');c.width=64;c.height=36;const x=c.getContext('2d');x.drawImage(img,0,0,64,36);return x.getImageData(0,0,64,36).data;});
   let diff=0;for(let i=0;i<pixels[0].length;i++)if(i%4!==3)diff+=Math.abs(pixels[0][i]-pixels[1][i]);return diff/(64*36*3);
  },[... [live,source].map(b=>'data:image/jpeg;base64,'+b.toString('base64'))]);
  assert.ok(difference<8,'original differs from repository image: '+id+' '+difference);
  console.log('ORIGINAL_COVER_PROOF '+JSON.stringify({id,difference}));
 }
 await proof.close();
 for(const width of [390,1440]){
  for(const changed of [false,true]){
   replacement=changed;withdrawn=false;
   const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),requests=[],errors=[];
   page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
   await context.route('https://vzdicnufhidelaoeqbza.supabase.co/**',r=>r.fulfill({json:[]}));
   await context.route(origin+'/**',async route=>{
    const req=route.request();
    if(new URL(req.url()).pathname==='/api/public/image')return route.fulfill({body:await fs.readFile('assets/images/covers/tea-at-the-summit.jpg'),contentType:'image/jpeg'});
    const response=await publicContentResponse(new Request(req.url(),{method:req.method(),headers:req.headers()}),env,readingResponse,{fetcher,cache:null});
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
   });
   await page.goto(origin+'/');await page.locator('#home-grid[aria-busy="false"]').waitFor();await page.waitForTimeout(600);
   const cover=page.locator('.content-featured-card a[href="/stories/michaels-choice/"] img').first();
   await cover.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.content-featured-card img')].some(i=>i.complete&&i.naturalWidth));
   const current=await cover.evaluate(i=>i.currentSrc);
   if(changed)assert.ok(current.includes('/api/public/image?'),'replacement cover must use live gateway');
   else{
    assert.ok(current.includes('michaels-choice.')&&current.endsWith('.avif'));
    assert.ok(requests.includes(current),'featured uses the same responsive original as static HTML');
    assert.ok(!requests.some(u=>u.includes('/api/public/image?')),'original cover needs no extra JPEG');
   }
   withdrawn=true;await page.reload();await page.locator('#home-grid[aria-busy="false"]').waitFor();
   assert.equal(await page.locator('#home-grid a[href="/stories/michaels-choice/"],.content-featured-card a[href="/stories/michaels-choice/"]').count(),0);
   assert.deepEqual(errors,[]);
   console.log('COVER_DELIVERY '+JSON.stringify({width,replacement:changed,current,withdrawal:true,originalRequests:requests.filter(u=>u.includes('michaels-choice.')).length}));
   await context.close();
  }
 }
}finally{await browser.close();}
