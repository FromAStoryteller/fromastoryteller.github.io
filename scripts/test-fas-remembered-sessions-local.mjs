import {randomUUID,randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {createBrowserSessionStorage} from '../account/session-storage.mjs';
import {restoreSession} from '../account/session-controller.mjs';

// Local-only fixture. Capture keys in memory, never log or save them.
let status=JSON.parse(execFileSync(process.platform==='win32'?'cmd.exe':'npx',process.platform==='win32'
 ? ['/d','/s','/c','npx.cmd --yes --offline supabase@2.120.0 status -o json']
 : ['--yes','--offline','supabase@2.120.0','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],windowsHide:true}));
if(status.API_URL!=='http://127.0.0.1:55321')throw Error('Refusing a non-local target');
const base=status.API_URL,key=status.ANON_KEY,adminKey=status.SERVICE_ROLE_KEY;status=null;
const email=`fas-remember-${randomUUID()}@example.invalid`,password='LocalOnly9!'+randomBytes(24).toString('base64url');
const backing=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const sharedStorage=backing(),clients=[];
const storage=remember=>createBrowserSessionStorage({namespace:'local-fixture',sharedStorage,tabStorage:backing(),remember});
const client=store=>{const c=createClient(base,key,{auth:{storage:store.adapter,storageKey:store.key,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});clients.push(c);return c;};
const requireCondition=(condition,message)=>{if(!condition)throw Error(message);};
const admin=async(path,method,body)=>{
 const response=await fetch(base+'/auth/v1/admin/'+path,{method,headers:{apikey:adminKey,Authorization:'Bearer '+adminKey,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 requireCondition(response.ok,'Local fixture management failed');return response.json();
};
let id;
try{
 id=(await admin('users','POST',{email,password,email_confirm:true})).id;
 const firstStore=storage(),first=client(firstStore);
 requireCondition(!(await first.auth.signInWithPassword({email,password})).error,'Local sign-in failed');
 const secondStore=storage(),second=client(secondStore);
 requireCondition((await restoreSession(second.auth,true,()=>secondStore.clear())).state==='signed-in','New tab restore failed');
 const restartedStore=storage(),restarted=client(restartedStore);
 requireCondition((await restoreSession(restarted.auth,true,()=>restartedStore.clear())).state==='signed-in','Fresh browser restore failed');
 console.log('PASS remembered credentials restore through real Auth in new-tab and fresh-browser adapters');
 requireCondition(!(await restarted.auth.signOut({scope:'local'})).error,'Sign-out failed');
 requireCondition(!firstStore.hasSession&&!secondStore.hasSession,'Shared cache survived sign-out');
 requireCondition((await restoreSession(second.auth,true,()=>secondStore.clear())).state==='session-ended','Other tab remained signed in');
 console.log('PASS shared sign-out clears sibling credentials and server-verified restoration stays closed');
 const privateStore=storage(false),privateClient=client(privateStore);
 requireCondition(!(await privateClient.auth.signInWithPassword({email,password})).error,'Tab-only sign-in failed');
 requireCondition(privateStore.hasSession&&!storage().hasSession,'Tab-only credentials leaked to shared storage');
 console.log('PASS tab-only sign-in remains separate from a fresh tab');
 await privateClient.auth.signOut({scope:'local'});
}catch(error){console.error('FAIL remembered-session integration: '+error.message);process.exitCode=1;}
finally{
 for(const c of clients)await c.auth.dispose();
 if(id){await admin('users/'+id,'DELETE');console.log('PASS disposable local viewer removed');}
}
