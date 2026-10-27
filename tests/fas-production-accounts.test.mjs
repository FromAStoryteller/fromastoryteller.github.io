import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAccountAuthConfig, loadLocalAuthConfig, isProductionAuthConfig, PRODUCTION_AUTH_URL, PRODUCTION_ACCOUNT_ORIGIN, DEV_ACCOUNT_ORIGIN, DEV_AUTH_URL } from '../account/auth-settings.mjs';
import { productionAccountBuildConfig } from '../scripts/fas-production-account-build.mjs';
import { lifecycleEnvironment } from '../supabase/functions/fas-account-lifecycle/environment.mjs';
import { makeLifecycleHandler } from '../supabase/functions/fas-account-lifecycle/handler.mjs';
import { prepareDeletion, downloadOwnedContent } from '../account/lifecycle-client.mjs';
import { createSignupController, resendVerification } from '../account/signup-controller.mjs';
import { requestRecovery } from '../account/recovery-controller.mjs';
import { accountEnvironmentNote } from '../account/environment-copy.mjs';
const key = (role='anon',ref='vzdicnufhidelaoeqbza') => `fixture.${Buffer.from(JSON.stringify({role,ref})).toString('base64url')}.fixture`;
const config = {mode:'production',enabled:true,url:PRODUCTION_AUTH_URL,key:key(),signup:true,lifecycle:true,policyRelease:'test-release'};
const registry = {activePublishedVersion:'test-release',versions:{'test-release':{status:'published',acknowledgementKind:'published_terms_agreement',documents:Object.fromEntries(['terms','privacy'].map(kind=>[kind,{path:`/account/policy-history/test-release/${kind}/index.html`,sha256:'a'.repeat(64)}]))}}};
const env = {FAS_PRODUCTION_ACCOUNTS_ENABLED:'true',FAS_PRODUCTION_LIFECYCLE_ENABLED:'true',FAS_PRODUCTION_PUBLIC_KEY:key()};

test('Production config needs exact opt-ins, backend and public key; malformed/missing responses stay closed', async () => {
  assert.equal(isProductionAuthConfig(config),true);
  assert.equal(isProductionAuthConfig({...config,key:'sb_publishable_synthetic_fixture'}),true);
  for (const change of [{mode:'development'},{enabled:'true'},{enabled:false},{signup:false},{lifecycle:'true'},{policyRelease:'../other'},{url:DEV_AUTH_URL},{url:PRODUCTION_AUTH_URL+'/'},{key:key('service_role')},{key:key('anon','oqmmvjjycpyxvxipcyli')},{key:'sb_secret_fixture'},{key:'invalid'}]) assert.equal(isProductionAuthConfig({...config,...change}),false);
  let calls=0;
  const request=async(path,options)=>{calls++;assert.equal(path,'/account/runtime-config.json');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');return Response.json(config);};
  assert.deepEqual(await loadAccountAuthConfig(PRODUCTION_ACCOUNT_ORIGIN,request),config);
  for(const origin of ['https://www.fromastoryteller.com','http://fromastoryteller.com','https://attacker.invalid','https://preview.workers.dev'])assert.equal(await loadAccountAuthConfig(origin,request),null);
  assert.equal(await loadLocalAuthConfig(PRODUCTION_ACCOUNT_ORIGIN,request),null);
  assert.equal(calls,1);
  for(const response of [new Response('',{status:404}),new Response('<html>fallback</html>',{headers:{'Content-Type':'text/html'}}),Response.json({...config,enabled:false}),new Response('{broken',{headers:{'Content-Type':'application/json'}})])assert.equal(await loadAccountAuthConfig(PRODUCTION_ACCOUNT_ORIGIN,async()=>response),null);
  assert.equal(await loadAccountAuthConfig(PRODUCTION_ACCOUNT_ORIGIN,async()=>{throw Error('network');}),null);
  assert.equal(await loadAccountAuthConfig(DEV_ACCOUNT_ORIGIN,async()=>Response.json(config)),null);
});

test('concurrent runtime config reads share a request without retaining stale configuration',async()=>{
  let calls=0,finish;
  const request=()=>{calls++;return new Promise(resolve=>finish=resolve);};
  const first=loadAccountAuthConfig(PRODUCTION_ACCOUNT_ORIGIN,request);
  const second=loadAccountAuthConfig(PRODUCTION_ACCOUNT_ORIGIN,request);
  assert.equal(calls,1);finish(Response.json(config));
  assert.deepEqual(await first,config);assert.deepEqual(await second,config);
  const retry=loadAccountAuthConfig(PRODUCTION_ACCOUNT_ORIGIN,request);
  assert.equal(calls,2);finish(new Response('',{status:503}));assert.equal(await retry,null);
  const recovered=loadAccountAuthConfig(PRODUCTION_ACCOUNT_ORIGIN,request);
  assert.equal(calls,3);finish(Response.json(config));assert.deepEqual(await recovered,config);
});

test('Build cannot enable accounts in preview, without lifecycle, with a secret, or with draft/misplaced policies', () => {
  assert.equal(productionAccountBuildConfig({},registry,true),null);
  assert.equal(productionAccountBuildConfig({...env,WORKERS_CI_BRANCH:'feature/fixture'},registry,true),null);
  assert.equal(productionAccountBuildConfig({...env,GITHUB_EVENT_NAME:'pull_request'},registry,true),null);
  assert.deepEqual(productionAccountBuildConfig({...env,WORKERS_CI_BRANCH:'main'},registry,true),config);
  assert.equal(productionAccountBuildConfig({...env,FAS_PRODUCTION_ACCOUNTS_ENABLED:'TRUE'},registry,true),null);
  assert.throws(()=>productionAccountBuildConfig(env,registry,false),/preview/);
  assert.throws(()=>productionAccountBuildConfig({...env,FAS_PRODUCTION_LIFECYCLE_ENABLED:'false'},registry,true),/lifecycle/);
  assert.throws(()=>productionAccountBuildConfig({...env,FAS_PRODUCTION_PUBLIC_KEY:key('service_role')},registry,true),/nonprivileged/);
  const actual=JSON.parse(readFileSync(new URL('../account/policy-versions.json',import.meta.url),'utf8'));
  actual.activePublishedVersion=actual.candidateVersion;
  actual.versions[actual.candidateVersion].status='publication-candidate';
  assert.throws(()=>productionAccountBuildConfig(env,actual,true),/No published/);
  const wrong=structuredClone(registry);wrong.versions['test-release'].documents.terms.path='/account/terms-review/';
  assert.throws(()=>productionAccountBuildConfig(env,wrong,true),/snapshot paths/);
  assert.deepEqual(productionAccountBuildConfig(env,registry,true),config);
});

test('Production lifecycle has an independent switch and exact CORS; caller identity is still server-verified', async () => {
  assert.equal(lifecycleEnvironment(PRODUCTION_AUTH_URL,'true').enabled,false);
  assert.equal(lifecycleEnvironment(PRODUCTION_AUTH_URL,'true',true).enabled,false);
  assert.equal(lifecycleEnvironment(DEV_AUTH_URL,'false','true').enabled,false);
  assert.equal(lifecycleEnvironment('https://attacker.invalid','true','true').enabled,false);
  const environment=lifecycleEnvironment(PRODUCTION_AUTH_URL,'false','true');
  assert.deepEqual(environment,{enabled:true,origin:PRODUCTION_ACCOUNT_ORIGIN});
  let calls=0;const handler=makeLifecycleHandler({base:PRODUCTION_AUTH_URL,anonKey:key(),serviceKey:'synthetic-server-only',...environment},async(url,options)=>{calls++;assert.equal(url,PRODUCTION_AUTH_URL+'/auth/v1/user');assert.equal(options.headers.apikey,key());return new Response('{}',{status:401});});
  const request=(origin,method='POST')=>new Request(PRODUCTION_AUTH_URL+'/functions/v1/fas-account-lifecycle',{method,headers:{Origin:origin,Authorization:'Bearer fixture.jwt.token','Content-Type':'application/json'},...(method==='POST'?{body:'{"action":"export"}'}:{})});
  assert.equal((await handler(request(DEV_ACCOUNT_ORIGIN))).status,403);
  const preflight=await handler(request(PRODUCTION_ACCOUNT_ORIGIN,'OPTIONS'));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),PRODUCTION_ACCOUNT_ORIGIN);
  assert.equal(calls,0);
  assert.equal((await handler(request(PRODUCTION_ACCOUNT_ORIGIN))).status,401);assert.equal(calls,1);
});

test('Production browser lifecycle uses only its exact backend; password and tokens are never sent to another target', async () => {
  const original=globalThis.fetch;let calls=0,refreshes=0;
  const local={mode:'production',lifecycleEnabled:true,accountOrigin:PRODUCTION_ACCOUNT_ORIGIN,client:{supabaseUrl:PRODUCTION_AUTH_URL,supabaseKey:key(),auth:{refreshSession:async()=>{refreshes++;return{data:{session:{access_token:'synthetic-session'}}};}}}};
  try{
    globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,PRODUCTION_AUTH_URL+'/functions/v1/fas-account-lifecycle');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic-session');assert.equal(JSON.parse(options.body).action,'prepare-delete');return Response.json({fixture:true});};
    assert.deepEqual(await prepareDeletion(local,'SyntheticOnly9!'),{fixture:true});
    for(const wrong of [{...local,accountOrigin:DEV_ACCOUNT_ORIGIN},{...local,mode:'development'},{...local,client:{...local.client,supabaseUrl:DEV_AUTH_URL}},{...local,client:{...local.client,supabaseKey:key('service_role')}}])await assert.rejects(()=>prepareDeletion(wrong,'SyntheticOnly9!'),/not enabled/);
    await assert.rejects(()=>downloadOwnedContent({...local,lifecycleEnabled:false}),/not enabled/);
    assert.equal(calls,1);assert.equal(refreshes,1);
  }finally{globalThis.fetch=original;}
});

test('Production signup requires a published agreement and callbacks stay on the exact live origin', async () => {
  let calls=0;const auth={signUp:async input=>{calls++;assert.equal(input.options.emailRedirectTo,PRODUCTION_ACCOUNT_ORIGIN+'/account/verify-email/');assert.ok(input.options.data.fas_policy_agreement);return{data:{}};},resend:async input=>{assert.equal(input.options.emailRedirectTo,PRODUCTION_ACCOUNT_ORIGIN+'/account/verify-email/');return{};},resetPasswordForEmail:async(_email,input)=>{assert.equal(input.redirectTo,PRODUCTION_ACCOUNT_ORIGIN+'/account/reset-password/');return{};}};
  assert.throws(()=>createSignupController(auth,()=>{},PRODUCTION_ACCOUNT_ORIGIN),/Published/);
  const release={release_id:'test-release',status:'published',published_at:'2026-10-15T00:00:00Z',minimum_age:16,terms_version:'v1',privacy_version:'v1',terms_sha256:'a'.repeat(64),privacy_sha256:'b'.repeat(64),terms_path:'/account/policy-history/test-release/terms/',privacy_path:'/account/policy-history/test-release/privacy/'};
  await createSignupController(auth,()=>{},PRODUCTION_ACCOUNT_ORIGIN,release).signUp({displayName:'Fixture',email:'fixture@example.invalid',password:'SyntheticOnly9!Z',confirmation:'SyntheticOnly9!Z',ageConfirmed:true,termsAgreed:true,privacyNoticeSeen:true});
  assert.equal(calls,1);await resendVerification(auth,'fixture@example.invalid',PRODUCTION_ACCOUNT_ORIGIN);await requestRecovery(auth,'fixture@example.invalid',PRODUCTION_ACCOUNT_ORIGIN);
  assert.equal(accountEnvironmentNote('production','Local test','DEV test','Your account'),'Your account');
  assert.equal(accountEnvironmentNote('development','Local test','DEV test','Your account'),'DEV test');
});
