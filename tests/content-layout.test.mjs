import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storyPageMarkup,manuscriptMarkup,interactiveHeaderMarkup,contentLayouts} from '../systems/content/page-layout.mjs';
const story={id:'fixture',title:'A <title>',body_document:{version:1,blocks:[{type:'paragraph',text:'Opening <script>alert(1)</script>'},{type:'paragraph',runs:[{text:'Next',bold:true}]},{type:'scene'},{type:'paragraph',text:'After break'}]},author:{public_id:'81000000-0000-0000-0000-000000000001',display_name:'A <writer>',social_links:[{platform:'website',url:'javascript:alert(1)'}]},content_type:'story',image:'javascript:alert(1)',content_warning:'<img onerror=bad>'};
test('shared editorial layout escapes contributor fields and preserves only validated manuscript formatting',()=>{
 const html=storyPageMarkup(story);
 assert.ok(html.includes('class="story-hero'));assert.ok(html.includes('class="story-content fas-manuscript"'));assert.ok(html.includes('The End'));
 assert.ok(html.includes('A &lt;title&gt;'));assert.ok(html.includes('<strong>Next</strong>'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('href="javascript:'));
 assert.equal((html.match(/<h1/g)||[]).length,1);
 const prose=manuscriptMarkup(story.body_document,{drop_caps:true,scene_style:'invalid'});
 assert.match(prose.attributes,/data-drop-caps="true"/);assert.match(prose.attributes,/data-scene-style="space"/);
 assert.equal((prose.html.match(/data-indent="true"/g)||[]).length,1);
 assert.match(prose.html,/<hr[^>]*><p data-indent="false">After break/);
});
test('blog and interactive wrappers are type-specific; unsupported types cannot select a template',()=>{
 assert.match(storyPageMarkup({...story,content_type:'blog'}),/Back to Blog/);assert.ok(!storyPageMarkup({...story,content_type:'blog'}).includes('The End'));
 for(const type of ['game','tool','video'])assert.match(interactiveHeaderMarkup({...story,content_type:type}),new RegExp('data-content-layout="'+type+'"'));
 assert.throws(()=>storyPageMarkup({...story,content_type:'game'}));assert.throws(()=>interactiveHeaderMarkup({...story,content_type:'__proto__'}));assert.equal(Object.keys(contentLayouts).length,5);
});
test('private preview uses the shared layout and local crop without inventing publication dates',()=>{
 const html=storyPageMarkup({...story,image:'blob:https://fromastoryteller.com/fixture'},{preview:true});
 assert.match(html,/id="ss-preview-title"/);assert.match(html,/src="blob:/);assert.ok(!html.includes('datetime='));
 assert.ok(!storyPageMarkup({...story,image:'blob:https://fromastoryteller.com/fixture'}).includes('src="blob:'));
});
test('trusted legacy manuscript remains byte-identical inside the reading slot',()=>{
 const body='<p class="original">Exact older words &amp; emphasis <em>remain</em>.</p>';const html=storyPageMarkup({...story,source_kind:'file'},{trustedBody:body});
 assert.ok(html.includes(body));assert.ok(html.includes('data-file-publishing'));
});
test('each game owns its menu source',()=>{
 for(const game of ['rally-clash','brick-blitz']){const source=readFileSync(new URL('../sources/games/'+game+'.mjs',import.meta.url),'utf8');assert.ok(source.includes('class MenuManager'));assert.ok(!source.includes('systems/games/menu/'));}
});

test('Worker renders validated prose in the shared shell without forwarding a reader session',async()=>{
 const {readingResponse}=await import('../cloudflare-worker.mjs');
 const shell=readFileSync(new URL('../read/index.html',import.meta.url),'utf8');
 const config={mode:'production',enabled:true,url:'https://vzdicnufhidelaoeqbza.supabase.co',key:'sb_publishable_fixture',signup:true,lifecycle:true,policyRelease:'fixture'};
 const env={ASSETS:{fetch:async request=>{const path=new URL(request.url).pathname;return path==='/account/runtime-config.json'?Response.json(config):new Response(shell,{status:path==='/read/'?200:404,headers:{'Content-Type':'text/html'}});}}};
 let calls=0;
 const fetcher=async(url,options)=>{calls++;assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Cookie,undefined);return Response.json({...story,slug:'fixture',summary:'A safe description'});};
 const response=await readingResponse(new Request('https://fromastoryteller.com/stories/fixture/',{headers:{Cookie:'private-cookie',Authorization:'Bearer reader-private'}}),env,fetcher);
 const html=await response.text();assert.equal(response.status,200);assert.equal(calls,1);
 assert.match(html,/data-content-layout="story"/);assert.match(html,/Opening &lt;script&gt;/);assert.ok(!html.includes('<script>alert(1)</script>'));assert.ok(!html.includes('Loading the story'));
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});

test('editorial pages omit card descriptions while retaining warnings and taxonomy',()=>{
 const html=storyPageMarkup({...story,summary:'Card description only',genres:['Fantasy'],content_warning:'Violence'});
 assert.ok(!html.includes('Card description only'));assert.ok(!html.includes('story-summary'));
 assert.ok(html.includes('Content warning:'));assert.ok(html.includes('Fantasy'));
 const noDetails=storyPageMarkup({...story,summary:'Card only',genres:[],tags:[],content_warning:''});
 assert.ok(!noDetails.includes('story-details'));
 assert.ok(!storyPageMarkup({...story,summary:'Card description only'},{preview:true}).includes('Card description only'));
});
