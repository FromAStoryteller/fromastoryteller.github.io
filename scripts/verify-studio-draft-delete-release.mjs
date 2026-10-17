import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const origin='https://fromastoryteller.com';
const normalize=s=>s.replace(/\r\n/g,'\n');
for(const path of ['systems/community/studio-editor.mjs','systems/community/studio-service.mjs','css/studio.css']){
 const expected=normalize(await readFile(path,'utf8'));let match=false;
 for(let i=0;i<8;i++){const r=await fetch(origin+'/'+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.status===200&&normalize(await r.text())===expected){match=true;break;}await new Promise(r=>setTimeout(r,3000));}
 assert.ok(match,'Live source mismatch: '+path);console.log('PASS live reviewed source '+path);
}
const r=await fetch(origin+'/account/runtime-config.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const config=await r.json();
assert.equal(config.url,'https://vzdicnufhidelaoeqbza.supabase.co');assert.equal(config.mode,'production');assert.equal(config.enabled,true);assert.equal(config.signup,true);assert.equal(config.lifecycle,true);console.log('PASS production account configuration retained');
for(const path of ['/stories/release-check-missing/','/blog/release-check-missing/','/read/?story=release-check-missing']){
 const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(r.status,404,path);assert.match(r.headers.get('x-robots-tag')??'',/noindex/);console.log('PASS private/missing reader '+path);
}
console.log('PASS draft-delete release verification; no accounts, drafts or files were changed.');
