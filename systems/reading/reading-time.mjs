// Shared by the site generator and story/Studio previews. Estimate, not a timer.
export const WORDS_PER_MINUTE = 225;

export function readingTimeFromHtml(html = '') {
  const text = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(?:p|div|section|article|blockquote|li|br|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&(?:apos|rsquo|lsquo);/gi, "'")
    .replace(/&[a-z][a-z0-9]+;/gi, ' ');
  const words = (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
  return { words, minutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)) };
}

export function storyBodyHtml(page) {
  const start = /<section\b[^>]*class=["'][^"']*\bstory-content\b[^"']*["'][^>]*>/i.exec(page);
  if (!start) return null;
  const offset = start.index + start[0].length;
  const tags = /<\/?section\b[^>]*>/gi;
  tags.lastIndex = offset;
  let depth = 1, tag;
  while ((tag = tags.exec(page))) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (!depth) return page.slice(offset, tag.index);
  }
  throw new Error('Story content section is not closed');
}

export function readingTimeLabel(minutes) {
  return Number.isFinite(minutes) && minutes > 0 ? `${Math.ceil(minutes)} min read` : '';
}

export function readingTimeMarkup(minutes) {
  return `<i class="fa-solid fa-clock" aria-hidden="true"></i>${readingTimeLabel(minutes)}`;
}
