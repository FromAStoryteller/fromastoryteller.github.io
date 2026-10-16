// Synthetic agreement rehearsal on the fixed local FAS stack; no hosted target.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {publishedPolicyDeclaration,acceptCurrentPolicies} from '../account/published-policies.mjs';
import {exportAccountData} from '../account/settings-controller.mjs';
import {accountDataArchive} from '../account/account-data-download.mjs';
const base='http://127.0.0.1:55321',key=process.env.FAS_TEST_ANON_KEY,secret=process.env.FAS_TEST_SERVICE_KEY;
if(process.env.FAS_TEST_CONFIRM!=='LOCAL-FAS-ONLY' || !key || !secret)throw Error('Fixed local FAS credentials and acknowledgement required.');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(base,secret,options),clients=[],users=[],emails=[],stories=[];
const releaseId='local-policy-test-'+randomUUID();
const release={release_id:releaseId,status:'published',published_at:new Date().toISOString(),minimum_age:16,terms_version:'synthetic-terms-v1',privacy_version:'synthetic-privacy-v1',terms_sha256:'a'.repeat(64),privacy_sha256:'b'.repeat(64),terms_path:`/account/policy-history/${releaseId}/terms/`,privacy_path:`/account/policy-history/${releaseId}/privacy/`};
const yes={ageConfirmed:true,termsAgreed:true,privacyNoticeSeen:true};
function sql(statement){return execFileSync('docker',['exec','-i','supabase_db_fas-community-v1','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:statement,encoding:'utf8',stdio:['pipe','pipe','pipe'],windowsHide:true}).trim();}
let stage='inactive requirement',activated=false,cleanupOk=true;
try{
 assert.equal((await admin.rpc('fas_current_policy_requirement')).data,null);
 assert.equal(sql('select count(*) from private.account_policy_releases;'),'0');
 for(let i=0;i<2;i++){
  const email=`fas-policy-${randomUUID()}@example.invalid`,password='LocalOnly9!'+randomBytes(24).toString('base64url');emails.push(email);
  const made=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ok(!made.error);users.push(made.data.user.id);
  const client=createClient(base,key,options);clients.push(client);assert.ok(!(await client.auth.signInWithPassword({email,password})).error);
 }
 sql(`begin; insert into private.account_policy_releases(release_id,status,published_at,terms_version,privacy_version,terms_sha256,privacy_sha256,terms_path,privacy_path) values('${releaseId}','published',now(),'synthetic-terms-v1','synthetic-privacy-v1','${release.terms_sha256}','${release.privacy_sha256}','${release.terms_path}','${release.privacy_path}'); update private.account_policy_requirement set release_id='${releaseId}' where singleton; commit;`);activated=true;
 stage='signup rejection';
 assert.ok(!(await admin.from('user_roles').insert({user_id:users[0],role:'member'})).error);
 assert.ok((await clients[0].from('stories').insert({author_id:users[0],slug:'policy-denied-'+randomUUID(),title:'Synthetic policy gate',body:'Test only'})).error);
 assert.ok(!(await clients[0].from('profiles').update({bio:'Correction remains available'}).eq('id',users[0])).error);
 const publicClient=createClient(base,key,options);clients.push(publicClient);
 assert.equal((await publicClient.rpc('fas_current_policy_requirement')).data.release_id,releaseId);
 for(const data of [{},{fas_policy_agreement:{...publishedPolicyDeclaration(release,yes),terms_agreed:'true'}},{fas_policy_agreement:{...publishedPolicyDeclaration(release,yes),privacy_notice_seen:false}},{fas_policy_agreement:{...publishedPolicyDeclaration(release,yes),terms_sha256:'c'.repeat(64)}}]){
  const email=`fas-policy-denied-${randomUUID()}@example.com`;emails.push(email);
  const result=await publicClient.auth.signUp({email,password:'LocalOnly9!'+randomBytes(24).toString('base64url'),options:{data}});
  if(result.data?.user?.id)users.push(result.data.user.id);
  assert.equal(result.error?.status,400);
 }
 console.log('PASS local public Auth rejects missing, string, unchecked and wrong-document agreements');
 stage='valid new signup';
 const email=`fas-policy-signup-${randomUUID()}@example.com`;emails.push(email);
 const signup=await publicClient.auth.signUp({email,password:'LocalOnly9!'+randomBytes(24).toString('base64url'),options:{data:{display_name:'Synthetic policy fixture',fas_policy_agreement:publishedPolicyDeclaration(release,yes)}}});
 assert.ok(!signup.error&&signup.data.user?.id&&!signup.data.session);users.push(signup.data.user.id);
 assert.equal(sql(`select count(*) from private.account_policy_agreements where user_id='${signup.data.user.id}' and release_id='${releaseId}' and source='signup';`),'1');
 console.log('PASS real local signup records the exact synthetic release before email confirmation without opening a session');
 stage='self-only existing account agreement and exports';
 assert.deepEqual((await clients[0].rpc('fas_my_policy_agreements')).data,[]);
 assert.ok((await publicClient.rpc('fas_my_policy_agreements')).error);
 const accepted=await acceptCurrentPolicies(clients[0],release,yes);
 assert.equal(accepted[0].source,'existing_account');
 const created=await clients[0].from('stories').insert({author_id:users[0],slug:'policy-allowed-'+randomUUID(),title:'Synthetic policy gate',body:'Test only'}).select('id').single();
 assert.ok(!created.error);stories.push(created.data.id);
 console.log('PASS contribution writes require the current agreement; profile correction remains available before agreement');
 assert.deepEqual(await acceptCurrentPolicies(clients[0],release,yes),accepted);
 assert.ok(!(await clients[0].auth.updateUser({data:{fas_policy_agreement:{terms_agreed:false}}})).error);
 assert.deepEqual((await clients[0].rpc('fas_my_policy_agreements')).data,accepted);
 assert.deepEqual((await clients[1].rpc('fas_my_policy_agreements')).data,[]);
 const exported=await exportAccountData(clients[0]);assert.deepEqual(exported.account.policy_agreements,accepted);
 assert.ok(!JSON.stringify(exported).includes(users[1]));
 assert.ok(new TextDecoder().decode(await accountDataArchive(exported).arrayBuffer()).includes('synthetic-terms-v1'));
 console.log('PASS existing accounts opt in explicitly; repeats/metadata edits preserve history; other accounts and anonymous callers cannot read it; personal ZIP includes it');
 stage='identity deletion cascade';
 for(const id of stories)assert.ok(!(await admin.from('stories').delete().eq('id',id)).error);
 assert.ok(!(await admin.auth.admin.deleteUser(users[0])).error);
 assert.equal(sql(`select count(*) from private.account_policy_agreements where user_id='${users[0]}';`),'0');
 console.log('PASS Auth identity deletion also removes its published-agreement records');
}catch{console.error('FAIL local policy rehearsal at '+stage+'; confidential responses withheld.');process.exitCode=1;}
finally{
 try{if(activated)sql(`update private.account_policy_requirement set release_id=null where singleton;`);}catch{cleanupOk=false;}
 for(const client of clients)await client.auth.signOut({scope:'local'}).catch(()=>{});
 for(const id of stories)if((await admin.from('stories').delete().eq('id',id)).error)cleanupOk=false;
 for(const id of users){const found=await admin.auth.admin.getUserById(id);if(found.data?.user&&(await admin.auth.admin.deleteUser(id)).error)cleanupOk=false;}
 try{
  // Operator-only synthetic fixture removal. One locked local transaction;
  // never weaken the trigger in a hosted project or expose this as an RPC.
  if(activated)sql(`begin; lock table private.account_policy_releases in access exclusive mode; alter table private.account_policy_releases disable trigger immutable_policy_releases; delete from private.account_policy_releases where release_id='${releaseId}'; alter table private.account_policy_releases enable trigger immutable_policy_releases; commit;`);
  const inbox=await fetch('http://127.0.0.1:55324/api/v1/messages',{signal:AbortSignal.timeout(10000)}).then(r=>r.json());
  for(const mail of inbox.messages??[])if(mail.To?.some(to=>emails.includes(to.Address)))assert.ok((await fetch('http://127.0.0.1:55324/api/v1/messages',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDs:[mail.ID]})})).ok);
  assert.equal(sql('select release_id is null from private.account_policy_requirement where singleton;'),'t');
  assert.equal(sql('select count(*) from private.account_policy_releases;'),'0');
 }catch{cleanupOk=false;}
 if(!cleanupOk){console.error('Local synthetic policy cleanup needs attention.');process.exitCode=1;}
 else console.log('PASS synthetic local identities/mail/release cleaned up; policy activation restored to NULL');
}
