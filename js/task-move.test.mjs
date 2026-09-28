// focus-deck-app/js/task-move.test.mjs -- run with: node --test js/task-move.test.mjs
//
// Dragging tasks (PR 11): task sortOrder, where a drop lands, what moving a task to another project
// means for GitHub (planTaskMove), the mutation, the two guarantees that a moved task neither comes
// back through a GitHub sync nor duplicates through the Gist merge, and the new markup.
// See docs/4-systems/styling.md#dragging-tasks and docs/4-systems/github-sync.md#moving-a-task-to-another-project.
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k === 'focusdeck-github-token' ? 'test-token' : (k in store ? store[k] : null)), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const calls = [];
let respond = () => ({});
globalThis.fetch = async (url, opts = {}) => {
  const call = { url: String(url).replace('https://api.github.com', ''), method: opts.method || 'GET', body: opts.body };
  calls.push(call);
  const out = await respond(call);
  if (out && out.__status) return { ok: false, status: out.__status, json: async () => out.body || {} };
  return { ok: true, status: 200, json: async () => out };
};

const { ensureTaskSortOrder, sortTasks, taskOrderChanges, planTaskMove } = await import('./task-move.js');
const { mergeStates } = await import('./merge.js');
const { state } = await import('./state.js');
const M = await import('./mutations.js');
const { upsertRepoProject, transferTaskIssue } = await import('./github-sync.js');
const { renderTaskRow, renderProjectCard, renderMoveDialog } = await import('./render.js');

const task = (id, sortOrder, extra) => Object.assign({ id, title: id.toUpperCase(), status: 'next', source: 'manual' }, sortOrder === undefined ? {} : { sortOrder }, extra);
const ids = (list) => list.map((t) => t.id);

test('ensureTaskSortOrder numbers unnumbered tasks after the project max, in array order, per project', () => {
  const projects = [
    { id: 'p1', tasks: [task('a'), task('b', 5), task('c'), task('d', 2)] },
    { id: 'p2', tasks: [task('e'), task('f')] },
  ];
  assert.strictEqual(ensureTaskSortOrder(projects), 4);
  assert.deepStrictEqual(projects[0].tasks.map((t) => t.sortOrder), [6, 5, 7, 2]);
  assert.deepStrictEqual(projects[1].tasks.map((t) => t.sortOrder), [1, 2]);
  assert.strictEqual(ensureTaskSortOrder(projects), 0, 'a second run changes nothing');
});

test('sortTasks: ascending sortOrder, unnumbered last, ties keep array order', () => {
  assert.deepStrictEqual(ids(sortTasks([task('a', 3), task('b'), task('c', 1), task('d', 3)])), ['c', 'a', 'd', 'b']);
});

test('a within-group move changes only the moved task', () => {
  const group = [task('a', 1), task('b', 2), task('c', 3), task('d', 4)];
  assert.deepStrictEqual(taskOrderChanges(group, 'a', 2), { a: 3.5 }, 'a to after c');
  assert.deepStrictEqual(taskOrderChanges(group, 'd', 0), { d: 0 }, 'd to the top');
  assert.deepStrictEqual(taskOrderChanges(group, 'a', 3), { a: 5 }, 'a to the bottom');
  assert.deepStrictEqual(taskOrderChanges(group, 'b', 1), {}, 'the same place changes nothing');
  assert.deepStrictEqual(taskOrderChanges([], 'x', 0), { x: 0 }, 'into an empty group');
  assert.deepStrictEqual(taskOrderChanges([task('a', 1)], 'x', 1), { x: 2 }, 'a task from another project goes after the last');
});

test('a gap too small to split renumbers the group 1..n', () => {
  const group = [task('a', 1), task('b', 1 + 1e-9), task('c', 3)];
  const changes = taskOrderChanges(group, 'c', 1);
  assert.deepStrictEqual(changes, { c: 2, b: 3 }, 'a stays 1; c and b take 2 and 3');
});

test('applyTaskMove: into the other group of the same project sets the status and stamps the task', () => {
  state.projects = [{ id: 'p1', name: 'P', source: 'manual', tasks: [task('a', 1, { status: 'next', updatedAt: 1 }), task('b', 2, { status: 'doing', updatedAt: 1 })] }];
  state.completedLog = [];
  const changes = taskOrderChanges(sortTasks(state.projects[0].tasks.filter((t) => t.status === 'doing')), 'a', 1);
  assert.ok(M.applyTaskMove({ taskId: 'a', toProjectId: 'p1', status: 'doing', changes }));
  const a = state.projects[0].tasks.find((t) => t.id === 'a');
  const b = state.projects[0].tasks.find((t) => t.id === 'b');
  assert.strictEqual(a.status, 'doing');
  assert.strictEqual(a.sortOrder, 3, 'after b');
  assert.strictEqual(b.sortOrder, 2, 'the others are untouched');
  assert.ok(a.updatedAt > 1);
});

test('applyTaskMove: into another project moves the record, keeps its id and link, and leaves the old list', () => {
  const linked = task('t', 1, { source: 'github', repoFullName: 'o/r', issueNumber: 7, url: 'https://github.com/o/r/issues/7', updatedAt: 1 });
  state.projects = [
    { id: 'p1', name: 'A', source: 'github', repoFullName: 'o/r', tasks: [linked, task('x', 2)] },
    { id: 'p2', name: 'B', source: 'manual', tasks: [task('y', 5, { status: 'doing' })] },
  ];
  assert.ok(M.applyTaskMove({ taskId: 't', toProjectId: 'p2', status: 'doing', changes: { t: 6 } }));
  assert.deepStrictEqual(ids(state.projects[0].tasks), ['x']);
  assert.deepStrictEqual(ids(state.projects[1].tasks), ['y', 't']);
  const t = state.projects[1].tasks[1];
  assert.deepStrictEqual([t.source, t.repoFullName, t.issueNumber, t.url, t.status, t.sortOrder], ['github', 'o/r', 7, 'https://github.com/o/r/issues/7', 'doing', 6]);
  assert.strictEqual(M.applyTaskMove({ taskId: 'nope', toProjectId: 'p2', status: 'next', changes: {} }), false);
});

test('planTaskMove covers every case', () => {
  const offline = { id: 'po', name: 'Garden', source: 'manual' };
  const repoBC = { id: 'pc', name: 'c', source: 'github', repoFullName: 'a/c' };
  const repoAB = { id: 'pb', name: 'b', source: 'github', repoFullName: 'a/b' };
  const handMade = { id: 't1', title: 'Fix it', source: 'manual' };
  const linked = { id: 't2', title: 'Fix it', source: 'github', repoFullName: 'a/b', issueNumber: 12 };

  assert.deepStrictEqual(planTaskMove(handMade, repoAB, offline), { kind: 'local', message: '', confirm: false });
  assert.deepStrictEqual(planTaskMove(linked, repoAB, offline), { kind: 'local', message: '', confirm: false }, 'a linked task into an offline project: no message, link kept');
  assert.deepStrictEqual(planTaskMove(linked, offline, repoAB), { kind: 'local', message: '', confirm: false }, 'into the task\'s own repo\'s project: a plain move');
  assert.strictEqual(planTaskMove(linked, offline, { id: 'x', name: 'B2', source: 'github', repoFullName: 'A/B' }).kind, 'local', 'the repo name is compared without case');

  const create = planTaskMove(handMade, offline, repoBC);
  assert.strictEqual(create.kind, 'create-issue');
  assert.strictEqual(create.message, 'Move “Fix it” to c? This creates a new issue in a/c and links the task to it.');

  const transfer = planTaskMove(linked, repoAB, repoBC);
  assert.strictEqual(transfer.kind, 'transfer');
  assert.strictEqual(transfer.message, 'Move “Fix it” to c? Issue #12 will move from a/b to a/c on GitHub.');

  const other = planTaskMove(linked, repoAB, { id: 'pz', name: 'z', source: 'github', repoFullName: 'x/z' });
  assert.strictEqual(other.kind, 'cross-owner');
  assert.strictEqual(other.message, 'Move “Fix it” to z? GitHub can’t move issues between different owners, so it moves in Focus Deck only and stays linked to a/b#12.');
  [create, transfer, other].forEach((p) => assert.strictEqual(p.confirm, true));
});

test('transferTaskIssue: node ids, the GraphQL body, and the task\'s new link', async () => {
  state.projects = [{ id: 'p2', name: 'c', source: 'github', repoFullName: 'a/c', tasks: [task('t', 1, { source: 'github', repoFullName: 'a/b', issueNumber: 12, url: 'old' })] }];
  calls.length = 0;
  respond = (c) => {
    if (c.url === '/repos/a/b/issues/12') return { node_id: 'ISSUE_NODE' };
    if (c.url === '/repos/a/c') return { node_id: 'REPO_NODE' };
    if (c.url === '/graphql') return { data: { transferIssue: { issue: { number: 3, url: 'https://github.com/a/c/issues/3' } } } };
    return {};
  };
  const ui = {};
  assert.strictEqual(await transferTaskIssue('t', 'a/c', ui, 'c'), true);
  const gql = calls.find((c) => c.url === '/graphql');
  assert.deepStrictEqual(JSON.parse(gql.body).variables, { issueId: 'ISSUE_NODE', repositoryId: 'REPO_NODE' });
  assert.match(JSON.parse(gql.body).query, /transferIssue/);
  const t = state.projects[0].tasks[0];
  assert.deepStrictEqual([t.repoFullName, t.issueNumber, t.url], ['a/c', 3, 'https://github.com/a/c/issues/3']);
});

test('transferTaskIssue: a refusal (GraphQL errors) keeps the old link and says why', async () => {
  state.projects = [{ id: 'p2', name: 'c', source: 'github', repoFullName: 'a/c', tasks: [task('t', 1, { source: 'github', repoFullName: 'a/b', issueNumber: 12, url: 'old' })] }];
  respond = (c) => (c.url === '/graphql' ? { errors: [{ message: 'Must have admin rights to Repository.' }] } : { node_id: 'N' });
  const ui = {};
  assert.strictEqual(await transferTaskIssue('t', 'a/c', ui, 'c'), false);
  assert.match(ui.syncError, /Must have admin rights to Repository\./);
  assert.match(ui.syncError, /stays linked to a\/b#12/);
  const t = state.projects[0].tasks[0];
  assert.deepStrictEqual([t.repoFullName, t.issueNumber, t.url], ['a/b', 12, 'old']);
});

test('sync de-duplication: an issue whose task was moved to another project is not imported again', () => {
  const repo = { full_name: 'o/r', name: 'r', html_url: 'https://github.com/o/r', private: false };
  const moved = task('t_moved', 1, { title: 'old title', source: 'github', repoFullName: 'o/r', issueNumber: 5, status: 'next' });
  state.projects = [
    { id: 'gh1', name: 'r', source: 'github', repoFullName: 'o/r', tasks: [] },
    { id: 'p_offline', name: 'Garden', source: 'manual', tasks: [moved] },
  ];
  state.completedLog = [];
  state.excludedIssues = [];
  const closed = upsertRepoProject(repo, [
    { number: 5, title: 'new title', labels: ['Bug'], body: '', state: 'open' },
    { number: 6, title: 'fresh', labels: ['Bug'], body: '', state: 'open' },
  ], {});
  assert.deepStrictEqual(closed, []);
  assert.deepStrictEqual(state.projects[0].tasks.map((t) => t.issueNumber), [6], 'only the new issue is imported into the repo project');
  assert.strictEqual(moved.title, 'new title', 'the moved task is refreshed where it is');
  assert.strictEqual(state.projects[1].tasks.length, 1);
  // a second sync changes nothing structural
  upsertRepoProject(repo, [{ number: 5, title: 'new title', labels: ['Bug'], body: '', state: 'open' }, { number: 6, title: 'fresh', labels: ['Bug'], body: '', state: 'open' }], {});
  assert.deepStrictEqual(state.projects.map((p) => p.tasks.length), [1, 1]);
});

test('sync de-duplication: the moved task is closed where it lives when its issue closes, and a repo with no project of its own is not created for it', () => {
  const repo = { full_name: 'o/gone', name: 'gone', html_url: 'https://github.com/o/gone', private: false };
  const moved = task('t_m2', 1, { source: 'github', repoFullName: 'o/gone', issueNumber: 9, status: 'next' });
  state.projects = [{ id: 'p_offline', name: 'Garden', source: 'manual', tasks: [moved] }];
  state.completedLog = [];
  state.pinnedRepos = [];
  const closed = upsertRepoProject(repo, [], {});
  assert.deepStrictEqual(closed.map((t) => t.id), ['t_m2']);
  assert.strictEqual(moved.status, 'done');
  assert.strictEqual(state.projects.length, 1, 'no project was created for the repo');
  assert.strictEqual(state.completedLog[0].projectId, 'p_offline');
});

test('Gist merge: device A moved T from P1 to P2, device B still has it in P1 -- merged state has T once, in P2', () => {
  const T = (extra) => Object.assign({ id: 'T', title: 'T', status: 'next', updatedAt: 100, sortOrder: 1 }, extra);
  const project = (id, tasks) => ({ id, name: id, updatedAt: 50, tasks });
  const deviceA = { projects: [project('P1', []), project('P2', [T({ updatedAt: 200, sortOrder: 4 })])], deletedTaskIds: {}, inbox: [], categories: [], completedLog: [] };
  const deviceB = { projects: [project('P1', [T()]), project('P2', [])], deletedTaskIds: {}, inbox: [], categories: [], completedLog: [] };
  [mergeStates(deviceA, deviceB), mergeStates(deviceB, deviceA)].forEach((merged) => {
    const homes = [];
    merged.projects.forEach((p) => p.tasks.forEach((t) => { if (t.id === 'T') homes.push(p.id); }));
    assert.deepStrictEqual(homes, ['P2'], 'T exists once, in P2 (either device merging)');
    assert.strictEqual(merged.projects.find((p) => p.id === 'P2').tasks[0].sortOrder, 4);
  });
  // and a merge with no move is unchanged: the task stays put
  const same = mergeStates(deviceB, deviceB);
  assert.deepStrictEqual(same.projects.map((p) => p.tasks.length), [1, 0]);
});

test('Gist merge: an edit made after the move, on the device that still has it in the old project, wins', () => {
  const T = (extra) => Object.assign({ id: 'T', title: 'T', status: 'next', updatedAt: 100 }, extra);
  const a = { projects: [{ id: 'P1', name: 'P1', tasks: [] }, { id: 'P2', name: 'P2', tasks: [T({ updatedAt: 200 })] }], inbox: [], categories: [] };
  const b = { projects: [{ id: 'P1', name: 'P1', tasks: [T({ updatedAt: 300, title: 'edited later' })] }, { id: 'P2', name: 'P2', tasks: [] }], inbox: [], categories: [] };
  const merged = mergeStates(a, b);
  assert.deepStrictEqual(merged.projects.map((p) => p.tasks.map((t) => t.title)), [['edited later'], []]);
});

test('markup: every open row has a grip before the checkbox, done rows have none', () => {
  const p = { id: 'p1', name: 'P' };
  const open = renderTaskRow({ id: 't1', title: 'Water <plants>', status: 'next' }, p, [], { editingTask: null });
  assert.match(open, /<button type="button" class="task-grip" data-task="t1" data-project="p1" aria-label="Move Water &lt;plants&gt;"/);
  assert.ok(open.indexOf('class="task-grip"') < open.indexOf('type="checkbox"'), 'the grip comes first');
  assert.ok(open.includes('<svg'), 'it carries the hand-drawn grip icon');
  const done = renderTaskRow({ id: 't2', title: 'Old', status: 'done' }, p, [], { editingTask: null });
  assert.ok(!done.includes('task-grip'), 'done rows do not drag');
});

test('markup: both groups always render, in sortOrder, empty ones as drop targets', () => {
  const p = { id: 'p1', name: 'P', color: 'red', tasks: [task('a', 3, { status: 'next' }), task('b', 1, { status: 'next' })] };
  const html = renderProjectCard(p, { doneOpen: {}, projectCollapsed: {}, editingProject: {}, addingTask: {}, projectView: 'all' }, [], [], false);
  assert.ok(html.indexOf('data-task="b"') < html.indexOf('data-task="a"'), 'ascending sortOrder');
  assert.match(html, /class="task-group is-empty" data-group="doing" data-project="p1"><h4 class="group-label">In progress<\/h4><div class="drop-zone">Drop here<\/div>/);
  assert.match(html, /class="task-group" data-group="next" data-project="p1"><h4 class="group-label">Up next<\/h4>/);
});

test('markup: the move dialog', () => {
  const html = renderMoveDialog('Move “A & B” to C?');
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /A &amp; B/);
  assert.ok(html.includes('data-dialog="move"') && html.includes('data-dialog="cancel"'));
});

test('a sync that lists the old repo while a transfer is in flight does not mark the task done', async () => {
  const t = task('t', 1, { source: 'github', repoFullName: 'a/b', issueNumber: 12, url: 'old' });
  state.projects = [
    { id: 'pb', name: 'b', source: 'github', repoFullName: 'a/b', tasks: [] },
    { id: 'pc', name: 'c', source: 'github', repoFullName: 'a/c', tasks: [t] },
  ];
  let releaseGraphql;
  const graphqlHeld = new Promise((r) => { releaseGraphql = r; });
  respond = (c) => {
    if (c.url === '/graphql') return graphqlHeld.then(() => ({ data: { transferIssue: { issue: { number: 3, url: 'https://github.com/a/c/issues/3' } } } }));
    return { node_id: 'N' };
  };
  const moving = transferTaskIssue('t', 'a/c', {}, 'c');
  await new Promise((r) => setTimeout(r, 0)); // let the transfer reach the held GraphQL call
  // the old repo's list no longer has #12: it has left for a/c
  upsertRepoProject({ full_name: 'a/b', name: 'b', html_url: 'u', private: false }, [], {});
  assert.strictEqual(t.status, 'next', 'mid-transfer, the task is not closed by the old repo\'s list');
  releaseGraphql();
  assert.strictEqual(await moving, true);
  assert.deepStrictEqual([t.status, t.repoFullName, t.issueNumber], ['next', 'a/c', 3]);
});
