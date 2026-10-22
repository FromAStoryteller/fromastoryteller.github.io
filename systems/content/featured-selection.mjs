// Featured work is derived from publication time, never from manual flags or edit time.
export const publicationTime = item => {
  const time = Date.parse(item.datePublished ?? item.published_at ?? '');
  return Number.isFinite(time) ? time : 0;
};
export const contributorKey = item => {
  const author = typeof item.author === 'object' ? item.author?.public_id : item.author;
  return String(author || item.authorDisplay || item.publisher || 'From A Storyteller').trim().toLowerCase();
};
export const contentType = item => item.type || item.content_type || ({stories:'story',games:'game',tools:'tool',videos:'video'})[item.category] || item.category;
export function newestPublished(items) {
  return [...items].sort((a,b) => publicationTime(b)-publicationTime(a) || String(a.id||a.url||a.slug).localeCompare(String(b.id||b.url||b.slug)));
}
export function selectFeatured(items, {perType=false, now=Date.now()}={}) {
  const seen=new Set();
  return newestPublished(items.filter(item => item.status==='published' && !item.draft && publicationTime(item)>0 && publicationTime(item)<=now)).filter(item => {
    const key=contributorKey(item)+(perType?'|'+contentType(item):'');
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
