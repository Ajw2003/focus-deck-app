// focus-deck-app/js/choosing-mode.test.mjs -- run with: node --test app/js/choosing-mode.test.mjs
//
// The "Choosing a card" setting (#120): state.choosingMode defaults, survives save and load, the
// setter refuses unknown modes, and mergeStates keeps the newer stamp (same rule as dueDefaults).
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const { state, serializeState, loadState } = await import('./state.js');
const { mergeStates } = await import('./merge.js');
const M = await import('./mutations.js');

test('the default is tap twice, and a save from before this field loads with it', () => {
  assert.strictEqual(state.choosingMode.mode, 'twice');
  store['focusdeck-state-v1'] = JSON.stringify({ projects: [] });
  const loaded = loadState();
  assert.deepStrictEqual({ mode: loaded.choosingMode.mode, at: loaded.choosingMode.updatedAt }, { mode: 'twice', at: 0 });
});

test('setChoosingMode stamps and saves, survives load, and refuses unknown modes', () => {
  assert.strictEqual(M.setChoosingMode('swipe'), true);
  assert.strictEqual(state.choosingMode.mode, 'swipe');
  assert.ok(state.choosingMode.updatedAt > 0);
  assert.strictEqual(JSON.parse(serializeState(state)).choosingMode.mode, 'swipe', 'serializeState carries it');
  assert.strictEqual(loadState().choosingMode.mode, 'swipe', 'and load returns it');
  assert.strictEqual(M.setChoosingMode('hover'), false);
  assert.strictEqual(state.choosingMode.mode, 'swipe', 'a refused mode changes nothing');
});

test('a hand-edited unknown mode loads as the default', () => {
  store['focusdeck-state-v1'] = JSON.stringify({ projects: [], choosingMode: { mode: 'hover', updatedAt: 5 } });
  assert.strictEqual(loadState().choosingMode.mode, 'twice');
});

test('merge: choosingMode newest updatedAt wins, either direction; absent on one side keeps the other', () => {
  const base = { projects: [], inbox: [], categories: [], githubSync: {} };
  const older = Object.assign({}, base, { choosingMode: { mode: 'tap', updatedAt: 100 } });
  const newer = Object.assign({}, base, { choosingMode: { mode: 'swipe', updatedAt: 200 } });
  assert.strictEqual(mergeStates(older, newer).choosingMode.mode, 'swipe', 'remote newer wins');
  assert.strictEqual(mergeStates(newer, older).choosingMode.mode, 'swipe', 'local newer wins');
  assert.strictEqual(mergeStates(older, base).choosingMode.mode, 'tap', 'remote has none: keep local');
  assert.strictEqual(mergeStates(base, newer).choosingMode.mode, 'swipe', 'local has none: take remote');
  assert.ok(!('choosingMode' in mergeStates(base, base)), 'neither has one: nothing invented');
  const tie = mergeStates(older, Object.assign({}, base, { choosingMode: { mode: 'swipe', updatedAt: 100 } }));
  assert.strictEqual(tie.choosingMode.mode, 'tap', 'a tie keeps the local copy');
});
