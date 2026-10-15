// Static wording preview only. Never sends mail or renders an actual credential.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const settings = JSON.parse(read('supabase/templates/production-email-settings.json'));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const cards = Object.entries(settings.templates).map(([kind, file]) => {
  const template = read('supabase/templates/' + file);
  // Preserve text/layout while making every preview link inert. No fake token
  // or production callback is emitted into the review frame.
  const inert = template.replace(/href="[^"]*"/g, 'aria-disabled="true"');
  return `<article class="terms-section"><h2>${kind === 'confirmation' ? 'Confirm signup' : 'Password recovery'}</h2><p><strong>Email subject:</strong> ${escape(settings.subjects[kind])}</p><iframe title="${kind === 'confirmation' ? 'Signup verification email preview' : 'Password recovery email preview'}" sandbox="" srcdoc="${escape(inert)}" style="display:block;width:100%;height:660px;border:1px solid var(--text-muted, #777);border-radius:8px;background:#f4efdf;"></iframe></article>`;
}).join('');
const main = `<main id="main-content" tabindex="-1" class="page-content"><section class="terms-page"><header class="terms-hero"><h1>Account emails — launch preview</h1><p class="terms-intro">The emails viewers will receive when verifying an account or resetting a password.</p><p class="terms-updated">Prepared 16 October 2026 · not installed in production</p></header><section class="terms-feature"><div class="terms-feature-content"><p class="terms-feature-label">Wording and layout preview</p><h2>Clear account emails</h2><p>These messages use the site name without DEV or local-test labels. They contain no private account details, passwords or recovery tokens. Links inside the email previews are disabled.</p><p>No email has been sent and live registration remains closed. Existing DEV emails retain their development labels.</p></div></section><section class="terms-content">${cards}<article class="terms-section"><h2>Before these go live</h2><p>The sender, production website address, one-hour link expiry and delivery settings must match the prepared configuration. Real delivery and recovery will be checked after the approved rollout. This browser preview cannot show every email app’s rendering.</p><p><a href="/account/policy-review/">Return to account policy review</a> · <a href="/account/settings/">Account settings</a></p></article></section></section></main>`;
const shell = read('account/policy-review/index.html');
const html = shell.replace(/<title>[^<]*<\/title>/, '<title>Account email launch preview | From A Storyteller</title>')
  .replace('https://fromastoryteller.com/account/policy-review/', 'https://fromastoryteller.com/account/email-review/')
  .replace(/<main\b[^>]*>[\s\S]*?<\/main>/, main);
const destination = new URL('account/email-review/', root);
mkdirSync(destination, { recursive: true });
writeFileSync(new URL('index.html', destination), html);
console.log('Generated inert production-email review page at ' + fileURLToPath(destination));
