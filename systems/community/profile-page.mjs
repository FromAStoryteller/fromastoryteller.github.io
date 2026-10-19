import {signInHref} from '/account/return-path.mjs';
import {contentAddress} from './content-address.mjs';
import { loadLocalAuthClient } from '/account/local-auth-client.mjs';
import { restoreSession } from '/account/session-controller.mjs';
import { loadProfileAccount } from '/account/settings-controller.mjs';
import { watchSessionEnd } from '/account/session-events.mjs';
import { mountProfileEditor } from './profile-editor.mjs';
import { createProfileService } from './profiles.mjs';
import { renderPublicProfile, renderPublicStory } from './public-profile.mjs';
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
try {
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
      const account = await loadProfileAccount(local.client,{useRestoredSession:true});
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
  } else if (mode === 'public') {
    const id = new URLSearchParams(location.search).get('author');
    let ownsPage = false;
    let ownerAdmin = false;
    let ownerSessionEnded = false;
    // Verify ownership alongside public content, rather than starting afterwards.
    const stopOwnerWatch = watchSessionEnd(local, () => { ownerSessionEnded = true; ownsPage = false; root.querySelector('.account-navigation')?.remove(); });
    addEventListener('pagehide', stopOwnerWatch, { once: true });
    const ownProfile = (async () => {
      const session = await local.client.auth.getSession();
      if (!session.data?.session) return null;
      return loadProfileAccount(local.client);
    })().catch(() => null);
    let current = await service.readPublic(id);
    function render() {
      renderPublicProfile(root,current,{imageBase:local.publicImageBase});
      if (current && ownsPage) root.prepend(accountNavigation(document, { current: 'public', publicId: id, auth: local.client.auth, admin: ownerAdmin }));
      if (current?.next_offset != null) {
        const more = document.createElement('button');more.className='account-secondary';more.textContent='More work';
        more.addEventListener('click',async () => {
          more.disabled=true;
          try {
            const page = await service.readPublic(id,current.next_offset);
            if (!page) { current=null; render(); return; }
            current={...page,stories:[...current.stories,...page.stories]}; render();
          } catch { more.textContent='Could not load work. Try again';more.disabled=false; }
        });root.append(more);
      }
    }
    render();
    if (current) document.title=`${current.display_name} | From A Storyteller`;
    // Owner controls never form part of the anonymous public projection.
    void (async () => {
      const own = await ownProfile;
      if (!own || !current) return;
      ownsPage = !ownerSessionEnded && own.profile.public_id === id;
      ownerAdmin = own.admin;
      if (ownsPage) render();
    })().catch(() => {});
  } else {
    const address=contentAddress(location.pathname);let story = await service.readStory(address?.slug??new URLSearchParams(location.search).get('story'));if(address&&story&&(story.content_type??'story')!==address.content_type)story=null;
    renderPublicStory(root,story,{imageBase:local.publicImageBase});
    if(story)applyContentMetadata(document,contentMetadata(story,publicCoverUrl(story.cover,local.publicImageBase)));
    if (story) document.title=`${story.title} | From A Storyteller`;
  }
} catch (error) { if (!ended) message('This page could not be loaded',error.message || 'Please try again later.'); }
