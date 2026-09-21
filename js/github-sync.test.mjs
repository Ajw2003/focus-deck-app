// focus-deck-app/js/github-sync.test.mjs — run with: node js/github-sync.test.mjs
import {
  energyFromLabels, statusFromLabels, parseRepoInput, resolveIssueEnergy,
  applyCategoryFromLabels, CLAUDE_CREATED_LABEL, CLAUDE_COMPLETED_LABEL,
  dropStaleCompletedLabel, refreshClosedTaskLabels, syncIssueCompletion, upsertRepoProject,
} from './github-sync.js';
import { state } from './state.js';
import assert from 'node:assert';

// HIGH-priority label variant
assert.strictEqual(energyFromLabels(['bug', 'high-priority']), 'high', 'high-priority label should map to high energy');
assert.strictEqual(energyFromLabels(['P0']), 'high', 'P0 label should map to high energy');

// LOW-priority label variant, including labels-with-spaces/hyphens to prove normLabel works
assert.strictEqual(energyFromLabels(['good first issue']), 'low', '"good first issue" (spaces) should normalize to goodfirstissue -> low');
assert.strictEqual(energyFromLabels(['Good-First-Issue']), 'low', '"Good-First-Issue" (mixed case + hyphens) should normalize to goodfirstissue -> low');
assert.strictEqual(energyFromLabels(['docs']), 'low', 'docs label should map to low energy');

// label matching neither HIGH nor LOW -> medium
assert.strictEqual(energyFromLabels(['enhancement']), 'medium', 'unrecognized label should default to medium energy');
assert.strictEqual(energyFromLabels([]), 'medium', 'no labels should default to medium energy');
assert.strictEqual(energyFromLabels(undefined), 'medium', 'undefined labels should default to medium energy');

// wip / in progress status labels
assert.strictEqual(statusFromLabels(['wip']), 'doing', '"wip" label should map to doing status');
assert.strictEqual(statusFromLabels(['in progress']), 'doing', '"in progress" (spaces) should normalize to inprogress -> doing');
assert.strictEqual(statusFromLabels(['In-Progress']), 'doing', '"In-Progress" (mixed case + hyphen) should normalize to inprogress -> doing');
assert.strictEqual(statusFromLabels(['enhancement']), 'next', 'unrecognized status label should default to next');

// parseRepoInput: owner/repo shorthand, full GitHub URLs, and invalid input
assert.strictEqual(parseRepoInput('owner/repo'), 'owner/repo', 'plain "owner/repo" should parse as-is');
assert.strictEqual(parseRepoInput('https://github.com/owner/repo'), 'owner/repo', 'full github.com URL should parse to owner/repo');
assert.strictEqual(parseRepoInput('https://github.com/owner/repo/'), 'owner/repo', 'URL with a trailing slash should parse to owner/repo');
assert.strictEqual(parseRepoInput('https://github.com/owner/repo.git'), 'owner/repo', 'URL with a .git suffix should parse to owner/repo');
assert.strictEqual(parseRepoInput('not a valid repo input'), null, 'invalid input should return null');

// resolveIssueEnergy: an explicit priority label wins over the complexity estimate
assert.strictEqual(resolveIssueEnergy({ title: 'x', body: '', labels: ['high-priority'] }), 'high', 'an explicit high-priority label should win over the complexity estimate');
assert.strictEqual(resolveIssueEnergy({ title: 'x', body: '', labels: ['good-first-issue'] }), 'low', 'an explicit low-priority label should win over the complexity estimate');

// resolveIssueEnergy: no priority label -> falls back to the complexity estimate
assert.strictEqual(resolveIssueEnergy({ title: 'Quick typo fix', body: '', labels: [] }), 'low', 'a simple issue with no priority label should estimate low');
assert.strictEqual(
  resolveIssueEnergy({
    title: 'Design and overhaul the sync layer',
    body: '- [ ] one\n- [ ] two\n- [ ] three\n- [ ] four\n- [ ] five\n- [ ] six\n- [ ] seven\n- [ ] eight\n- [ ] nine',
    labels: ['enhancement', 'backend', 'ui'],
  }),
  'high',
  'a complex issue with a 9-item checklist and 3 labels should estimate high even with no priority label'
);

// --- provenance labels ---
{
  const catsBefore = state.categories.length;

  // created label sets the sticky flag and is never a category candidate
  let t = { status: 'next' };
  applyCategoryFromLabels(t, [CLAUDE_CREATED_LABEL]);
  assert.strictEqual(t.claudeCreated, true, '"Claude created this" should set claudeCreated');
  assert.strictEqual(t.categoryId, undefined, 'a provenance label must not become a category');
  assert.strictEqual(state.categories.length, catsBefore, 'a provenance label must not auto-create a category');

  // existing category still wins alongside a provenance label
  t = { status: 'next' };
  applyCategoryFromLabels(t, [CLAUDE_CREATED_LABEL, 'Bug']);
  assert.strictEqual(t.categoryId, 'cat_bug', 'a real category label alongside the provenance label should still resolve the category');
  assert.strictEqual(t.claudeCreated, true);

  // an unknown real label becomes the category even when a provenance label is listed first
  t = { status: 'done' };
  applyCategoryFromLabels(t, [CLAUDE_COMPLETED_LABEL, 'Epic']);
  const epic = state.categories.find((c) => c.name === 'Epic');
  assert.ok(epic, 'the real label "Epic" should be auto-created as a category');
  assert.strictEqual(t.categoryId, epic.id, 'the category must be the real label, not the provenance label');
  assert.strictEqual(t.claudeCompleted, true, 'completed label on a done task should set claudeCompleted');
  state.categories.splice(state.categories.indexOf(epic), 1);

  // claudeCompleted is live: a stale label on a non-done (reopened) task reads as false
  t = { status: 'next', claudeCompleted: true };
  applyCategoryFromLabels(t, [CLAUDE_COMPLETED_LABEL]);
  assert.ok(!t.claudeCompleted, 'a reopened (non-done) task must not read as claudeCompleted, even if the label is stale');

  // ...and it clears when the label is gone
  t = { status: 'done', claudeCompleted: true };
  applyCategoryFromLabels(t, ['Bug']);
  assert.ok(!t.claudeCompleted, 'claudeCompleted should clear when the label is no longer on the issue');

  // claudeCreated is sticky: never cleared, even with no labels or without the label
  t = { status: 'next', claudeCreated: true };
  applyCategoryFromLabels(t, []);
  assert.strictEqual(t.claudeCreated, true, 'claudeCreated must survive an empty label list');
  applyCategoryFromLabels(t, ['Bug']);
  assert.strictEqual(t.claudeCreated, true, 'claudeCreated must survive labels that omit the provenance label');

  // spelling/case tolerance, same as other reserved labels
  t = { status: 'next' };
  applyCategoryFromLabels(t, ['claude-created-this']);
  assert.strictEqual(t.claudeCreated, true, 'label matching should normalize case/hyphens like other reserved labels');

  // no labels, no flags
  t = { status: 'done' };
  applyCategoryFromLabels(t, []);
  assert.strictEqual(t.claudeCompleted, undefined);
  assert.strictEqual(t.claudeCreated, undefined);
}

// --- live claudeCompleted: stubbed GitHub API ---
{
  globalThis.localStorage = { getItem: () => 'test-token', setItem() {}, removeItem() {} };
  const calls = [];
  let nextJson = {};
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url).replace('https://api.github.com', ''), method: opts.method || 'GET', body: opts.body });
    return { ok: true, status: 200, json: async () => nextJson };
  };
  const LABEL_PATH = '/repos/o/r/issues/5/labels/Claude%20completed%20this';
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // dropStaleCompletedLabel: removes the stale label from a reopened task
  calls.length = 0;
  await dropStaleCompletedLabel({ status: 'next', repoFullName: 'o/r', issueNumber: 5 }, ['Bug', CLAUDE_COMPLETED_LABEL]);
  assert.deepStrictEqual(calls.map((c) => c.method + ' ' + c.url), ['DELETE ' + LABEL_PATH], 'a reopened task with a stale completed label should have that label removed from the issue');

  // ...but not when the task is done, or the label isn't there
  calls.length = 0;
  await dropStaleCompletedLabel({ status: 'done', repoFullName: 'o/r', issueNumber: 5 }, [CLAUDE_COMPLETED_LABEL]);
  await dropStaleCompletedLabel({ status: 'next', repoFullName: 'o/r', issueNumber: 5 }, ['Bug']);
  assert.strictEqual(calls.length, 0, 'no label removal when the task is done or the label is absent');

  // syncIssueCompletion: unchecking a Claude-completed task reopens the issue AND removes the label
  calls.length = 0;
  let t = { source: 'github', repoFullName: 'o/r', issueNumber: 5, status: 'next', claudeCompleted: true };
  await syncIssueCompletion(t);
  assert.deepStrictEqual(calls.map((c) => c.method + ' ' + c.url), ['PATCH /repos/o/r/issues/5', 'DELETE ' + LABEL_PATH], 'reopen should PATCH the issue open then remove the completed label');
  assert.strictEqual(JSON.parse(calls[0].body).state, 'open');
  assert.ok(!t.claudeCompleted, 'claudeCompleted should be cleared locally on reopen');

  // syncIssueCompletion: closing (done) never touches labels
  calls.length = 0;
  t = { source: 'github', repoFullName: 'o/r', issueNumber: 5, status: 'done' };
  await syncIssueCompletion(t);
  assert.deepStrictEqual(calls.map((c) => c.method + ' ' + c.url), ['PATCH /repos/o/r/issues/5']);

  // syncIssueCompletion: reopening a task that was never Claude-completed makes no label call
  calls.length = 0;
  t = { source: 'github', repoFullName: 'o/r', issueNumber: 5, status: 'next' };
  await syncIssueCompletion(t);
  assert.deepStrictEqual(calls.map((c) => c.method), ['PATCH']);

  // refreshClosedTaskLabels: closed issue with the label -> claudeCompleted
  calls.length = 0;
  nextJson = { number: 7, title: 'x', labels: [{ name: CLAUDE_COMPLETED_LABEL }, { name: 'Bug' }], body: '', state: 'closed', html_url: 'u' };
  t = { status: 'done', repoFullName: 'o/r', issueNumber: 7 };
  await refreshClosedTaskLabels([t]);
  assert.strictEqual(t.claudeCompleted, true, 'a newly-closed task whose issue carries the completed label should read as claudeCompleted');
  assert.strictEqual(t.categoryId, 'cat_bug');

  // refreshClosedTaskLabels: an issue that is actually open is ignored
  nextJson = { number: 7, title: 'x', labels: [{ name: CLAUDE_COMPLETED_LABEL }], body: '', state: 'open', html_url: 'u' };
  t = { status: 'done', repoFullName: 'o/r', issueNumber: 7 };
  await refreshClosedTaskLabels([t]);
  assert.ok(!t.claudeCompleted, 'an issue that is not closed must not set claudeCompleted');

  // refreshClosedTaskLabels: a failing fetch is swallowed
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await refreshClosedTaskLabels([{ status: 'done', repoFullName: 'o/r', issueNumber: 7 }]); // must not throw
  globalThis.fetch = realFetch;

  // upsertRepoProject: returns tasks newly closed (issue vanished from the open list)
  state.projects.length = 0;
  state.completedLog.length = 0;
  const repo = { full_name: 'o/r', name: 'r', html_url: 'https://github.com/o/r', private: false };
  state.projects.push({ id: 'p1', name: 'r', source: 'github', repoFullName: 'o/r', tasks: [
    { id: 't_closed', title: 'gone', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 1 },
    { id: 't_reopen', title: 'back', status: 'done', source: 'github', repoFullName: 'o/r', issueNumber: 2, claudeCompleted: true },
    { id: 't_open', title: 'still', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 3 },
  ] });
  calls.length = 0;
  const newlyClosed = upsertRepoProject(repo, [
    { number: 2, title: 'back', labels: ['Bug', CLAUDE_COMPLETED_LABEL], body: '', state: 'open' },
    { number: 3, title: 'still', labels: ['Bug'], body: '', state: 'open' },
  ], {});
  assert.deepStrictEqual(newlyClosed.map((x) => x.id), ['t_closed'], 'only the task whose issue left the open list is newly closed');
  const reopened = state.projects[0].tasks.find((x) => x.id === 't_reopen');
  assert.strictEqual(reopened.status, 'next', 'a done task whose issue is open again should reopen');
  assert.ok(!reopened.claudeCompleted, 'a reopened task must lose claudeCompleted');
  await tick();
  assert.deepStrictEqual(calls.map((c) => c.method + ' ' + c.url), ['DELETE /repos/o/r/issues/2/labels/Claude%20completed%20this'], 'the stale label should be removed from the reopened issue');
  assert.deepStrictEqual(upsertRepoProject({ full_name: 'x/y', name: 'y', html_url: 'u', private: false }, [], {}), [], 'early return yields an empty array');
  state.projects.length = 0;
  state.completedLog.length = 0;
}

console.log('GITHUB SYNC HEURISTIC TESTS PASSED');
