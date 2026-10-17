import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const origin='https://fromastoryteller.com';
const paths=['systems/community/studio-editor.mjs','systems/community/studio-service.mjs','systems/community/studio-page.mjs','systems/community/studio-recovery.mjs','systems/community/studio-lock.mjs','css/studio.css'];
const normalize=s=>s.replace(/\r\n/g,'\n').trimEnd();
for(const path of paths){
 const expected=normalize(await readFile(path,'utf8'));
 let matched=false,last='';
 for(let attempt=0;attempt<16;attempt++){
  const response=await fetch(origin+'/'+path+'?studio-recovery-release='+process.env.GITHUB_SHA,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000),redirect:'error'});
  const actual=normalize(await response.text());last='HTTP '+response.status;
  if(response.ok&&actual===expected){matched=true;break;}
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 assert.ok(matched,path+' did not match reviewed source: '+last);
 console.log('PASS public production source matches '+path);
}
const response=await fetch(origin+'/account/studio/',{signal:AbortSignal.timeout(20000),redirect:'error'});
assert.equal(response.status,200);assert.match(await response.text(),/data-studio-root/);
console.log('PASS public Studio shell; no sign-in or private content mutation');
