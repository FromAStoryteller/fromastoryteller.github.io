// Fixed-origin, read-only release verification. No credentials or fixture writes.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
if(process.argv.slice(2).join(' ')!=='--production-read-only')throw Error('Explicit read-only mode required');
const paths=['systems/content/page-layout.mjs','systems/community/public-profile.mjs','systems/community/studio-editor.mjs','stories/stories.css','css/manuscript.css','css/studio.css','games/rally-clash/game.js','games/brick-blitz/game.js'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const path of paths){
 const expected=digest(await readFile(new URL('../'+path,import.meta.url)));let matched=false;
 for(let attempt=0;attempt<18;attempt++){
  try{const r=await fetch('https://fromastoryteller.com/'+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.ok&&digest(Buffer.from(await r.arrayBuffer()))===expected){matched=true;break;}}catch{}
  if(attempt<17)await new Promise(resolve=>setTimeout(resolve,10000));
 }
 assert.ok(matched,'Deployment source mismatch: '+path);
}
await import('./test-fas-operational-readiness.mjs');
for(const [path,type] of [['/stories/the-deal/','story'],['/games/rally-clash/','game'],['/tools/countdown/','tool']]){
 const r=await fetch('https://fromastoryteller.com'+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);assert.ok((await r.text()).includes('data-content-layout="'+type+'"'));
}
console.log('PASS exact production layout/manuscript sources, both independent game bundles and shared story/game/tool templates');
