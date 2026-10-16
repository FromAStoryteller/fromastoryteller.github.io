import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const settings = JSON.parse(read('supabase/templates/production-email-settings.json'));

test('Production email sources keep private credentials in the fragment and avoid redirect metadata', () => {
  assert.equal(settings.status, 'installed-verified-no-delivery-test');
  assert.equal(settings.projectRef, 'vzdicnufhidelaoeqbza');
  assert.equal(settings.siteURL, 'https://fromastoryteller.com');
  assert.equal(settings.otpExpirySeconds, 3600);
  for (const [kind, file] of Object.entries(settings.templates)) {
    const html = read('supabase/templates/' + file);
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
    const tokenLinks = links.filter(link => link.includes('.TokenHash'));
    assert.equal(tokenLinks.length, 1);
    const url = new URL(tokenLinks[0].replace('{{ .SiteURL }}', settings.siteURL).replace('{{ .TokenHash }}', 'synthetic-fixture').replaceAll('&amp;', '&'));
    assert.equal(url.origin, settings.siteURL);
    assert.equal(url.search, '');
    assert.equal(url.pathname, kind === 'confirmation' ? '/account/verify-email/' : '/account/reset-password/');
    assert.equal(url.hash, '#token_hash=synthetic-fixture&type=' + (kind === 'confirmation' ? 'email' : 'recovery'));
    assert.doesNotMatch(html, /\.ConfirmationURL|\.RedirectTo|\.Data|\.Email|127\.0\.0\.1|localhost|Development test|Local test|\bDEV\b/);
    assert.match(html, /one hour/);
    assert.match(html, /If you didn’t request/);
    assert.doesNotMatch(settings.subjects[kind], /DEV|test/i);
  }
});

test('Emails have accessible structure and the launch preview cannot navigate or submit a token', () => {
  for (const file of Object.values(settings.templates)) {
    const html = read('supabase/templates/' + file);
    assert.match(html, /<html lang="en" dir="ltr">/);
    assert.match(html, /<body[^>]*>\s*<div lang="en" dir="ltr"/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.doesNotMatch(html, /<script|<form|<img|<input|https?:\/\/[^" ]+\.(?:png|gif)/i);
  }
  const preview = read('account/email-review/index.html');
  assert.equal((preview.match(/sandbox=""/g) || []).length, 2);
  assert.doesNotMatch(preview, /\.TokenHash|token_hash=|&lt;a href=/);
  assert.match(preview, /installed in production; registration remains closed/);
  assert.match(read('supabase/config.toml'), /templates\/confirmation\.html/);
  assert.doesNotMatch(read('supabase/config.toml'), /production\.html/);
});
