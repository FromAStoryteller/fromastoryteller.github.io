export const SESSION_KEY = 'fas-local-account-preview';

export function createSessionStorage(candidate) {
  const memory = new Map();
  let persistent = false;
  let storage;
  try {
    storage = candidate ?? globalThis.sessionStorage;
    const probe = SESSION_KEY + '-probe';
    storage.setItem(probe, 'test');
    storage.removeItem(probe);
    persistent = true;
  } catch { storage = null; }
  const adapter = {
    getItem(key) {
      if (persistent) {
        try { const value = storage.getItem(key); if (value !== null) memory.set(key, value); return value; }
        catch { persistent = false; }
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      if (persistent) { try { storage.setItem(key, value); } catch { persistent = false; } }
    },
    removeItem(key) {
      memory.delete(key);
      if (persistent) { try { storage.removeItem(key); } catch { persistent = false; } }
    },
  };
  // Supabase broadcasts events by storageKey. Independent sessionStorage tabs
  // need independent channel names; duplicated tabs may retain the same session.
  const tabKey = SESSION_KEY + '-tab-id';
  let tabId = adapter.getItem(tabKey);
  if (!/^[0-9a-f-]{36}$/.test(tabId ?? '')) {
    tabId = globalThis.crypto.randomUUID();
    adapter.setItem(tabKey, tabId);
  }
  const key = SESSION_KEY + '-' + tabId;
  const previous = adapter.getItem(SESSION_KEY);
  if (previous && !adapter.getItem(key)) {
    adapter.setItem(key, previous);
    for (const suffix of ['', '-user', '-code-verifier']) adapter.removeItem(SESSION_KEY + suffix);
  }
  return {
    adapter,
    key,
    get persistent() { return persistent; },
    get hasSession() { return Boolean(adapter.getItem(key)); },
    clear() { for (const suffix of ['', '-user', '-code-verifier']) adapter.removeItem(key + suffix); },
  };
}
