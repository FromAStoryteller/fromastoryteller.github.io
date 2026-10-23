import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverContent} from '../systems/content/content-discovery.mjs';
import {historyPage,filterHistory,activityGroup} from '../systems/community/viewer-history.mjs';
const row=(id,extra={})=>({id,title:id,url:'/stories/'+id+'/',category:'stories',author:id,status:'published',datePublished:'2026-10-01',...extra});
test('home prioritizes followed authors while retaining the selected order within both groups',()=>{
 const items=[row('Z'),row('A'),row('M'),row('B')];
 assert.deepEqual(discoverContent(items,{sort:'title'},new Set(['z','m'])).map(i=>i.id),['M','Z','A','B']);
 assert.deepEqual(discoverContent(items,{sort:'title'}).map(i=>i.id),['A','B','M','Z']);
});
test('game player and progress filters combine without including unknown capabilities',()=>{
 const items=[row('solo',{category:'games',subtype:'arcade',gameFeatures:{saves:true,multiplayer:'off'}}),row('room',{category:'games',gameFeatures:{saves:false,multiplayer:'realtime'}}),row('unknown',{category:'games'})];
 assert.deepEqual(discoverContent(items,{category:'games',players:'single',saves:'yes'}).map(i=>i.id),['solo']);
 assert.deepEqual(discoverContent(items,{players:'multi'}).map(i=>i.id),['room']);
});
test('tool purpose and topic, blog reading time, video topic and format use their own metadata',()=>{
 const items=[row('timer',{category:'tools',genres:['productivity'],tags:['Focus'],subtype:'focus'}),row('blog',{category:'blog',readingMinutes:7}),row('film',{category:'videos',subtype:'short-film',card:{tags:['Travel']}})];
 assert.equal(discoverContent(items,{category:'tools',genre:'Productivity',tag:'Focus'})[0].id,'timer');
 assert.equal(discoverContent(items,{category:'blog',length:'medium'})[0].id,'blog');
 assert.equal(discoverContent(items,{category:'videos',subtype:'short-film',tag:'Travel'})[0].id,'film');
 assert.deepEqual(discoverContent(items,{category:'tools',length:'quick'}),[]);
});
test('history requests private cursor pages and rejects failed or malformed responses',async()=>{
 const cursor={activity_at:'2026-10-24T01:00:00Z',id:'a'},calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return {data:{items:[{id:'b'}],next_cursor:null}};}};
 assert.equal((await historyPage(client,'completed',cursor)).items[0].id,'b');
 assert.deepEqual(calls[0],{name:'fas_my_content_history',args:{view_key:'completed',before_time:cursor.activity_at,after_id:'a'}});
 await assert.rejects(historyPage({rpc:async()=>({error:Error('offline')})},'recent'));
 await assert.rejects(historyPage({rpc:async()=>({data:[]})},'recent'));
});
test('history search/type/date filters preserve activity order and handle unknown completion dates',()=>{
 const now=Date.parse('2026-10-24T12:00:00Z'),items=[{title:'Écho',type:'story',activity_at:'2026-10-23T12:00:00Z'},{title:'Timer',type:'tool',activity_at:'2026-10-12T12:00:00Z'},{title:'Old mark',type:'story',activity_at:null}];
 assert.deepEqual(filterHistory(items,{query:'echo'}),[items[0]]);
 assert.deepEqual(filterHistory(items,{type:'story',period:'week'},now),[items[0]]);
 assert.deepEqual(filterHistory(items,{period:'month'},now),items.slice(0,2));
 assert.equal(filterHistory(items).length,3);
 assert.equal(activityGroup(null),'Date not recorded');
 assert.equal(activityGroup(new Date(2026,9,24,9).toISOString(),new Date(2026,9,24,12)),'Today');
 assert.equal(activityGroup(new Date(2026,9,23,9).toISOString(),new Date(2026,9,24,12)),'Yesterday');
});
