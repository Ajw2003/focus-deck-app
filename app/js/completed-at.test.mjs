// run with: node --test app/js/completed-at.test.mjs
// task.completedAt (#145): stamped when a task becomes done, cleared on reopen, kept by a Gist merge.
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const { state } = await import('./state.js');
const { mergeStates } = await import('./merge.js');
const M = await import('./mutations.js');

state.projects = [{ id: 'p', name: 'P', color: '#333', tasks: [{ id: 't1', title: 'One', status: 'next', updatedAt: 1 }] }];
state.completedLog = [];
const t = () => state.projects[0].tasks[0];

test('becoming done stamps completedAt; reopening clears it', () => {
  const before = Date.now();
  M.setTaskStatus('t1', 'done');
  assert.ok(t().completedAt >= before && t().completedAt <= Date.now());
  M.setTaskStatus('t1', 'doing');
  assert.strictEqual('completedAt' in t(), false);
  M.toggleTask('t1', 'p');
  assert.strictEqual(typeof t().completedAt, 'number', 'ticking goes the same way');
  M.toggleTask('t1', 'p');
  assert.strictEqual('completedAt' in t(), false);
});

test('a second done does not restamp', () => {
  M.setTaskStatus('t1', 'done');
  const at = t().completedAt;
  M.setTaskStatus('t1', 'done');
  assert.strictEqual(t().completedAt, at);
});

test('merge keeps completedAt (tasks merge whole, newest updatedAt wins)', () => {
  const side = (task) => ({ projects: [{ id: 'p', name: 'P', tasks: [task] }], inbox: [], categories: [], githubSync: {} });
  const merged = mergeStates(side({ id: 'a', status: 'next', updatedAt: 5 }), side({ id: 'a', status: 'done', updatedAt: 9, completedAt: 9 }));
  assert.strictEqual(merged.projects[0].tasks[0].completedAt, 9);
  const reopened = mergeStates(side({ id: 'a', status: 'next', updatedAt: 12 }), side({ id: 'a', status: 'done', updatedAt: 9, completedAt: 9 }));
  assert.strictEqual(reopened.projects[0].tasks[0].completedAt, undefined);
});
