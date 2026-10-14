// Operator-only tool. Never import into the website or run against PMP.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const [mode, directory] = process.argv.slice(2);
if (!['export','restore'].includes(mode) || !directory) throw new Error('Usage: node scripts/fas-storage-backup.mjs export|restore <private-directory>');
const url = process.env.FAS_STORAGE_URL?.replace(/\/$/,'');
const key = process.env.FAS_STORAGE_SECRET_KEY;
if (!url || !key) throw new Error('Set FAS_STORAGE_URL and FAS_STORAGE_SECRET_KEY in this terminal only');
const base = new URL(url);
if (base.protocol !== 'https:' && !['127.0.0.1','localhost'].includes(base.hostname)) throw new Error('HTTPS required for remote storage');
const bucket = 'fas-story-images';
const root = resolve(directory);
// New secret keys are API keys, not JWTs; legacy service_role JWTs need Bearer.
const headers = key.startsWith('sb_secret_') ? {apikey:key} : {apikey:key, Authorization:`Bearer ${key}`};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const objectUrl = name => `${url}/storage/v1/object/${bucket}/${name.split('/').map(encodeURIComponent).join('/')}`;
async function request(endpoint, options = {}) {
  const response = await fetch(endpoint, { ...options, redirect:'error', headers:{...headers, ...options.headers} });
  if (!response.ok) throw new Error(`Storage request failed (${response.status}); check target, permissions and existing objects`);
  return response;
}
if (mode === 'export') {
  await mkdir(root, {recursive:true});
  // Refuse to silently overwrite an earlier inventory.
  try { await readFile(join(root,'manifest.json')); throw new Error('Choose a new empty export directory'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const entries = [];
  async function walk(prefix) {
    for (let offset = 0; ; offset += 100) {
      const response = await request(`${url}/storage/v1/object/list/${bucket}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({prefix, limit:100, offset, sortBy:{column:'name',order:'asc'}})
      });
      const rows = await response.json();
      for (const row of rows) {
        const name = prefix ? `${prefix}/${row.name}` : row.name;
        if (!row.id) { await walk(name); continue; }
        const response = await request(objectUrl(name));
        const bytes = Buffer.from(await response.arrayBuffer());
        const file = `${entries.length}.bin`;
        await writeFile(join(root,file), bytes, {flag:'wx'});
        entries.push({name, file, bytes:bytes.length, sha256:digest(bytes), contentType:row.metadata?.mimetype || response.headers.get('content-type') || 'application/octet-stream'});
      }
      if (rows.length < 100) break;
    }
  }
  await walk('');
  await writeFile(join(root,'manifest.json'), JSON.stringify({version:1,bucket,sourceUrl:url,exportedAt:new Date().toISOString(),entries},null,2), {flag:'wx'});
  console.log(`Exported ${entries.length} files with SHA-256 inventory. Encrypt this directory.`);
} else {
  const manifest = JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
  if (manifest.version !== 1 || manifest.bucket !== bucket) throw new Error('Unexpected backup format');
  if (process.env.FAS_RESTORE_CONFIRM_URL !== url) throw new Error('Set FAS_RESTORE_CONFIRM_URL to the checked disposable target URL');
  // Validate every file before making any remote writes.
  for (const item of manifest.entries) {
    if (!/^\d+\.bin$/.test(item.file) || item.name.split('/').some(p=>!p || p==='.' || p==='..')) throw new Error('Invalid backup path');
    const bytes = await readFile(join(root,item.file));
    if (bytes.length !== item.bytes || digest(bytes) !== item.sha256) throw new Error('Backup checksum mismatch');
  }
  for (const item of manifest.entries) {
    const bytes = await readFile(join(root,item.file));
    await request(objectUrl(item.name), {method:'POST',headers:{'Content-Type':item.contentType,'x-upsert':'false'},body:bytes});
  }
  console.log(`Restored ${manifest.entries.length} files without overwrites. Re-export to verify hashes.`);
}
