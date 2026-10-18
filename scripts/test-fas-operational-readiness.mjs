// Operator smoke check: fixed production, read-only, no account/content/email creation.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(process.argv.slice(2).join(' ')!=='--production-read-only')throw Error('Explicit --production-read-only required');
await import('./test-fas-community-public.mjs');
const origin='https://fromastoryteller.com';
const get=path=>fetch(origin+path,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
for(const path of ['/','/account/sign-in/','/account/sign-up/','/account/recover/','/account/verify-email/','/account/reset-password/','/account/settings/','/account/profile/','/account/invitation/','/terms/','/privacy/','/terms/contributors/','/contact/']){
 const r=await get(path);assert.equal(r.status,200,path);assert.match(r.headers.get('content-type')??'',/text\/html/i,path);await r.body?.cancel();
}
const contact=await get('/contact/');assert.match(await contact.text(),/mailto:fromastoryteller@gmail\.com/);
const config=await get('/account/runtime-config.json');assert.match(config.headers.get('cache-control')??'',/no-store/i);await config.body?.cancel();
const sources=['systems/community/studio-editor.mjs','systems/community/studio-service.mjs','systems/community/studio-recovery.mjs','systems/community/admin-service.mjs','account/session-controller.mjs','account/lifecycle-client.mjs'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const path of sources){
 const expected=await readFile(new URL('../'+path,import.meta.url));const r=await get('/'+path);assert.equal(r.status,200,path);
 assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(expected),'Deployed source differs from this checkout: '+path);
}
for(const base of ['http://fromastoryteller.com','https://www.fromastoryteller.com']){
 const path='/stories/?fas-readiness=1',r=await fetch(base+path,{redirect:'follow',signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200);assert.equal(r.url,origin+path,'Canonical redirect must preserve path/query');await r.body?.cancel();
}
const index=JSON.parse(await readFile(new URL('../content/content-index.json',import.meta.url),'utf8'));assert.ok(Array.isArray(index)&&index.length>0);
for(const metaPath of index){
 assert.match(metaPath,/^\/(stories|games|tools|blog|videos)\/[a-z0-9-]+\/meta\.json$/);
 const path=metaPath.replace(/meta\.json$/,'');const r=await get(path);assert.equal(r.status,200,path);assert.match(r.headers.get('content-type')??'',/text\/html/i);await r.body?.cancel();
}
for(const path of ['/stories/fas-operational-readiness-nonexistent-7e087322/','/scripts/fas-storage-backup.mjs','/supabase/config.toml']){
 const r=await get(path);assert.equal(r.status,404,path);await r.body?.cancel();
}
console.log('PASS production operational smoke: account/support/policy routes, no-store runtime, '+sources.length+' exact deployed sources, HTTPS/www redirects, '+index.length+' existing content pages, missing story and private-source exclusions');
