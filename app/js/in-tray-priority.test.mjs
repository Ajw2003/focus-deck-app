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

const fresh = () => ({ later: [], priority: null, due: '', projectId: null, selected: [], step: 1, find: '', title: null, notes: null, notesOpen: false, facingFolder: null, facingFlag: null, currentKey: null });
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

test('Sort slip and bulk panel carry the pickers; file button waits for a priority', () => {
  seed();
  const none = card({ step: 3, projectId: 'pB' });
  assert.ok(none.includes('Priority · needed') && none.includes('data-scope="sort"') && none.includes('Pick a priority to file') && !none.includes('unsorted-file'));
  const set = card({ step: 3, projectId: 'pB', priority: 'high' });
  assert.ok(set.includes('aria-pressed="true" data-action="pick-set" data-field="priority" data-value="high"') && set.includes('unsorted-file'));
  const bulk = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh(), bulk: { on: true, picked: ['i:th1'], projectId: 'pB', selected: [], groupTitle: '', newLabel: '', why: '' } });
  assert.ok(bulk.includes('data-scope="bulk"') && bulk.includes('Pick a priority for the thoughts'));
});
