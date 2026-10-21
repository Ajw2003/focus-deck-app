// focus-deck-app/js/comfort.test.mjs -- run with: node --test app/js/comfort.test.mjs
//
// The Comfort settings (#203): five separately stamped values. Defaults, setters that stamp and save,
// an unknown value falling back to the default, and mergeStates keeping the newest stamp per value.
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const { state, serializeState, loadState } = await import('./state.js');
const { mergeStates } = await import('./merge.js');
const M = await import('./mutations.js');
const C = await import('./comfort.js');

test('defaults: system movement, softer colours on, 7 cards, amber, category then priority then due', () => {
  assert.deepStrictEqual([C.getMotion(state), C.getCalm(state), C.getChunk(state), C.getOverdue(state)], ['system', true, 7, 'amber']);
  assert.deepStrictEqual(C.getColourBy(state), ['category', 'priority', 'due']);
  store['focusdeck-state-v1'] = JSON.stringify({ projects: [] });
  const loaded = loadState();
  assert.strictEqual(loaded.comfort.chunk.value, 7);
  assert.strictEqual(loaded.comfort.chunk.updatedAt, 0);
});

test('each setter stamps only its own value, saves, and survives load', () => {
  const before = Date.now();
  assert.strictEqual(M.setChunk(10), true);
  assert.ok(state.comfort.chunk.updatedAt >= before);
  assert.strictEqual(state.comfort.motion.updatedAt, 0, 'the others are not stamped');
  assert.strictEqual(M.setMotion('off'), true);
  assert.strictEqual(M.setCalmColours(false), true);
  assert.strictEqual(M.setOverdueStyle('red'), true);
  assert.strictEqual(M.setColourBy(['label:c1', 'due', 'category', 'priority']), true);
  const saved = JSON.parse(serializeState(state)).comfort;
  assert.deepStrictEqual([saved.motion.value, saved.calm.value, saved.chunk.value, saved.overdue.value], ['off', false, 10, 'red']);
  const loaded = loadState();
  assert.deepStrictEqual(C.getColourBy(loaded), ['label:c1', 'due', 'category', 'priority']);
  assert.strictEqual(C.getMotion(loaded), 'off');
});

test('an unknown value is refused by the setter and falls back to the default on load', () => {
  assert.strictEqual(M.setMotion('sideways'), false);
  assert.strictEqual(M.setChunk(6), false);
  assert.strictEqual(M.setOverdueStyle('purple'), false);
  assert.strictEqual(M.setCalmColours('yes'), false);
  assert.strictEqual(C.getMotion(state), 'off', 'a refused value changes nothing');
  store['focusdeck-state-v1'] = JSON.stringify({ projects: [], comfort: {
    motion: { value: 'sideways', updatedAt: 5 }, calm: { value: 'yes', updatedAt: 5 }, chunk: { value: 6, updatedAt: 5 },
    overdue: { value: 'purple', updatedAt: 5 }, colourBy: { value: ['bogus', 'due', 'due'], updatedAt: 5 } } });
  const l = loadState();
  assert.deepStrictEqual([C.getMotion(l), C.getCalm(l), C.getChunk(l), C.getOverdue(l)], ['system', true, 7, 'amber']);
  assert.deepStrictEqual(C.getColourBy(l), ['due', 'category', 'priority'], 'unknown and repeated dropped, missing built-ins added');
});

test('merge: each value takes the newest stamp on its own; absent on one side keeps the other', () => {
  const base = { projects: [], inbox: [], categories: [] };
  const mk = (c) => Object.assign({}, base, { comfort: c });
  const local = mk({ motion: { value: 'off', updatedAt: 200 }, chunk: { value: 5, updatedAt: 100 } });
  const remote = mk({ motion: { value: 'on', updatedAt: 100 }, chunk: { value: 10, updatedAt: 300 }, overdue: { value: 'red', updatedAt: 50 } });
  const m = mergeStates(local, remote).comfort;
  assert.strictEqual(m.motion.value, 'off', 'local newer wins for motion');
  assert.strictEqual(m.chunk.value, 10, 'remote newer wins for chunk');
  assert.strictEqual(m.overdue.value, 'red', 'only remote has it: taken');
  const back = mergeStates(remote, local).comfort;
  assert.deepStrictEqual([back.motion.value, back.chunk.value], ['off', 10], 'the same result the other way round');
  assert.ok(!('comfort' in mergeStates(base, base)), 'neither has any: nothing invented');
  assert.strictEqual(mergeStates(local, base).comfort.motion.value, 'off', 'remote has none: keep local');
});
