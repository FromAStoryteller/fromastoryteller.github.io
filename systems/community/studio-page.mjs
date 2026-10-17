import { loadLocalAuthClient } from '/account/local-auth-client.mjs';
import { restoreSession } from '/account/session-controller.mjs';
import { loadProfileAccount } from '/account/settings-controller.mjs';
import { watchSessionEnd } from '/account/session-events.mjs';
import { accountNavigation } from './account-navigation.mjs';
import { createStudioService } from './studio-service.mjs';
import { mountStudio } from './studio-editor.mjs';
const root=document.querySelector('[data-studio-root]'),nav=document.querySelector('[data-studio-navigation]');
let dispose,ended=false;
function unavailable(message) {
  dispose?.();nav.replaceChildren();root.replaceChildren();
  const h=document.createElement('h1');h.textContent='Storyteller Studio';
  const p=document.createElement('p');p.textContent=message;p.setAttribute('role','status');
  const link=document.createElement('a');link.href='/account/settings/';link.className='account-secondary';link.textContent='Your account and downloads';
  root.append(h,p,link);
}
try {
  const local=await loadLocalAuthClient();
  if(!local)throw new Error('Account services are currently unavailable. Please try again later.');
  const stop=watchSessionEnd(local,()=>{ended=true;unavailable('Your session ended. Sign in again to manage your stories.');});
  const session=await restoreSession(local.client.auth,local.hadSession,()=>local.storage.clear());
  if(session.state!=='signed-in')unavailable('Sign in with a contributor account to write here.');
  else {
    const account=await loadProfileAccount(local.client,{useRestoredSession:true});
    if(!ended) {
      if(!account.contributor||account.state!=='active')unavailable('Storyteller Studio is available to active contributors. Your saved work remains available through your account download.');
      else {
        nav.replaceChildren(accountNavigation(document,{current:'studio',publicId:account.profile.public_id,auth:local.client.auth,admin:account.admin,beforeSignOut:()=>dispose?.canLeave?.()??true}));
        const switched=local.client.auth.onAuthStateChange((_event,s)=>{if(s?.user?.id&&s.user.id!==account.user.id){ended=true;unavailable('Your account changed. Reopen Storyteller Studio to continue.');}}).data.subscription;
        addEventListener('pagehide',()=>switched.unsubscribe(),{once:true});
        dispose=mountStudio(root,createStudioService(local.client,{ownerId:account.user.id}),{authorName:account.profile.display_name,imageBase:local.publicImageBase,auth:local.client.auth,admin:account.admin,publicId:account.profile.public_id,socialLinks:account.profile.social_links??[],onAccessLost:message=>{ended=true;unavailable(message);}});
      }
    }
  }
  addEventListener('pagehide',()=>{dispose?.();stop();},{once:true});
}catch(error){if(!ended)unavailable(error.message);}
