import test from 'node:test';
import assert from 'node:assert/strict';
import { DEV_AUTH_URL, DEV_ACCOUNT_ORIGIN, LOCAL_AUTH_URL, loadLocalAuthConfig, isDevAuthConfig } from '../account/auth-settings.mjs';
import { localAuthPlugin } from '../scripts/fas-local-auth-server.mjs';
import { lifecycleEnvironment } from '../supabase/functions/fas-account-lifecycle/environment.mjs';
import { createSignupController, resendVerification } from '../account/signup-controller.mjs';
import { requestRecovery } from '../account/recovery-controller.mjs';
const key = role => `test.${Buffer.from(JSON.stringify({role,ref:'oqmmvjjycpyxvxipcyli'})).toString('base64url')}.test`;
const config = {mode:'development',url:DEV_AUTH_URL,key:key('anon')};

test('DEV preview accepts only its fixed backend and nonprivileged keys; live origins stay closed', async () => {
  for (const invalid of [{...config,url:LOCAL_AUTH_URL},{...config,url:'https://vzdicnufhidelaoeqbza.supabase.co'},{...config,key:key('service_role')},{...config,key:'sb_secret_invalid'}]) assert.equal(isDevAuthConfig(invalid),false);
  let calls=0; const request=async()=>{calls++;return {ok:true,json:async()=>config};};
  assert.deepEqual(await loadLocalAuthConfig(DEV_ACCOUNT_ORIGIN,request),config);
  assert.equal(await loadLocalAuthConfig('http://127.0.0.1:55400',request),null);
  assert.equal(await loadLocalAuthConfig('https://fromastoryteller.com',request),null);
  assert.equal(calls,2);
});
test('DEV middleware rejects other loopback ports and cross-origin callers', () => {
  let middleware;
  localAuthPlugin({FAS_DEV_AUTH_ENABLED:'true',FAS_DEV_PUBLIC_KEY:key('anon')}).configureServer({middlewares:{use(fn){middleware=fn;}}});
  const run=headers=>{const res={statusCode:200,setHeader(){},end(body){this.body=body;}};middleware({url:'/__fas/local-auth',method:'GET',headers},res,()=>assert.fail());return res;};
  assert.equal(run({host:'127.0.0.1:55400'}).statusCode,404);
  assert.equal(run({host:'127.0.0.1:55410','sec-fetch-site':'cross-site'}).statusCode,404);
  assert.equal(JSON.parse(run({host:'127.0.0.1:55410','sec-fetch-site':'same-origin'}).body).url,DEV_AUTH_URL);
});
test('Lifecycle opt-in cannot enable production or an unexpected backend', () => {
  assert.equal(lifecycleEnvironment(DEV_AUTH_URL,'true').enabled,true);
  assert.equal(lifecycleEnvironment(DEV_AUTH_URL,'false').enabled,false);
  assert.equal(lifecycleEnvironment('https://vzdicnufhidelaoeqbza.supabase.co','true').enabled,false);
  assert.equal(lifecycleEnvironment('http://kong:8000').enabled,true);
  assert.equal(lifecycleEnvironment(DEV_AUTH_URL,'true').origin,DEV_ACCOUNT_ORIGIN);
});
test('DEV signup, resend and recovery keep callbacks on the DEV loopback preview', async () => {
  const auth={
    signUp:async data=>{assert.equal(data.options.emailRedirectTo,DEV_ACCOUNT_ORIGIN+'/account/verify-email/');return {data:{}};},
    resend:async data=>{assert.equal(data.options.emailRedirectTo,DEV_ACCOUNT_ORIGIN+'/account/verify-email/');return {};},
    resetPasswordForEmail:async(_email,data)=>{assert.equal(data.redirectTo,DEV_ACCOUNT_ORIGIN+'/account/reset-password/');return {};},
  };
  let state;
  await createSignupController(auth,value=>{state=value;},DEV_ACCOUNT_ORIGIN).signUp({displayName:'Reader',email:'reader@example.invalid',password:'ExampleOnly9!Z',confirmation:'ExampleOnly9!Z',ageConfirmed:true,policiesAcknowledged:true});
  assert.equal(state.state,'requested');
  await resendVerification(auth,'reader@example.invalid',DEV_ACCOUNT_ORIGIN);
  await requestRecovery(auth,'reader@example.invalid',DEV_ACCOUNT_ORIGIN);
  assert.throws(()=>createSignupController(auth,()=>{},'https://attacker.invalid'),/not allowed/);
});
