// app/js/github-ties-read.test.mjs -- run with: node --test app/js/github-ties-read.test.mjs
// Reading ties on sync (#196). Mocked fetch only. See docs/4-systems/github-sync.md#reading-ties-196
import test from 'node:test';
import assert from 'node:assert';

globalThis.localStorage = { getItem: (k) => (k === 'focusdeck-github-token' ? 'test-token' : null), setItem() {}, removeItem() {} };
const calls = [];
let lists = {}; // path -> array of raw issues
globalThis.fetch = async (url, opts = {}) => {
  const path = String(url).replace('https://api.github.com', '').replace(/\?.*/, '');
  calls.push((opts.method || 'GET') + ' ' + path);
  return { ok: true, status: 200, json: async () => lists[path] || [] };
};
const S = await import('./github-sync.js');
const { state } = await import('./state.js');

const raw = (repo, n) => ({ id: n * 100, number: n, title: 'T' + n, labels: [{ name: 'bug', color: 'f00' }], body: '', state: 'open', html_url: 'https://github.com/' + repo + '/issues/' + n, repository_url: 'https://api.github.com/repos/' + repo });
const lk = (id, n, repo = 'o/r') => ({ id, title: id, status: 'next', categoryIds: [], steps: [], source: 'github', repoFullName: repo, issueNumber: n, issueId: n * 100 });
const iss = (n, subs = 0, blocked = 0) => ({ id: n * 100, number: n, subIssueCount: subs, blockedByCount: blocked, title: 'T' + n, labels: ['bug'], labelColors: {} });
const repo = { full_name: 'o/r', name: 'r', html_url: 'https://github.com/o/r' };
const setup = () => {
  calls.length = 0; lists = {};
  state.excludedIssues = []; state._ui = {};
  state.projects = [
    { id: 'p', name: 'r', source: 'github', repoFullName: 'o/r', tasks: [lk('a', 1), lk('b', 2), lk('c', 3), { id: 'u', title: 'u', status: 'next', categoryIds: [], steps: [] }] },
    { id: 'q', name: 's', source: 'github', repoFullName: 'o/s', tasks: [lk('x', 9, 'o/s')] },
  ];
  return (id) => state.projects.flatMap((p) => p.tasks).find((t) => t.id === id);
};

test('zero counts cause no requests', async () => {
  setup();
  await S.readTiesForRepo(repo, [iss(1), iss(2)]);
  assert.deepStrictEqual(calls, []);
});

test('sub-issue that is a task gets parentId; a missing one is imported and tied; removed one is cleared', async () => {
  const t = setup();
  lists['/repos/o/r/issues/1/sub_issues'] = [raw('o/r', 2), raw('o/r', 7)];
  t('c').parentId = 'a';
  await S.readTiesForRepo(repo, [iss(1, 2)]);
  assert.strictEqual(t('b').parentId, 'a');
  const imp = state.projects[0].tasks.find((x) => x.issueNumber === 7);
  assert.ok(imp && imp.parentId === 'a' && imp.source === 'github' && imp.issueId === 700);
  assert.strictEqual(t('c').parentId, undefined);
});

test('cross-repo sub-issue becomes waitsOn on the parent', async () => {
  const t = setup();
  lists['/repos/o/r/issues/1/sub_issues'] = [raw('o/s', 9)];
  await S.readTiesForRepo(repo, [iss(1, 1)]);
  assert.deepStrictEqual(t('a').waitsOn, ['x']);
  assert.strictEqual(t('x').parentId, undefined);
});

test('blocked-by replaces linked waitsOn but keeps local-only entries', async () => {
  const t = setup();
  t('c').waitsOn = ['u', 'a'];
  lists['/repos/o/r/issues/3/dependencies/blocked_by'] = [raw('o/r', 2), raw('o/r', 55)];
  await S.readTiesForRepo(repo, [iss(3, 0, 2)]);
  assert.deepStrictEqual(t('c').waitsOn, ['u', 'b']);
  await S.readTiesForRepo(repo, [iss(3)]); // blockers gone on GitHub
  assert.deepStrictEqual(t('c').waitsOn, ['u']);
});

test('a read makes no write calls and a failure is reported', async () => {
  setup();
  lists['/repos/o/r/issues/1/sub_issues'] = [raw('o/r', 2)];
  await S.readTiesForRepo(repo, [iss(1, 1)]);
  assert.ok(calls.every((c) => c.startsWith('GET ')), calls.join('\n'));
  const f = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const failed = await S.readTiesForRepo(repo, [iss(1, 1)]);
  globalThis.fetch = f;
  assert.strictEqual(failed, 1);
  assert.match(String(state._ui.syncError), /ties/);
});
