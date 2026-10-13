import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = new URL(process.argv[2] || 'http://127.0.0.1:8787');
if (base.pathname !== '/' || !['http:', 'https:'].includes(base.protocol)) throw new Error('Use an origin URL');
const baseline = process.argv.includes('--baseline');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'cloudflare-manifest.json'), 'utf8'));
const results = [], errors = [];
const hash = data => createHash('sha256').update(data).digest('hex');
async function check(entry) {
  const urlPath = entry.path === 'index.html' ? '/' : '/' + entry.path.replace(/\/index\.html$/, '/');
  try {
    const response = await fetch(new URL(urlPath, base), { signal: AbortSignal.timeout(20000) });
    const body = Buffer.from(await response.arrayBuffer());
    const pass = response.status === 200 && hash(body) === entry.sha256;
    results.push({ path: urlPath, status: response.status, matches: hash(body) === entry.sha256 });
    if (!pass) errors.push(`${urlPath}: status/body differs`);
    if (!baseline && !response.headers.get('x-robots-tag')?.includes('noindex')) errors.push(`${urlPath}: preview noindex missing`);
  } catch (error) { errors.push(`${urlPath}: ${error.message}`); }
}
// Compare every public file, including all published content and binary assets.
for (let start = 0; start < manifest.length; start += 6) await Promise.all(manifest.slice(start, start + 6).map(check));
if (!baseline) {
  for (const candidate of ['/stories/michaels-choice', '/stories/michaels-choice/index.html']) {
    const response = await fetch(new URL(candidate + '?migration=1', base), { redirect: 'manual' });
    const location = response.headers.get('location');
    const target = location && new URL(location, base);
    if (![301, 302, 307, 308].includes(response.status) || target?.pathname !== '/stories/michaels-choice/' || target.search !== '?migration=1') errors.push(`${candidate}: redirect failed`);
    results.push({ path: candidate, status: response.status, location });
  }
  for (const candidate of ['/__fas_missing__', '/assets/missing.js', '/.git/config', '/package.json', '/CNAME', '/scripts/build-cloudflare.mjs', '/_templates/studio/site-contract.json']) {
    const response = await fetch(new URL(candidate, base));
    if (response.status !== 404) errors.push(`${candidate}: expected 404, got ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (hash(body) !== manifest.find(entry => entry.path === '404.html').sha256) errors.push(`${candidate}: custom 404 body differs`);
    results.push({ path: candidate, status: response.status });
  }
}
const report = { origin: base.origin, mode: baseline ? 'existing-host-baseline' : 'cloudflare-preview', checkedAt: new Date().toISOString(), results, errors };
fs.writeFileSync(path.join(root, baseline ? 'hosting-baseline.json' : 'cloudflare-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${results.length} checks; ${errors.length} failures.`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
