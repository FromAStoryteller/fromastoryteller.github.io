import {initPublicStorytellerPage} from './public-storyteller-page.mjs';
import {signInHref} from '/account/return-path.mjs';
import {contentAddress} from './content-address.mjs';
import { loadLocalAuthClient } from '/account/local-auth-client.mjs';
import { restoreSession } from '/account/session-controller.mjs';
import { loadProfileAccount } from '/account/settings-controller.mjs';
import { watchSessionEnd } from '/account/session-events.mjs';
import { mountProfileEditor } from './profile-editor.mjs';
import { createProfileService } from './profiles.mjs';
import { renderPublicStory } from './public-profile.mjs';
import { accountNavigation } from './account-navigation.mjs';
import {contentMetadata,applyContentMetadata} from './content-metadata.mjs';
import {publicCoverUrl} from './profiles.mjs';
const root = document.querySelector('[data-profile-root]');
const mode = document.querySelector('[data-profile-mode]').dataset.profileMode;
let dispose;
let ended = false;
function message(title, detail, signIn = false) {
  root.replaceChildren();
  const h = document.createElement('h1'); h.textContent = title;
  const p = document.createElement('p'); p.textContent = detail; p.setAttribute('role','status');
  root.append(h,p);
  if (signIn) { const link = document.createElement('a');link.className='account-secondary profile-sign-in';link.href=signInHref(location.pathname);link.textContent='Sign in';root.append(link); }
}
if(mode==='public'){
 let ownerPromise,ownerEnded=false,publicId=new URLSearchParams(location.search).get('author');
 await initPublicStorytellerPage(root,{onRender:async profile=>{
  ownerPromise??=(async()=>{const local=await loadLocalAuthClient();if(!local)return null;const stop=watchSessionEnd(local,()=>{ownerEnded=true;root.querySelector('.storyteller-owner-toolbar')?.remove();});addEventListener('pagehide',stop,{once:true});const session=await local.client.auth.getSession();if(!session.data?.session)return null;return {account:await loadProfileAccount(local.client),local};})().catch(()=>null);
  const own=await ownerPromise;if(ownerEnded||!own||own.account.state!=='active'||own.account.profile.public_id!==publicId||root.dataset.profilePublicId!==publicId)return;
  root.querySelector('.storyteller-owner-toolbar')?.remove();
  const toolbar=document.createElement('nav');toolbar.className='storyteller-owner-toolbar';toolbar.setAttribute('aria-label','Manage your storyteller profile');
  for(const [label,href]of [['Edit profile','/account/profile/'],['Storyteller Studio','/account/studio/']]){const a=document.createElement('a');a.className='account-secondary';a.href=href;a.textContent=label;toolbar.append(a);}root.prepend(toolbar);
 }});
}else try {
  const local = await loadLocalAuthClient();
  if (!local) throw new Error('Profile services are currently unavailable. Please try again later.');
  const service = createProfileService(local.client);
  if (mode === 'profile') {
    let userId;
    const end = () => { ended = true; dispose?.(); message('Your profile is private','Sign in again to manage your profile.',true); };
    const stopWatching = watchSessionEnd(local,end);
    const subscription = local.client.auth.onAuthStateChange((event,session) => {
      if (userId && session?.user?.id && userId !== session.user.id) end();
    }).data.subscription;
    const session = await restoreSession(local.client.auth,local.hadSession,() => local.storage.clear());
    if (session.state !== 'signed-in') message('Your profile is private',session.message || 'Sign in to make this space your own.',true);
    else {
      const account = await loadProfileAccount(local.client,{useRestoredSession:true,onNavigation:access=>{
        if (!ended) { root.querySelector('.account-navigation')?.remove(); root.prepend(accountNavigation(document,{current:'profile',auth:local.client.auth,contributor:access.contributor,admin:access.admin})); }
      }});
      userId = account.user.id;
      if (!ended) {
        if (account.state !== 'active') message('Account removal is in progress','Profile editing is unavailable while your account is being removed.');
        else {
          const contributor = account.contributor;
          if (!ended) dispose = mountProfileEditor(root,local.client,{contributor,viewer:!contributor,initialProfile:account.profile,ownerId:account.user.id,imageBase:local.publicImageBase,admin:account.admin});
        }
      }
    }
    addEventListener('pagehide',() => { dispose?.(); subscription.unsubscribe(); stopWatching(); },{once:true});
  } else {
    const address=contentAddress(location.pathname);let story = await service.readStory(address?.slug??new URLSearchParams(location.search).get('story'));if(address&&story&&(story.content_type??'story')!==address.content_type)story=null;
    renderPublicStory(root,story,{imageBase:local.publicImageBase});
    if(story)applyContentMetadata(document,contentMetadata(story,publicCoverUrl(story.cover,local.publicImageBase)));
    if (story) document.title=`${story.title} | From A Storyteller`;
  }
} catch (error) { if (!ended) message('This page could not be loaded',error.message || 'Please try again later.'); }
