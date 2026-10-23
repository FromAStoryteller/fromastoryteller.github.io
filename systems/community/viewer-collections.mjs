import { connectViewerAccount } from './viewer-actions.mjs';
import { createCardMarkup } from '../content/content-system.js';
import { publicCoverUrl } from './profiles.mjs';
import { signInHref } from '../../account/return-path.mjs';
import { watchViewerChanges, publishViewerChanges } from './viewer-sync.mjs';
import { createBrowseHistory } from '../content/browse-state.mjs';

const searchable = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();

async function mountViewerCollection(root, { connect = connectViewerAccount } = {}) {
  const d = root.ownerDocument, w = d.defaultView, kind = root.dataset.viewerCollection;
  const title = kind === 'favourites' ? 'Favourites' : 'Saved for later';
  const types = kind === 'favourites' ? [['game','Games'],['tool','Tools']] : [['story','Stories'],['blog','Blog'],['video','Videos']];
  let account, ended = false, cursor = null, loading = false, stop, stopSync, notice, searchTimer;
  let hasLoaded = false, cache = new Map(), visiblePages = 1, query = '', type = 'all';
  let revision = 0, refreshQueued = false, viewQueued = false, retryRefresh = false, browseRestored = false, undoing = false, undoEntry = null;
  const browsing = createBrowseHistory(() => ({pages:visiblePages,filter:type,query}), {window:w,document:d});
  visiblePages = Number.isInteger(browsing.state?.pages) ? Math.max(1,Math.min(50,browsing.state.pages)) : 1;
  if (types.some(([key]) => key === browsing.state?.filter)) type = browsing.state.filter;
  if (typeof browsing.state?.query === 'string') query = browsing.state.query.slice(0,160);
  const filtered = () => query.trim() !== '' || type !== 'all';
  const matches = items => {
    const words = searchable(query).trim().split(/\s+/).filter(Boolean);
    return [...items.values()].filter(item => (type === 'all' || item.type === type) && words.every(word => searchable(item.title+' '+(item.summary ?? '')).includes(word)));
  };
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
    if (!account) { browsing.dispose(); fail('Sign in to see your private '+title.toLowerCase()+'.',true); return; }
    stop = account.subscribe(() => {
      ended = true; stopSync?.(); w.clearTimeout(searchTimer); cache.clear(); query = ''; undoEntry = null;
      browsing.clear(); browsing.dispose();
      fail('Your account changed. Sign in again to view this collection.',true);
    });
    root.replaceChildren(node('h1',title),node('p',kind === 'favourites'
      ? 'Games and tools you want to return to. Your favourites are private.'
      : 'Pieces you have kept for another time. Your saved list is private.'));
    const nav = node('nav','');
    nav.className = 'viewer-collection-navigation'; nav.setAttribute('aria-label','Your collections');
    for (const [text,href] of [['Saved for later','/account/saved/'],['Favourites','/account/favourites/'],['Your history','/account/history/']]) {
      const a = node('a',text); a.href = href; a.className = 'account-secondary';
      if (href === w.location.pathname) a.setAttribute('aria-current','page');
      nav.append(a);
    }
    const controls = node('form',''); controls.className = 'viewer-collection-filters'; controls.setAttribute('role','search'); controls.setAttribute('aria-label','Search '+title.toLowerCase());
    const searchField = node('div',''); searchField.className = 'viewer-collection-field';
    const searchLabel = node('label',kind === 'favourites' ? 'Search favourites' : 'Search saved pieces');
    const search = node('input',''); search.type = 'search'; search.name = 'collection-search'; search.maxLength = 160; search.placeholder = 'Title or description'; search.value = query; search.autocomplete = 'off'; search.setAttribute('aria-controls','viewer-collection-grid'); search.id = 'viewer-collection-search'; searchLabel.htmlFor = search.id; searchField.append(searchLabel,search);
    const typeField = node('div',''); typeField.className = 'viewer-collection-field';
    const typeLabel = node('label','Content type'), select = node('select',''); select.name = 'collection-type'; select.setAttribute('aria-controls','viewer-collection-grid');
    for (const [value,label] of [['all','All types'],...types]) { const option = node('option',label); option.value = value; select.append(option); }
    select.value = type; select.id = 'viewer-collection-type'; typeLabel.htmlFor = select.id; typeField.append(typeLabel,select);
    const clear = node('button','Clear filters'); clear.type = 'button'; clear.className = 'account-secondary'; clear.hidden = !filtered();
    controls.append(searchField,typeField,clear);
    const grid = node('div',''); grid.id = 'viewer-collection-grid'; grid.className = 'content-grid viewer-collection-grid';
    const status = node('p','Loading your collection…'); status.setAttribute('role','status');
    const more = node('button','Load more'); more.type = 'button'; more.className = 'account-secondary'; more.hidden = true;
    root.append(nav,controls,status,grid,more);
    notice = node('div',''); notice.className = 'viewer-notice'; notice.hidden = true;
    const noticeText = node('span',''); noticeText.setAttribute('role','status');
    const undo = node('button','Undo'); undo.type = 'button'; undo.className = 'viewer-notice-undo'; undo.dataset.viewerUndo = '';
    const dismiss = node('button','×'); dismiss.type = 'button'; dismiss.className = 'viewer-notice-close'; dismiss.setAttribute('aria-label','Dismiss message');
    notice.append(noticeText,undo,dismiss); d.body.append(notice);
    dismiss.onclick = () => { undoEntry = null; notice.hidden = true; (grid.querySelector('a,button') ?? search).focus({preventScroll:true}); };
    undo.onclick = async () => {
      if (ended || undoing || !undoEntry) return;
      const entry = undoEntry; undoing = true; revision++; undo.disabled = true; noticeText.textContent = 'Restoring…'; let restored = false;
      try {
        const r = await account.client.rpc('fas_set_viewer_action',{content_key:entry.key,action_key:'saved',enabled:true});
        if (ended) return;
        if (r.error || r.data?.saved !== true) throw Error('Could not restore this piece. Please try again.');
        revision++; restored = true; publishViewerChanges(w);
        if (undoEntry === entry) {
          undoEntry = null; noticeText.textContent = kind === 'favourites' ? 'Restored to favourites.' : 'Restored to saved for later.';
          if (d.activeElement === undo) dismiss.focus({preventScroll:true}); undo.hidden = true;
        }
      } catch (e) { if (!ended && undoEntry === entry) noticeText.textContent = e.message; }
      finally { undoing = false; undo.disabled = false; if (!ended && (restored || refreshQueued || viewQueued)) { const refresh = restored || refreshQueued; refreshQueued = viewQueued = false; void load(refresh); } }
    };
    function makeCard(item) {
      const image = item.source === 'file' ? item.image : publicCoverUrl(item.cover,account.imageBase);
      const template = d.createElement('template');
      template.innerHTML = createCardMarkup({type:item.type,category:({story:'stories',game:'games',tool:'tools',video:'videos'})[item.type] ?? item.type,url:item.url,title:item.title,card:{title:item.title,description:item.summary,image,imageAlt:item.image_alt ?? item.cover?.alt ?? ''}});
      return template.content.firstElementChild;
    }
    function reconcile(items) {
      const existing = new Map([...grid.children].map(card => [card.dataset.viewerContent,card]));
      const active = grid.contains(d.activeElement) ? d.activeElement : null;
      const focusedIndex = active ? [...grid.children].indexOf(active.closest('.content-grid-card')) : -1;
      const wanted = new Set(items.map(item => item.url));
      for (const [key,card] of existing) if (!wanted.has(key)) card.remove();
      let position = grid.firstElementChild, added = false;
      for (const item of items) {
        const previous = existing.get(item.url), card = previous ?? makeCard(item);
        if (!previous) added = true;
        if (card !== position) grid.insertBefore(card,position); position = card.nextElementSibling;
      }
      if (active) {
        if (active.isConnected) active.focus({preventScroll:true});
        else (grid.children[Math.min(focusedIndex,grid.children.length-1)]?.querySelector('button,a') ?? search).focus({preventScroll:true});
      }
      if (added) w.dispatchEvent(new CustomEvent('fas-viewer-collection-rendered'));
    }
    function renderView(pending = false) {
      const found = matches(cache), shown = found.slice(0,visiblePages*48);
      reconcile(shown); clear.hidden = !filtered();
      grid.setAttribute('aria-busy',String(pending));
      more.hidden = !cursor && found.length <= shown.length; more.disabled = pending; more.textContent = 'Load more';
      if (pending) status.textContent = filtered() ? 'Searching your collection…' : 'Loading your collection…';
      else if (!shown.length) status.textContent = filtered() ? 'No pieces match your search and filters.' : 'Nothing here yet. Use the save or favourite button on a piece or card to add it. Published pieces appear here while they are available.';
      else status.textContent = filtered() ? 'Showing '+shown.length+' matching '+(shown.length === 1 ? 'piece.' : 'pieces.') : '';
    }
    async function load(refresh = false) {
      if (ended) return;
      if (undoing || loading) { if (refresh) refreshQueued = true; else viewQueued = true; return; }
      loading = true; retryRefresh = refresh; more.disabled = true; grid.setAttribute('aria-busy','true');
      if (!refresh || filtered()) status.textContent = filtered() ? 'Searching your collection…' : 'Loading your collection…';
      const before = revision, items = refresh ? new Map() : new Map(cache), cursors = new Set();
      let next = refresh ? null : cursor, fetched = !refresh && hasLoaded;
      try {
        // Search further pages until this view is full or the collection ends.
        // Cached pages can be filtered again without another account request.
        while (!fetched || (next && matches(items).length < visiblePages*48)) {
          const cursorKey = JSON.stringify(next);
          if (cursors.has(cursorKey)) throw Error('Your collection could not load. Please try again.');
          cursors.add(cursorKey);
          const r = await account.client.rpc('fas_my_viewer_collection',{collection_key:kind,before_time:next?.saved_at ?? null,after_id:next?.id ?? null});
          if (ended) return;
          if (r.error || !Array.isArray(r.data?.items)) throw Error('Your collection could not load. Please try again.');
          for (const item of r.data.items) items.set(item.url,item);
          next = r.data.next_cursor; fetched = true;
          if (before !== revision) { refreshQueued = true; return; }
        }
        // A local removal during a read must not reappear from its old snapshot.
        if (before !== revision) { refreshQueued = true; return; }
        cache = items; cursor = next; hasLoaded = true; retryRefresh = false; renderView();
        if (!browseRestored) { browseRestored = true; browsing.restore(); }
      } catch (e) {
        if (!ended) { grid.setAttribute('aria-busy','false'); status.textContent = e.message; more.hidden = false; more.textContent = 'Try again'; }
      } finally {
        loading = false; more.disabled = false;
        if (!ended && (refreshQueued || viewQueued)) { const refreshNext = refreshQueued; refreshQueued = viewQueued = false; void load(refreshNext); }
      }
    }
    function changeView(immediate = false) {
      if (ended) return;
      w.clearTimeout(searchTimer); query = search.value.slice(0,160); type = select.value; visiblePages = 1;
      renderView(true); browsing.remember();
      if (immediate) void load(); else searchTimer = w.setTimeout(() => void load(),180);
    }
    search.addEventListener('input',() => changeView()); select.addEventListener('change',() => changeView(true));
    controls.addEventListener('submit',event => { event.preventDefault(); changeView(true); });
    clear.onclick = () => { search.value = ''; select.value = 'all'; changeView(true); search.focus({preventScroll:true}); };
    const changed = event => {
      if (ended || event.detail?.saved !== false) return;
      revision++; cache.delete(event.detail.key);
      const card = [...grid.children].find(c => c.dataset.viewerContent === event.detail.key);
      if (!card) return;
      const pieceTitle = card.querySelector('h3')?.textContent ?? 'this piece';
      undoEntry = {key:event.detail.key}; noticeText.textContent = 'Removed “'+pieceTitle+'”.'; notice.hidden = false; undo.hidden = false; undo.disabled = undoing;
      const focused = card.contains(d.activeElement) || event.detail.restoreFocus; card.remove(); renderView(loading);
      if (focused) undo.focus({preventScroll:true});
    };
    w.addEventListener('fas-viewer-action-change',changed);
    stopSync = watchViewerChanges(() => void load(true),{window:w,document:d});
    more.onclick = () => { if (more.textContent === 'Load more') visiblePages++; browsing.remember(); void load(retryRefresh); };
    w.addEventListener('pagehide',() => {
      ended = true; undoEntry = null; w.clearTimeout(searchTimer); cache.clear(); notice.remove(); browsing.dispose(); stop?.(); stopSync?.(); w.removeEventListener('fas-viewer-action-change',changed);
    },{once:true});
    await load();
  } catch (e) { if (!ended) fail(e.message); }
}
const root = typeof document !== 'undefined' ? document.querySelector('[data-viewer-collection]') : null;
if (root) void mountViewerCollection(root);
export {mountViewerCollection};
