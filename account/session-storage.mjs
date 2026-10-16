export const SESSION_KEY = 'fas-local-account-preview';

export function createSessionStorage(candidate, { shared = false, namespace = SESSION_KEY } = {}) {
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
        try { const value = storage.getItem(key); if (value !== null) memory.set(key, value); else memory.delete(key); return value; }
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
  const tabKey = namespace + '-tab-id';
  let tabId = adapter.getItem(tabKey);
  if (!/^[0-9a-f-]{36}$/.test(tabId ?? '')) {
    tabId = globalThis.crypto.randomUUID();
    adapter.setItem(tabKey, tabId);
  }
  const key = shared ? namespace + '-remembered' : namespace + '-' + tabId;
  const previous = namespace === SESSION_KEY && !shared && adapter.getItem(SESSION_KEY);
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

// The shared key also gives the SDK one refresh lock and one Auth event channel
// across remembered tabs. Tab-only sessions keep separate keys/channels.
export function createBrowserSessionStorage({ namespace, remember, sharedStorage, tabStorage } = {}) {
  const safely = name => { try { return globalThis[name]; } catch { return null; } };
  const tab = tabStorage ?? safely('sessionStorage');
  const shared = sharedStorage ?? safely('localStorage');
  const prefix = 'fas-account-' + namespace;
  const modeKey = prefix + '-mode';
  const read = (storage, key) => { try { return storage?.getItem(key); } catch { return null; } };
  const write = (storage, key, value) => { try { storage?.setItem(key, value); } catch { /* Memory fallback remains usable. */ } };
  const usable = storage => {
    try { const probe = prefix + '-probe'; storage.setItem(probe, 'test'); storage.removeItem(probe); return true; }
    catch { return false; }
  };
  // Existing tab sessions remain tab-only until the person explicitly signs in
  // again with Keep me signed in selected. Never silently persist old tokens.
  const legacyTab = createSessionStorage(tab ?? { setItem() { throw Error('blocked'); } });
  const legacy = legacyTab.hasSession;
  const requested = remember ?? (read(tab, modeKey) !== 'tab' && !legacy);
  const remembered = requested && usable(shared);
  const result = createSessionStorage((remembered ? shared : tab) ?? { setItem() { throw Error('blocked'); } }, { shared: remembered, namespace: prefix });
  if (legacy && remember === undefined && !result.hasSession) {
    result.adapter.setItem(result.key, legacyTab.adapter.getItem(legacyTab.key));
    legacyTab.clear();
  }
  write(tab, modeKey, remembered ? 'remembered' : 'tab');
  return { ...result, get persistent() { return result.persistent; }, get hasSession() { return result.hasSession; }, remembered, requestedRemember: requested };
}
