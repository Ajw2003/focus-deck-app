// focus-deck-app/js/github-sync.test.mjs — run with: node js/github-sync.test.mjs
import {
  energyFromLabels, statusFromLabels, parseRepoInput, resolveIssueEnergy,
  applyLabels, CLAUDE_CREATED_LABEL, CLAUDE_COMPLETED_LABEL,
  dropStaleCompletedLabel, refreshClosedTaskLabels, syncIssueCompletion, upsertRepoProject,
  priorityFromLabels, pushCategoriesToIssue, pushPriorityToIssue,
  sameIssueTitle, createGithubIssueFromTask,
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
  applyLabels(t, [CLAUDE_CREATED_LABEL]);
  assert.strictEqual(t.claudeCreated, true, '"Claude created this" should set claudeCreated');
  assert.deepStrictEqual(t.categoryIds, [], 'a provenance label must not become a category');
  assert.strictEqual(state.categories.length, catsBefore, 'a provenance label must not auto-create a category');

  // existing category still wins alongside a provenance label
  t = { status: 'next' };
  applyLabels(t, [CLAUDE_CREATED_LABEL, 'Bug']);
  assert.deepStrictEqual(t.categoryIds, ['cat_bug'], 'a real category label alongside the provenance label should still resolve the category');
  assert.strictEqual(t.claudeCreated, true);

  // an unknown real label becomes the category even when a provenance label is listed first
  t = { status: 'done' };
  applyLabels(t, [CLAUDE_COMPLETED_LABEL, 'Epic']);
  const epic = state.categories.find((c) => c.name === 'Epic');
  assert.ok(epic, 'the real label "Epic" should be auto-created as a category');
  assert.deepStrictEqual(t.categoryIds, [epic.id], 'the category must be the real label, not the provenance label');
  assert.strictEqual(t.claudeCompleted, true, 'completed label on a done task should set claudeCompleted');
  state.categories.splice(state.categories.indexOf(epic), 1);

  // claudeCompleted is live: a stale label on a non-done (reopened) task reads as false
  t = { status: 'next', claudeCompleted: true };
  applyLabels(t, [CLAUDE_COMPLETED_LABEL]);
  assert.ok(!t.claudeCompleted, 'a reopened (non-done) task must not read as claudeCompleted, even if the label is stale');

  // ...and it clears when the label is gone
  t = { status: 'done', claudeCompleted: true };
  applyLabels(t, ['Bug']);
  assert.ok(!t.claudeCompleted, 'claudeCompleted should clear when the label is no longer on the issue');

  // claudeCreated is sticky: never cleared, even with no labels or without the label
  t = { status: 'next', claudeCreated: true };
  applyLabels(t, []);
  assert.strictEqual(t.claudeCreated, true, 'claudeCreated must survive an empty label list');
  applyLabels(t, ['Bug']);
  assert.strictEqual(t.claudeCreated, true, 'claudeCreated must survive labels that omit the provenance label');

  // spelling/case tolerance, same as other reserved labels
  t = { status: 'next' };
  applyLabels(t, ['claude-created-this']);
  assert.strictEqual(t.claudeCreated, true, 'label matching should normalize case/hyphens like other reserved labels');

  // no labels, no flags
  t = { status: 'done' };
  applyLabels(t, []);
  assert.strictEqual(t.claudeCompleted, undefined);
  assert.strictEqual(t.claudeCreated, undefined);
}

// --- several labels per task, GitHub colours, priority ---
{
  const before = state.categories.map((c) => c.id);
  let t = { status: 'next' };
  applyLabels(t, ['art', 'design', 'lighting', 'priority: high'], { design: 'c5def5', lighting: 'fbca04' });
  const byName = (n) => state.categories.find((c) => c.name === n);
  assert.deepStrictEqual(t.categoryIds, ['art', 'design', 'lighting'].map((n) => byName(n).id), 'every non-priority label becomes one of the task\'s categories, in order');
  assert.strictEqual(byName('lighting').color, '#fbca04', 'a label first seen on GitHub keeps its GitHub colour');
  assert.ok(!byName('priority: high'), 'a priority label must not become a category');
  assert.strictEqual(t.priority, 'high');
  assert.strictEqual(t.priorityLabel, 'priority: high');

  applyLabels(t, ['art'], {});
  assert.deepStrictEqual(t.categoryIds, [byName('art').id], 'a label removed on GitHub is removed from the task');
  assert.strictEqual(t.priority, null, 'no priority label means no priority');

  assert.deepStrictEqual(priorityFromLabels(['P1', 'bug']), { priority: 'high', label: 'P1' }, 'common aliases are read as priority');
  assert.deepStrictEqual(priorityFromLabels(['critical', 'Priority: Low']), { priority: 'low', label: 'Priority: Low' }, 'a canonical priority label wins over an alias');
  assert.deepStrictEqual(priorityFromLabels(['priority: low', 'priority: urgent']), { priority: 'urgent', label: 'priority: urgent' }, 'among canonical labels the most urgent wins');
  assert.strictEqual(priorityFromLabels(['bug']), null);
  applyLabels(t, ['good first issue'], {});
  assert.ok(byName('good first issue'), '"good first issue" is an ordinary label now, not an energy hint');

  state.categories.splice(0, state.categories.length, ...state.categories.filter((c) => before.includes(c.id)));
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
  assert.deepStrictEqual(t.categoryIds, ['cat_bug']);

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

  // pushCategoriesToIssue: adds only the labels the task gained, removes only those it lost.
  // cssColorToHex needs a DOM; a stand-in that reports every colour as #aa0000 is enough here.
  globalThis.document = { createElement: () => ({ style: {} }), body: { appendChild() {}, removeChild() {} } };
  globalThis.getComputedStyle = () => ({ color: 'rgb(170, 0, 0)' });
  state.categories.push({ id: 'cat_art', name: 'art', color: '#aa0000' }, { id: 'cat_ui', name: 'ui', color: '#aa0000' });
  calls.length = 0;
  nextJson = { color: 'aa0000' };
  t = { source: 'github', repoFullName: 'o/r', issueNumber: 5, categoryIds: ['cat_bug', 'cat_art'] };
  await pushCategoriesToIssue(t, ['cat_bug', 'cat_ui']);
  let writes = calls.filter((c) => c.method !== 'GET').map((c) => c.method + ' ' + c.url + (c.body ? ' ' + c.body : ''));
  assert.deepStrictEqual(writes, ['POST /repos/o/r/issues/5/labels {"labels":["art"]}', 'DELETE /repos/o/r/issues/5/labels/ui'], 'only the gained label is added and only the lost one removed: ' + writes.join(' | '));

  // pushPriorityToIssue: swaps whatever priority label the issue had for the canonical one
  calls.length = 0;
  t = { source: 'github', repoFullName: 'o/r', issueNumber: 5, priority: 'urgent', priorityLabel: 'P1' };
  await pushPriorityToIssue(t);
  writes = calls.filter((c) => c.method !== 'GET').map((c) => c.method + ' ' + c.url + (c.body ? ' ' + c.body : ''));
  assert.ok(writes.includes('POST /repos/o/r/issues/5/labels {"labels":["priority: urgent"]}'), 'the canonical priority label is added: ' + writes.join(' | '));
  assert.ok(writes.includes('DELETE /repos/o/r/issues/5/labels/P1'), 'the old priority label is removed, whatever its name');
  assert.strictEqual(t.priorityLabel, 'priority: urgent');
  calls.length = 0;
  t.priority = null;
  await pushPriorityToIssue(t);
  writes = calls.filter((c) => c.method !== 'GET').map((c) => c.method + ' ' + c.url);
  assert.deepStrictEqual(writes, ['DELETE /repos/o/r/issues/5/labels/priority%3A%20urgent'], 'clearing the priority only removes its label');
  assert.strictEqual(t.priorityLabel, null);
  state.categories.splice(state.categories.findIndex((c) => c.id === 'cat_art'), 2);
  delete globalThis.document;
  delete globalThis.getComputedStyle;

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

  // an issue linked to a task stays open while it's open on GitHub, even with no labels (e.g. one
  // Focus Deck just created from an unlabelled task); a new unlabelled issue still isn't imported;
  // a task in this project linked to another repo's issue is left alone
  state.projects.length = 0;
  state.completedLog.length = 0;
  state.projects.push({ id: 'p2', name: 'r', source: 'github', repoFullName: 'o/r', tasks: [
    { id: 't_nolabel', title: 'made here', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 20 },
    { id: 't_other', title: 'elsewhere', status: 'next', source: 'github', repoFullName: 'x/other', issueNumber: 99 },
  ] });
  const closed2 = upsertRepoProject(repo, [
    { number: 20, title: 'made here', labels: [], body: '', state: 'open' },
    { number: 21, title: 'stranger', labels: [], body: '', state: 'open' },
    { number: 22, title: 'labelled', labels: ['Bug'], body: '', state: 'open' },
  ], {});
  const tasks2 = state.projects[0].tasks;
  assert.deepStrictEqual(closed2, [], 'nothing should be closed: #20 is still open, #99 belongs to another repo');
  assert.strictEqual(tasks2.find((t) => t.id === 't_nolabel').status, 'next', 'a linked issue without labels must not mark its task done');
  assert.strictEqual(tasks2.find((t) => t.id === 't_other').status, 'next', 'a task linked to another repo must not be closed by this repo\'s sync');
  assert.ok(!tasks2.some((t) => t.issueNumber === 21), 'a new unlabelled issue is still not imported');
  assert.ok(tasks2.some((t) => t.issueNumber === 22), 'a new labelled issue is imported');
  state.projects.length = 0;
  state.completedLog.length = 0;
}

// --- createGithubIssueFromTask: pulls the repo's open issues first and links a same-title match ---
{
  assert.ok(sameIssueTitle('Fix login', '  fix   LOGIN '), 'titles should match ignoring case and extra whitespace');
  assert.ok(!sameIssueTitle('Fix login', 'Fix logout'));
  assert.ok(!sameIssueTitle('', ''), 'two empty titles are not a match');

  globalThis.localStorage = { getItem: () => 'test-token', setItem() {}, removeItem() {} };
  const calls = [];
  const openIssues = [
    { number: 9, title: 'Fix login', labels: [], body: '', state: 'open', html_url: 'https://github.com/o/r/issues/9', pull_request: undefined },
  ];
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace('https://api.github.com', '');
    const method = opts.method || 'GET';
    calls.push(method + ' ' + path);
    if (method === 'GET' && path.startsWith('/repos/o/r/issues?')) return { ok: true, status: 200, json: async () => openIssues };
    if (method === 'GET' && path === '/repos/o/r/issues/9') return { ok: true, status: 200, json: async () => openIssues[0] };
    if (method === 'POST' && path === '/repos/o/r/issues') return { ok: true, status: 201, json: async () => ({ number: 10, title: 'New thing', labels: [], body: '', state: 'open', html_url: 'https://github.com/o/r/issues/10' }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const makeTask = (id, title) => ({ id, title, status: 'next', source: 'manual', categoryIds: [], steps: [] });

  // an open issue with the same title already exists -> link to it, never POST a new one
  state.projects.length = 0;
  state.projects.push({ id: 'p1', name: 'r', tasks: [makeTask('t_dup', 'fix login')] });
  calls.length = 0;
  let ui = {};
  await createGithubIssueFromTask('t_dup', 'o/r', ui);
  let t = state.projects[0].tasks[0];
  assert.ok(!calls.some((c) => c.startsWith('POST /repos/o/r/issues')), 'no new issue should be created when a same-title issue is already open: ' + calls.join(', '));
  assert.strictEqual(t.issueNumber, 9, 'the task should be linked to the existing issue');
  assert.strictEqual(t.source, 'github');
  assert.ok(!ui.syncError, 'linking to the existing issue is not an error: ' + ui.syncError);
  assert.ok(/linked to it instead/.test(ui.notice || ''), 'the user should be told the task was linked, not created');

  // the matching issue is already linked to a different task -> stop with a message, create nothing
  state.projects[0].tasks.push(makeTask('t_second', 'Fix login'));
  calls.length = 0;
  ui = {};
  await createGithubIssueFromTask('t_second', 'o/r', ui);
  t = state.projects[0].tasks[1];
  assert.ok(!calls.some((c) => c.startsWith('POST ')), 'nothing should be created when the match is linked elsewhere');
  assert.strictEqual(t.source, 'manual', 'the second task should stay unlinked');
  assert.ok(/already exists/.test(ui.syncError || ''), 'the user should be told why nothing was created');
  assert.strictEqual(ui.syncing, false);

  // no same-title issue -> the check runs first, then a new issue is created as before
  state.projects[0].tasks.push(makeTask('t_new', 'New thing'));
  calls.length = 0;
  ui = {};
  await createGithubIssueFromTask('t_new', 'o/r', ui);
  t = state.projects[0].tasks[2];
  assert.ok(calls[0].startsWith('GET /repos/o/r/issues?'), 'the repo\'s open issues should be pulled before anything is created');
  assert.ok(calls.includes('POST /repos/o/r/issues'), 'a new issue should be created when there is no match');
  assert.strictEqual(t.issueNumber, 10);
  state.projects.length = 0;
}

console.log('GITHUB SYNC HEURISTIC TESTS PASSED');
