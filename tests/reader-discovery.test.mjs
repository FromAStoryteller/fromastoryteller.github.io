import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFeatured,newestPublished} from '../systems/content/featured-selection.mjs';
import {discoverStories,storyGenres} from '../systems/content/story-discovery.mjs';
import {loadFollowedStorytellers,followedWork} from '../systems/community/following-page.mjs';
import {createCardMarkup,getHomeFeaturedItems} from '../systems/content/content-system.js';
const a='aa000000-0000-4000-8000-000000000001',b='aa000000-0000-4000-8000-000000000002';
const row=(id,author,type,date,extra={})=>({id,author,type,category:({story:'stories',game:'games',tool:'tools',blog:'blog'})[type],datePublished:date,status:'published',draft:false,title:id,url:'/stories/'+id+'/',readingMinutes:2,card:{title:id,description:'Summary',image:'',imageAlt:''},...extra});
const items=[row('a-old',a,'story','2026-01-01',{featured:true,pinned:true,dateModified:'2026-10-22'}),row('a-new',a,'story','2026-10-20'),row('a-blog',a,'blog','2026-10-21'),row('b-story',b,'story','2026-10-19')];
test('homepage features only the latest publication per contributor across all types',()=>{
 assert.deepEqual(getHomeFeaturedItems(items).map(x=>x.id),['a-blog','b-story']);
 const uploaded=row('a-upload',a,'game','2026-10-22T08:00:00Z');
 assert.deepEqual(getHomeFeaturedItems([...items,uploaded]).map(x=>x.id),['a-upload','b-story']);
 assert.equal(items[0].id,'a-old');
});
test('profile features one latest work per type; categories feature one per contributor',()=>{
 assert.deepEqual(selectFeatured(items.filter(x=>x.author===a),{perType:true}).map(x=>x.id),['a-blog','a-new']);
 assert.deepEqual(selectFeatured(items.filter(x=>x.category==='stories')).map(x=>x.id),['a-new','b-story']);
 assert.equal(selectFeatured([row('organization',{public_id:a},'story','2026-10-21'),...items]).filter(x=>(typeof x.author==='object'?x.author.public_id:x.author)===a).length,1);
});
test('drafts, scheduled future work, invalid dates and manual flags cannot enter featured selection',()=>{
 const candidates=[...items,row('draft',b,'story','2026-10-22',{status:'draft',draft:true}),row('scheduled',b,'story','2099-01-01'),row('invalid',b,'story','not a date')];
 assert.deepEqual(selectFeatured(candidates,{now:Date.parse('2026-10-23')}).map(x=>x.id),['a-blog','b-story']);
 const tied=[row('b',a,'story','2026-10-20'),row('a',a,'story','2026-10-20')];assert.equal(selectFeatured(tied)[0].id,'a');
});
test('genre and length filters combine, handle boundary values, and sort without mutating input',()=>{
 const stories=[row('short',a,'story','2026-10-20',{genres:['fantasy'],readingMinutes:4}),row('five',a,'story','2026-10-21',{taxonomy:{genres:['Fantasy']},readingMinutes:5}),row('fifteen',b,'story','2026-10-19',{genres:['fantasy'],readingMinutes:15}),row('long',b,'story','2026-10-18',{genres:['horror'],readingMinutes:16}),row('unknown',b,'story','2026-10-17',{readingMinutes:0})];
 assert.deepEqual(storyGenres(stories[0]),['Fantasy']);assert.deepEqual(discoverStories(stories,{genre:'Fantasy',length:'medium'}).map(x=>x.id),['five','fifteen']);
 assert.deepEqual(discoverStories(stories,{length:'quick'}).map(x=>x.id),['short']);assert.deepEqual(discoverStories(stories,{length:'long'}).map(x=>x.id),['long']);
 assert.deepEqual(discoverStories(stories,{sort:'shortest'}).map(x=>x.id),['short','five','fifteen','long','unknown']);assert.equal(stories[0].id,'short');
});
test('Following feed reads every author page and displays published work newest first',async()=>{
 const calls=[];const client={rpc:async(name,args)=>{calls.push(args);return {data:args.after_id?{items:[{public_id:b,display_name:'B'}],next_cursor:null}:{items:[{public_id:a,display_name:'A'}],next_cursor:{name:'A',id:a}}};}};
 const people=await loadFollowedStorytellers(client);assert.equal(calls.length,2);assert.equal(calls[1].after_id,a);assert.equal(people.length,2);
 assert.deepEqual(followedWork([...items,row('private',a,'story','2026-10-22',{status:'draft',draft:true}),row('unfollowed','other','story','2026-10-22')],people).map(x=>x.id),['a-blog','a-new','b-story','a-old']);
 assert.deepEqual(followedWork(items,[]),[]);
});
test('Following rejects repeated pagination cursors and stops on account change',async()=>{
 const client={rpc:async()=>({data:{items:[{public_id:a,display_name:'A'}],next_cursor:{name:'A',id:a}}})};
 await assert.rejects(loadFollowedStorytellers(client),/could not be loaded/);assert.deepEqual(await loadFollowedStorytellers(client,{isEnded:()=>true}),[]);
});
test('card author links are separate from content links, escaped, and use public IDs',()=>{
 const html=createCardMarkup({...items[0],authorDisplay:'A <Writer>'});assert.match(html,/class="content-card-author" href="\/storytellers\/\?author=/);assert.match(html,/By A &lt;Writer&gt;/);assert.equal((html.match(/<a /g)||[]).length,2);
 assert.ok(!createCardMarkup({...items[0],author:'javascript:bad',authorDisplay:'Writer'}).includes('?author=javascript'));
});
