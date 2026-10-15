import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { exportAccountData } from '../account/settings-controller.mjs';
import { registrationDeclaration } from '../account/registration-declaration.mjs';
import { createClient } from '@supabase/supabase-js';
const base='http://127.0.0.1:55321';
const inbox='http://127.0.0.1:55324';
const key=process.env.FAS_TEST_ANON_KEY;
const adminKey=process.env.FAS_TEST_SERVICE_KEY;
if(process.env.FAS_TEST_CONFIRM!=='LOCAL-FAS-ONLY'||!key||!adminKey){console.error('Supply local FAS keys and acknowledge LOCAL-FAS-ONLY in the process environment.');process.exit(1);}
const client=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const emails=new Set();
const declaration=registrationDeclaration({ageConfirmed:true,policiesAcknowledged:true});
let stage='local settings';
const requireCondition=value=>{if(!value)throw new Error('Contract failed');};
async function admin(path,method='GET',body){
  const response=await fetch(base+path,{method,headers:{apikey:adminKey,Authorization:`Bearer ${adminKey}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),redirect:'error'});
  requireCondition(response.ok);return response.json();
}
function fixtureEmail(){const email=`fas-signup-${randomUUID()}@example.invalid`;emails.add(email);return email;}
async function emailLink(email,exclude){
  for(let attempt=0;attempt<20;attempt++){
    const listResponse=await fetch(`${inbox}/api/v1/search?query=${encodeURIComponent('to:'+email)}`);
    const list=listResponse.ok?await listResponse.json():{messages:[]};
    for(const item of list.messages){
      const message=await fetch(`${inbox}/api/v1/message/${item.ID}`).then(r=>r.json());
      const html=message.HTML??'';
      const href=html.match(/href="([^"]*\/account\/verify-email\/[^\"]+)"/)?.[1]?.replaceAll('&amp;','&');
      if(href){const url=new URL(href);const params=new URLSearchParams(url.hash.slice(1));const token=params.get('token_hash');if(token&&token!==exclude){requireCondition(url.origin==='http://127.0.0.1:55400'&&!url.search&&params.get('type')==='email');return token;}}
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Local mail not received');
}
function ageConfirmation(id,hours=false){
  requireCondition(/^[0-9a-f-]{36}$/.test(id));
  execFileSync('docker',['exec','supabase_db_fas-community-v1','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`update auth.users set confirmation_sent_at = now() - interval '${hours?'2 hours':'65 seconds'}' where id = '${id}'::uuid`],{stdio:['ignore','ignore','ignore'],windowsHide:true});
}
try{
  const settings=await fetch(base+'/auth/v1/settings',{headers:{apikey:key}}).then(r=>r.json());
  requireCondition(settings.mailer_autoconfirm===false&&settings.external.email===true);
  stage='server password enforcement';
  const weakEmail=fixtureEmail();
  for(const password of ['short9!Aa','Abcdefghijk1','abcdefghij1!']) requireCondition((await client.auth.signUp({email:weakEmail,password})).error?.code==='weak_password');
  console.log('PASS server rejects short passwords and missing character categories');
  stage='server registration declarations';
  const deniedEmail=fixtureEmail();const deniedPassword='LocalOnly9!'+randomBytes(24).toString('base64url');
  for (const data of [{},{fas_registration:{...declaration,age_16_or_over:false}},{fas_registration:{...declaration,age_16_or_over:'true'}},{fas_registration:{...declaration,terms_acknowledged:false}},{fas_registration:{...declaration,privacy_notice_seen:false}},{fas_registration:{...declaration,terms_version:'old'}},{fas_registration:{...declaration,privacy_version:'old'}},{fas_registration:{...declaration,mode:'published_agreement'}}]) {
    const denied=await client.auth.signUp({email:deniedEmail,password:deniedPassword,options:{data}});
    requireCondition(denied.error?.status===400&&denied.error.message==='Confirm you are 16 or older and acknowledge the current draft Terms and Privacy notice.');
  }
  const deniedList=await admin('/auth/v1/admin/users?page=1&per_page=1000');
  requireCondition(!deniedList.users.some(user=>user.email===deniedEmail));
  const deniedMail=await fetch(`${inbox}/api/v1/search?query=${encodeURIComponent('to:'+deniedEmail)}`).then(r=>r.json());
  requireCondition(deniedMail.messages.length===0);
  console.log('PASS direct signup rejects missing/false/string/stale declarations before creating an identity or email');
  stage='local signup and unverified sign-in';
  const email=fixtureEmail();const password='LocalOnly9!'+randomBytes(24).toString('base64url');
  const signed=await client.auth.signUp({email,password,options:{data:{display_name:'Synthetic signup reader',fas_registration:declaration,role:'admin',is_admin:true},emailRedirectTo:'http://127.0.0.1:55400/account/verify-email/'}});
  if(signed.error) console.error('Local signup API code: '+(/^[a-z_]+$/.test(signed.error.code??'')?signed.error.code:'unavailable'));
  requireCondition(!signed.error&&signed.data.user?.id&&!signed.data.session);
  const id=signed.data.user.id;
  stage='unverified sign-in denial';
  requireCondition((await client.auth.signInWithPassword({email,password})).error?.code==='email_not_confirmed');
  stage='local verification mailbox delivery';
  const initial=await emailLink(email);
  console.log('PASS signup delivers a local verification email and blocks unverified sign-in');
  stage='resend throttling and new email';
  requireCondition((await client.auth.resend({type:'signup',email})).error?.status===429);
  ageConfirmation(id);
  requireCondition(!(await client.auth.resend({type:'signup',email})).error);
  const replacement=await emailLink(email,initial);
  requireCondition((await client.auth.verifyOtp({token_hash:initial,type:'email'})).error);
  console.log('PASS immediate resend is throttled and the replacement link supersedes the old link');
  stage='email verification and viewer permissions';
  const verified=await client.auth.verifyOtp({token_hash:replacement,type:'email'});
  requireCondition(!verified.error&&verified.data.user.email_confirmed_at&&verified.data.session);
  const roles=await client.from('user_roles').select('role').eq('user_id',id);
  requireCondition(!roles.error&&roles.data.length===0);
  const profile=await client.from('profiles').select('display_name').eq('id',id).single();
  requireCondition(!profile.error&&profile.data.display_name==='Synthetic signup reader');
  requireCondition((await client.from('user_roles').insert({user_id:id,role:'admin'})).error);
  requireCondition((await client.from('stories').insert({author_id:id,slug:`fas-signup-${randomUUID()}`,title:'Denied viewer draft',body:'Synthetic only'})).error);
  const record=await client.rpc('fas_my_registration_declaration');
  requireCondition(!record.error&&record.data.minimum_age===16&&record.data.terms_version===declaration.terms_version&&record.data.recorded_at&&record.data.acknowledgement_kind==='local_draft_review');
  const savedRecord=JSON.stringify(record.data);
  requireCondition(!(await client.auth.updateUser({data:{fas_registration:{mode:'tampered',terms_version:'tampered'},role:'admin'}})).error);
  requireCondition(JSON.stringify((await client.rpc('fas_my_registration_declaration')).data)===savedRecord);
  const exported=await exportAccountData(client);
  requireCondition(JSON.stringify(exported.account.registration)===savedRecord);
  const unauthenticated=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}});
  requireCondition((await unauthenticated.rpc('fas_before_user_created',{event:{}})).error);
  requireCondition((await unauthenticated.rpc('fas_my_registration_declaration')).error);
  console.log('PASS registration record is immutable through metadata edits, readable only by its owner and included in personal exports');
  await client.auth.signOut({scope:'local'});
  requireCondition(!(await client.auth.signInWithPassword({email,password})).error);
  requireCondition((await client.auth.verifyOtp({token_hash:replacement,type:'email'})).error);
  console.log('PASS verified account can sign in but remains a viewer; links are single use');
  stage='expired verification link';
  const expiredEmail=fixtureEmail();
  const expired=await client.auth.signUp({email:expiredEmail,password,options:{data:{fas_registration:declaration}}});
  requireCondition(!expired.error&&expired.data.user?.id);
  const expiredToken=await emailLink(expiredEmail);
  ageConfirmation(expired.data.user.id,true);
  requireCondition((await client.auth.verifyOtp({token_hash:expiredToken,type:'email'})).error?.code==='otp_expired');
  console.log('PASS expired verification link is rejected');
}catch{console.error(`FAIL ${stage} (credential details withheld)`);process.exitCode=1;}
finally{
  await client.auth.signOut({scope:'local'}).catch(()=>{});
  try{
    const listed=await admin('/auth/v1/admin/users?page=1&per_page=1000');
    for(const user of listed.users.filter(user=>emails.has(user.email)))await admin('/auth/v1/admin/users/'+user.id,'DELETE');
    for(const email of emails){const removed=await fetch(`${inbox}/api/v1/search?query=${encodeURIComponent('to:'+email)}`,{method:'DELETE'});requireCondition(removed.ok);}
    const after=await admin('/auth/v1/admin/users?page=1&per_page=1000');
    requireCondition(!after.users.some(user=>emails.has(user.email)));
    console.log('PASS temporary signup accounts and test mail removed');
  }catch{console.error('FAIL local signup fixture cleanup');process.exitCode=1;}
}
