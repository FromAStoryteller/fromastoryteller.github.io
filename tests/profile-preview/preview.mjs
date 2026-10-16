// Browser-only fixture: this directory is excluded from production builds.
import { mountProfileEditor } from '../../systems/community/profile-editor.mjs';
import { renderPublicProfile, renderPublicStory } from '../../systems/community/public-profile.mjs';
const public_id = '82b9aa53-bc29-4ff8-9e25-000000000001';
let profile = { display_name: 'Alex Morgan', bio: 'I write about quiet places, ordinary people and the moments that change us. Usually found with a book and a cup of tea.', welcome_line: 'A little corner of my world. Make yourself at home.', public_id };
const stories = [{slug:'the-last-light',title:'The Last Light',summary:'At the edge of a sleeping town, one window still keeps its promise.'},{slug:'a-door-left-open',title:'A Door Left Open',summary:'Some invitations arrive long after we have stopped waiting for them.'}];
const root = document.querySelector('[data-profile-root]');
const mode = new URLSearchParams(location.search).get('mode') ?? 'contributor';
document.querySelector('[data-preview-mode]').textContent = mode === 'story' ? 'Published story' : mode === 'public' ? 'Public storyteller page' : mode === 'viewer' ? 'Private viewer profile' : 'Contributor profile editor';
let dispose;
if (mode === 'public') {
  root.className = 'storyteller-home'; renderPublicProfile(root, { ...profile, stories:stories.map((story,index)=>({...story,preview_image:index===0?'/assets/images/stories/sunset-at-the-lighthouse.png':'/assets/images/stories/a-place-left-behind.jpg',preview_alt:index===0?'A lighthouse overlooking the coast':'A quiet landscape'})) },{preview:true});
  for (const link of root.querySelectorAll('a')) {
    const slug=new URL(link.href).searchParams.get('story');
    if (slug) link.href=`?mode=story&story=${encodeURIComponent(slug)}`;
  }
} else if (mode === 'story') {
  const story=stories.find(item=>item.slug===new URLSearchParams(location.search).get('story'));
  root.className='community-reading';
  renderPublicStory(root,story?{...story,body:'The light was still on when she came home.\n\nFor the first time in years, she knocked.',author:{display_name:profile.display_name,public_id}}:null);
  const byline=root.querySelector('a');if(byline)byline.href='?mode=public';
}
else {
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'preview-only' } } }) }, from: () => {
    const query = {select: () => query,eq: () => query,update: changes => { profile = {...profile,...changes}; return query; },single: async () => ({data:profile,error:null})}; return query;
  }};
  dispose = mountProfileEditor(root, client, { contributor: mode !== 'viewer' });
  // Keep the test preview inside its own clearly marked fictional screens.
  const observer = new MutationObserver(() => {
    const link = root.querySelector('[data-public-link]');
    if (link && !link.hidden && !link.href.includes('mode=public')) link.href = '?mode=public';
  });
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','href']});
  addEventListener('pagehide', () => { observer.disconnect(); dispose?.(); });
}
