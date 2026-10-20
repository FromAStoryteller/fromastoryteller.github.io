import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileContentPath,publishingName} from '../systems/community/publishing-identity.mjs';
import {validateStory} from '../systems/community/studio-service.mjs';
import {filePublishingResponse,renderFilePublishing} from '../cloudflare-worker.mjs';
import {contentMetadata} from '../systems/community/content-metadata.mjs';
const item={id:'fa500000-0000-4000-8000-000000000002',url:'/games/brick-blitz/',author:{public_id:'fa500000-0000-4000-8000-000000000001',display_name:'From A Storyteller',kind:'organization',social_links:[{platform:'instagram',url:'https://instagram.com/example/'}]}};
const config={mode:'production',enabled:true,url:'https://vzdicnufhidelaoeqbza.supabase.co',key:'sb_publishable_fixture',signup:true,lifecycle:true,policyRelease:'fixture'};
const html='<html><head><meta name="author" content="Ry"><script type="application/ld+json">{"@type":"Article","author":{"name":"Ry"}}</script></head><body><main><span class="file-publishing-author" data-file-publishing>Ry</span></main></body></html>';
test('publishing choices are bounded and personal by default',()=>{
 assert.equal(validateStory({title:'Title'}).publishing_identity,'personal');
 assert.throws(()=>validateStory({title:'Title',publishing_identity:'other'}),/publishing name/);
 assert.equal(publishingName('personal','Ry'),'Ry');assert.equal(publishingName('fas','Ry'),'From A Storyteller');
 for(const p of ['/stories/the-deal/','/games/brick-blitz/','/tools/countdown/'])assert.equal(fileContentPath(p),p);
 for(const p of ['https://evil.example/','//evil.example/','/account/','/stories/../account/','/stories/x/?a=1'])assert.equal(fileContentPath(p),null);
});
test('file pages use the selected author in byline, socials and structured metadata with escaping',()=>{
 const rendered=renderFilePublishing(html,item);
 assert.match(rendered,/By From A Storyteller/);assert.match(rendered,/"@type":"Organization"/);assert.match(rendered,/Author social links/);assert.match(rendered,/data-content-id=/);
 const escaped=renderFilePublishing(html,{...item,author:{...item.author,display_name:'</script><script>bad</script>',social_links:[{platform:'website',url:'javascript:bad()'}]}});
 assert.ok(!escaped.includes('<script>bad</script>'));assert.ok(!escaped.includes('javascript:'));
 const metadata=contentMetadata({slug:'fixture',content_type:'story',title:'Title',summary:'Description',author:item.author});
 assert.equal(metadata.structured.author['@type'],'Organization');
});
test('public file attribution is server rendered without forwarding account credentials; unavailable owners fail closed',async()=>{
 const env={ASSETS:{fetch:async()=>Response.json(config)}};
 let calls=0;
 const request=new Request('https://fromastoryteller.com/games/brick-blitz/',{headers:{Authorization:'Bearer private',Cookie:'private=1'}});
 const response=await filePublishingResponse(request,env,new Response(html),async(url,options)=>{calls++;assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Cookie,undefined);assert.equal(options.redirect,'manual');assert.deepEqual(JSON.parse(options.body),{content_path:'/games/brick-blitz/'});return Response.json(item);});
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.match(await response.text(),/By From A Storyteller/);assert.equal(calls,1);
 for(const [result,status]of [[Response.json(null),404],[new Response('',{status:302}),503]]){const r=await filePublishingResponse(request,env,new Response(html),async()=>result);assert.equal(r.status,status);assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow');}
 const head=await filePublishingResponse(new Request(request,{method:'HEAD'}),env,new Response(html),async()=>Response.json(item));assert.equal(await head.text(),'');
});
test('every existing game/story/tool has one themed linked byline and keeps its canonical address',()=>{
 const paths=JSON.parse(readFileSync(new URL('../content/content-index.json',import.meta.url)));
 for(const path of paths){
  const meta=JSON.parse(readFileSync(new URL('..'+path,import.meta.url)));const page=readFileSync(new URL('..'+meta.url+'index.html',import.meta.url),'utf8');
  assert.equal((page.match(/data-file-publishing/g)||[]).length,1,meta.url);
  assert.ok(page.includes(meta.canonicalUrl));assert.ok(page.includes('data-file-schema'));const schema=JSON.parse(page.match(/<script type="application\/ld\+json" data-file-schema>([\s\S]*?)<\/script>/)[1]);assert.equal(schema.author.name,meta.authorDisplay);assert.equal(meta.authorDisplay,meta.type==='tool'?'From A Storyteller':'Ry');
 }
});

test('production and preview run public attribution for every supported content route',()=>{
 for(const path of ['../wrangler.production.jsonc','../wrangler.jsonc']){
  const config=JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
  for(const route of ['/stories/*','/blog/*','/games/*','/tools/*','/videos/*'])assert.ok(config.assets.run_worker_first.includes(route),route+' must reach the publishing worker');
 }
});

 test('migrated original routes render saved manuscripts and fresh metadata in the existing themed shell',async()=>{
 const base=readFileSync(new URL('../stories/a-place-left-behind/index.html',import.meta.url),'utf8'),author=item.author,story={id:item.id,slug:'a-place-left-behind',content_type:'story',title:'Updated <safe> title',summary:'An updated saved description.',genres:['fantasy'],tags:['Hidden tag'],published_at:'2026-08-09T00:00:00Z',updated_at:'2026-10-20T00:00:00Z',body_document:{version:1,blocks:[{type:'paragraph',text:'Saved revised words <script>literal</script>.'}]},author,cover:{asset_id:item.id,alt:'Updated cover'}};
 const projected={...item,url:'/stories/a-place-left-behind/',slug:story.slug,title:story.title,summary:story.summary,content_type:'story',editorial_migrated:true,editorial:story};
 const result=await filePublishingResponse(new Request('https://fromastoryteller.com'+projected.url),{ASSETS:{fetch:async()=>Response.json(config)}},new Response(base),async()=>Response.json(projected)),rendered=await result.text();assert.equal(result.status,200);assert.ok(rendered.includes('<h1>Updated &lt;safe&gt; title</h1>'));assert.ok(rendered.includes('Saved revised words &lt;script&gt;literal&lt;/script&gt;.'));assert.ok(!rendered.match(/<p class="content-page-details[^>]*>[\s\S]*?<\/p>/)?.[0]?.includes('Hidden tag'));assert.equal((rendered.match(/property="og:title"/g)||[]).length,1);assert.ok(rendered.includes('https://fromastoryteller.com/stories/a-place-left-behind/'));assert.equal((rendered.match(/aria-label="Author social links"/g)||[]).length,1);
 const hidden=await filePublishingResponse(new Request('https://fromastoryteller.com'+projected.url),{ASSETS:{fetch:async()=>Response.json(config)}},new Response(base),async()=>Response.json({...projected,editorial:null}));assert.equal(hidden.status,404);
 });
