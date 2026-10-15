import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createSessionStorage, SESSION_KEY } from '../account/session-storage.mjs';
import { restoreSession } from '../account/session-controller.mjs';

const base='http://127.0.0.1:55321';
const key=process.env.FAS_TEST_ANON_KEY;
const adminKey=process.env.FAS_TEST_SERVICE_KEY;
if(process.env.FAS_TEST_CONFIRM!=='LOCAL-FAS-ONLY'||!key||!adminKey){console.error('Supply local FAS keys and acknowledge LOCAL-FAS-ONLY in the process environment.');process.exit(1);}
const email=`fas-sessions-${randomUUID()}@example.invalid`;
const password='LocalOnly9!'+randomBytes(24).toString('base64url');
const backing=new Map();
const storage=createSessionStorage({getItem:key=>backing.get(key)??null,setItem:(key,value)=>backing.set(key,value),removeItem:key=>backing.delete(key)});
const clients=[];
const client=()=>{const result=createClient(base,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storage:storage.adapter,storageKey:SESSION_KEY}});clients.push(result);return result;};
const requireCondition=value=>{if(!value)throw new Error('Session contract failed');};
let id;
let stage='create fixture';
async function admin(path,method='GET',body){const response=await fetch(base+path,{method,headers:{apikey:adminKey,Authorization:`Bearer ${adminKey}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});requireCondition(response.ok);return response.json();}
try{
  id=(await admin('/auth/v1/admin/users','POST',{email,password,email_confirm:true})).id;
  const first=client();
  requireCondition(!(await first.auth.signInWithPassword({email,password})).error);
  requireCondition(storage.hasSession);
  stage='navigation and reload restoration';
  const restored=await restoreSession(client().auth,true,()=>storage.clear());
  requireCondition(restored.state==='signed-in'&&restored.email===email);
  console.log('PASS a new client restores and server-verifies the stored session');
  stage='cached expiry with a usable refresh token';
  const cached=JSON.parse(storage.adapter.getItem(SESSION_KEY));cached.expires_at=1;
  storage.adapter.setItem(SESSION_KEY,JSON.stringify(cached));
  requireCondition((await restoreSession(client().auth,true,()=>storage.clear())).state==='signed-in');
  console.log('PASS SDK refresh restores an expired cache when the server session is valid');
  stage='server-side session expiry';
  requireCondition(/^[0-9a-f-]{36}$/.test(id));
  execFileSync('docker',['exec','supabase_db_fas-community-v1','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`update auth.sessions set not_after=now()-interval '1 second' where user_id='${id}'::uuid`],{stdio:['ignore','ignore','ignore'],windowsHide:true});
  requireCondition((await restoreSession(client().auth,true,()=>storage.clear())).state==='session-ended');
  requireCondition(!storage.hasSession);
  console.log('PASS a server-expired session is rejected and its tab cache is cleared');
  stage='sign-out and reload';
  const active=client();requireCondition(!(await active.auth.signInWithPassword({email,password})).error);
  requireCondition(!(await active.auth.signOut({scope:'local'})).error);
  requireCondition(!storage.hasSession);
  requireCondition((await restoreSession(client().auth,false,()=>storage.clear())).state==='guest');
  console.log('PASS sign-out removes the cache; a subsequent client remains signed out');
}catch{console.error(`FAIL ${stage} (credential details withheld)`);process.exitCode=1;}
finally{
  for(const item of clients)await item.auth.signOut({scope:'local'}).catch(()=>{});
  storage.clear();
  if(id){try{await admin('/auth/v1/admin/users/'+id,'DELETE');console.log('PASS temporary session-test account removed');}catch{console.error('FAIL session fixture cleanup');process.exitCode=1;}}
}
