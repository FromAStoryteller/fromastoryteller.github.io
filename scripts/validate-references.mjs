import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['.git', 'node_modules', 'dist', 'dist-production', '.sites-runtime']);
function walk(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (skip.has(entry.name)) return [];
    const relative = path.posix.join(base, entry.name);
    return entry.isDirectory() ? walk(path.join(dir, entry.name), relative) : [relative];
  });
}
const files = walk(root), errors = [], ids = new Map();
let references = 0, syntax = 0, metadata = 0;
function check(file, value) {
  if (!value || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(value) || /[{}<>$]/.test(value)) return;
  const clean = decodeURIComponent(value.split(/[?#]/)[0]);
  if (!clean) return;
  const target = clean.startsWith('/') ? path.join(root, clean.slice(1)) : path.resolve(root, path.dirname(file), clean);
  references++;
  if (!fs.existsSync(target)) errors.push(`${file}: missing ${value}`);
}
const retired = [
  ['scripts', 'theme.js'], ['scripts', 'focus.js'], ['scripts', 'story-theme-controls.js'],
  ['content', 'content-system.js'], ['content', 'content-page.js'], ['content', 'reading-time.mjs'],
  ['stories', 'story-page.js'], ['stories', 'reading-time.js']
].map(parts => parts.join('/'));
for (const file of files) {
  if (!/\.(?:html|css|js|mjs|cjs|json)$/.test(file) || file === 'package-lock.json') continue;
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.json')) {
    try {
      const data = JSON.parse(text);
      if (file.endsWith('/meta.json') && !file.startsWith('_templates/')) {
        metadata++;
        if (!data.id) errors.push(`${file}: missing content ID`);
        else if (ids.has(data.id)) errors.push(`${file}: duplicate ID ${data.id} (${ids.get(data.id)})`);
        else ids.set(data.id, file);
      }
      if (file.endsWith('.system.json')) check(file, '/' + data.entry);
    } catch (error) { errors.push(`${file}: invalid JSON: ${error.message}`); }
  }
  if (/\.(?:js|mjs|cjs)$/.test(file)) {
    syntax++;
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) errors.push(`${file}: syntax error ${result.stderr || result.error}`);
    for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) {
      if (/^[./]/.test(match[1])) check(file, match[1]);
      if (file.startsWith('systems/') && /^\/(?:games|tools|stories)\/(?!shared\/)/.test(match[1])) errors.push(`${file}: shared system imports content ${match[1]}`);
    }
    for (const match of text.matchAll(/\bfetch\(\s*["']([^"']+)["']/g)) check(file, match[1]);
  }
  if (file.endsWith('.html')) {
    for (const tag of text.matchAll(/<(?:script|img|source|link)\b[^>]*>/gi)) {
      for (const match of tag[0].matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) check(file, match[1]);
    }
  }
  if (file.endsWith('.css')) for (const match of text.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)) check(file, match[1]);
  if (file !== 'scripts/validate-references.mjs') {
    for (const old of retired) if (new RegExp('(?:^["\'`]?|["\'`]/?)' + old.replaceAll('.', '\\.') + '(?:["\'`?#]|$)').test(text)) errors.push(`${file}: retired path ${old}`);
    if (/['"]\/script\.js['"]|games\/shared\/[^\s"']+\.js\b|\b_template\//.test(text)) errors.push(`${file}: retired shell, game or template path`);
  }
}
const contract = JSON.parse(fs.readFileSync(path.join(root, '_templates/studio/site-contract.json'), 'utf8'));
for (const entry of [contract.pageTemplate, contract.metadataTemplate, contract.metadataSchema, contract.aiSchema, ...contract.styles, ...Object.values(contract.categories).flatMap(c => [c.template, ...c.styles])]) check('_templates/studio/site-contract.json', '/' + entry);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
console.log(`${references} local references; ${syntax} JavaScript syntax checks; ${metadata} content metadata files; ${errors.length} errors.`);
