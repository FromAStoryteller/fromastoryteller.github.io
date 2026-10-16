import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLocalAuthConfig, isLocalAuthConfig } from '../account/auth-settings.mjs';
import { createSignInController, signInError } from '../account/sign-in-controller.mjs';
import { localAuthPlugin } from '../scripts/fas-local-auth-server.mjs';

const fakeKey = role => `test.${Buffer.from(JSON.stringify({role,iss:'supabase-demo'})).toString('base64url')}.test`;

test('Auth is closed outside the exact local preview; privileged/hosted configuration is refused', async () => {
  let calls = 0;
  const request = async () => { calls++; return {ok:true,json:async()=>({url:'http://127.0.0.1:55321',key:fakeKey('anon')})}; };
  assert.equal(await loadLocalAuthConfig('https://fromastoryteller.com',request),null);
  assert.equal(await loadLocalAuthConfig('http://127.0.0.1:55401',request),null);
  assert.equal(calls,0);
  assert.ok(await loadLocalAuthConfig('http://127.0.0.1:55400',request));
  assert.equal(isLocalAuthConfig({url:'http://127.0.0.1:55321',key:fakeKey('service_role')}),false);
  assert.equal(isLocalAuthConfig({url:'https://example.supabase.co',key:fakeKey('anon')}),false);
  assert.equal(isLocalAuthConfig({url:'http://127.0.0.1:55321',key:'sb_secret_example'}),false);
});

test('Local config endpoint rejects other hosts, cross-site requests and disabled mode', () => {
  const run = (headers, enabled = 'true') => {
    let middleware;
    localAuthPlugin({FAS_LOCAL_AUTH_ENABLED:enabled,FAS_LOCAL_ANON_KEY:fakeKey('anon')}).configureServer({middlewares:{use(fn){middleware=fn;}}});
    const res = {statusCode:200,setHeader(){},end(body){this.body=body;}};
    middleware({url:'/__fas/local-auth',method:'GET',headers},res,()=>assert.fail('Config request must be handled'));
    return res;
  };
  assert.equal(run({host:'attacker.example:55400'}).statusCode,404);
  assert.equal(run({host:'127.0.0.1:55400','sec-fetch-site':'cross-site'}).statusCode,404);
  assert.equal(run({host:'127.0.0.1:55400'},'false').statusCode,404);
  assert.equal(JSON.parse(run({host:'127.0.0.1:55400','sec-fetch-site':'same-origin'}).body).url,'http://127.0.0.1:55321');
});

test('Sign-in trims the email, preserves the password exactly, and signs out only this session', async () => {
  const states = [];
  const auth = {
    async signInWithPassword(credentials) {
      assert.deepEqual(credentials,{email:'reader@example.invalid',password:' SampleOnly9! '});
      return {data:{session:{},user:{email:'reader@example.invalid'}},error:null};
    },
    async signOut(options) { assert.deepEqual(options,{scope:'local'}); return {error:null}; },
  };
  const controller = createSignInController(auth,state=>states.push(state));
  await controller.signIn(' reader@example.invalid ',' SampleOnly9! ');
  assert.equal(states.at(-1).state,'signed-in');
  await controller.signOut();
  assert.equal(states.at(-1).state,'signed-out');
});

test('Missing account, wrong password and unverified email have the same safe feedback', () => {
  assert.equal(signInError({status:400,code:'invalid_credentials'}),signInError({status:400,code:'email_not_confirmed'}));
  assert.match(signInError({status:429}),/Wait a few minutes/);
  assert.match(signInError({status:503,message:'sensitive server internals'}),/connect to account services/);
  assert.doesNotMatch(signInError({message:'secret'}),/secret/);
});

test('Duplicate requests are suppressed and network errors allow another attempt', async () => {
  let finish;
  let calls = 0;
  const states = [];
  const controller = createSignInController({signInWithPassword:()=>{calls++; return new Promise(resolve=>{finish=resolve;});}},state=>states.push(state));
  const first = controller.signIn('reader@example.invalid','SampleOnly9!');
  await controller.signIn('reader@example.invalid','SampleOnly9!');
  assert.equal(calls,1);
  finish({error:{status:400,code:'invalid_credentials'}});
  await first;
  assert.equal(states.at(-1).state,'error');
  const retry = controller.signIn('reader@example.invalid','SampleOnly9!');
  finish({error:{status:503}});
  await retry;
  assert.equal(calls,2);
});

test('Failed sign-out is never reported as success; session ending has its own message', async () => {
  const states=[];
  const controller=createSignInController({signOut:async()=>{throw new Error('offline');}},state=>states.push(state));
  await controller.signOut();
  assert.equal(states.at(-1).state,'sign-out-error');
  controller.sessionEnded();
  assert.match(states.at(-1).message,/session has ended/);
});
