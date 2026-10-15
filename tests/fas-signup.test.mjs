import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localSignupReady } from '../scripts/fas-local-signup-settings.mjs';
import { createSignupController, EMAIL_REQUEST_MESSAGE, resendVerification } from '../account/signup-controller.mjs';
import { consumeVerificationLink, createVerificationController } from '../account/verification-controller.mjs';
import { savePendingEmail, readPendingEmail, clearPendingEmail } from '../account/pending-email.mjs';

const details = { displayName: ' Local reader ', email: ' reader@example.invalid ', password: 'SampleOnly9!', confirmation: 'SampleOnly9!', ageConfirmed: true, policiesAcknowledged: true };
const hash = 'a'.repeat(56);

test('Local signup requires the correct local URL, server password rules and email confirmation', () => {
  const config=readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');
  assert.equal(localSignupReady(config),true);
  for (const [before,after] of [['minimum_password_length = 12','minimum_password_length = 6'],['password_requirements = "lower_upper_letters_digits_symbols"','password_requirements = ""'],['enable_confirmations = true','enable_confirmations = false'],['pg-functions://postgres/public/fas_before_user_created','pg-functions://postgres/public/wrong_hook'],['[auth.hook.before_user_created]','[auth.hook.before_user_created_disabled]'],['site_url = "http://127.0.0.1:55400"','site_url = "https://fromastoryteller.com"']]) assert.equal(localSignupReady(config.replace(before,after)),false);
});

test('Invalid password/name never submits; signup requires declarations and sends cosmetic name with versioned local acknowledgement', async () => {
  let calls=0;
  const states=[];
  const controller=createSignupController({signUp:async request=>{
    calls++;
    assert.deepEqual(request,{email:'reader@example.invalid',password:'SampleOnly9!',options:{data:{display_name:'Local reader',fas_registration:{mode:'local_draft_review',terms_version:'local-preview-2026-10-15-v1',privacy_version:'local-preview-2026-10-15-v1',age_16_or_over:true,terms_acknowledged:true,privacy_notice_seen:true}},emailRedirectTo:'http://127.0.0.1:55400/account/verify-email/'}});
    return {data:{user:{id:'fixture'},session:null}};
  }},state=>states.push(state));
  await controller.signUp({...details,confirmation:'MismatchOnly9!'});
  await controller.signUp({...details,displayName:'   '});
  await controller.signUp({...details,ageConfirmed:false});
  await controller.signUp({...details,policiesAcknowledged:false});
  await controller.signUp({...details,ageConfirmed:'true'});
  assert.equal(calls,0);
  await controller.signUp(details);
  assert.equal(calls,1);
  assert.equal(states.at(-1).state,'requested');
});

test('Existing accounts receive the same inbox guidance; autoconfirm never reports verification pending', async () => {
  const states=[];
  await createSignupController({signUp:async()=>({error:{code:'user_already_exists',status:422}})},s=>states.push(s)).signUp(details);
  assert.equal(states.at(-1).message,EMAIL_REQUEST_MESSAGE);
  let revoked=false;
  await createSignupController({signUp:async()=>({data:{session:{},user:{}}}),signOut:async()=>{revoked=true;return {error:null};}},s=>states.push(s)).signUp(details);
  assert.equal(revoked,true);
  assert.equal(states.at(-1).state,'error');
});

test('Resend hides account membership, while connection/rate-limit failures remain clear', async () => {
  const missing=await resendVerification({resend:async()=>({error:{status:400,code:'user_not_found'}})},'reader@example.invalid');
  const registered=await resendVerification({resend:async()=>({})},'reader@example.invalid');
  assert.deepEqual(missing,registered);
  assert.match((await resendVerification({resend:async()=>({error:{status:429}})},'reader@example.invalid')).message,/Wait a few minutes/);
  assert.equal((await resendVerification({resend:async()=>{throw new Error('secret');}},'reader@example.invalid')).state,'error');
});

test('Verification accepts fragment-only credentials, scrubs the address and rejects query/mixed/duplicate credentials', () => {
  let scrubbed=0;
  const scrub=()=>scrubbed++;
  assert.equal(consumeVerificationLink(`http://127.0.0.1:55400/account/verify-email/#token_hash=${hash}&type=email&next=https://attacker.invalid`,scrub),hash);
  for (const suffix of [
    `?token_hash=${hash}&type=email`,
    `?token_hash=${hash}#token_hash=${hash}&type=email`,
    `#token_hash=${hash}&type=recovery`,
    '?verified=true#access_token=fake',
    `#token_hash=${hash}&token_hash=${hash}&type=email`,
    `#token_hash=${hash}&type=email&type=email`,
    '#token_hash=bad&type=email',
  ]) assert.equal(consumeVerificationLink('http://127.0.0.1:55400/account/verify-email/'+suffix,scrub),null);
  assert.equal(scrubbed,8);
});

test('Verification needs an explicit call and server confirmation; used links terminate while network errors allow retry', async () => {
  let calls=0;
  const states=[];
  const verify=createVerificationController({verifyOtp:async request=>{calls++;assert.deepEqual(request,{token_hash:hash,type:'email'});return {data:{user:{email_confirmed_at:'2026-10-15T00:00:00Z'}}};}},hash,s=>states.push(s));
  assert.equal(calls,0);
  await verify();await verify();
  assert.equal(calls,1);assert.equal(states.at(-1).state,'verified');
  let attempts=0;
  const retry=createVerificationController({verifyOtp:async()=>{attempts++;return {error:{status:attempts===1?503:403}};}},hash,s=>states.push(s));
  await retry();assert.equal(states.at(-1).retryable,true);
  await retry();assert.equal(states.at(-1).retryable,false);
  await retry();assert.equal(attempts,2);
});

test('Pending email uses only temporary email/time data and handles unavailable browser storage', () => {
  const values=new Map();
  const storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
  savePendingEmail(' reader@example.invalid ',storage);
  assert.equal(readPendingEmail(storage).email,'reader@example.invalid');
  assert.deepEqual(Object.keys(JSON.parse([...values.values()][0])).sort(),['email','requestedAt']);
  clearPendingEmail(storage);assert.equal(readPendingEmail(storage),null);
  const blocked={setItem(){throw new Error('blocked');},getItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}};
  assert.doesNotThrow(()=>savePendingEmail('reader@example.invalid',blocked));
  assert.equal(readPendingEmail(blocked),null);
  assert.doesNotThrow(()=>clearPendingEmail(blocked));
});
