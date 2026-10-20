import {storyPageMarkup} from '../content/page-layout.mjs';
import {profileImageUrl} from './profile-image-service.mjs';
import {fileContentPath} from './publishing-identity.mjs';
import {isInteractive} from './interactive-package.mjs';
import {interactivePageMarkup,mountPublicPlayer} from './interactive-page.mjs';
import {contentPath} from './content-address.mjs';
import { initials } from './profile-editor.mjs';
import { publicProfileUrl, publicCoverUrl, isPublicId } from './profiles.mjs';
import { createCardMarkup } from '../content/content-system.js';
import {renderManuscript,plainDocument,renderSocialLinks} from './manuscript.mjs';
import {genreLabel} from './studio-catalog.mjs';

const node = (document, tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

export function renderPublicProfile(root, profile, { imageBase, preview = false } = {}) {
  const d = root.ownerDocument;
  root.replaceChildren();
  if (!profile) { root.append(node(d, 'h1', '', 'Storyteller page unavailable'), node(d, 'p', 'profile-muted', 'This page may no longer be public.')); return; }
  const header = node(d, 'header', 'storyteller-header');
  header.append(node(d, 'div', 'profile-monogram', initials(profile.display_name)), node(d, 'h1', '', profile.display_name));
  const avatarUrl=profileImageUrl(profile.image,imageBase);
  if(avatarUrl){const img=node(d,'img','profile-avatar');img.src=avatarUrl;img.alt=profile.image.alt;img.width=img.height=96;
    const monogram=header.querySelector('.profile-monogram');monogram.hidden=true;monogram.after(img);img.addEventListener('error',()=>{img.remove();monogram.hidden=false;},{once:true});}
  if (profile.welcome_line) header.append(node(d, 'p', 'profile-welcome', profile.welcome_line));
  if (profile.bio) header.append(node(d, 'p', 'profile-bio', profile.bio));
  if(profile.social_links?.length){const socials=node(d,'nav','storyteller-socials');renderSocialLinks(socials,profile.social_links);header.append(socials);}
  const section = node(d, 'section', 'storyteller-stories');
  section.append(node(d, 'h2', '', 'Published work'));
  const list = node(d, 'div', 'content-grid profile-story-list');
  for (const story of profile.stories ?? []) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(story.slug ?? '')) continue;
    const frame = node(d, 'template');
    frame.innerHTML = profileStoryCard(story, { imageBase, preview });
    list.append(frame.content);
  }
  for (const image of list.querySelectorAll('img')) image.addEventListener('error', () => {
    const fallback=node(d,'span','content-grid-card-placeholder','From, A Storyteller');
    fallback.setAttribute('aria-hidden','true');image.replaceWith(fallback);
  },{once:true});
  if (!list.children.length) section.append(node(d, 'p', 'profile-muted', 'No published work yet.'));
  else section.append(list);
  root.append(header, section);
}

export function profileStoryCard(story, { imageBase, preview = false } = {}) {
  const localImage = (preview||story.source_kind==='file') && /^\/assets\/images\/[a-z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(story.preview_image ?? '') ? story.preview_image : '';
  return createCardMarkup({ category:({story:'stories',blog:'blog',game:'games',tool:'tools',video:'videos'})[story.content_type]||'stories',title:story.title,url:story.source_kind==='file'?fileContentPath(story.url)||'#':contentPath(story),
    card:{title:story.title,description:story.summary,image:publicCoverUrl(story.cover,imageBase)||localImage,imageAlt:story.cover?.alt || story.preview_alt || ''} });
}

const players=new WeakMap();
export function renderPublicStory(root,story,{imageBase}={}){
 players.get(root)?.();players.delete(root);
 root.removeAttribute('data-content-id');root.classList.remove('community-reading');
 if(isPublicId(story?.id))root.dataset.contentId=story.id;
 root.replaceChildren();
 if(!story){root.append(node(root.ownerDocument,'h1','','Story unavailable'),node(root.ownerDocument,'p','','This story may no longer be published.'));return;}
 if(isInteractive(story.content_type)){root.innerHTML=interactivePageMarkup(story);players.set(root,mountPublicPlayer(root,story));root.dispatchEvent(new root.ownerDocument.defaultView.CustomEvent('fas:content-rendered',{bubbles:true}));return;}
 root.innerHTML=storyPageMarkup({...story,image:publicCoverUrl(story.cover,imageBase),image_alt:story.cover?.alt,genres:story.genres?.map(genreLabel)??[]});
 root.dispatchEvent(new root.ownerDocument.defaultView.CustomEvent('fas:content-rendered',{bubbles:true}));
 for(const img of root.querySelectorAll('.story-feature-image img'))img.addEventListener('error',()=>{img.closest('.story-hero').classList.add('story-hero--no-image');img.closest('figure').remove();},{once:true});
}
