import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverContent} from '../systems/content/content-discovery.mjs';
import {loadExperiencedContent} from '../systems/community/viewer-history.mjs';
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
test('history reads every 100-key batch and uses URL identity for both file and Studio pieces',async()=>{
 const items=Array.from({length:205},(_,i)=>row(String(i))),calls=[];
 const client={rpc:async(name,args)=>{calls.push(args.content_keys);return {data:args.content_keys.map(key=>({key,experienced:['/stories/0/','/stories/204/'].includes(key)}))};}};
 assert.deepEqual((await loadExperiencedContent(client,items)).map(i=>i.id),['0','204']);assert.deepEqual(calls.map(c=>c.length),[100,100,5]);
 assert.deepEqual(await loadExperiencedContent(client,items,{isEnded:()=>true}),[]);
 await assert.rejects(loadExperiencedContent({rpc:async()=>({error:Error('offline')})},items));
});
