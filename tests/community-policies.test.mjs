import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contributionPolicyState} from '../account/contribution-policies.mjs';
import {invitationEmail} from '../supabase/functions/_shared/invitation-email.mjs';
import {invitationEmail as originalEmail} from '../supabase/functions/_shared/invitation-email-v1.mjs';
import {policyTransitionPlan} from '../scripts/fas-policy-release-plan.mjs';
import {fileURLToPath} from 'node:url';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const registry=JSON.parse(read('account/policy-versions.json'));
const version=registry.communityUpdateVersion;
const release={release_id:version,status:'published',published_at:'2026-10-18T00:00:00Z',minimum_age:16,terms_version:version,privacy_version:version,terms_sha256:'a'.repeat(64),privacy_sha256:'b'.repeat(64),terms_path:'/account/policy-history/'+version+'/terms/',privacy_path:'/account/policy-history/'+version+'/privacy/'};
test('contribution onboarding fails closed and only accepts the exact server-required release',async()=>{
 for(const [records,accepted] of [[[],false],[[{release_id:'earlier'}],false],[[{release_id:version}],true]]){
  const client={rpc:async name=>({data:name==='fas_current_policy_requirement'?release:records})};
  assert.equal((await contributionPolicyState(client)).accepted,accepted);
 }
 assert.deepEqual(await contributionPolicyState({rpc:async()=>({data:null})}),{requirement:null,accepted:true});
 await assert.rejects(contributionPolicyState({rpc:async()=>({error:true})}),/unavailable/);
 let calls=0;await assert.rejects(contributionPolicyState({rpc:async()=>++calls===1?{data:release}:{error:true}}),/could not be checked/);
});
test('contributor policy is identical in public Terms, standalone policy and immutable agreement snapshot',()=>{
 const article=text=>text.match(/<article class="terms-section" id="contributors">[\s\S]*?<\/article>/)?.[0];
 const frozen=read('account/policy-history/'+version+'/terms/index.html');
 assert.ok(article(frozen));assert.equal(article(read('terms/index.html')),article(frozen));assert.equal(article(read('terms/contributors/index.html')),article(frozen));
 for(const phrase of ['retain ownership','non-exclusive, worldwide, royalty-free','publish without prior approval','moderation','Account deletion','fromastoryteller@gmail.com','AI models','separate agreement'])assert.ok(frozen.includes(phrase),phrase);
 const privacy=read('account/policy-history/'+version+'/privacy/index.html');
 for(const phrase of ['24 hours','session storage','seven days','30 days','Resend','Supabase','access, correction or removal'])assert.ok(privacy.includes(phrase),phrase);
 const ops=policyTransitionPlan(fileURLToPath(new URL('../',import.meta.url)),registry,version,registry.versions[version].previousVersion);
 assert.equal(read('supabase/ops/'+version+'.sql'),ops);
});
test('new invitation notice has no extra private link; persisted renderer versions preserve retry bodies',()=>{
 const job={token:'a'.repeat(72),expires_at:'2026-12-01T00:00:00Z'};
 assert.deepEqual(invitationEmail({...job,template_version:1}),originalEmail(job));
 assert.deepEqual(invitationEmail(job),originalEmail(job));
 const current=invitationEmail({...job,template_version:2});
 assert.match(current.text,/administrator supplied your email/);
 assert.match(current.text,/access, correction or removal/);
 assert.match(current.html,/https:\/\/fromastoryteller.com\/privacy\/#invitations/);
 assert.equal((current.html.match(/#invite=/g)??[]).length,1);
 assert.deepEqual(current,invitationEmail({...job,template_version:2}));
 assert.throws(()=>invitationEmail({...job,template_version:9}),/Unsupported/);
});
