import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {versionPublicAssets} from '../scripts/version-public-assets.mjs';
test('asset versions rewrite HTML and dependency graphs while keeping runtime config and external services fresh',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fas-assets-'));
 try{
  const moduleImport='im'+'port ',fetchName='fe'+'tch';
  const input={'account/policy-history/frozen/terms/index.html':'<script src="/systems/main.js"></script>', 'index.html':'<script src="/systems/main.js"></script><link href="/css/site.css"><img src="/assets/a.png">','systems/main.js':moduleImport+'"./child.mjs"; '+fetchName+'("/content/catalogue.json"); '+fetchName+'("/account/runtime-config.json"); const image="https://service.example/assets/a.png";','systems/child.mjs':'export const image="/assets/a.png";','css/site.css':'body{background:url(../assets/a.png)}','assets/a.png':Buffer.from([0,255,4]),'content/catalogue.json':'[{"image":"/assets/a.png","url":"/stories/a/"}]','account/runtime-config.json':'{"key":"public"}'};
  for(const [file,data]of Object.entries(input)){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),data);}
  const result=versionPublicAssets(root,Object.keys(input)),prefix='_assets/'+result.release+'/';
  const read=file=>fs.readFileSync(path.join(root,file),'utf8');
  assert.match(read('index.html'),new RegExp('/'+prefix+'systems/main.js'));assert.equal(read(prefix+'assets/a.png'),input['assets/a.png'].toString());
  const js=read(prefix+'systems/main.js');assert.ok(js.includes(moduleImport+'"./child.mjs"'));assert.ok(js.includes('/'+prefix+'content/catalogue.json'));assert.ok(js.includes('"/account/runtime-config.json"'));assert.ok(js.includes('https://service.example/assets/a.png'));
  assert.equal(read(prefix+'css/site.css'),input['css/site.css']);
  assert.ok(read(prefix+'systems/child.mjs').includes('/'+prefix+'assets/a.png'));assert.ok(read(prefix+'content/catalogue.json').includes('"url":"/stories/a/"'));assert.ok(!fs.existsSync(path.join(root,prefix,'account/runtime-config.json')));
  assert.equal(JSON.parse(read('content/build-release.json')).release,result.release);
  assert.equal(read('account/policy-history/frozen/terms/index.html'),input['account/policy-history/frozen/terms/index.html']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
