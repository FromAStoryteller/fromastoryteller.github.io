import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const base = 'http://127.0.0.1:55321';
const key = process.env.FAS_TEST_ANON_KEY;
const adminKey = process.env.FAS_TEST_SERVICE_KEY;
if (process.env.FAS_TEST_CONFIRM !== 'LOCAL-FAS-ONLY' || !key || !adminKey) {
  console.error('Supply local FAS keys in the process environment and confirm LOCAL-FAS-ONLY.'); process.exit(1);
}
const password = 'LocalOnly9!' + randomBytes(24).toString('base64url');
const email = `fas-sign-in-${randomUUID()}@example.invalid`;
const client = createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
let userId;
let stage='create local fixture';
let cleanupOk=true;
async function adminRequest(path,method='GET',body) {
  const response=await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:adminKey,Authorization:`Bearer ${adminKey}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if (!response.ok) throw new Error('Local admin request failed');
  return response.json();
}
function requireCondition(value){if(!value)throw new Error('Contract check failed');}
try {
  const created=await adminRequest('/auth/v1/admin/users','POST',{email,password,email_confirm:true,user_metadata:{role:'admin',is_admin:true}});
  userId=created.id;
  stage='sign in a temporary viewer';
  const signed=await client.auth.signInWithPassword({email,password});
  requireCondition(!signed.error && signed.data.user.id===userId && signed.data.session);
  console.log('PASS local password sign-in');
  stage='verify viewer privileges';
  const roles=await client.from('user_roles').select('role').eq('user_id',userId);
  requireCondition(!roles.error && roles.data.length===0);
  const escalation=await client.from('user_roles').insert({user_id:userId,role:'admin'});
  requireCondition(escalation.error);
  const story=await client.from('stories').insert({author_id:userId,slug:`fas-auth-${randomUUID()}`,title:'Denied viewer draft',body:'Synthetic only'});
  requireCondition(story.error);
  console.log('PASS viewer cannot publish or self-promote');
  stage='refresh and sign out';
  requireCondition(!(await client.auth.refreshSession()).error);
  const previous=(await client.auth.getSession()).data.session.refresh_token;
  requireCondition(!(await client.auth.signOut({scope:'local'})).error);
  requireCondition((await client.auth.getSession()).data.session===null);
  const refresh=await fetch(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:previous}),signal:AbortSignal.timeout(15000)});
  requireCondition(!refresh.ok);
  console.log('PASS refresh works and sign-out revokes the refresh token');
  stage='wrong and missing-account credentials';
  const wrong=await client.auth.signInWithPassword({email,password:password+'wrong'});
  const missing=await client.auth.signInWithPassword({email:`missing-${randomUUID()}@example.invalid`,password});
  requireCondition(wrong.error?.code==='invalid_credentials' && missing.error?.code==='invalid_credentials');
  console.log('PASS wrong password and missing account return the same error');
} catch {
  console.error(`FAIL ${stage} (details withheld to avoid printing credentials)`);
  process.exitCode=1;
} finally {
  await client.auth.signOut({scope:'local'}).catch(()=>{});
  if(userId) {
    try {
      await adminRequest('/auth/v1/admin/users/'+userId,'DELETE');
      const listed=await adminRequest('/auth/v1/admin/users?page=1&per_page=1000');
      requireCondition(!listed.users.some(user=>user.id===userId));
      console.log('PASS temporary account removed');
    } catch { cleanupOk=false; console.error('FAIL local test-account cleanup');process.exitCode=1; }
  }
  if (!cleanupOk) console.error('Review local test accounts before continuing.');
}
