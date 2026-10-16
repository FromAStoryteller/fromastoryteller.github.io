export const CHOICE_KEY = 'fas-site-storage-choice';
export const CHOICE_DAYS = 180;
export const OPTIONAL_KEYS = {
  'from-a-storyteller-theme': 'preferences',
  rallyClash_SoundEnabled: 'preferences', rallyClash_MasterVolume: 'preferences',
  rallyClash_bestRally: 'gameRecords', 'games.brickBlitz.highscore': 'gameRecords',
};
export function parseChoice(value, now = Date.now()) {
  try {
    const d = JSON.parse(value);
    return d?.version === 1 && typeof d.preferences === 'boolean' && typeof d.gameRecords === 'boolean' && Number.isFinite(d.expiresAt) && d.expiresAt > now && d.expiresAt <= now + CHOICE_DAYS * 86400000 ? d : null;
  } catch { return null; }
}
let memoryChoice = null;
function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }
export function readChoice(storage = browserStorage()) {
  if (memoryChoice) return parseChoice(JSON.stringify(memoryChoice));
  try { return storage ? parseChoice(storage.getItem(CHOICE_KEY)) : parseChoice(JSON.stringify(memoryChoice)); } catch { return parseChoice(JSON.stringify(memoryChoice)); }
}
export function setChoice({ preferences, gameRecords }, storage = browserStorage()) {
  const value = { version: 1, preferences: preferences === true, gameRecords: gameRecords === true, expiresAt: Date.now() + CHOICE_DAYS * 86400000 };
  memoryChoice = null;
  try { if (storage) storage.setItem(CHOICE_KEY, JSON.stringify(value)); else memoryChoice = value; } catch { memoryChoice = value; }
  for (const [key, category] of Object.entries(OPTIONAL_KEYS)) if (!value[category]) { try { storage?.removeItem(key); } catch {} }
  return value;
}
export function optionalStorageAllowed(key, storage = browserStorage()) {
  const category = OPTIONAL_KEYS[key]; return !!category && readChoice(storage)?.[category] === true;
}
