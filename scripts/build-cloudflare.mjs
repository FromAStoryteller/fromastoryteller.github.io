import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const dirs = new Set(['about', 'assets', 'blog', 'components', 'contact', 'content', 'css', 'games', 'privacy', 'search', 'stories', 'systems', 'terms', 'tools', 'videos']);
const files = new Set(['index.html', '404.html', 'home.js', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'googlecae29814c1367461.html']);
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
const selected = tracked.filter(file => files.has(file) || dirs.has(file.split('/')[0]));
// Fixed output is a direct child of this repository; never delete a caller-supplied path.
if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('dist must not be a symlink');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
const manifest = [];
for (const file of selected) {
  if (/(?:^|\/)(?:\.[^/]+|secrets|workspace|private-control|scheduled|drafts)(?:\/|$)|\.(?:key|pem|pfx|p12)$/i.test(file)) throw new Error(`Refusing private path: ${file}`);
  const source = path.join(root, file);
  if (!fs.lstatSync(source).isFile()) throw new Error(`Refusing non-file: ${file}`);
  const data = fs.readFileSync(source);
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  manifest.push({ path: file, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
// Preview-only headers. Production must use a separately reviewed configuration/build.
fs.writeFileSync(path.join(output, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
// Keep audit information outside the served directory.
fs.writeFileSync(path.join(root, 'cloudflare-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${manifest.length} unchanged public files for preview; no domain routes configured.`);
