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
  return {
    adapter,
    get persistent() { return persistent; },
    get hasSession() { return Boolean(adapter.getItem(SESSION_KEY)); },
    clear() { for (const key of [SESSION_KEY, SESSION_KEY + '-user', SESSION_KEY + '-code-verifier']) adapter.removeItem(key); },
  };
}
