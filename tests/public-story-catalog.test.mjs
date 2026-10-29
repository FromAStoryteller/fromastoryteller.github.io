import test from 'node:test';
import assert from 'node:assert/strict';
import {publicStoryCard,publicStoryCatalog} from '../systems/community/public-story-catalog.mjs';
import {createCardMarkup} from '../systems/content/content-system.js';
const id='aa000000-0000-0000-0000-000000000001',other='aa000000-0000-0000-0000-000000000002',author='ab000000-0000-0000-0000-000000000001',asset='ac000000-0000-0000-0000-000000000001';
const root='https://vzdicnufhidelaoeqbza.supabase.co',base=root+'/functions/v1/fas-story-image',when='2026-10-18T00:00:00Z';
const row={id,title:'A <quiet> story',slug:'a-quiet-story',summary:'A private-looking <script> remains text.',content_type:'story',status:'published',published_at:when,updated_at:when,author:{public_id:author,display_name:'Writer'},cover:{asset_id:asset,alt:'Landscape',width:1600,height:900},tags:['Magic'],genres:['fantasy'],reading_minutes:2};
test('public cards use safe reading addresses, public author IDs and the shared theme renderer',()=>{
 const card=publicStoryCard(row,base);assert.equal(card.url,'/stories/a-quiet-story/');assert.equal(card.author,author);assert.equal(card.category,'stories');assert.equal(card.readingMinutes,2);
 const html=createCardMarkup(card);assert.match(html,/A &lt;quiet&gt; story/);assert.ok(!html.includes('<script>'));assert.match(card.image.src,/fas-story-image\?asset_id=/);
 assert.equal(publicStoryCard({...row,content_type:'blog'},base).url,'/blog/a-quiet-story/');
 for(const [type,category] of [['game','games'],['tool','tools']]){const c=publicStoryCard({...row,content_type:type},base);assert.equal(c.url,'/'+category+'/a-quiet-story/');assert.equal(c.category,category);}
 for(const changed of [{status:'draft'},{status:'archived'},{content_type:'video'},{slug:'../../private'},{author:{public_id:'private'}},{published_at:'invalid'}])assert.equal(publicStoryCard({...row,...changed},base),null);
});
test('public discovery follows distinct cursors, deduplicates IDs and never sends account credentials',async()=>{
 const calls=[],cursor={id,published_at:when};
 const items=await publicStoryCatalog({origin:'https://fromastoryteller.com',loadConfig:async()=>({url:root,key:'sb_publishable_fixture'}),fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>calls.length===1?{items:[row],next_cursor:cursor}:{items:[row,{...row,id:other,slug:'another'}],next_cursor:null}};}});
 assert.equal(items.length,2);assert.equal(calls.length,2);assert.deepEqual(JSON.parse(calls[1].options.body),{before_time:when,after_id:id});
 for(const call of calls){assert.equal(call.url,root+'/rest/v1/rpc/fas_public_story_catalog');assert.equal(call.options.credentials,'omit');assert.equal(call.options.cache,'no-store');assert.equal(call.options.redirect,'error');assert.equal(call.options.headers.Authorization,undefined);}
});
test('public discovery rejects repeated or malformed cursors and HTTP failures',async()=>{
 const args={origin:'https://fromastoryteller.com',loadConfig:async()=>({url:root,key:'public'})};
 await assert.rejects(publicStoryCatalog({...args,fetcher:async()=>({ok:true,json:async()=>({items:[row],next_cursor:{id,published_at:when}})})}),/pagination/);
 await assert.rejects(publicStoryCatalog({...args,fetcher:async()=>({ok:true,json:async()=>({items:[row],next_cursor:{id:'invalid',published_at:when}})})}),/pagination/);
 await assert.rejects(publicStoryCatalog({...args,fetcher:async()=>({ok:false})}),/could not be loaded/);
 assert.deepEqual(await publicStoryCatalog({...args,loadConfig:async()=>null}),[]);
});

test('paged discovery stops after each requested page and retries without losing its cursor',async()=>{
 const {createPublicStoryPager}=await import('../systems/community/public-story-catalog.mjs');let calls=0,fail=true;
 const pager=createPublicStoryPager({origin:'https://fromastoryteller.com',loadConfig:async()=>({url:root,key:'public'}),fetcher:async()=>{calls++;if(calls===1)return Response.json({items:[row],next_cursor:{id,published_at:when}});if(fail){fail=false;return new Response(null,{status:503});}return Response.json({items:[{...row,id:other,slug:'another'}],next_cursor:null});}});
 assert.equal((await pager.next()).length,1);assert.equal(calls,1);assert.equal(pager.done,false);await assert.rejects(pager.next());assert.equal((await pager.next())[0].id,other);assert.equal(pager.done,true);assert.deepEqual(await pager.next(),[]);assert.equal(calls,3);
});

test('original imported covers reuse responsive repository images, while replacements retain live visibility checks',()=>{
 const original='05cbe008-99d6-edd3-5357-1c8e0fb9e19d';
 const item={...row,cover:{asset_id:original,alt:'Current alt text',width:1600,height:900}};
 const card=publicStoryCard(item,base);
 assert.equal(card.image.src,'/assets/images/covers/michaels-choice.jpg');
 assert.equal(card.image.alt,'Current alt text');assert.match(createCardMarkup(card),/image\/avif/);
 const changed=publicStoryCard({...item,cover:{...item.cover,asset_id:asset}},base);
 assert.match(changed.image.src,/fas-story-image\?asset_id=/);
 assert.equal(publicStoryCard({...item,status:'archived'},base),null);
 assert.equal(publicStoryCard({...item,author:null},base),null);
 assert.notEqual(publicStoryCard(item,'https://oqmmvjjycpyxvxipcyli.supabase.co/functions/v1/fas-story-image').image.src,card.image.src);
});
