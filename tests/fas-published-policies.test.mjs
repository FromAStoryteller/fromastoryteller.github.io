import test from 'node:test';
import assert from 'node:assert/strict';
import { validPolicyRequirement,publishedPolicyDeclaration,currentPolicyRequirement,acceptCurrentPolicies } from '../account/published-policies.mjs';
import { createSignupController } from '../account/signup-controller.mjs';
const release={release_id:'test-policy',status:'published',published_at:'2026-10-15T00:00:00Z',minimum_age:16,terms_version:'test-terms-v1',privacy_version:'test-privacy-v1',terms_sha256:'a'.repeat(64),privacy_sha256:'b'.repeat(64),terms_path:'/account/policy-history/test-policy/terms/',privacy_path:'/account/policy-history/test-policy/privacy/'};
const confirmations={ageConfirmed:true,termsAgreed:true,privacyNoticeSeen:true};
test('Published policy controls reject review status, unsafe links, forged hashes and unchecked/string confirmations',()=>{
  assert.equal(validPolicyRequirement(release),true);
  for(const changed of [{...release,status:'review'},{...release,terms_path:'https://attacker.invalid'},{...release,privacy_sha256:'bad'}])assert.equal(publishedPolicyDeclaration(changed,confirmations),null);
  for(const key of Object.keys(confirmations))for(const value of [false,'true',null])assert.equal(publishedPolicyDeclaration(release,{...confirmations,[key]:value}),null);
});
test('Published signup sends explicit agreement versions and hashes instead of reusing draft acknowledgement',async()=>{
  let calls=0;const states=[];
  const controller=createSignupController({signUp:async request=>{calls++;assert.deepEqual(request.options.data.fas_policy_agreement,publishedPolicyDeclaration(release,confirmations));assert.equal(request.options.data.fas_registration,undefined);return{data:{}};}},state=>states.push(state),'http://127.0.0.1:55400',release);
  const details={displayName:'Reader',email:'test@example.invalid',password:'ExampleOnly9!Z',confirmation:'ExampleOnly9!Z',...confirmations};
  await controller.signUp({...details,termsAgreed:false});assert.equal(calls,0);
  await controller.signUp(details);assert.equal(calls,1);assert.equal(states.at(-1).state,'requested');
});
test('Requirement lookup fails closed; existing-account acceptance has no account ID and verifies session first',async()=>{
  assert.equal(await currentPolicyRequirement({rpc:async()=>({data:null})}),null);
  await assert.rejects(()=>currentPolicyRequirement({rpc:async()=>({error:true})}),/unavailable/);
  let called=false;
  const client={auth:{refreshSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{id:'self',email_confirmed_at:'yes'}}})},rpc:async(name,args)=>{called=true;assert.equal(name,'fas_accept_current_policies');assert.deepEqual(args,{target_release:'test-policy',terms_agreed:true,privacy_notice_seen:true,age_16_or_over:true});return{data:[{release_id:'test-policy'}]};}};
  await assert.rejects(()=>acceptCurrentPolicies(client,release,{...confirmations,termsAgreed:false}));assert.equal(called,false);
  await acceptCurrentPolicies(client,release,confirmations);assert.equal(called,true);
  client.auth.refreshSession=async()=>({error:true});await assert.rejects(()=>acceptCurrentPolicies(client,release,confirmations),/Sign in/);
});
