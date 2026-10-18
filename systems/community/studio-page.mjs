import {contributionPolicyState} from '/account/contribution-policies.mjs';
import {loadLocalAuthClient} from '/account/local-auth-client.mjs';
import {restoreSession} from '/account/session-controller.mjs';
import {loadProfileAccount} from '/account/settings-controller.mjs';
import {watchSessionEnd} from '/account/session-events.mjs';
import {accountNavigation} from './account-navigation.mjs';
import {createStudioService} from './studio-service.mjs';
import {mountStudio} from './studio-editor.mjs';
import {mountStudioLock} from './studio-lock.mjs';
import {createRecoveryStore,clearRecoveryStorage,downloadRecovery} from './studio-recovery.mjs';
const root=document.querySelector('[data-studio-root]'),nav=document.querySelector('[data-studio-navigation]');
let dispose,lockDispose,ended=false,held=null,ownerId=null,local,signingOut=false,tabStorage;
try{tabStorage=sessionStorage;}catch{}
function unavailable(message,{preserve=false,forget=false}={}){
 if(preserve&&!forget){held=dispose?.recovery?.()??held;}
 if(forget){held=null;dispose?.forgetRecovery?.();clearRecoveryStorage(tabStorage);}
 dispose?.();dispose=null;lockDispose?.();lockDispose=null;nav.replaceChildren();root.replaceChildren();
 const h=document.createElement('h1');h.textContent='Storyteller Studio';const p=document.createElement('p');p.textContent=message;p.setAttribute('role','status');root.append(h,p);
 if(held&&local){
  lockDispose=mountStudioLock(root,{snapshot:held,ownerId,auth:local.client.auth,verify:()=>loadProfileAccount(local.client),
   onResume:(snapshot,account)=>{held=null;lockDispose=null;ended=false;launch(account,snapshot).catch(error=>unavailable(error.message,{preserve:true}));},
   onForget:()=>{held=null;unavailable('Recovery discarded. Reopen Studio to continue with the current account.',{forget:true});}});
 }else{const link=document.createElement('a');link.href='/account/sign-in/';link.className='account-secondary';link.textContent='Sign in';root.append(link);}
}
async function launch(account,initialRecovery=null){
 const policies=await contributionPolicyState(local.client);
 if(ended)return;
 if(!policies.accepted){
  held=initialRecovery??held;
  ownerId=account.user.id;
  nav.replaceChildren(accountNavigation(document,{current:'studio',publicId:account.profile.public_id,auth:{signOut:async args=>{held=null;clearRecoveryStorage(tabStorage);return local.client.auth.signOut(args);}},admin:account.admin}));
  root.replaceChildren();
  const heading=document.createElement('h1');heading.textContent='Review the updated contributor terms';
  const message=document.createElement('p');message.textContent='Before creating, editing or uploading, review the current Terms, including your content rights and contributor responsibilities. Saved work stays private and any tab recovery copy is kept. Account downloads, deletion and support remain available.';
  const actions=document.createElement('div');actions.className='account-flow-actions';
  for(const [text,href] of [['Review and agree','/account/agreements/'],['Read contributor policy','/terms/contributors/'],['Account settings and downloads','/account/settings/']]){const a=document.createElement('a');a.className='account-secondary';a.href=href;a.textContent=text;actions.append(a);}
  root.append(heading,message,actions);
  if(held){const note=document.createElement('p');note.textContent='Download the unsaved writing held in memory before leaving this tab.';root.append(note);for(const [label,plain] of [['Download unsaved text',true],['Download recovery file',false]]){const button=document.createElement('button');button.type='button';button.className='account-secondary';button.textContent=label;button.addEventListener('click',()=>downloadRecovery(document,held,plain));root.append(button);}}
  return;
 }
 ownerId=account.user.id;clearRecoveryStorage(tabStorage,account.profile.public_id);
 const store=createRecoveryStore(tabStorage,{ownerId:account.profile.public_id});
 const navigationAuth={signOut:async args=>{signingOut=true;dispose?.forgetRecovery?.();try{return await local.client.auth.signOut(args);}finally{signingOut=false;}}};
 nav.replaceChildren(accountNavigation(document,{current:'studio',publicId:account.profile.public_id,auth:navigationAuth,admin:account.admin,beforeSignOut:()=>dispose?.canLeave?.()??true}));
 dispose=mountStudio(root,createStudioService(local.client,{ownerId}),{authorName:account.profile.display_name,imageBase:local.publicImageBase,auth:local.client.auth,admin:account.admin,publicId:account.profile.public_id,socialLinks:account.profile.social_links??[],initialRecovery,recoveryStore:store,onAccessLost:(message,error)=>{ended=true;unavailable(message,{preserve:true,forget:['owner-changed','account-closed'].includes(error?.reason)});}});
}
try{
 local=await loadLocalAuthClient();if(!local)throw new Error('Account services are currently unavailable. Please try again later.');
 const stop=watchSessionEnd(local,()=>{ended=true;unavailable('Your session ended. Saved drafts remain private.',{preserve:true,forget:signingOut});});
 const switched=local.client.auth.onAuthStateChange((_event,session)=>{if(ownerId&&session?.user?.id&&session.user.id!==ownerId){ended=true;unavailable('Your account changed. Reopen Studio to continue.',{forget:true});}}).data.subscription;
 const session=await restoreSession(local.client.auth,local.hadSession,()=>local.storage.clear());
 if(session.state!=='signed-in')unavailable('Sign in with a contributor account to write here.');
 else{const account=await loadProfileAccount(local.client,{useRestoredSession:true});if(!ended){if(!account.contributor||account.state!=='active')unavailable('Storyteller Studio is available to active contributors. Your saved work remains available through your account download.');else await launch(account);}}
 addEventListener('pagehide',()=>{dispose?.();lockDispose?.();held=null;stop();switched.unsubscribe();},{once:true});
 addEventListener('beforeunload',event=>{if(held){event.preventDefault();event.returnValue='';}});
}catch(error){if(!ended)unavailable(error.message,{preserve:true});}
