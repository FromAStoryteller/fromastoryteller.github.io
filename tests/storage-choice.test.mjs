import test from 'node:test';
import assert from 'node:assert/strict';
import { CHOICE_KEY, OPTIONAL_KEYS, parseChoice, readChoice, setChoice, optionalStorageAllowed } from '../systems/privacy/storage-choice.mjs';
import { Storage } from '../systems/games/storage.js';
function storage() { const data = new Map(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; }
test('No choice, malformed/expired choices and unregistered keys never enable optional storage', () => {
  const s = storage(); assert.equal(optionalStorageAllowed('from-a-storyteller-theme', s), false);
  assert.equal(parseChoice('{broken'), null);
  assert.equal(parseChoice(JSON.stringify({ version: 1, preferences: true, gameRecords: true, expiresAt: Date.now() - 1 })), null);
  setChoice({ preferences: true, gameRecords: true }, s);
  assert.equal(optionalStorageAllowed('unexpected-tracker', s), false);
});
test('Choices are independent; withdrawing removes only the named optional keys', () => {
  const s = storage(); for (const k of Object.keys(OPTIONAL_KEYS)) s.setItem(k, 'saved'); s.setItem('unrelated-account-data', 'keep');
  setChoice({ preferences: true, gameRecords: false }, s);
  assert.equal(optionalStorageAllowed('from-a-storyteller-theme', s), true);
  assert.equal(s.getItem('games.brickBlitz.highscore'), null);
  setChoice({ preferences: false, gameRecords: false }, s);
  assert.equal(s.getItem('from-a-storyteller-theme'), null);
  assert.equal(s.getItem('unrelated-account-data'), 'keep');
  assert.equal(readChoice(s).preferences, false);
  s.removeItem(CHOICE_KEY); assert.equal(readChoice(s), null);
});
test('Actual game storage neither reads nor writes records before permission; withdrawal blocks future writes', () => {
  const s = storage(); globalThis.localStorage = s;
  try {
    s.setItem('games.brickBlitz.highscore', '99');
    assert.equal(Storage.load('games.brickBlitz.highscore', 0), 0);
    Storage.save('games.brickBlitz.highscore', 100); assert.equal(s.getItem('games.brickBlitz.highscore'), '99');
    setChoice({ preferences: false, gameRecords: true }, s);
    assert.equal(Storage.load('games.brickBlitz.highscore', 0), 99);
    Storage.save('games.brickBlitz.highscore', 101); assert.equal(Storage.load('games.brickBlitz.highscore', 0), 101);
    setChoice({ preferences: false, gameRecords: false }, s);
    Storage.save('games.brickBlitz.highscore', 102); assert.equal(s.getItem('games.brickBlitz.highscore'), null);
  } finally { delete globalThis.localStorage; }
});
test('Blocked storage retains only current-page choices without throwing', () => {
  const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
  assert.doesNotThrow(() => setChoice({ preferences: false, gameRecords: false }, blocked));
  assert.equal(readChoice(blocked).preferences, false);
});
