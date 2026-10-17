import {loadLocalAuthClient} from '/account/local-auth-client.mjs';
import {restoreSession} from '/account/session-controller.mjs';
import {loadProfileAccount} from '/account/settings-controller.mjs';
import {watchSessionEnd} from '/account/session-events.mjs';
import {accountNavigation} from './account-navigation.mjs';
import {createStudioService} from './studio-service.mjs';
import {mountStudio} from './studio-editor.mjs';
import {mountStudioLock} from './studio-lock.mjs';
import {createRecoveryStore,clearRecoveryStorage} from './studio-recovery.mjs';
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
   onResume:(snapshot,account)=>{held=null;lockDispose=null;ended=false;launch(account,snapshot);},
   onForget:()=>{held=null;unavailable('Recovery discarded. Reopen Studio to continue with the current account.',{forget:true});}});
 }else{const link=document.createElement('a');link.href='/account/sign-in/';link.className='account-secondary';link.textContent='Sign in';root.append(link);}
}
function launch(account,initialRecovery=null){
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
 else{const account=await loadProfileAccount(local.client,{useRestoredSession:true});if(!ended){if(!account.contributor||account.state!=='active')unavailable('Storyteller Studio is available to active contributors. Your saved work remains available through your account download.');else launch(account);}}
 addEventListener('pagehide',()=>{dispose?.();lockDispose?.();held=null;stop();switched.unsubscribe();},{once:true});
 addEventListener('beforeunload',event=>{if(held){event.preventDefault();event.returnValue='';}});
}catch(error){if(!ended)unavailable(error.message,{preserve:true});}
