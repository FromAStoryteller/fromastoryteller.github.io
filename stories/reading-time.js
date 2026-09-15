import { readingTimeFromHtml, readingTimeMarkup } from '/content/reading-time.mjs';

// Also loaded by the canonical Studio story template; no bundled app change needed.
const prose = document.querySelector('.story-content');
const metadata = document.querySelector('.story-header .story-meta');
if (prose && metadata) {
  let label = metadata.querySelector('[data-story-reading-time]');
  if (!label) {
    label = document.createElement('span');
    label.dataset.storyReadingTime = '';
    metadata.append(label);
  }
  const update = () => { label.innerHTML = readingTimeMarkup(readingTimeFromHtml(prose.innerHTML).minutes); };
  update();
  new MutationObserver(update).observe(prose, {subtree: true, childList: true, characterData: true});
}
