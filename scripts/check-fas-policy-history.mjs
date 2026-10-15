import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyPolicyHistory, publishedAgreement } from './fas-policy-history.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const registry = JSON.parse(readFileSync(new URL('../account/policy-versions.json', import.meta.url), 'utf8'));
verifyPolicyHistory(root, registry);
console.log('Preserved account policies and acknowledged test wording match their checksums.');
if (process.argv.includes('--for-launch')) {
  try { publishedAgreement(registry); console.log('Published policy snapshots are present; server enforcement and other launch checks still require review.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
} else console.log('Launch review is separate; no published agreement is activated.');
