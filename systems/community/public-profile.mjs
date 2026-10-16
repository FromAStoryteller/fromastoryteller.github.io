import { initials } from './profile-editor.mjs';
import { publicProfileUrl } from './profiles.mjs';

const node = (document, tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

export function renderPublicProfile(root, profile) {
  const d = root.ownerDocument;
  root.replaceChildren();
  if (!profile) { root.append(node(d, 'h1', '', 'Storyteller page unavailable'), node(d, 'p', 'profile-muted', 'This page may no longer be public.')); return; }
  const header = node(d, 'header', 'storyteller-header');
  header.append(node(d, 'p', 'profile-eyebrow', 'From, a storyteller'), node(d, 'div', 'profile-monogram', initials(profile.display_name)), node(d, 'h1', '', profile.display_name));
  if (profile.welcome_line) header.append(node(d, 'p', 'profile-welcome', profile.welcome_line));
  if (profile.bio) header.append(node(d, 'p', 'profile-bio', profile.bio));
  const section = node(d, 'section', 'storyteller-stories');
  section.append(node(d, 'h2', '', 'Stories to spend a little time with'));
  const list = node(d, 'div', 'profile-story-list');
  for (const story of profile.stories ?? []) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(story.slug ?? '')) continue;
    const article = node(d, 'article', 'profile-story');
    const title = node(d, 'h3');
    const link = node(d, 'a', '', story.title);
    link.href = `/read/?story=${encodeURIComponent(story.slug)}`;
    title.append(link); article.append(title, node(d, 'p', '', story.summary));
    const read = node(d, 'a', '', 'Read story →'); read.href = link.href; article.append(read); list.append(article);
  }
  if (!list.children.length) section.append(node(d, 'p', 'profile-muted', 'A quiet corner, waiting for its first story.'));
  else section.append(list);
  root.append(header, section);
}

export function renderPublicStory(root, story) {
  const d = root.ownerDocument;
  root.replaceChildren();
  if (!story) { root.append(node(d, 'h1', '', 'Story unavailable'), node(d, 'p', '', 'This story may no longer be published.')); return; }
  root.append(node(d, 'p', 'profile-eyebrow', 'A story from the community'), node(d, 'h1', '', story.title));
  const authorUrl = publicProfileUrl(story.author?.public_id);
  const byline = node(d, authorUrl ? 'a' : 'p', '', `By ${story.author?.display_name || 'Storyteller'}`);
  if (authorUrl) byline.href = authorUrl;
  root.append(byline, node(d, 'div', 'community-prose', story.body));
}
