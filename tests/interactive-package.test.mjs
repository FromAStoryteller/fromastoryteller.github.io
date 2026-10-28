import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {starterPackage,packageDocument,packageZip,validatePackage,packageFromFiles} from '../systems/community/interactive-package.mjs';
import {recoveryRecord,parseRecovery} from '../systems/community/studio-recovery.mjs';
import {validateStory} from '../systems/community/studio-service.mjs';
import {readingResponse} from '../cloudflare-worker.mjs';
const owner='81000000-0000-0000-0000-000000000001';
test('uploaded code remains escaped data until the opaque player bootstraps it',()=>{
 const p={...starterPackage(),js:'</script><script>parent.stolen=true;</script>',css:'</style><script>parent.stolen=true;</script>'},html=packageDocument(p,{channel:'fixture'});
 assert.equal((html.match(/<script>/g)||[]).length,1);assert.equal((html.match(/<\/script>/g)||[]).length,1);assert.ok(!html.includes('</script><script>parent.stolen'));
 assert.match(html,/connect-src 'none'/);assert.match(html,/frame-src 'none'/);assert.match(html,/worker-src 'none'/);assert.match(html,/base-uri 'none'/);
 new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
});
test('upload bounds reject traversal, duplicate assets, unsupported types and oversized scripts',async()=>{
 const p=starterPackage(),asset={name:'one.png',type:'image/png',data:'aGVsbG8='};assert.ok(validatePackage({...p,assets:[asset]}));assert.match(packageDocument({...p,assets:[asset],css:'canvas { background-image: url("assets/one.png"); }'}),/data:image\/png;base64,aGVsbG8=/);
 for(const change of [{version:2},{orientation:'square'},{js:'x'.repeat(262145)},{css:'x'.repeat(65537)},{assets:[{...asset,name:'../one.png'}]},{assets:[asset,{...asset,name:'ONE.png'}]},{assets:[{...asset,type:'text/html'}]},{assets:[{...asset,data:'<script>'}]}])assert.throws(()=>validatePackage({...p,...change}));
 await assert.rejects(packageFromFiles([new File(['x'],'other.js')]),/Unsupported/);
 const loaded=await packageFromFiles([new File(['console.log("ok")'],'main.js'),new File(['canvas {}'],'style.css'),new File(['hello'],'one.png')],'portrait');assert.equal(loaded.orientation,'portrait');assert.equal(loaded.assets[0].data,asset.data);const imported=await packageFromFiles([new File(['x'],'main.js'),new File([JSON.stringify({version:1,orientation:'portrait'})],'fas.json')]);assert.equal(imported.orientation,'portrait');
});
test('offline ZIP preserves source files, dimensions, resource helpers and user assets',()=>{
 for(const orientation of ['landscape','portrait']){const p={...starterPackage(orientation),assets:[{name:'one.png',type:'image/png',data:'aGVsbG8='}]},bytes=Buffer.from(packageZip(p)),files=new Map();let offset=0;
  while(bytes.readUInt32LE(offset)===0x04034b50){const size=bytes.readUInt32LE(offset+18),n=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),name=bytes.subarray(offset+30,offset+30+n).toString(),start=offset+30+n+extra;files.set(name,bytes.subarray(start,start+size).toString());offset=start+size;}
  assert.deepEqual([...files.keys()],['index.html','game.js','game.css','fas-runtime.js','meta.json','README.txt','assets/one.png']);assert.equal(files.get('game.js'),p.js);assert.equal(files.get('assets/one.png'),'hello');assert.match(files.get('index.html'),/fas-canvas/);assert.match(files.get('fas-runtime.js'),/ctx.setTransform/);assert.equal(JSON.parse(files.get('meta.json')).orientation,orientation);new Script(files.get('fas-runtime.js'));new Script(files.get('game.js'));
 }
});
test('game source survives portable recovery and cannot attach executable files to stories',()=>{
 const values={title:'Private game',content_type:'game',metadata:{instructions:'Tap to move'},executable_package:starterPackage(),genres:['arcade']};const record=recoveryRecord(values,{ownerId:owner});assert.deepEqual(parseRecovery(JSON.stringify(record),{ownerId:owner}).values.executable_package,values.executable_package);assert.throws(()=>validateStory({...values,content_type:'story'}),/Only games/);
});
const shell='<html><head><title>Fallback</title></head><body><main><!--content-layout:start-->Loading<!--content-layout:end--></main></body></html>',config={mode:'production',enabled:true,url:'https://vzdicnufhidelaoeqbza.supabase.co',key:'sb_publishable_fixture',signup:true,lifecycle:true,policyRelease:'fixture'};
test('dynamic games/tools use the shared shell, retain existing files and reject private or wrong-type projections',async()=>{
 for(const [type,collection] of [['game','games'],['tool','tools']]){const url='https://fromastoryteller.com/'+collection+'/fixture/',item={id:owner,slug:'fixture',title:'A <safe> player',summary:'Description for card and sharing',content_type:type,metadata:{instructions:'Tap <button>'},author:{display_name:'Writer'},genres:[]},env={ASSETS:{fetch:async r=>new Response(new URL(r.url).pathname.includes('runtime-config')?JSON.stringify(config):shell,{status:new URL(r.url).pathname.startsWith('/'+collection+'/')?404:200})}};
  const result=await readingResponse(new Request(url,{headers:{Authorization:'Bearer private',Cookie:'private'}}),env,async(_u,o)=>{assert.equal(o.headers.Authorization,undefined);assert.equal(o.headers.Cookie,undefined);return Response.json(item)});assert.equal(result.status,200);const html=await result.text();assert.match(html,/data-interactive-player/);assert.ok(html.includes('A &lt;safe&gt; player'));assert.ok(html.includes('Tap &lt;button&gt;'));assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal((await readingResponse(new Request(url),env,async()=>Response.json(null))).status,404);assert.equal((await readingResponse(new Request(url),env,async()=>Response.json({...item,content_type:'story'}))).status,404);
 }
});

test('nested media paths round-trip through ZIP and folder upload without flattening or collisions',async()=>{
 const p={...starterPackage(),assets:[{name:'images/hero.png',type:'image/png',data:'aGVsbG8='},{name:'icons/hero.png',type:'image/png',data:'aGVsbG8='}],css:'.hero{background:url(assets/images/hero.png)}'};
 const restored=await packageFromFiles([new File([packageZip(p)],'project.zip')]);assert.deepEqual(restored.assets,p.assets);assert.match(packageDocument(p),/data:image\/png;base64/);
 const files=[new File(['const ready=true'],'game.js'),new File(['hello'],'hero.png')];Object.defineProperty(files[0],'webkitRelativePath',{value:'project/game.js'});Object.defineProperty(files[1],'webkitRelativePath',{value:'project/assets/images/hero.png'});assert.equal((await packageFromFiles(files)).assets[0].name,'images/hero.png');
 for(const name of ['../hero.png','a/../hero.png','/hero.png','a//hero.png','a\\hero.png','a/b/c/d/hero.png'])assert.throws(()=>validatePackage({...p,assets:[{...p.assets[0],name}]}));
 assert.throws(()=>packageDocument({...p,css:'.x{background:url(assets/missing.png)}'}),/Missing CSS asset/);
});
