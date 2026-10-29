import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {importedCoverImages} from '../systems/community/public-story-catalog.mjs';
test('reviewed imported-cover registry cannot drift from the immutable seed identity or repository bytes',()=>{
 const seed=JSON.parse(readFileSync(new URL('../supabase/seed-data/existing-editorial.json',import.meta.url)));
 for(const [id,entry]of Object.entries(importedCoverImages)){
  assert.ok(seed.some(s=>s.asset_id===id&&s.image===entry.src));
  const bytes=readFileSync(new URL('..'+entry.src,import.meta.url));
  const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  assert.equal(sha,entry.blobSha,'revalidate original cover before changing '+entry.src);
 }
});
