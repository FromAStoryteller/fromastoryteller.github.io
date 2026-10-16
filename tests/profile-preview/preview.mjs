// Browser-only fixture: this directory is excluded from production builds.
import { mountProfileEditor } from '../../systems/community/profile-editor.mjs';
import { renderPublicProfile } from '../../systems/community/public-profile.mjs';
const public_id = '82b9aa53-bc29-4ff8-9e25-000000000001';
let profile = { display_name: 'Alex Morgan', bio: 'I write about quiet places, ordinary people and the moments that change us. Usually found with a book and a cup of tea.', welcome_line: 'A little corner of my world. Make yourself at home.', public_id };
const stories = [{slug:'the-last-light',title:'The Last Light',summary:'At the edge of a sleeping town, one window still keeps its promise.'},{slug:'a-door-left-open',title:'A Door Left Open',summary:'Some invitations arrive long after we have stopped waiting for them.'}];
const root = document.querySelector('[data-profile-root]');
const mode = new URLSearchParams(location.search).get('mode') ?? 'contributor';
document.querySelector('[data-preview-mode]').textContent = mode === 'public' ? 'Public storyteller page' : mode === 'viewer' ? 'Private viewer profile' : 'Contributor profile editor';
let dispose;
if (mode === 'public') { root.className = 'storyteller-home'; renderPublicProfile(root, { ...profile, stories }); }
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
  observer.observe(root,{subtree:true,attributes:true,attributeFilter:['hidden','href']});
  addEventListener('pagehide', () => { observer.disconnect(); dispose?.(); });
}
