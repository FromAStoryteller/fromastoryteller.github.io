// Only disposable fixtures in the exact FAS DEV project. Never sends real mail.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { securityTarget, checkLegacyProjectKey } from './fas-security-target.mjs';
import { registrationDeclaration } from '../account/registration-declaration.mjs';
import { exportAccountData } from '../account/settings-controller.mjs';
const {base} = securityTarget(['--hosted-dev'],process.env.FAS_TEST_CONFIRM);
const key=process.env.FAS_TEST_ANON_KEY, secret=process.env.FAS_TEST_SERVICE_KEY;
if(!key || !secret) throw new Error('Process-only DEV credentials required.');
checkLegacyProjectKey(key,'anon'); checkLegacyProjectKey(secret,'service_role');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(base,secret,options);
const fixtures=[],clients=[];
let stage='signup hook';
const endpoint=base+'/functions/v1/fas-account-lifecycle';
const send=(token,body,origin='http://127.0.0.1:55410')=>fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
const check=(value)=>assert.ok(value,`DEV account check failed at ${stage}`);
try {
  const declaration=registrationDeclaration({ageConfirmed:true,policiesAcknowledged:true});
  for(const metadata of [{}, {fas_registration:{...declaration,age_16_or_over:false}}, {fas_registration:{...declaration,terms_version:'stale'}}]) {
    const email='fas-dev-denied-'+randomUUID()+'@example.com';
    const rejected=await fetch(base+'/auth/v1/signup',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password:'DevOnly9!'+randomBytes(24).toString('base64url'),data:metadata})});
    const result=await rejected.json();
    // If a future hook regression unexpectedly creates an identity, still clean
    // up that exact generated fixture; never broaden cleanup to other accounts.
    const unexpected=result.user?.id ?? result.id;
    if(typeof unexpected==='string') fixtures.push({id:unexpected});
    check(rejected.status===400); check((result.message ?? result.msg ?? '').includes('Confirm you are 16 or older'));
  }
  console.log('PASS DEV public signup rejects missing, false and stale declarations before creating accounts or sending mail');
  stage='disposable identities';
  for(let i=0;i<2;i++) {
    const email='fas-dev-account-'+randomUUID()+'@example.invalid',password='DevOnly9!'+randomBytes(24).toString('base64url');
    const made=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Disposable DEV reader',fas_registration:declaration,role:'admin'}});
    check(!made.error && made.data.user?.id); const user={id:made.data.user.id,password,email};fixtures.push(user);
    const client=createClient(base,key,options);clients.push(client);
    const signed=await client.auth.signInWithPassword({email,password});check(!signed.error);user.token=signed.data.session.access_token;
  }
  stage='viewer permissions and personal export';
  const exported=await exportAccountData(clients[0]);check(exported.account.role==='viewer');check(!JSON.stringify(exported).includes(fixtures[1].id));
  const role=await clients[0].from('user_roles').insert({user_id:fixtures[0].id,role:'admin'});check(!!role.error);
  const other=await clients[0].from('profiles').update({display_name:'Tampered'}).eq('id',fixtures[1].id).select('id');check(other.error || other.data.length===0);
  check((await send(fixtures[0].token,{action:'export'})).status===403);
  check((await send(fixtures[0].token,{action:'export'},'https://untrusted.invalid')).status===403);
  check((await send('forged.invalid.token',{action:'export'})).status===401);
  console.log('PASS DEV viewer personal export works; contributor export, role escalation, cross-account edits and forged/cross-origin requests are denied');
  stage='original declaration';
  const original=await clients[0].rpc('fas_my_registration_declaration');check(!original.error && original.data);
  check(!(await clients[0].auth.updateUser({data:{fas_registration:{age_16_or_over:false}}})).error);
  const after=await clients[0].rpc('fas_my_registration_declaration');check(JSON.stringify(after.data)===JSON.stringify(original.data));
  console.log('PASS DEV original registration declaration survives editable metadata changes');
  stage='confirmed viewer deletion';
  check((await send(fixtures[0].token,{action:'prepare-delete',password:'wrong'})).status===403);
  const preparedResponse=await send(fixtures[0].token,{action:'prepare-delete',password:fixtures[0].password});check(preparedResponse.ok);
  const prepared=await preparedResponse.json();check(prepared.summary.stories===0 && prepared.summary.images===0);
  check((await send(fixtures[0].token,{action:'confirm-delete',confirmation:'DELETE',exportAcknowledged:false,confirmationToken:prepared.confirmationToken})).status===400);
  const removed=await send(fixtures[0].token,{action:'confirm-delete',confirmation:'DELETE',exportAcknowledged:true,confirmationToken:prepared.confirmationToken});check(removed.ok && (await removed.json()).state==='deleted');
  check(!!(await clients[0].auth.signInWithPassword({email:fixtures[0].email,password:fixtures[0].password})).error);
  const receipt=await send(key,{action:'deletion-status',userId:fixtures[0].id,confirmationToken:prepared.confirmationToken});check(receipt.ok && (await receipt.json()).state==='complete');
  const survivor=await clients[1].auth.getUser();check(survivor.data?.user?.id===fixtures[1].id);
  console.log('PASS DEV password confirmation, explicit deletion, receipt and revoked login work; the other account remains usable');
} catch { console.error('FAIL DEV account workflow at '+stage+'; confidential response bodies withheld.');process.exitCode=1; }
finally {
  for(const client of clients) await client.auth.signOut({scope:'local'}).catch(()=>{});
  let failed=false;
  for(const user of fixtures) {
    const existing=await admin.auth.admin.getUserById(user.id);
    if(existing.error && existing.error.status!==404) failed=true;
    if(existing.data?.user && (await admin.auth.admin.deleteUser(user.id)).error) failed=true;
  }
  if(failed){console.error('Disposable DEV account cleanup needs attention.');process.exitCode=1;}
  else console.log('Disposable DEV identities cleaned up; existing operator account and original storage were not targeted.');
}
