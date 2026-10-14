import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

test('FAS image backup paginates nested files, restores bytes and rejects corruption/overwrites', async () => {
  const root = await mkdtemp(join(tmpdir(),'fas-storage-test-'));
  const source = new Map(Array.from({length:101},(_,i)=>[`author/story/${i}.png`,Buffer.from(`image-${i}`)]));
  const target = new Map();
  let active = source;
  const server = createServer(async (req,res)=> {
    try {
      assert.equal(req.headers.apikey,'sb_secret_test_only');
      assert.equal(req.headers.authorization,undefined);
      const chunks=[]; for await(const chunk of req) chunks.push(chunk);
      const bytes=Buffer.concat(chunks);
      if (req.url.includes('/list/')) {
        const {prefix,limit,offset}=JSON.parse(bytes.toString());
        const children=new Map();
        for(const name of active.keys()) {
          if(prefix && !name.startsWith(prefix+'/')) continue;
          const rest=prefix?name.slice(prefix.length+1):name;
          const first=rest.split('/')[0];
          children.set(first,{name:first,id:rest.includes('/')?null:'test-id',metadata:{mimetype:'image/png'}});
        }
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify([...children.values()].slice(offset,offset+limit)));
      } else {
        const name=decodeURIComponent(req.url.split('/fas-story-images/')[1]);
        if(req.method==='GET') { res.setHeader('Content-Type','image/png'); res.end(active.get(name)); }
        else if(active.has(name)) { res.statusCode=409; res.end('exists'); }
        else { active.set(name,bytes); res.end('{}'); }
      }
    } catch { res.statusCode=500; res.end('mock failure'); }
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const invoke=(mode,folder)=>new Promise((finish)=> {
    const child=spawn(process.execPath,[resolve('scripts/fas-storage-backup.mjs'),mode,folder],{
      env:{...process.env,FAS_STORAGE_URL:url,FAS_STORAGE_SECRET_KEY:'sb_secret_test_only',FAS_RESTORE_CONFIRM_URL:url},windowsHide:true
    });
    let output=''; child.stdout.on('data',b=>output+=b); child.stderr.on('data',b=>output+=b);
    child.on('close',code=>finish({code,output}));
  });
  try {
    const backup=join(root,'backup');
    assert.equal((await invoke('export',backup)).code,0);
    const manifest=JSON.parse(await readFile(join(backup,'manifest.json'),'utf8'));
    assert.equal(manifest.entries.length,101);
    active=target;
    assert.equal((await invoke('restore',backup)).code,0);
    assert.equal(target.size,source.size);
    for(const [name,bytes] of source) assert.deepEqual(target.get(name),bytes);
    assert.notEqual((await invoke('restore',backup)).code,0);
    await writeFile(join(backup,manifest.entries[0].file),'corrupted');
    active=new Map();
    assert.notEqual((await invoke('restore',backup)).code,0);
    assert.equal(active.size,0);
    assert.notEqual((await invoke('export',backup)).code,0);
  } finally {
    await new Promise(r=>server.close(r));
    await rm(root,{recursive:true,force:true});
  }
});
