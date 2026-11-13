// #249: a thought needs a priority to be filed; the slip and the bulk panel show the pickers.
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const { state } = await import('./state.js');
const M = await import('./mutations.js');
const { fileSlip, bulkBlocker, bulkSort } = await import('./in-tray.js');
const { renderInTrayCard } = await import('./in-tray-view.js');
const { unsortedQueue } = await import('./render.js');

const fresh = () => ({ later: [], priority: null, due: '', projectId: null, selected: [], step: 0, sub: null, menu: false, find: '', title: null, notes: null, dueStages: null, facingFolder: null, facingFlag: null, currentKey: null });
function seed() {
  state.projects.length = 0; state.categories.length = 0; state.inbox.length = 0;
  state.projects.push({ id: 'pB', name: 'Home', color: '#3E8E5E', tasks: [] });
  state.inbox.push({ id: 'th1', text: 'Buy a card', createdAt: Date.now() - 60000 }, { id: 'th2', text: 'Email Ms Patel', createdAt: Date.now() });
}
const deps = () => ({ labelIdByName: (n) => n, fileInboxItem: M.fileInboxItem, updateTaskFields: () => {}, createIssue: () => {}, addTask: M.addTask, projects: state.projects });
const card = (u) => renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), u) });

test('priority is required to file a thought, singly or in bulk; a due date is stored', () => {
  seed();
  const cur = unsortedQueue(state)[0];
  assert.deepStrictEqual(fileSlip(cur, { projectId: 'pB', selected: [] }, deps()), { outcome: 'none' }, 'no priority: nothing filed');
  assert.strictEqual(M.fileInboxItem('th1', 'pB', [], {}), undefined, 'the mutation refuses too');
  assert.strictEqual(state.inbox.length, 2);
  const out = fileSlip(cur, { projectId: 'pB', selected: [], priority: 'urgent', deadline: '2026-12-15' }, deps());
  assert.strictEqual(out.task.priority, 'urgent');
  assert.strictEqual(out.task.deadline, '2026-12-15');
  seed();
  const th = unsortedQueue(state);
  assert.match(bulkBlocker(th, { projectId: 'pB', selected: [] }), /priority/);
  const done = bulkSort(th, { projectId: 'pB', selected: [], priority: 'low', deadline: '' }, deps());
  assert.strictEqual(done.filed, 2);
  assert.ok(state.projects[0].tasks.every((t) => t.priority === 'low'));
});

test('Sort priority step and bulk panel carry the pickers; Next waits for a priority', () => {
  seed();
  const none = card({ step: 2, projectId: 'pB' });
  assert.ok(none.includes('data-scope="sort"') && none.includes('disabled>Next<'));
  const set = card({ step: 2, projectId: 'pB', priority: 'high' });
  assert.ok(set.includes('aria-pressed="true"') && set.includes('data-field="priority" data-value="high"') && !set.includes('disabled>Next<'));
  assert.ok(card({ step: 9, projectId: 'pB' }).includes('disabled>Save to Home<') && card({ step: 9, projectId: 'pB', priority: 'high' }).includes('unsorted-file'), 'the receipt files only with a priority');
  const bulk = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh(), bulk: { on: true, step: 2, picked: ['i:th1'], projectId: 'pB', selected: [], groupTitle: '', newLabel: '', why: '' } });
  assert.ok(bulk.includes('data-scope="bulk"') && bulk.includes('disabled>Next<'));
});

test('the steps carry the warn stages and a task\'s priority and due date to what they save', () => {
  seed();
  const stages = { yellow: { leadHours: 72 }, red: { leadHours: 24 } };
  const out = fileSlip(unsortedQueue(state)[0], { projectId: 'pB', selected: [], priority: 'high', deadline: '2026-12-15', dueStages: stages }, deps());
  assert.deepStrictEqual(out.task.dueStages, stages, 'a thought keeps the lead times chosen on the warn page');
  const none = fileSlip(unsortedQueue(state)[0], { projectId: 'pB', selected: [], priority: 'high', dueStages: stages }, deps());
  assert.ok(!('dueStages' in none.task), 'no date, no stages');
  const calls = [];
  const task = { id: 't1', title: 'Fix', status: 'next', categoryIds: [], priority: 'low' };
  const cur = { kind: 'task', task, project: { id: 'pB' } };
  const d = Object.assign(deps(), { updateTaskFields: (...a) => calls.push(a) });
  fileSlip(cur, { projectId: 'pB', selected: [], priority: 'low', deadline: '' }, d);
  assert.deepStrictEqual(calls, [], 'unchanged priority and date write nothing');
  fileSlip(cur, { projectId: 'pB', selected: [], priority: 'urgent', deadline: '2026-12-15', dueStages: stages }, d);
  assert.deepStrictEqual(calls[0], ['t1', { priority: 'urgent', deadline: '2026-12-15', dueStages: stages }]);
});
