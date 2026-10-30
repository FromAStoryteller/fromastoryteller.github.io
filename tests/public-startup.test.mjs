import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {Script,createContext} from 'node:vm';import {publicStartupMarkup} from '../scripts/public-startup-markup.mjs';import {queryPublicContent} from '../systems/content/public-query.mjs';
test('public startup preloads static dependencies once and leaves dynamic/editor modules lazy',()=>{
 const keyword='im'+'port',from='fr'+'om';
 const source=new Map(Object.entries({'main.mjs':keyword+' "./child.mjs";const lazy=()=>'+keyword+'("./editor.mjs");','child.mjs':'export {x} '+from+' "./leaf.mjs";','leaf.mjs':'export const x=1;const sample='+JSON.stringify(keyword+' "./editor.mjs"')+';','editor.mjs':'export const editor=true;'}));
 source.set('systems/content/discovery-startup.js','globalThis.boot=true;');
 const mapping=new Map([...source.keys()].map(p=>['/'+p,'/_assets/012345678901234567890123/'+p]));mapping.set('/systems/content/discovery-startup.js','/_assets/012345678901234567890123/startup.js');
 const resolve=(f,u)=>u.replace(/^\.\//,'').replace(/^\//,'');
 const html='<head><script type="module" src="/main.mjs"></script></head>';
 const result=publicStartupMarkup('index.html',html,{source,mapping,resolve});
 assert.ok(result.includes('child.mjs'));assert.ok(result.includes('leaf.mjs'));assert.ok(!result.includes('editor.mjs'));
 assert.equal((result.match(/rel="modulepreload"/g)||[]).length,2);
 assert.ok(result.indexOf('data-fas-discovery-startup')<result.indexOf('rel="modulepreload"'));
 assert.equal(publicStartupMarkup('account/policy-history/frozen/index.html',html,{source,mapping,resolve}),html);
});
const startup=readFileSync(new URL('../systems/content/discovery-startup.js',import.meta.url),'utf8'),slot=Symbol.for('fas.public-discovery');
function begin(path,fetcher){const events=new Map(),location={origin:'https://fromastoryteller.com',pathname:path.split('?')[0],href:'https://fromastoryteller.com'+path},sandbox={location,URL,URLSearchParams,Symbol,AbortController,AbortSignal,fetch:fetcher,addEventListener:(name,fn)=>events.set(name,fn)};const context=createContext(sandbox);new Script(startup).runInContext(context);const pending=new Script('globalThis[Symbol.for("fas.public-discovery")]').runInContext(context);return {pending,hide:()=>events.get('pagehide')?.()};}
const page=()=>Response.json({items:[],featured:[],total:0,next_cursor:null});
test('one anonymous startup request is consumed once, with fresh reads after consumption or restoration',async()=>{
 const previous=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return page();};
 try{const boot=begin('/',globalThis.fetch);assert.equal(calls.length,1);globalThis[slot]=boot.pending;
  await queryPublicContent({offset:0});assert.equal(calls.length,1);assert.equal(globalThis[slot],undefined);
  await queryPublicContent({offset:0});assert.equal(calls.length,2);
  const restored=begin('/stories/',globalThis.fetch);restored.hide();assert.equal(restored.pending.controller.signal.aborted,true);
  for(const c of calls){assert.equal(c.options.credentials,'omit');assert.equal(c.options.cache,'no-store');assert.equal(c.options.redirect,'error');}
 }finally{delete globalThis[slot];globalThis.fetch=previous;}
});
test('query changes discard speculative results; search keys match and failures remain retryable',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return page();};
 try{
  const boot=begin('/',globalThis.fetch);globalThis[slot]=boot.pending;
  await queryPublicContent({category:'stories',offset:0});assert.equal(calls,2);assert.equal(boot.pending.controller.signal.aborted,true);
  const search=begin('/search/?q=Tea',globalThis.fetch);globalThis[slot]=search.pending;
  await queryPublicContent({q:'Tea',limit:24,offset:0});assert.equal(calls,3);
  const failed=begin('/',async()=>{throw Error('Offline');});globalThis[slot]=failed.pending;
  await assert.rejects(queryPublicContent({offset:0}),/Offline/);
  await queryPublicContent({offset:0});assert.equal(calls,4);
 }finally{delete globalThis[slot];globalThis.fetch=previous;}
});
test('empty search does not fetch and early consumer cancellation aborts the original request',async()=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return page();};
 try{assert.equal(begin('/search/',globalThis.fetch).pending,undefined);assert.equal(calls,0);
  const boot=begin('/',globalThis.fetch);globalThis[slot]=boot.pending;const controller=new AbortController();controller.abort();
  await assert.rejects(queryPublicContent({offset:0},{signal:controller.signal}),{name:'AbortError'});
  assert.equal(boot.pending.controller.signal.aborted,true);
 }finally{delete globalThis[slot];globalThis.fetch=previous;}
});
