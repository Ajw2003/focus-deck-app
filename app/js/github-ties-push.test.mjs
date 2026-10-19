// app/js/github-ties-push.test.mjs -- run with: node --test app/js/github-ties-push.test.mjs
// Writing ties to GitHub (#195). Mocked fetch only. See docs/4-systems/task-links.md#github
import test from 'node:test';
import assert from 'node:assert';

globalThis.localStorage = { getItem: (k) => (k === 'focusdeck-github-token' ? 'test-token' : null), setItem() {}, removeItem() {} };
const calls = [];
let fail = false;
globalThis.fetch = async (url, opts = {}) => {
  calls.push((opts.method || 'GET') + ' ' + String(url).replace('https://api.github.com', '') + (opts.body ? ' ' + opts.body : ''));
  if (fail) return { ok: false, status: 422, json: async () => ({ message: 'nope' }) };
  return { ok: true, status: 200, json: async () => ({ id: 1, number: 1 }) };
};
const { state } = await import('./state.js');
const M = await import('./mutations.js');

const lk = (id, n) => ({ id, title: id, status: 'next', categoryIds: [], steps: [], source: 'github', repoFullName: 'o/r', issueNumber: n, issueId: n * 100 });
const setup = () => {
  calls.length = 0; fail = false;
  state.excludedIssues = []; state.completedLog = []; state.deletedTaskIds = {}; state._ui = {};
  state.projects = [
    { id: 'p', name: 'r', tasks: [lk('a', 1), lk('b', 2), lk('c', 3), { id: 'u', title: 'u', status: 'next', categoryIds: [], steps: [] }] },
    { id: 'q', name: 's', tasks: [] },
  ];
  return (id) => state.projects[0].tasks.find((t) => t.id === id);
};
const tick = () => new Promise((r) => setTimeout(r, 30));

test('parent: add, change, remove', async () => {
  setup();
  M.updateTaskFields('c', { parentId: 'a' }); await tick();
  assert.deepStrictEqual(calls, ['POST /repos/o/r/issues/1/sub_issues {"sub_issue_id":300,"replace_parent":true}']);
  calls.length = 0;
  M.updateTaskFields('c', { parentId: 'b' }); await tick();
  assert.deepStrictEqual(calls, ['DELETE /repos/o/r/issues/1/sub_issue {"sub_issue_id":300}', 'POST /repos/o/r/issues/2/sub_issues {"sub_issue_id":300,"replace_parent":true}']);
  calls.length = 0;
  M.updateTaskFields('c', { parentId: undefined }); await tick();
  assert.deepStrictEqual(calls, ['DELETE /repos/o/r/issues/2/sub_issue {"sub_issue_id":300}']);
});

test('waitsOn: add and remove use issue_id; an unlinked other task makes no call', async () => {
  setup();
  M.updateTaskFields('c', { waitsOn: ['a', 'u'] }); await tick();
  assert.deepStrictEqual(calls, ['POST /repos/o/r/issues/3/dependencies/blocked_by {"issue_id":100}']);
  calls.length = 0;
  M.updateTaskFields('c', { waitsOn: ['u'] }); await tick();
  assert.deepStrictEqual(calls, ['DELETE /repos/o/r/issues/3/dependencies/blocked_by/100']);
  calls.length = 0;
  M.updateTaskFields('c', { parentId: 'u' }); await tick();
  assert.deepStrictEqual(calls, []);
});

test('moving to another folder removes the detached subtask ties', async () => {
  const t = setup();
  t('b').parentId = 'a';
  M.applyTaskMove({ taskId: 'a', toProjectId: 'q' }); await tick();
  assert.deepStrictEqual(calls, ['DELETE /repos/o/r/issues/1/sub_issue {"sub_issue_id":200}']);
});

test('deleting pushes the other tasks whose ties it cut', async () => {
  const t = setup();
  t('b').parentId = 'a'; t('c').waitsOn = ['a'];
  M.deleteTask('a', 'p'); await tick();
  assert.ok(calls.includes('DELETE /repos/o/r/issues/3/dependencies/blocked_by/100'), calls.join('\n'));
});

test('a failing call is reported and state is unchanged', async () => {
  const t = setup(); fail = true;
  M.updateTaskFields('c', { parentId: 'a' }); await tick();
  assert.strictEqual(t('c').parentId, 'a');
  assert.match(String(state._ui.syncError || ''), /ties/);
});
