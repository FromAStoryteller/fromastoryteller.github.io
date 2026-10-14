const KEY = 'fas-local-pending-email';
export function savePendingEmail(email, storage) {
  try { (storage ?? globalThis.sessionStorage).setItem(KEY, JSON.stringify({ email: email.trim(), requestedAt: Date.now() })); } catch { /* A manually entered email still works. */ }
}
export function readPendingEmail(storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.sessionStorage).getItem(KEY));
    if (typeof value?.email === 'string' && value.email.length <= 254 && Number.isFinite(value.requestedAt) && Date.now() - value.requestedAt < 3600000) return value;
  } catch { /* No cross-page email is available. */ }
  return null;
}
export function clearPendingEmail(storage) { try { (storage ?? globalThis.sessionStorage).removeItem(KEY); } catch {} }
