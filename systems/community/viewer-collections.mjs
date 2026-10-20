import { connectViewerAccount } from './viewer-actions.mjs';
import { createCardMarkup } from '../content/content-system.js';
import { publicCoverUrl } from './profiles.mjs';
import { signInHref } from '../../account/return-path.mjs';
import { watchViewerChanges,publishViewerChanges } from './viewer-sync.mjs';
import {createBrowseHistory} from '../content/browse-state.mjs';

async function mountViewerCollection(root, { connect = connectViewerAccount } = {}) {
  const d = root.ownerDocument, w = d.defaultView, kind = root.dataset.viewerCollection;
  const title = kind === 'favourites' ? 'Favourites' : 'Saved for later';
  let account, ended = false, cursor = null, loading = false, stop, stopSync, notice;
  let loadedPages = 0, revision = 0, refreshQueued = false, retryRefresh = false, browseRestored=false, undoing=false, undoEntry=null;
  const browsing=createBrowseHistory(()=>({pages:loadedPages}),{window:w,document:d});
  const initialPages=Number.isInteger(browsing.state?.pages)?Math.max(1,Math.min(50,browsing.state.pages)):1;
  w.addEventListener('pageshow', event => { if (event.persisted) w.location.reload(); });
  const node = (tag, text) => { const n = d.createElement(tag); n.textContent = text; return n; };
  function fail(text, signIn = false) {
    notice?.remove();
    root.replaceChildren(node('h1',title),node('p',text));
    const link = node('a',signIn ? 'Sign in' : 'Reload this collection');
    link.className = 'account-secondary';
    link.href = signIn ? signInHref(w.location.pathname) : w.location.pathname;
    root.append(link);
  }
  try {
    account = await connect();
    if (!account) { fail('Sign in to see your private '+title.toLowerCase()+'.',true); return; }
    stop = account.subscribe(() => {
      ended = true; stopSync?.();browsing.clear();browsing.dispose();undoEntry=null;
      fail('Your account changed. Sign in again to view this collection.',true);
    });
    root.replaceChildren(node('h1',title),node('p',kind === 'favourites'
      ? 'Games and tools you want to return to. Your favourites are private.'
      : 'Pieces you have kept for another time. Your saved list is private.'));
    const nav = node('nav','');
    nav.className = 'viewer-collection-navigation'; nav.setAttribute('aria-label','Your collections');
    for (const [text,href] of [['Saved for later','/account/saved/'],['Favourites','/account/favourites/']]) {
      const a = node('a',text); a.href = href; a.className = 'account-secondary';
      if (href === w.location.pathname) a.setAttribute('aria-current','page');
      nav.append(a);
    }
    const grid = node('div',''); grid.className = 'content-grid viewer-collection-grid';
    const status = node('p','Loading your collection…'); status.setAttribute('role','status');
    const more = node('button','Load more'); more.type = 'button'; more.className = 'account-secondary'; more.hidden = true;
    root.append(nav,status,grid,more);
    notice=node('div','');notice.className='viewer-notice';notice.hidden=true;
    const noticeText=node('span','');noticeText.setAttribute('role','status');
    const undo=node('button','Undo');undo.type='button';undo.className='viewer-notice-undo';undo.dataset.viewerUndo='';
    const dismiss=node('button','×');dismiss.type='button';dismiss.className='viewer-notice-close';dismiss.setAttribute('aria-label','Dismiss message');
    notice.append(noticeText,undo,dismiss);d.body.append(notice);
    dismiss.onclick=()=>{undoEntry=null;notice.hidden=true;(grid.querySelector('a,button')??nav.querySelector('[aria-current]'))?.focus({preventScroll:true});};
    undo.onclick=async()=>{
      if(ended||undoing||!undoEntry)return;
      const entry=undoEntry;undoing=true;revision++;undo.disabled=true;noticeText.textContent='Restoring…';let restored=false;
      try{
        const r=await account.client.rpc('fas_set_viewer_action',{content_key:entry.key,action_key:'saved',enabled:true});
        if(ended)return;
        if(r.error||r.data?.saved!==true)throw Error('Could not restore this piece. Please try again.');
        revision++;restored=true;publishViewerChanges(w);
        if(undoEntry===entry){undoEntry=null;noticeText.textContent=kind==='favourites'?'Restored to favourites.':'Restored to saved for later.';if(d.activeElement===undo)dismiss.focus({preventScroll:true});undo.hidden=true;}
      }catch(e){if(!ended&&undoEntry===entry)noticeText.textContent=e.message;}
      finally{undoing=false;undo.disabled=false;if(!ended&&(restored||refreshQueued)){refreshQueued=false;void load(true);}}
    };
    function makeCard(item) {
      const image = item.source === 'file' ? item.image : publicCoverUrl(item.cover,account.imageBase);
      const template = d.createElement('template');
      template.innerHTML = createCardMarkup({type:item.type,category:({story:'stories',game:'games',tool:'tools',video:'videos'})[item.type] ?? item.type,url:item.url,title:item.title,card:{title:item.title,description:item.summary,image,imageAlt:item.image_alt ?? item.cover?.alt ?? ''}});
      return template.content.firstElementChild;
    }
    function reconcile(items, replace) {
      const existing = new Map([...grid.children].map(card=>[card.dataset.viewerContent,card]));
      const active = grid.contains(d.activeElement) ? d.activeElement : null;
      const focusedIndex = active ? [...grid.children].indexOf(active.closest('.content-grid-card')) : -1;
      const wanted = new Set(items.map(item=>item.url));
      if (replace) for (const [key,card] of existing) if (!wanted.has(key)) card.remove();
      let position = replace ? grid.firstElementChild : null, added = false;
      for (const item of items) {
        const previous = existing.get(item.url), card = previous ?? makeCard(item);
        if (!previous) added = true;
        if (replace) { if (card !== position) grid.insertBefore(card,position); position = card.nextElementSibling; }
        else if (!card.isConnected) grid.append(card);
      }
      if (active) {
        if (active.isConnected) active.focus({preventScroll:true});
        else (grid.children[Math.min(focusedIndex,grid.children.length-1)]?.querySelector('button,a') ?? nav.querySelector('[aria-current]'))?.focus({preventScroll:true});
      }
      if (added) w.dispatchEvent(new CustomEvent('fas-viewer-collection-rendered'));
    }
    async function load(refresh = false) {
      if (ended) return;
      if (undoing) { refreshQueued=true;return; }
      if (loading) { if (refresh) refreshQueued = true; return; }
      loading = true; more.disabled = true; retryRefresh = refresh;
      if (!refresh) status.textContent = 'Loading your collection…';
      const before = revision, limit = refresh ? Math.max(1,loadedPages) : loadedPages===0?initialPages:1;
      let next = refresh ? null : cursor, fetched = 0;
      const items = new Map();
      try {
        do {
          const r = await account.client.rpc('fas_my_viewer_collection',{collection_key:kind,before_time:next?.saved_at ?? null,after_id:next?.id ?? null});
          if (ended) return;
          if (r.error || !Array.isArray(r.data?.items)) throw Error('Your collection could not load. Please try again.');
          for (const item of r.data.items) items.set(item.url,item);
          next = r.data.next_cursor; fetched++;
        } while (next && fetched < limit);
        // A local removal during a read must not reappear from its old snapshot.
        if (before !== revision) { refreshQueued = true; return; }
        reconcile([...items.values()],refresh);
        loadedPages = refresh ? fetched : loadedPages+fetched;
        cursor = next; more.hidden = !cursor; more.textContent = 'Load more'; retryRefresh = false;
        status.textContent = grid.children.length ? '' : 'Nothing here yet. Use the save or favourite button on a piece or card to add it. Published pieces appear here while they are available.';
        if(!browseRestored){browseRestored=true;browsing.restore();}
      } catch (e) {
        if (!ended) { status.textContent = e.message; more.hidden = false; more.textContent = 'Try again'; }
      } finally {
        loading = false; more.disabled = false;
        if (refreshQueued && !ended) { refreshQueued = false; void load(true); }
      }
    }
    const changed = event => {
      if (ended || event.detail?.saved !== false) return;
      revision++;
      const card = [...grid.children].find(c=>c.dataset.viewerContent === event.detail.key);
      if (!card) return;
      const title=card.querySelector('h3')?.textContent??'this piece';
      undoEntry={key:event.detail.key,title};noticeText.textContent='Removed “'+title+'”.';notice.hidden=false;undo.hidden=false;undo.disabled=undoing;
      const focused=card.contains(d.activeElement)||event.detail.restoreFocus;card.remove();if(focused)undo.focus({preventScroll:true});
      if (!grid.children.length) {
        status.textContent = cursor ? 'Removed. Load more to see other saved pieces.' : 'Nothing here yet. Use the save or favourite button on a piece or card to add it.';
      }
    };
    w.addEventListener('fas-viewer-action-change',changed);
    stopSync = watchViewerChanges(()=>void load(true),{window:w,document:d});
    more.onclick = () => void load(retryRefresh);
    w.addEventListener('pagehide',()=>{ended = true;undoEntry=null;notice.remove();browsing.dispose();stop?.();stopSync?.();w.removeEventListener('fas-viewer-action-change',changed);},{once:true});
    await load();
  } catch (e) { if (!ended) fail(e.message); }
}
const root = typeof document !== 'undefined' ? document.querySelector('[data-viewer-collection]') : null;
if (root) void mountViewerCollection(root);
export {mountViewerCollection};
