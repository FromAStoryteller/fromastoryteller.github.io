// Cross-tab messages carry no account, content or choice data. They only request
// a fresh authenticated read. No browser storage or polling is required.
const pages = new WeakMap();
function pageSync(w, d) {
  let page = pages.get(w);
  if (page) return page;
  const listeners = new Set();
  let channel, timer = null;
  const request = () => {
    if (d.visibilityState === 'hidden' || timer !== null) return;
    timer = w.setTimeout(() => {
      timer = null;
      if (d.visibilityState !== 'hidden') for (const listener of listeners) listener();
    }, 100);
  };
  try {
    channel = new w.BroadcastChannel('fas-viewer-actions-v1');
    channel.onmessage = event => { if (event.data === 'changed') request(); };
  } catch { /* Focus, visibility and reconnect still refresh without a channel. */ }
  const visible = () => { if (d.visibilityState === 'visible') request(); };
  w.addEventListener('focus', request);
  w.addEventListener('online', request);
  d.addEventListener('visibilitychange', visible);
  page = { listeners, publish() { try { channel?.postMessage('changed'); } catch {} }, close() {
    w.clearTimeout(timer); channel?.close();
    w.removeEventListener('focus', request); w.removeEventListener('online', request);
    d.removeEventListener('visibilitychange', visible); pages.delete(w);
  } };
  pages.set(w, page);
  return page;
}
export function watchViewerChanges(listener, { window: w = window, document: d = w.document } = {}) {
  const page = pageSync(w, d);
  page.listeners.add(listener);
  let stopped = false;
  return () => { if (stopped) return; stopped = true; page.listeners.delete(listener); if (!page.listeners.size) page.close(); };
}
export function publishViewerChanges(w = window) { pages.get(w)?.publish(); }
