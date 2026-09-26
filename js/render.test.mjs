// focus-deck-app/js/render.test.mjs — run with: node js/render.test.mjs
import { renderTaskRow, renderToast, renderFocus, renderTaskEditForm, renderInbox, unsortedQueue, unsortedCurrent, renderProjectSidebar } from './render.js';
import assert from 'node:assert';

const p = { id: 'p1', name: 'P' };
const cats = [{ id: 'cat_bug', name: 'Bug', color: 'hsl(4 70% 55%)' }];
const ui = { editingTask: null };
const base = { id: 't1', title: 'T', energy: 'low', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 1, url: 'https://github.com/o/r/issues/1', categoryIds: ['cat_bug'] };
const row = (over) => renderTaskRow({ ...base, ...over }, p, cats, ui);

assert.ok(!row({}).includes('claude-chip'), 'a plain task shows no Claude chips');

const created = row({ claudeCreated: true });
assert.ok(created.includes('claude-created-chip') && created.includes('>Claude created<'), 'claudeCreated renders the created chip');
assert.ok(!created.includes('claude-completed-chip'), 'created alone does not render the completed chip');

const completed = row({ claudeCompleted: true, status: 'done' });
assert.ok(completed.includes('claude-completed-chip') && completed.includes('>Claude completed<'), 'claudeCompleted on a done task renders the completed chip');

assert.ok(!row({ claudeCompleted: true, status: 'next' }).includes('claude-completed-chip'), 'a reopened task must not show the completed chip even if the flag is stale');

const both = row({ claudeCreated: true, claudeCompleted: true, status: 'done' });
assert.ok(both.includes('claude-created-chip') && both.includes('claude-completed-chip'), 'both chips can show together');
assert.ok(both.indexOf('cat-chip') < both.indexOf('claude-created-chip'), 'Claude chips come after the category chip so they never displace it');
assert.ok(both.indexOf('claude-created-chip') < both.indexOf('claude-completed-chip'), 'created chip precedes completed chip');

const linked = row({});
assert.ok(/<a class="task-title" href="https:\/\/github.com\/o\/r\/issues\/1"[^>]*target="_blank"/.test(linked), 'a linked task title is a link to its issue');
assert.ok(!/class="task-title"[^>]*data-action="edit-task"/.test(linked), 'a linked task title must not open the edit form');
assert.ok(/data-action="edit-task"[^>]*>Edit</.test(linked), 'a linked task gets a separate Edit button');
const manual = row({ source: 'manual', url: undefined, repoFullName: undefined, issueNumber: undefined });
assert.ok(/<span class="task-title" data-action="edit-task"/.test(manual), 'an unlinked task title still opens the edit form');
assert.ok(!manual.includes('>Edit<'), 'an unlinked task needs no separate Edit button');

const multi = renderTaskRow({ ...base, categoryIds: ['cat_bug', 'cat_art'] }, p, cats.concat([{ id: 'cat_art', name: 'Art', color: '#fbca04' }]), ui);
assert.ok(multi.includes('>Bug<') && multi.includes('>Art<'), 'every label on a task gets its own chip');
assert.ok(row({ priority: 'urgent' }).includes('class="chip priority-chip small" data-action="cycle-priority"') && row({ priority: 'urgent' }).includes('>Urgent<'), 'a task with a priority shows it as a chip');
assert.ok(row({ priority: null }).includes('>+ Priority<'), 'an open task with no priority offers to set one');
assert.ok(!row({}).includes('energy-chip'), 'the energy chip is hidden while ENERGY_UI_ENABLED is off');

// focus picker: one card per label with open tasks, busiest first, then a separate "Surprise me"; project pills narrow it
{
  const task = (id, cats, extra) => ({ id, title: id, status: 'next', categoryIds: cats, ...extra });
  const st = {
    focus: null,
    categories: [{ id: 'c_art', name: 'art', color: '#d000ff' }, { id: 'c_chore', name: 'chore', color: '#888888' }, { id: 'c_idle', name: 'idle', color: '#123456' }],
    projects: [
      { id: 'pA', name: 'PlunderSpell', tasks: [task('a1', ['c_art'], { priority: 'urgent' }), task('a2', ['c_art']), task('a3', ['c_idle'], { status: 'done' })] },
      { id: 'pB', name: 'Chores', color: 'hsl(140 58% 40%)', tasks: [task('b1', ['c_chore', 'c_art'])] },
    ],
  };
  const html = renderFocus(st, () => null, { focusFilter: {} });
  const cards = [...html.matchAll(/data-action="pick-focus" data-category="([^"]*)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(cards, ['c_art', 'c_chore', ''], 'label cards busiest first, labels with nothing open left out, "Surprise me" last');
  assert.ok(/<div class="focus-surprise"><button type="button" class="btn primary" data-action="pick-focus" data-category=""[^>]*>Surprise me<\/button>/.test(html), '"Surprise me" is its own accent button, not a card');
  assert.ok(html.indexOf('focus-grid') < html.indexOf('focus-surprise') && !html.slice(html.indexOf('focus-grid'), html.indexOf('focus-surprise')).includes('>Surprise me<'), '"Surprise me" sits outside the card grid');
  assert.ok(!html.includes('>Anything<'), 'there is no "Anything" card any more');
  assert.ok(html.includes('>3 open · 1 urgent · 2 projects<'), 'a card says how many are open, the most pressing priority, and across how many projects');
  assert.ok(html.includes('class="filter-pill active" data-action="set-focus-scope" data-scope="">All projects<'), '"All projects" is chosen by default');
  assert.ok(html.includes('class="filter-pill tint-pill" data-action="set-focus-scope" data-scope="pB" style="--chip-color:hsl(140 58% 40%)">Chores<'), 'a project pill is tinted in the project\'s own colour');
  assert.ok(!html.includes('<select'), 'no dropdowns in the picker');
  const narrowed = renderFocus(st, () => null, { focusFilter: { projectId: 'pB' } });
  assert.ok(narrowed.includes('>1 open<') && !narrowed.includes('2 projects'), 'a chosen project narrows the counts');
  assert.ok(renderFocus(st, () => null, { focusFilter: { projectId: 'gone' } }).includes('class="filter-pill active" data-action="set-focus-scope" data-scope="">All projects<'), 'a remembered project that no longer exists falls back to All projects');

  // Project mode was removed: a remembered mode: 'project' still renders the Type view
  const oldMode = renderFocus(st, () => null, { focusFilter: { mode: 'project' } });
  assert.ok(!oldMode.includes('focus-mode') && oldMode.includes('data-category="c_art"') && oldMode.includes('>All projects<'), 'only the Type view renders, even for a remembered Project mode');
  // project pills collapse to the busiest six, with a "+N more" pill that expands them
  const manyProjects = { ...st, projects: Array.from({ length: 9 }, (_, i) => ({ id: 'p' + i, name: 'project-with-a-long-name-' + i, color: '#123456', tasks: Array.from({ length: 9 - i }, (_, j) => task('t' + i + '_' + j, ['c_art'])) })) };
  const collapsed = renderFocus(manyProjects, () => null, { focusFilter: {} });
  assert.strictEqual((collapsed.match(/data-action="set-focus-scope"/g) || []).length, 7, 'All projects plus the six busiest projects');
  assert.ok(collapsed.includes('data-action="toggle-focus-projects">+3 more<'), 'a "+N more" pill counts the hidden projects');
  assert.ok(!collapsed.includes('>project-with-a-long-name-8<'), 'the least busy project is hidden until expanded');
  const chosenHidden = renderFocus(manyProjects, () => null, { focusFilter: { projectId: 'p8' } });
  assert.ok(chosenHidden.includes('class="filter-pill tint-pill active" data-action="set-focus-scope" data-scope="p8"'), 'the chosen project always shows, even if it would be hidden');
  const expanded = renderFocus(manyProjects, () => null, { focusFilter: {}, focusShowAllProjects: true });
  assert.strictEqual((expanded.match(/data-action="set-focus-scope"/g) || []).length, 10, 'expanded: every project gets a pill, with its full name');
  assert.ok(expanded.includes('data-action="toggle-focus-projects">Show fewer<'), 'expanded pills offer Show fewer');
}

// unlabelled tasks: the focus picker keeps its Unlabelled card but no longer links to a sort flow
{
  const task = (id, cats, extra) => ({ id, title: id, status: 'next', categoryIds: cats, ...extra });
  const st = {
    focus: null,
    categories: [{ id: 'c_art', name: 'art', color: '#d000ff' }, { id: 'c_fix', name: 'Fix', color: '#ff0000' }],
    projects: [{ id: 'pA', name: 'PlunderSpell', color: 'red', tasks: [task('a1', ['c_art']), task('u1', []), task('u2', [], { priority: 'urgent' }), task('u3', [], { status: 'done' })] }],
  };
  const picker = renderFocus(st, () => null, { focusFilter: {} });
  assert.ok(picker.includes('data-category="__none__"') && picker.includes('>Unlabelled<') && picker.includes('>2 open · 1 urgent<'), 'an Unlabelled card counts open tasks with no label');
  assert.ok(!picker.includes('start-sort'), 'the old "Sort N unlabelled" link is gone -- the Unsorted card below handles it now');
  const noneLeft = { ...st, projects: [{ id: 'pA', name: 'P', color: 'red', tasks: [task('a1', ['c_art'])] }] };
  assert.ok(!renderFocus(noneLeft, () => null, { focusFilter: {} }).includes('Unlabelled'), 'no Unlabelled card when every task has a label');
}

// unsortedQueue: captured thoughts (oldest first), then every open unlabelled task, project order
// then task order; done or labelled tasks are excluded
{
  const task = (id, cats, extra) => ({ id, title: id, status: 'next', categoryIds: cats, ...extra });
  const st = {
    inbox: [{ id: 'th1', text: 'older thought', createdAt: 1 }, { id: 'th2', text: 'newer thought', createdAt: 2 }],
    categories: [],
    projects: [
      { id: 'pA', name: 'A', color: 'red', tasks: [task('a1', ['c_art']), task('u1', [])] },
      { id: 'pB', name: 'B', color: 'blue', tasks: [task('u2', [], { priority: 'urgent' }), task('u3', [], { status: 'done' })] },
    ],
  };
  const queue = unsortedQueue(st);
  assert.deepStrictEqual(queue.map((x) => x.key), ['i:th1', 'i:th2', 't:u1', 't:u2'], 'thoughts (oldest first) come before unlabelled open tasks (project order, then task order)');
  assert.strictEqual(unsortedCurrent(st, { skipped: [] }).key, 'i:th1', 'the current item is the first non-skipped one');
  assert.strictEqual(unsortedCurrent(st, { skipped: ['i:th1', 'i:th2'] }).key, 't:u1', 'skipped items are passed over');
  assert.strictEqual(unsortedCurrent(st, { skipped: ['i:th1', 'i:th2', 't:u1', 't:u2'] }), null, 'null once everything is skipped');
}

const freshUnsorted = () => ({ skipped: [], projectId: null, selected: [], newLabels: '', showAllLabels: false, showAllProjects: false, currentKey: null });

// renderInbox: a captured thought, project step
{
  const st = {
    inbox: [{ id: 'th1', text: 'call the plumber', createdAt: Date.now() - 3 * 60000 }],
    categories: [{ id: 'c_fix', name: 'Fix', color: '#ff0000' }],
    projects: [
      { id: 'pBusy', name: 'Busy Project', color: 'red', tasks: [{ id: 'b1', status: 'next', categoryIds: ['c_fix'] }, { id: 'b2', status: 'next', categoryIds: ['c_fix'] }] },
      { id: 'pQuiet', name: 'Quiet Project', color: 'blue', tasks: [] },
    ],
  };
  const html = renderInbox(st, { inboxOpen: true, unsorted: freshUnsorted() });
  assert.ok(html.includes('📥 Unsorted') && html.includes('class="count">1<'), 'the header keeps its toggle and shows the queue count');
  assert.ok(html.includes('Which project?'), 'a captured thought asks which project first');
  const pillIds = [...html.matchAll(/data-action="unsorted-project" data-project="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(pillIds, ['pBusy', 'pQuiet'], 'project pills are ranked busiest (most open tasks) first, full names shown');
  assert.ok(html.includes('>Busy Project<') && html.includes('>Quiet Project<'), 'names are never shortened');
  assert.ok(html.includes('data-action="unsorted-complete"') && html.includes('data-action="unsorted-skip"') && html.includes('data-action="unsorted-delete"'), 'Done, Skip and Delete are offered');
  assert.ok(!html.includes('unsorted-file'), 'no File button until a project is chosen');

  const manyProjects = { ...st, projects: Array.from({ length: 10 }, (_, i) => ({ id: 'p' + i, name: 'Project ' + i, color: 'red', tasks: [] })) };
  const withMany = renderInbox(manyProjects, { inboxOpen: true, unsorted: freshUnsorted() });
  assert.ok(withMany.includes('data-action="unsorted-more-projects">+2 more<'), 'a "+N more" pill appears after the first 8 projects');
}

// renderInbox: a captured thought, label step once a project is chosen
{
  const st = {
    inbox: [{ id: 'th1', text: 'call the plumber', createdAt: Date.now() }],
    categories: [{ id: 'c_fix', name: 'Fix', color: '#ff0000' }],
    projects: [{ id: 'pA', name: 'PlunderSpell', color: 'red', tasks: [] }],
  };
  const u = Object.assign(freshUnsorted(), { projectId: 'pA' });
  const html = renderInbox(st, { inboxOpen: true, unsorted: u });
  assert.ok(html.includes('What kind of task is this?'), 'choosing a project advances to the label step');
  const kindTokens = [...html.matchAll(/class="energy-btn[^"]*" data-action="sort-toggle" data-token="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(kindTokens, ['kind:reminder', 'kind:build', 'c_fix'], 'Reminder / Build / Fix come first; an existing "Fix" label is reused instead of a new one');
  assert.ok(html.includes('data-action="unsorted-file" data-inbox="th1">File →<'), 'File files the thought into the chosen project');
  assert.ok(html.includes('data-action="unsorted-change-project"') && html.includes('PlunderSpell · change'), 'the chosen project shows as a change-project button');
}

// renderInbox: a task already in a project goes straight to the label step, no project choice
{
  const st = {
    inbox: [],
    categories: [],
    projects: [{ id: 'pA', name: 'PlunderSpell', color: 'red', tasks: [{ id: 't1', title: 'Fix the thing', status: 'next', categoryIds: [], issueNumber: 42 }] }],
  };
  const html = renderInbox(st, { inboxOpen: true, unsorted: freshUnsorted() });
  assert.ok(html.includes('class="chip proj-chip" style="--chip-color:red">PlunderSpell<') && html.includes('>#42<'), 'a task shows its project and issue number as chips');
  assert.ok(html.includes('What kind of task is this?'), 'a task skips the project step entirely');
  assert.ok(html.includes('data-action="unsorted-save" data-task="t1" data-project="pA">Save →<'), 'Save files the picks onto the task');
  assert.ok(!html.includes('Which project?'), 'no project step for a task that already has one');
}

// renderInbox: skip list and the empty-queue / all-skipped states
{
  const st = { inbox: [{ id: 'th1', text: 'one', createdAt: 1 }, { id: 'th2', text: 'two', createdAt: 2 }], categories: [], projects: [] };
  const skippedFirst = Object.assign(freshUnsorted(), { skipped: ['i:th1'] });
  const html = renderInbox(st, { inboxOpen: true, unsorted: skippedFirst });
  assert.ok(html.includes('>two<'), 'skipping the current item moves to the next');
  const allSkipped = Object.assign(freshUnsorted(), { skipped: ['i:th1', 'i:th2'] });
  const allSkippedHtml = renderInbox(st, { inboxOpen: true, unsorted: allSkipped });
  assert.ok(allSkippedHtml.includes('2 skipped for now.') && allSkippedHtml.includes('data-action="unsorted-restart">Go through them again<'), 'once everything is skipped, a restart link clears the skip list');
  const empty = renderInbox({ inbox: [], categories: [], projects: [] }, { inboxOpen: true, unsorted: freshUnsorted() });
  assert.ok(empty.includes('Nothing to sort'), 'an empty queue says so');
}

// label ranking on the Unsorted card: this task's project first (busiest), then the rest, capped
// with "+N more" -- ported from the old sort flow's equivalent test
{
  const manyLabels = Array.from({ length: 12 }, (_, i) => ({ id: 'L' + i, name: 'label' + i, color: '#123456' }));
  const task = (id, cats) => ({ id, title: id, status: 'next', categoryIds: cats });
  const busy = {
    inbox: [], categories: manyLabels,
    projects: [
      { id: 'pA', name: 'Here', color: 'red', tasks: [task('h1', ['L11']), task('h2', ['L11', 'L10']), task('hu', [])] },
      { id: 'pB', name: 'Elsewhere', color: 'blue', tasks: [task('e1', ['L0']), task('e2', ['L0']), task('e3', ['L0'])] },
    ],
  };
  const busyFlow = renderInbox(busy, { inboxOpen: true, unsorted: freshUnsorted() });
  const pillOrder = [...busyFlow.matchAll(/class="filter-pill tint-pill[^"]*" data-action="sort-toggle" data-token="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(pillOrder.slice(0, 3), ['L11', 'L10', 'L0'], 'labels this project uses come first (busiest first), then the rest by use elsewhere');
  assert.strictEqual(pillOrder.length, 8, 'only eight label pills show at first');
  assert.ok(busyFlow.includes('data-action="sort-more-labels">+4 more<'), 'a "+N more" pill counts the hidden labels');
  const pickedHidden = renderInbox(busy, { inboxOpen: true, unsorted: Object.assign(freshUnsorted(), { selected: ['L9'] }) });
  assert.ok(pickedHidden.includes('data-token="L9"'), 'a picked label always shows, even if it would be hidden');
  const allShown = renderInbox(busy, { inboxOpen: true, unsorted: Object.assign(freshUnsorted(), { showAllLabels: true }) });
  assert.strictEqual([...allShown.matchAll(/data-action="sort-toggle" data-token="L/g)].length, 12, '"+N more" reveals every label');
}

// a picked task's project chip jumps to that project
{
  const st = { focus: { taskId: 'x1', pool: ['x1'] }, categories: [], projects: [{ id: 'pZ', name: 'PlunderSpell', color: 'red', tasks: [{ id: 'x1', title: 'Pick me', status: 'next', categoryIds: [] }] }] };
  const find = (id) => ({ task: st.projects[0].tasks.find((t) => t.id === id), project: st.projects[0] });
  const active = renderFocus(st, find, { focusFilter: {} });
  assert.ok(active.includes('<button type="button" class="chip proj-chip" data-action="scroll-project" data-project="pZ"'), 'the picked task\'s project chip is a button that jumps to the project');
}

// wide-screen project sidebar: search, category pills, sort, and a row per visible project that jumps to it
{
  const projects = [
    { id: 'p1', name: 'PlunderSpell', color: 'red', tasks: [{ id: 'a', status: 'next' }, { id: 'b', status: 'done' }] },
    { id: 'p2', name: 'Chores', color: 'green', tasks: [] },
  ];
  const side = renderProjectSidebar({ projects, projectCategories: [] }, { projectQuery: 'plu', projectSort: 'name', projectCollapsed: {} }, [projects[0]]);
  assert.ok(side.startsWith('<aside class="project-sidebar"'), 'the sidebar is an aside');
  assert.ok(side.includes('class="project-search sidebar-search" data-action="set-project-query"') && side.includes('value="plu"'), 'it has its own search box, sharing the project search');
  assert.ok(side.includes('data-action="set-project-filter"') && side.includes('data-action="set-project-sort"'), 'it has the category pills and sort');
  assert.ok(side.includes('data-action="scroll-project" data-project="p1"') && side.includes('>PlunderSpell<') && side.includes('title="Open tasks">1<'), 'a visible project is a row with its open count that jumps to it');
  assert.ok(!side.includes('data-project="p2"'), 'projects hidden by the search are left out');
  assert.strictEqual(renderProjectSidebar({ projects: [], projectCategories: [] }, {}, []), '', 'no projects, no sidebar');
}

// GitHub controls: the row shows only the issue number; unlink / link / create live in the edit form
{
  const linkedRow = row({});
  assert.ok(linkedRow.includes('class="chip gh-chip small"') && !linkedRow.includes('unlink-github-issue'), 'a linked row shows #N but no Unlink');
  const plainRow = row({ source: 'manual', url: undefined, repoFullName: undefined, issueNumber: undefined });
  assert.ok(!plainRow.includes('link-github-issue') && !plainRow.includes('create-github-issue'), 'an unlinked row has no Link or + Issue');
  const linkedForm = renderTaskEditForm({ ...base }, p, cats);
  assert.ok(linkedForm.includes('Linked to o/r#1') && linkedForm.includes('data-action="unlink-github-issue"'), 'the edit form of a linked task offers Unlink');
  const plainForm = renderTaskEditForm({ ...base, source: 'manual', url: undefined, repoFullName: undefined, issueNumber: undefined }, p, cats);
  assert.ok(plainForm.includes('data-action="create-github-issue"') && plainForm.includes('data-action="link-github-issue"'), 'the edit form of an unlinked task offers create and link');
  const inbox = renderInbox({ inbox: [{ id: 'i1', text: 'idea', createdAt: Date.now() }], projects: [{ id: 'p1', name: 'P', color: 'red', tasks: [] }], categories: cats }, { inboxOpen: true, unsorted: freshUnsorted() });
  assert.ok(inbox.includes('Which project?') && inbox.includes('data-action="unsorted-project" data-project="p1"'), 'a captured thought is guided to a project before it can be filed');
}

assert.strictEqual(renderToast(null, 'error'), '', 'no message means no toast');
const toast = renderToast('Could not link <b>', 'error');
assert.ok(toast.includes('class="toast toast-error"') && toast.includes('role="alert"'), 'an error renders the pinned toast in its error style, announced');
assert.ok(toast.includes('Could not link &lt;b&gt;'), 'the message text is escaped');
assert.ok(toast.includes('data-action="dismiss-toast"'), 'the toast can be dismissed');
const info = renderToast('Linked instead', 'info');
assert.ok(info.includes('class="toast"') && info.includes('role="status"'), 'a notice uses the plain toast style and a polite announcement');

console.log('RENDER CHIP TESTS PASSED');
