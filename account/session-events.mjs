import { clearNavigationSnapshot } from './navigation-shell.mjs';
// SDK events normally coordinate remembered tabs. The storage event also clears
// private UI if BroadcastChannel is unavailable in the browser.
export function watchSessionEnd(local, onEnd, events = globalThis.window) {
  const end = () => { clearNavigationSnapshot(); onEnd(); };
  const listener = event => {
    if (local.storage.remembered && (event.key === local.storage.key || event.key === null) && event.newValue === null) end();
  };
  const { data } = local.client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') end(); });
  events?.addEventListener('storage', listener);
  return () => { data.subscription.unsubscribe(); events?.removeEventListener('storage', listener); };
}
