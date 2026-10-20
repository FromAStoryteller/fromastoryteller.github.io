import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {defaultGameSettings,validateGameSettings,validateSaveData,validateSaveSchema} from '../systems/community/game-contract.mjs';
import {packageFromFiles,packageZip,starterPackage} from '../systems/community/interactive-package.mjs';
import {createGameService} from '../systems/community/game-service.mjs';
const settings={...defaultGameSettings(),saves:true,multiplayer:'realtime'};
test('bounded save contracts reject undeclared data, invalid versions and unbounded collections',()=>{
 assert.ok(validateSaveData(settings.saveSchema,{level:1,score:2}));
 for(const value of [{level:0,score:2},{level:1,score:2,email:'private'},{level:1},{level:1,score:Infinity}])assert.equal(validateSaveData(settings.saveSchema,value),false);
 for(const change of [{saveVersion:0},{multiplayer:'public'},{unknown:true}])assert.throws(()=>validateGameSettings({...settings,...change}));
 for(const schema of [{type:'object',properties:{}},{type:'array',items:{type:'boolean'}},{type:'string',maxLength:10000},{type:'integer',minimum:3,maximum:2}])assert.throws(()=>validateSaveSchema(schema));
});
test('game and tool ZIPs round-trip canonical sources, assets and settings',async()=>{
 for(const type of ['game','tool'])for(const orientation of ['landscape','portrait']){
  const p=starterPackage(orientation,type,type==='game'?settings:defaultGameSettings());p.assets=[{name:'sprite.png',type:'image/png',data:'aGVsbG8='}];
  const loaded=await packageFromFiles([new File([packageZip(p,type)],'project.zip')],orientation,{type});
  assert.equal(loaded.js,p.js);assert.equal(loaded.css,p.css);assert.equal(loaded.orientation,orientation);assert.deepEqual(loaded.assets,p.assets);assert.deepEqual(loaded.settings,p.settings);
 }
});
test('ZIP import rejects traversal, duplicate names, corrupt data and encrypted entries',async()=>{
 const original=Buffer.from(packageZip(starterPackage()));
 for(const mutate of [b=>{b[35]^=1;},b=>{b.writeUInt16LE(1,6);const p=b.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));b.writeUInt16LE(1,p+8);},b=>{let p=0;while((p=b.indexOf(Buffer.from('game.js'),p))>=0){b.write('../x.js',p);p+=7;}}]){const b=Buffer.from(original);mutate(b);await assert.rejects(packageFromFiles([new File([b],'project.zip')]));}
});
test('the trusted game adapter requires explicit enablement and binds every write to verified account and game',async()=>{
 let uid='owner',callback;const calls=[];const client={auth:{getUser:async()=>({data:{user:{id:uid}}}),getSession:async()=>({data:{session:{user:{id:uid}}}}),onAuthStateChange:fn=>(callback=fn,{data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{calls.push({name,args});return {data:args.action==='status'?{enabled:true,policyCurrent:true}:{data:{level:1,score:2},revision:1}};},removeChannel:async()=>{}};
 const service=createGameService(client,{gameId:'game',version:'published-version',settings});
 await assert.rejects(service.invoke('save.get'),/Enable account features/);assert.equal(calls.length,0);
 await service.enable();await service.invoke('save.put',{game:'forged',owner:'forged',slot:'main',revision:0,data:{level:1,score:2}});
 assert.deepEqual(calls.at(-1).args,{game_key:'game',game_version:'published-version',action:'save.put',params:{slot:'main',revision:0,version:1,data:{level:1,score:2},account:'owner'}});
 uid='other';await assert.rejects(service.invoke('save.put',{data:{}}),/account changed/);assert.equal(calls.length,2);callback('SIGNED_OUT',null);service.dispose();
});

test('game notice release freezes the data controls and exact predecessor',async()=>{
 const {readFileSync}=await import('node:fs');const {policyTransitionPlan}=await import('../scripts/fas-policy-release-plan.mjs');const root=new URL('../',import.meta.url),r=JSON.parse(readFileSync(new URL('account/policy-versions.json',root)));const v=r.gameUpdateVersion;assert.equal(r.activePublishedVersion,v);for(const kind of ['privacy','terms']){const live=readFileSync(new URL(kind+'/index.html',root),'utf8'),frozen=readFileSync(new URL(r.versions[v].documents[kind].path.slice(1),root),'utf8');const withoutShell=html=>html.replace(/<!-- static:(header|sidebar|footer)-placeholder:start -->[\s\S]*?<!-- static:\1-placeholder:end -->/g,'');assert.equal(withoutShell(live),withoutShell(frozen));assert.match(live,/private multiplayer/i);assert.match(live,/account\/games/);}const {fileURLToPath}=await import('node:url');assert.equal(readFileSync(new URL('supabase/ops/'+v+'.sql',root),'utf8'),policyTransitionPlan(fileURLToPath(root),r,v,r.versions[v].previousVersion));
});

test('ordinary DEFLATE ZIPs import with the same canonical package',async()=>{
 const source=Buffer.from(packageZip(starterPackage())),locals=[],directory=[];let p=0,offset=0;while(source.readUInt32LE(p)===0x04034b50){const size=source.readUInt32LE(p+18),n=source.readUInt16LE(p+26),extra=source.readUInt16LE(p+28),start=p+30+n+extra,head=Buffer.from(source.subarray(p,start)),data=deflateRawSync(source.subarray(start,start+size));head.writeUInt16LE(8,8);head.writeUInt32LE(data.length,18);locals.push(head,data);directory.push({offset,size:data.length});p=start+size;}const entries=[];for(const entry of directory){const length=46+source.readUInt16LE(p+28)+source.readUInt16LE(p+30)+source.readUInt16LE(p+32),head=Buffer.from(source.subarray(p,p+length));head.writeUInt16LE(8,10);head.writeUInt32LE(entry.size,20);head.writeUInt32LE(offset,42);entries.push(head);offset+=locals[(entries.length-1)*2].length+entry.size;p+=length;}const end=Buffer.from(source.subarray(p));end.writeUInt32LE(entries.reduce((n,b)=>n+b.length,0),12);end.writeUInt32LE(offset,16);const loaded=await packageFromFiles([new File([Buffer.concat([...locals,...entries,end])],'compressed.zip')]);assert.equal(loaded.js,starterPackage().js);
});
