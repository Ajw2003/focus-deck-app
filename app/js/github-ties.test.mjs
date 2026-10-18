// app/js/github-ties.test.mjs -- run with: node --test app/js/github-ties.test.mjs
// Issue ids and tie counts (#194): mapIssue fields, issueId on linked tasks, and the tie API helpers.
// Mocked fetch only; nothing here touches GitHub. See docs/4-systems/github-sync.md.
import test from 'node:test';
import assert from 'node:assert';

globalThis.localStorage = { getItem: (k) => (k === 'focusdeck-github-token' ? 'test-token' : null), setItem() {}, removeItem() {} };
const calls = [];
let respond = () => ({});
globalThis.fetch = async (url, opts = {}) => {
  const call = { url: String(url).replace('https://api.github.com', ''), method: opts.method || 'GET', body: opts.body };
  calls.push(call);
  const out = await respond(call);
  if (out && out.__status) return { ok: false, status: out.__status, json: async () => out.body || {} };
  return { ok: true, status: 200, json: async () => out };
};

const G = await import('./github.js');
const S = await import('./github-sync.js');
const { state } = await import('./state.js');

const raw = (n, id, extra) => Object.assign({ id, number: n, title: 'T' + n, labels: [{ name: 'bug', color: 'f00' }], body: '', state: 'open', html_url: 'https://github.com/o/r/issues/' + n, repository_url: 'https://api.github.com/repos/o/r' }, extra);

test('mapIssue keeps id and the two tie counts, defaulting to 0', async () => {
  respond = () => raw(5, 5908483975, { sub_issues_summary: { total: 3, completed: 1, percent_completed: 33 }, issue_dependencies_summary: { blocked_by: 1, blocking: 0, total_blocked_by: 2, total_blocking: 0 } });
  let i = await G.getIssue('o', 'r', 5);
  assert.deepStrictEqual([i.id, i.subIssueCount, i.blockedByCount], [5908483975, 3, 2]);
  respond = () => raw(6, 7);
  i = await G.getIssue('o', 'r', 6);
  assert.deepStrictEqual([i.id, i.subIssueCount, i.blockedByCount], [7, 0, 0]);
});

test('issueId is stored on import, refresh, link, create and transfer, and cleared on unlink', async () => {
  const mk = (id, extra) => Object.assign({ id, title: id, status: 'next', source: 'manual', categoryIds: [], steps: [] }, extra);
  state.excludedIssues.length = 0;
  state.projects = [{ id: 'p', name: 'r', source: 'github', repoFullName: 'o/r', tasks: [mk('old', { source: 'github', repoFullName: 'o/r', issueNumber: 1 })] }];
  const repo = { full_name: 'o/r', name: 'r', html_url: 'https://github.com/o/r' };
  const issues = [{ number: 1, id: 101, title: 'one', labels: ['bug'], labelColors: {} }, { number: 2, id: 102, title: 'two', labels: ['bug'], labelColors: {} }];
  S.upsertRepoProject(repo, issues, {});
  const tasks = state.projects[0].tasks;
  assert.strictEqual(tasks.find((t) => t.issueNumber === 1).issueId, 101, 'existing linked task gets it filled in');
  assert.strictEqual(tasks.find((t) => t.issueNumber === 2).issueId, 102, 'newly imported task has it');

  // link
  state.projects[0].tasks.push(mk('lk'));
  respond = (c) => (c.url === '/repos/o/r/issues/9' ? raw(9, 109) : {});
  await S.linkTaskToIssue('lk', 'o/r#9', {});
  assert.strictEqual(tasks.find((t) => t.id === 'lk').issueId, 109);

  // create
  state.projects[0].tasks.push(mk('cr'));
  respond = (c) => {
    if (c.method === 'POST' && c.url === '/repos/o/r/issues') return raw(10, 110);
    if (c.url.startsWith('/repos/o/r/issues?')) return [];
    return {};
  };
  await S.createGithubIssueFromTask('cr', 'o/r', {});
  assert.strictEqual(tasks.find((t) => t.id === 'cr').issueId, 110);

  // transfer: the moved issue has a new id
  state.projects[0].tasks.push(mk('tr', { source: 'github', repoFullName: 'o/r', issueNumber: 20, issueId: 120 }));
  respond = (c) => {
    if (c.url === '/graphql') return { data: { transferIssue: { issue: { number: 3, url: 'https://github.com/o/c/issues/3', databaseId: 203 } } } };
    return { node_id: 'N' };
  };
  assert.strictEqual(await S.transferTaskIssue('tr', 'o/c', {}, 'c'), true);
  const tr = tasks.find((t) => t.id === 'tr');
  assert.strictEqual(tr.issueId, 203);

  // unlink
  S.unlinkTask('tr');
  assert.ok(!('issueId' in tr), 'unlinking clears issueId');
});

test('tie helpers: method, path, body, and results carry repoFullName', async () => {
  const other = raw(7, 77, { repository_url: 'https://api.github.com/repos/x/y' });
  const last = () => calls[calls.length - 1];

  respond = () => [other];
  let r = await G.listSubIssues('o', 'r', 1);
  assert.deepStrictEqual([last().method, last().url], ['GET', '/repos/o/r/issues/1/sub_issues?per_page=100']);
  assert.deepStrictEqual([r[0].id, r[0].number, r[0].repoFullName], [77, 7, 'x/y']);

  respond = () => other;
  await G.addSubIssue('o', 'r', 1, 77);
  assert.deepStrictEqual([last().method, last().url, JSON.parse(last().body)], ['POST', '/repos/o/r/issues/1/sub_issues', { sub_issue_id: 77 }]);
  r = await G.removeSubIssue('o', 'r', 1, 77);
  assert.deepStrictEqual([last().method, last().url, JSON.parse(last().body)], ['DELETE', '/repos/o/r/issues/1/sub_issue', { sub_issue_id: 77 }]);
  assert.strictEqual(r.repoFullName, 'x/y');

  assert.strictEqual((await G.getParentIssue('o', 'r', 1)).number, 7);
  assert.deepStrictEqual([last().method, last().url], ['GET', '/repos/o/r/issues/1/parent']);
  respond = () => ({ __status: 404 });
  assert.strictEqual(await G.getParentIssue('o', 'r', 1), null, 'no parent -> null');

  respond = () => [other];
  await G.listBlockedBy('o', 'r', 1);
  assert.deepStrictEqual([last().method, last().url], ['GET', '/repos/o/r/issues/1/dependencies/blocked_by?per_page=100']);
  respond = () => other;
  await G.addBlockedBy('o', 'r', 1, 77);
  assert.deepStrictEqual([last().method, last().url, JSON.parse(last().body)], ['POST', '/repos/o/r/issues/1/dependencies/blocked_by', { issue_id: 77 }]);
  await G.removeBlockedBy('o', 'r', 1, 77);
  assert.deepStrictEqual([last().method, last().url, last().body], ['DELETE', '/repos/o/r/issues/1/dependencies/blocked_by/77', undefined]);
});
