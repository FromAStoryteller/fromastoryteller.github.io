import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {starterPackage,packageZip} from '../systems/community/interactive-package.mjs';
import {unzipCreatorFiles} from '../systems/community/interactive-archive.mjs';
import {defaultGameSettings} from '../systems/community/game-contract.mjs';
const browser=await chromium.launch(),origin='http://127.0.0.1:55410',errors=[];
try{for(const mode of ['casual','realtime']){
 const dir='.preview-cache/interactive/'+mode;await mkdir(dir,{recursive:true});const p=starterPackage('landscape','game',{...defaultGameSettings(),saves:true,multiplayer:mode});for(const f of await unzipCreatorFiles(packageZip(p)))await writeFile(dir+'/'+f.name,new Uint8Array(await f.arrayBuffer()));
 const context=await browser.newContext(),host=await context.newPage(),guest=await context.newPage();for(const page of [host,guest]){page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/'+dir+'/index.html');await page.waitForFunction(()=>window.FAS?.saves);}
 assert.equal(await host.evaluate(()=>FAS.width),1920);
 assert.ok(await host.getByRole('button',{name:'Save progress',exact:true}).isVisible());
 const saved=await host.evaluate(()=>FAS.saves.save('fixture',{level:2,score:17},{revision:0,version:1}));assert.equal(saved.revision,1);
 await host.reload();assert.equal((await host.evaluate(()=>FAS.saves.load('fixture'))).data.score,17);
 await host.evaluate(()=>window.requestAnimationFrame=()=>0);await guest.evaluate(()=>window.requestAnimationFrame=()=>0);await host.waitForTimeout(200);await host.getByRole('button',{name:'Create room',exact:true}).click();const room=await host.evaluate(()=>FAS.multiplayer.get());
 await guest.evaluate(code=>FAS.multiplayer.join(code),room.code);await host.waitForFunction(async()=>(await FAS.multiplayer.get()).players.length===2);
 await guest.evaluate(()=>FAS.multiplayer.updatePlayer({x:42,y:17,move:0,sequence:1}));
 await host.waitForFunction(async()=>{const r=await FAS.multiplayer.get();return r.players.some(p=>p.data.x===42);});
 await assert.rejects(guest.evaluate(()=>FAS.multiplayer.updateShared({forged:true})),/Only the host/);
 await host.evaluate(()=>FAS.multiplayer.updateShared({round:4}));await guest.waitForFunction(async()=>(await FAS.multiplayer.get()).shared.data.round===4);
 await guest.evaluate(()=>{window.roomEnded=false;FAS.multiplayer.onChange(r=>{if(!r)window.roomEnded=true;});});await host.evaluate(()=>FAS.multiplayer.leave());await guest.waitForFunction(()=>window.roomEnded);assert.deepEqual(errors,[]);await context.close();console.log('PASS '+mode+' offline starter execution, save persistence, two-tab rooms and host-only state');
}}finally{await browser.close();}
