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
  header.append(node(d, 'p', 'profile-eyebrow', 'From, a storyteller'), node(d, 'div', 'profile-monogram', initials(profile.display_name)), node(d, 'h1', '', profile.display_name));
  if (profile.welcome_line) header.append(node(d, 'p', 'profile-welcome', profile.welcome_line));
  if (profile.bio) header.append(node(d, 'p', 'profile-bio', profile.bio));
  if(profile.social_links?.length){const socials=node(d,'nav','storyteller-socials');renderSocialLinks(socials,profile.social_links);header.append(socials);}
  const section = node(d, 'section', 'storyteller-stories');
  section.append(node(d, 'h2', '', 'Published stories & posts'));
  const list = node(d, 'div', 'profile-story-list');
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
  if (!list.children.length) section.append(node(d, 'p', 'profile-muted', 'A quiet corner, waiting for its first story.'));
  else section.append(list);
  root.append(header, section);
}

export function profileStoryCard(story, { imageBase, preview = false } = {}) {
  const localImage = preview && /^\/assets\/images\/stories\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(story.preview_image ?? '') ? story.preview_image : '';
  return createCardMarkup({ category:story.content_type==='blog'?'blog':'stories',title:story.title,url:contentPath(story),
    card:{title:story.title,description:story.summary,image:publicCoverUrl(story.cover,imageBase)||localImage,imageAlt:story.cover?.alt || story.preview_alt || ''} });
}

export function renderPublicStory(root, story, { imageBase } = {}) {
  root.removeAttribute('data-content-id');if(isPublicId(story?.id))root.dataset.contentId=story.id;
  const d = root.ownerDocument;
  root.replaceChildren();
  if (!story) { root.append(node(d, 'h1', '', 'Story unavailable'), node(d, 'p', '', 'This story may no longer be published.')); return; }
  root.append(node(d, 'p', 'profile-eyebrow', story.content_type==='blog'?'A post from the community':'A story from the community'), node(d, 'h1', '', story.title));
  const authorUrl = publicProfileUrl(story.author?.public_id);
  const byline = node(d, authorUrl ? 'a' : 'p', '', `By ${story.author?.display_name || 'Storyteller'}`);
  if (authorUrl) byline.href = authorUrl;
  root.append(byline);
  if (story.summary) root.append(node(d,'p','profile-welcome',story.summary));
  const metadata = [...(story.genre?[story.genre]:story.genres?.map(genreLabel)??[]), ...(story.tags ?? [])].filter(Boolean).join(' · ');
  if (metadata) root.append(node(d,'p','profile-muted',metadata));
  if (story.content_warning) root.append(node(d,'p','profile-bio',`Content warning: ${story.content_warning}`));
  const coverUrl = publicCoverUrl(story.cover,imageBase);
  if (coverUrl) { const img=node(d,'img','community-story-cover'); img.src=coverUrl;img.alt=story.cover.alt;img.addEventListener('error',()=>img.remove(),{once:true});root.append(img); }
  const prose=node(d,'div','');renderManuscript(prose,story.body_document??plainDocument(story.body),story);root.append(prose);
  if(story.author?.social_links?.length){const socials=node(d,'nav','storyteller-socials');renderSocialLinks(socials,story.author.social_links);root.append(socials);}
}
