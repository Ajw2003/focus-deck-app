// focus-deck-app/js/focus-pick.test.mjs -- run with: node --test app/js/focus-pick.test.mjs
// pickFocus offers unblocked tasks first, biggest unblocker first (#191). See docs/4-systems/task-links.md
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
const { state } = await import('./state.js');
const M = await import('./mutations.js');

const seed = (tasks) => { state.projects.length = 0; state.projects.push({ id: 'p', name: 'P', color: '#fff', tasks }); };
const T = (id, extra) => ({ id, title: id, status: 'next', categoryIds: [], ...extra });

test('pickFocus never offers a blocked task, and always the biggest unblocker', () => {
  seed([T('big'), T('small'), T('w1', { waitsOn: ['big'] }), T('w2', { waitsOn: ['big'] }), T('w3', { waitsOn: ['small'] })]);
  for (let i = 0; i < 20; i++) { M.pickFocus(); assert.strictEqual(state.focus.taskId, 'big'); assert.ok(!state.focus.allBlocked); }
});

test('with everything blocked it picks from the whole pool and says so', () => {
  seed([T('a', { waitsOn: ['b'] }), T('b', { waitsOn: ['a'] })]);
  M.pickFocus();
  assert.ok(['a', 'b'].includes(state.focus.taskId) && state.focus.allBlocked === true);
});

test('pickForMe opens the first task by the Start here order, and "Not this one" offers the next', () => {
  seed([T('old'), T('hi', { priority: 'high' }), T('ur', { priority: 'urgent' }), T('dn', { status: 'doing' })]);
  assert.strictEqual(M.pickForMe(), true);
  assert.strictEqual(state.focus.taskId, 'dn');
  M.reroll(); assert.strictEqual(state.focus.taskId, 'ur');
  M.reroll(); assert.strictEqual(state.focus.taskId, 'hi');
  M.reroll(); assert.strictEqual(state.focus.taskId, 'dn', 'wraps round: the 4th task is not in Now, so it is never offered');
  seed([]);
  assert.strictEqual(M.pickForMe(), false);
});

test('"Not this one" prefers an unblocked task from the pool', () => {
  seed([T('x'), T('y'), T('z', { waitsOn: ['x'] })]);
  M.pickFocus();
  for (let i = 0; i < 20; i++) { state.focus.taskId = 'x'; M.reroll(); assert.strictEqual(state.focus.taskId, 'y'); }
});
