import {publicProfileRequest} from './profile-directory.mjs';
import {mountStorytellerFollow} from './storyteller-follow.mjs';
import {isPublicId,publicProfileUrl} from './profiles.mjs';
import {profileImageUrl} from './profile-image-service.mjs';

// Both repository stories and published contributor stories use the rendered byline.
export function initStoryAuthorPanels({document:d=document,window:w=window,request=publicProfileRequest,connect}={}) {
  if(w.location.pathname.startsWith('/account/'))return;
  let generation=0,stop;
  async function render(){
    const story=d.querySelector('.story-page,.fas-interactive-page')||d.querySelector('main .game-hero,main .tool-hero,main .video-hero')?.closest('main');if(!story||story.querySelector('[data-story-author-panel]'))return;
    const footer=story.querySelector('.story-footer'),next=story.querySelector('.content-next-section,.related-content,[data-related-content]');
    const authorLink=story.querySelector('.story-author a,.file-publishing-author a');if(!authorLink)return;
    const id=new URL(authorLink.href,w.location.href).searchParams.get('author');if(!isPublicId(id))return;
    const panel=d.createElement('section');panel.className='story-author-panel';panel.dataset.storyAuthorPanel='';panel.setAttribute('aria-label','About the storyteller');panel.setAttribute('aria-busy','true');
    const loading=d.createElement('p');loading.textContent='Loading storyteller…';loading.setAttribute('role','status');panel.append(loading);if(footer)footer.after(panel);else if(next)next.before(panel);else story.append(panel);const token=++generation;
    async function load(){try{
      const response=await request('fas_public_profile',{profile_key:id,page_offset:0});if(token!==generation||!panel.isConnected)return;
      const profile=response.data;if(!profile){panel.replaceChildren();panel.hidden=true;return;}
      const h=d.createElement('h2'),a=d.createElement('a');a.href=publicProfileUrl(id);a.textContent=profile.display_name;h.append(a);
      const intro=d.createElement('p');intro.textContent=profile.welcome_line||profile.bio||'Explore more work from this storyteller.';
      const actions=d.createElement('div');actions.className='story-author-actions';const more=d.createElement('a');more.href=publicProfileUrl(id);more.className='account-secondary';more.textContent='More by this storyteller';actions.append(more);panel.replaceChildren(h,intro,actions);
      const image=profileImageUrl(profile.image,response.imageBase);if(image){const avatar=d.createElement('img');avatar.className='story-author-avatar';avatar.src=image;avatar.alt='';avatar.width=avatar.height=64;avatar.loading='lazy';avatar.addEventListener('error',()=>avatar.remove(),{once:true});panel.prepend(avatar);}
      stop?.();stop=mountStorytellerFollow(actions,profile,{window:w,...(connect?{connect}:{})});
    }catch{if(token!==generation||!panel.isConnected)return;const link=d.createElement('a');link.href=publicProfileUrl(id);link.textContent='Visit this storyteller';link.className='account-secondary';const retry=d.createElement('button');retry.type='button';retry.className='content-filter';retry.textContent='Retry storyteller details';retry.addEventListener('click',()=>void load());panel.replaceChildren(link,retry);}
    finally{if(token===generation)panel.setAttribute('aria-busy','false');}}
    await load();
  }
  const start=()=>void render();d.addEventListener('fas:content-rendered',start);start();
  // File bylines can be replaced after the initial page is rendered.
  const observer=new w.MutationObserver(start);observer.observe(d.querySelector('main')||d.body,{subtree:true,childList:true});
  w.addEventListener('pagehide',()=>{generation++;observer.disconnect();stop?.();d.removeEventListener('fas:content-rendered',start);},{once:true});
}
