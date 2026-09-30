// focus-deck-app/js/render.test.mjs — run with: node js/render.test.mjs
import { renderTaskRow, chipsMaxPct, renderToast, renderFocus, renderTaskEditForm, renderInbox, unsortedQueue, unsortedCurrent, renderProjectSidebar, renderProjectCard, renderProjectsMain, renderSyncButton, syncButtonTitle } from './render.js';
import assert from 'node:assert';

// the top-bar sync button: title/aria-label branch on whether it's ever synced, and it spins +
// disables while a sync is in flight
{
  const never = { githubSync: {} };
  assert.strictEqual(syncButtonTitle(never), 'Sync with GitHub', 'never synced -- no "synced Nm ago" suffix');
  const synced = { githubSync: { lastSyncedAt: Date.now() - 4 * 60000 } };
  assert.strictEqual(syncButtonTitle(synced), 'Sync with GitHub · synced 4m ago', 'synced -- relative time in the title');

  const idleHtml = renderSyncButton(never);
  assert.ok(idleHtml.includes('title="Sync with GitHub"') && idleHtml.includes('aria-label="Sync with GitHub"'), 'title and aria-label match when idle');
  assert.ok(!idleHtml.includes('disabled') && !idleHtml.includes('is-syncing'), 'not disabled or spinning when idle');

  const syncingHtml = renderSyncButton({ ...synced, _ui: { syncing: true } });
  assert.ok(syncingHtml.includes('is-syncing') && syncingHtml.includes('disabled'), 'spins and disables while syncing');
  assert.ok(syncingHtml.includes('title="Sync with GitHub · synced 4m ago"'), 'title stays current even while syncing');
}

const p = { id: 'p1', name: 'P' };
const cats = [{ id: 'cat_bug', name: 'Bug', color: 'hsl(4 70% 55%)' }];
const ui = { editingTask: null };
const base = { id: 't1', title: 'T', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 1, url: 'https://github.com/o/r/issues/1', categoryIds: ['cat_bug'] };
const row = (over) => renderTaskRow({ ...base, ...over }, p, cats, ui);

// #104: Claude provenance is a quiet icon after the title, plus a "Claude created" label chip in the chips column
{
  const plain = row({});
  assert.ok(!plain.includes('claude-mark'), 'a task without the Claude created label shows no marker');
  const created = row({ claudeCreated: true });
  assert.ok(created.includes('aria-label="Opened by Claude"') && created.includes('title="Opened by Claude"'), 'claudeCreated shows an "Opened by Claude" mark');
  assert.ok(!created.includes('Completed by Claude'), 'an open Claude-created task shows only the created mark');
  assert.ok(created.indexOf('claude-mark') > created.indexOf('class="task-title"') && created.indexOf('claude-mark') < created.indexOf('<div class="task-chips">'), 'the mark sits inside the title zone, before the chips column');
  assert.ok(/<span class="chip cat-chip claude-chip small"[^>]*>Claude created<\/span>/.test(created), 'claudeCreated shows a "Claude created" label chip');
  assert.ok(created.indexOf('claude-chip') > created.indexOf('<div class="task-chips">') && created.indexOf('claude-chip') > created.indexOf('cat-chip small" data-cat-id'), 'the chip is in the chips column, after the real labels');
  assert.ok(!plain.includes('claude-chip') && !row({ claudeCompleted: true, status: 'done' }).includes('claude-chip'), 'no chip without claudeCreated, and none for claudeCompleted');
  assert.ok(!created.includes('claude-chip" data-cat-id') && !/claude-chip[^>]*data-cat-id/.test(created), 'the Claude chip is not a category chip (no data-cat-id)');
  const closed = row({ claudeCreated: true, claudeCompleted: true, status: 'done' });
  assert.ok(closed.includes('Opened by Claude') && closed.includes('Completed by Claude'), 'a done task Claude opened and closed shows both marks');
  assert.ok(row({ claudeCompleted: true, status: 'next' }).includes('claude-mark') === false, 'a stale claudeCompleted on a non-done task shows nothing');
  assert.ok(row({ claudeCompleted: true, status: 'done' }).includes('Completed by Claude') && !row({ claudeCompleted: true, status: 'done' }).includes('Opened by Claude'), 'Claude can close an issue it did not open');
  // a marker changes neither the chips column ceiling nor its chips
  assert.strictEqual(row({ claudeCreated: true, title: 'A long title '.repeat(6) }).match(/--chips-max:(\d+)%/)[1], String(chipsMaxPct('A long title '.repeat(6))), 'chipsMaxPct ignores the marker');
  assert.strictEqual(created.match(/<div class="task-chips">.*<\/div>/)[0].replace(/<span class="chip cat-chip claude-chip.*?<\/span>/, ''), plain.match(/<div class="task-chips">.*<\/div>/)[0], 'apart from the Claude chip the chips column is identical');
}

// Q14a/Q12f: tapping the title always opens the editor now, linked or not -- the row itself has no
// #N badge, Edit link, Focus → or delete button any more (those moved into the editor).
const linked = row({});
assert.ok(/<span class="task-title" data-action="edit-task" data-task="t1" data-project="p1" role="button" tabindex="0">T<\/span>/.test(linked), 'a linked task title opens the editor, same as an unlinked one');
assert.ok(!linked.includes('<a class="task-title"'), 'a linked task title is no longer a link to its issue');
assert.ok(!linked.includes('gh-chip') && !linked.includes('>Edit<') && !linked.includes('focus-task') && !linked.includes('mini-x'), 'no #N badge, Edit link, Focus →, or delete button on the row');
const manual = row({ source: 'manual', url: undefined, repoFullName: undefined, issueNumber: undefined });
assert.ok(/<span class="task-title" data-action="edit-task"/.test(manual), 'an unlinked task title still opens the edit form');
assert.ok(!manual.includes('>Edit<'), 'an unlinked task needs no separate Edit button');

// #97/#92: checkbox, then the title zone, then the chips zone (priority -> labels -> deadline);
// the chips zone stays present, empty, when a task has no chips.
const full = row({ priority: 'high', deadline: '2026-10-01' });
const iBox = full.indexOf('<input type="checkbox"'), iTitle = full.indexOf('class="task-title"'), iChips = full.indexOf('<div class="task-chips">');
const iPrio = full.indexOf('priority-chip'), iCat = full.indexOf('cat-chip'), iDl = full.indexOf('deadline-chip');
assert.ok(iBox >= 0 && iBox < iTitle && iTitle < iChips, 'row order is checkbox, .task-title, .task-chips');
assert.ok(iChips < iPrio && iPrio < iCat && iCat < iDl, '.task-chips holds priority, then labels, then the deadline');
assert.ok(!full.includes('task-main'), 'the .task-main wrapper is gone');
assert.ok(row({ categoryIds: [], priority: undefined, deadline: undefined }).includes('<div class="task-chips"></div>'), 'a chipless row keeps an empty .task-chips zone');
const longCat = renderTaskRow({ ...base, categoryIds: ['cat_long'] }, p, [{ id: 'cat_long', name: 'a very long label name that cannot fit', color: '#fbca04' }], ui);
assert.ok(/class="chip cat-chip small"[^>]*title="A Very Long Label Name That Cannot Fit" aria-label="A Very Long Label Name That Cannot Fit"/.test(longCat), 'a label chip carries its full (displayed) name in title and aria-label');

const multi = renderTaskRow({ ...base, categoryIds: ['cat_bug', 'cat_art'] }, p, cats.concat([{ id: 'cat_art', name: 'Art', color: '#fbca04' }]), ui);
assert.ok(multi.includes('>Bug<') && multi.includes('>Art<'), 'every label on a task gets its own chip');
assert.ok(row({ priority: 'urgent' }).includes('class="chip priority-chip small" data-action="cycle-priority"') && row({ priority: 'urgent' }).includes('>Urgent<'), 'a task with a priority shows it as a chip');
assert.ok(!row({ priority: null }).includes('priority-chip'), 'an open task with no priority shows no placeholder chip -- priority is set from the edit form');
assert.ok(!row({}).includes('energy-chip'), 'the energy chip was removed with the energy system');

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
  assert.ok(html.includes('class="filter-pill" data-action="set-focus-scope" data-scope="pB"><span class="proj-dot" style="--dot:hsl(140 58% 40%)"></span>Chores<'), 'a project pill is neutral, with a colour dot for the project\'s identity');
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
  assert.ok(chosenHidden.includes('class="filter-pill active" data-action="set-focus-scope" data-scope="p8"'), 'the chosen project always shows, even if it would be hidden');
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
  assert.ok(html.includes('>Unsorted <') && html.includes('class="count">1<'), 'the header keeps its toggle and shows the queue count');
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
  assert.ok(html.includes('class="chip proj-chip"><span class="proj-dot" style="--dot:red"></span>PlunderSpell<') && html.includes('>#42<'), 'a task shows its project and issue number as chips');
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
  const side = renderProjectSidebar({ projects, projectCategories: [] }, { projectQuery: 'plu', projectSort: 'name', projectCollapsed: {}, projectView: 'all' }, [projects[0]]);
  assert.ok(side.includes('<div class="drawer-backdrop" data-action="close-projects-drawer"></div>'), 'a backdrop (closed) sits alongside the sidebar/drawer');
  assert.ok(side.includes('<aside class="project-sidebar" id="projects-drawer" tabindex="-1" aria-label="Projects">'), 'closed (or the wide-screen sidebar), it is a plain aside, not a modal');
  assert.ok(side.includes('class="project-search sidebar-search" data-action="set-project-query"') && side.includes('value="plu"'), 'it has its own search box, sharing the project search');
  assert.ok(side.includes('data-action="set-project-filter"') && side.includes('data-action="set-project-sort"'), 'it has the category pills and sort');
  assert.ok(side.includes('data-action="scroll-project" data-project="p1"') && side.includes('>PlunderSpell<') && side.includes('title="Open tasks">1<'), 'a visible project is a row with its open count that jumps to it');
  assert.ok(!side.includes('data-project="p2"'), 'projects hidden by the search are left out');
  assert.strictEqual(renderProjectSidebar({ projects: [], projectCategories: [] }, {}, []), '', 'no projects, no sidebar');

  const open = renderProjectSidebar({ projects, projectCategories: [] }, { projectQuery: '', projectSort: 'name', projectCollapsed: {}, projectView: 'all', projectsDrawerOpen: true }, projects);
  assert.ok(open.includes('class="drawer-backdrop is-open"') && open.includes('class="project-sidebar is-open" id="projects-drawer"'), 'ui.projectsDrawerOpen adds is-open to both the backdrop and the drawer');
  assert.ok(open.includes('role="dialog" aria-modal="true"'), 'open as the drawer, it is a modal dialog');

  // The "All"/"One" switch (PR 6): a two-option segmented control right under the title row.
  assert.ok(side.includes('role="group" aria-label="Project view"'), 'the switch is a labelled group');
  assert.ok(side.includes('data-action="set-project-view" data-view="all"') && side.includes('data-action="set-project-view" data-view="one"'), 'it has an All button and a One button');
  assert.ok(/class="filter-pill active" data-action="set-project-view" data-view="all" aria-pressed="true"/.test(side), 'the current view ("all" here) is pressed and gets the active pill treatment');
  assert.ok(/class="filter-pill" data-action="set-project-view" data-view="one" aria-pressed="false"/.test(side), 'the other option is not pressed');
  const oneSide = renderProjectSidebar({ projects, projectCategories: [] }, { projectQuery: '', projectSort: 'name', projectCollapsed: {}, projectView: 'one' }, projects);
  assert.ok(/class="filter-pill active" data-action="set-project-view" data-view="one" aria-pressed="true"/.test(oneSide), 'switching to "one" moves the active state to that button');
  assert.ok(!oneSide.includes('data-action="toggle-collapse-all"'), '"Collapse all" is left out of the sidebar in the "One" view');
}

// GitHub controls: the row shows nothing at all; unlink / link / create / Open issue / Focus /
// Delete all live in the edit form now (Q14a, Q12f).
{
  const linkedRow = row({});
  assert.ok(!linkedRow.includes('gh-chip') && !linkedRow.includes('unlink-github-issue'), 'a linked row shows no #N badge and no Unlink');
  const plainRow = row({ source: 'manual', url: undefined, repoFullName: undefined, issueNumber: undefined });
  assert.ok(!plainRow.includes('link-github-issue') && !plainRow.includes('create-github-issue'), 'an unlinked row has no Link or + Issue');
  const linkedForm = renderTaskEditForm({ ...base }, p, cats);
  {
    const swatchCats = [{ id: 'l1', name: 'Bug', color: '#112233' }, { id: 'l2', name: 'UI', color: '#445566' }];
    const f = renderTaskEditForm({ ...base }, p, swatchCats);
    const inputs = f.match(/<input type="color"[^>]*>/g) || [];
    assert.strictEqual(inputs.length, 2, 'the label picker has one colour input per label');
    assert.ok(inputs[0].includes('data-id="l1"') && inputs[0].includes('value="#112233"') && inputs[1].includes('data-id="l2"') && inputs[1].includes('value="#445566"'), 'each with its label hex');
  }
  assert.ok(linkedForm.includes('Linked to o/r#1') && linkedForm.includes('data-action="unlink-github-issue"'), 'the edit form of a linked task offers Unlink');
  assert.ok(linkedForm.includes('data-action="focus-task" data-task="t1" data-project="p1">Focus on this<'), 'the edit form offers Focus on this');
  assert.ok(/<a class="link-btn small" href="https:\/\/github.com\/o\/r\/issues\/1" target="_blank" rel="noopener">Open issue ↗ o\/r#1<\/a>/.test(linkedForm), 'a linked task\'s edit form offers Open issue ↗, showing owner/repo#N, as a real link');
  assert.ok(linkedForm.includes('class="btn-text danger" data-action="delete-task" data-task="t1" data-project="p1">Delete<'), 'the edit form offers Delete');
  const plainForm = renderTaskEditForm({ ...base, source: 'manual', url: undefined, repoFullName: undefined, issueNumber: undefined }, p, cats);
  assert.ok(plainForm.includes('data-action="create-github-issue"') && plainForm.includes('data-action="link-github-issue"'), 'the edit form of an unlinked task offers create and link');
  assert.ok(!plainForm.includes('Open issue'), 'an unlinked task\'s edit form has no Open issue link');
  assert.ok(plainForm.includes('data-action="delete-task"'), 'an unlinked task still offers Delete');
  const doneForm = renderTaskEditForm({ ...base, status: 'done' }, p, cats);
  assert.ok(!doneForm.includes('>Focus on this<'), 'a done task has nothing to focus on');
  const inbox = renderInbox({ inbox: [{ id: 'i1', text: 'idea', createdAt: Date.now() }], projects: [{ id: 'p1', name: 'P', color: 'red', tasks: [] }], categories: cats }, { inboxOpen: true, unsorted: freshUnsorted() });
  assert.ok(inbox.includes('Which project?') && inbox.includes('data-action="unsorted-project" data-project="p1"'), 'a captured thought is guided to a project before it can be filed');
}

// Project header (Q15a, #83): controls stay on the first line whatever the name's length; the
// badges line always renders, even empty, so every card's progress bar sits at the same offset.
{
  const cardUi = () => ({ doneOpen: {}, pendingRemove: {}, projectCollapsed: {}, editingProject: {}, addingTask: {}, selectedProjectId: null, editingTask: null, projectView: 'all' });
  const short = { id: 'p1', name: 'Short', color: 'red', tasks: [] };
  const long = { id: 'p2', name: 'A very very long project name that used to wrap the header controls onto a second line', color: 'red', source: 'github', htmlUrl: 'https://github.com/o/r', private: true, categoryId: 'c1', tasks: [] };
  const projectCategories = [{ id: 'c1', name: 'Games', color: '#123456' }];
  const shortHtml = renderProjectCard(short, cardUi(), [], []);
  const longHtml = renderProjectCard(long, cardUi(), [], projectCategories);
  const headOf = (html) => html.slice(html.indexOf('<div class="project-head">'), html.indexOf('<div class="project-badges">'));
  assert.ok(headOf(shortHtml).includes('collapse-toggle') && headOf(shortHtml).includes('>Edit<'), 'the collapse toggle and Edit link are on line 1 for a short name');
  assert.ok(headOf(longHtml).includes('collapse-toggle') && headOf(longHtml).includes('>Edit<'), 'and still on line 1 for a long name plus badges (#83)');
  assert.ok(!shortHtml.includes('>Remove<') && !longHtml.includes('data-action="remove-project"' + '>'), 'no Remove button in the header any more');
  assert.ok(longHtml.includes('project-badges') && longHtml.includes('Private · GitHub ↗') && longHtml.includes('>Games<'), 'the badges line carries the GitHub badge and the category chip, display only');
  assert.ok(shortHtml.includes('<div class="project-badges"></div>'), 'a project with no badges still renders an empty badges line, so every card\'s progress bar lines up');
  assert.ok(!shortHtml.includes('+ Category'), 'the old "+ Category" header placeholder is gone');

  // Edit panel: opened via the header's Edit link, holds the category picker and Remove
  const editing = renderProjectCard(long, { ...cardUi(), editingProject: { p2: true } }, [], projectCategories);
  assert.ok(editing.includes('project-edit-panel') && editing.includes('data-action="set-project-category" data-project="p2"'), 'the Edit panel holds the category select');
  assert.ok(editing.includes('data-action="remove-project" data-project="p2">Remove project<'), 'the Edit panel holds Remove project');
  assert.ok(editing.includes('data-action="close-project-edit" data-project="p2">Done<'), 'Done closes the panel');
  // Colour without right-click (#95): colour input for the project, and for its category only when it has one
  const hexProj = { ...long, color: '#aa5500' };
  const colourEdit = renderProjectCard(hexProj, { ...cardUi(), editingProject: { p2: true } }, [], projectCategories);
  assert.ok(colourEdit.includes('data-color-for="project" data-id="p2" value="#aa5500"'), 'the Edit panel has a colour input with the project hex');
  assert.ok(colourEdit.includes('data-color-for="project-category" data-id="c1" value="#123456"'), 'and a category colour input with the category hex');
  const noCatEdit = renderProjectCard({ ...hexProj, categoryId: '' }, { ...cardUi(), editingProject: { p2: true } }, [], projectCategories);
  assert.ok(noCatEdit.includes('data-color-for="project"') && !noCatEdit.includes('data-color-for="project-category"'), 'no category colour input without a category');
  const confirming = renderProjectCard(long, { ...cardUi(), editingProject: { p2: true }, pendingRemove: { p2: true } }, [], projectCategories);
  assert.ok(confirming.includes('Yes') && confirming.includes('No'), 'Remove project still uses the two-step Yes/No confirm');

  // "+ Add task" collapses by default and opens the full form when tapped
  assert.ok(shortHtml.includes('data-action="open-add-task" data-project="p1">+ Add task<') && !shortHtml.includes('add-task-form'), 'collapsed: a single "+ Add task" line, no open form');
  const opened = renderProjectCard(short, { ...cardUi(), addingTask: { p1: true } }, [], []);
  assert.ok(opened.includes('<form class="add-task-form"') && opened.includes('name="title"') && opened.includes('autofocus'), 'open: the full add-task form, title focused');
  assert.ok(opened.includes('data-action="cancel-add-task" data-project="p1"'), 'the open form can be cancelled');

  // Minimising is back (PR 6, 2026-09-27): in the "All" view a saved collapsed flag renders
  // header-only, with the ▸ toggle and aria-expanded="false"; expanded is ▾ and aria-expanded="true".
  const minimised = renderProjectCard(short, { ...cardUi(), projectCollapsed: { p1: true } }, [], []);
  assert.ok(minimised.includes('project-card is-collapsed'), 'a minimised project in "All" gets .is-collapsed');
  assert.ok(minimised.includes('>▸</button>') && minimised.includes('aria-label="Expand project"') && minimised.includes('aria-expanded="false"'), 'the collapsed toggle shows ▸, "Expand project", aria-expanded="false"');
  assert.ok(!minimised.includes('project-body'), 'a minimised card renders header + badges + progress bar only, no body');
  const expanded = renderProjectCard(short, { ...cardUi(), projectCollapsed: { p1: false } }, [], []);
  assert.ok(expanded.includes('>▾</button>') && expanded.includes('aria-label="Minimise project"') && expanded.includes('aria-expanded="true"'), 'expanded shows ▾, "Minimise project", aria-expanded="true"');
  assert.ok(shortHtml.includes('class="project-body" tabindex="0" role="region" aria-label="Short tasks"'), 'the task groups and add-task line sit in a keyboard-reachable scroll region');

  // The "One" view: the shown card always renders expanded, whatever its saved flag says, and with
  // no minimise button at all (there's only ever one card on screen, and nothing writes the flag here).
  const oneUi = { ...cardUi(), projectView: 'one', projectCollapsed: { p1: true }, selectedProjectId: 'p1' };
  const oneCard = renderProjectCard(short, oneUi, [], []);
  assert.ok(oneCard.includes('is-selected') && !oneCard.includes('is-collapsed'), 'the selected project in "One" always renders expanded, whatever its collapsed flag says');
  assert.ok(!oneCard.includes('collapse-toggle'), 'the "One" view has no minimise button at all');

  // Drag grip (PR 9): a real button named for its project, in the header, in "All" only
  assert.ok(/<button type="button" class="drag-grip" data-project="p1" aria-label="Move Short"/.test(shortHtml), 'the "All" view header carries a grip button labelled "Move <name>"');
  assert.ok(headOf(shortHtml).includes('drag-grip') && headOf(shortHtml).includes('<svg'), 'the grip sits in the project header and draws an svg');
  assert.ok(renderProjectCard({ ...short, name: 'A & <B>' }, cardUi(), [], []).includes('aria-label="Move A &amp; &lt;B&gt;"'), 'the grip label escapes the name');
  assert.ok(renderProjectCard(short, { ...cardUi(), projectCollapsed: { p1: true } }, [], []).includes('class="drag-grip"'), 'a minimised card keeps its grip');
  assert.ok(!oneCard.includes('drag-grip'), 'the "One" view single card has no grip');
}

// Sidebar rows are drag handles (PR 9) and the sort menu offers Custom order
{
  const projects = [{ id: 'p1', name: 'Alpha', color: 'red', tasks: [] }, { id: 'p2', name: 'Beta', color: 'blue', tasks: [] }];
  const html = renderProjectSidebar({ projects, projectCategories: [] }, { projectQuery: '', projectSort: 'custom', projectCollapsed: {}, projectView: 'all' }, projects);
  assert.ok(html.includes('<option value="custom" selected>Custom order</option>'), 'the sort menu has "Custom order", selected when the sort is custom');
  assert.ok(/class="sidebar-project"[^>]*data-project="p1"[^>]*aria-keyshortcuts="Alt\+ArrowUp Alt\+ArrowDown"/.test(html), 'each sidebar row announces its Alt+Arrow reorder keys');
}

// Sidebar: selection highlight + the one add field at the bottom
{
  const projects = [{ id: 'p1', name: 'Alpha', color: 'red', tasks: [] }, { id: 'p2', name: 'Beta', color: 'blue', tasks: [] }];
  const sideUi = { projectQuery: '', projectSort: 'name', projectCollapsed: {}, selectedProjectId: 'p2', projectView: 'one' };
  const html = renderProjectSidebar({ projects, projectCategories: [] }, sideUi, projects);
  assert.ok(html.includes('data-action="scroll-project" data-project="p2"') && /class="sidebar-project is-selected"[^>]*data-project="p2"[^>]*aria-current="true"/.test(html), 'the selected row is highlighted with aria-current');
  assert.ok(!/data-project="p1"[^>]*aria-current/.test(html), 'the unselected row carries no aria-current');
  assert.ok(html.includes('data-action="toggle-new-panel"') && html.includes('+ New<'), 'the header carries the "+ New" button');

  // The "All" view: every project is its own card/tile, so no row is "current" -- no is-selected
  // class, no aria-current, even though ui.selectedProjectId is still set (it's read in "One" only).
  const allView = renderProjectSidebar({ projects, projectCategories: [] }, { ...sideUi, projectView: 'all' }, projects);
  assert.ok(!allView.includes('is-selected') && !allView.includes('aria-current'), 'an "All" view sidebar row carries no selection state');
}

// renderProjectsMain: what shows in the main column depends on ui.projectView and, in "All", isWide.
{
  const projects = [
    { id: 'p1', name: 'Alpha', color: 'red', tasks: [{ id: 'a', status: 'next' }] },
    { id: 'p2', name: 'Beta', color: 'blue', tasks: [] },
    { id: 'p3', name: 'Gamma', color: 'green', tasks: [] },
  ];
  const st = { projects, categories: [], projectCategories: [] };

  // "One": only the selected project's card, at any width.
  const oneMain = renderProjectsMain(st, { projectView: 'one', selectedProjectId: 'p2', projectCollapsed: {}, doneOpen: {}, pendingRemove: {}, editingProject: {}, addingTask: {} }, projects, true);
  assert.ok(oneMain.includes('id="proj-p2"') && !oneMain.includes('id="proj-p1"') && !oneMain.includes('id="proj-p3"'), '"One" renders only the selected project\'s card');

  // "All", wide: minimised projects (p1, p3) gather below the tile grid, in sort order, under a
  // "Minimised" label; the rest (p2) stay in the tile grid.
  const allWideUi = { projectView: 'all', selectedProjectId: null, projectCollapsed: { p1: true, p3: true }, doneOpen: {}, pendingRemove: {}, editingProject: {}, addingTask: {} };
  const allWide = renderProjectsMain(st, allWideUi, projects, true);
  const gridPart = allWide.slice(0, allWide.indexOf('minimised-projects'));
  const groupPart = allWide.slice(allWide.indexOf('minimised-projects'));
  assert.ok(gridPart.includes('id="proj-p2"') && !gridPart.includes('id="proj-p1"') && !gridPart.includes('id="proj-p3"'), 'only the non-minimised project sits in the tile grid');
  assert.ok(groupPart.includes('<h4>Minimised</h4>') && groupPart.includes('minimised-grid'), 'the minimised group has its label and its own grid');
  assert.ok(groupPart.indexOf('id="proj-p1"') < groupPart.indexOf('id="proj-p3"'), 'minimised projects keep the same sort order (p1 before p3, alphabetical)');
  assert.ok(!groupPart.includes('id="proj-p2"'), 'the non-minimised project is not in the minimised group');

  // "All", <1100px: everything stacks in one column, minimised projects showing header-only in
  // place -- no separate group.
  const allNarrow = renderProjectsMain(st, allWideUi, projects, false);
  assert.ok(!allNarrow.includes('minimised-projects'), 'below 1100px there is no separate minimised group');
  assert.ok(allNarrow.includes('id="proj-p1"') && allNarrow.includes('id="proj-p2"') && allNarrow.includes('id="proj-p3"'), 'every project still renders, stacked');
}

assert.strictEqual(renderToast(null, 'error'), '', 'no message means no toast');
const toast = renderToast('Could not link <b>', 'error');
assert.ok(toast.includes('class="toast toast-error"') && toast.includes('role="alert"'), 'an error renders the pinned toast in its error style, announced');
assert.ok(toast.includes('Could not link &lt;b&gt;'), 'the message text is escaped');
assert.ok(toast.includes('data-action="dismiss-toast"'), 'the toast can be dismissed');
const info = renderToast('Linked instead', 'info');
assert.ok(info.includes('class="toast"') && info.includes('role="status"'), 'a notice uses the plain toast style and a polite announcement');

// The "+ New" panel (PR 7, Q29a/Q30c): always in the header, opens under it, two tabs, the
// no-token line, and the Edit panel's Link to GitHub repo row.
{
  const projects = [{ id: 'p1', name: 'Alpha', color: 'red', tasks: [] }];
  const baseUi = { projectQuery: '', projectSort: 'name', projectCollapsed: {}, projectView: 'all' };

  // The button always renders, whatever ui.newPanelOpen is -- never inside the scrolling list.
  const closed = renderProjectSidebar({ projects, projectCategories: [] }, baseUi, projects, true);
  assert.ok(closed.includes('data-action="toggle-new-panel"'), 'the "+ New" button is always present');
  // app.js returns focus here by id when Escape closes the panel; without the id focus went nowhere
  assert.ok(closed.includes('id="new-panel-toggle"'), 'the "+ New" button carries the id app.js focuses');
  assert.ok(closed.indexOf('data-action="toggle-new-panel"') < closed.indexOf('<ul class="sidebar-list">'), '"+ New" sits in the header, before the scrolling list');
  assert.ok(closed.includes('aria-expanded="false"') && closed.includes('aria-controls="new-panel"'), 'the button carries aria-expanded/aria-controls');
  assert.ok(!closed.includes('id="new-panel"'), 'the panel itself is absent while closed');

  const openUi = { ...baseUi, newPanelOpen: true };
  const open = renderProjectSidebar({ projects, projectCategories: [] }, openUi, projects, true);
  assert.ok(open.includes('id="new-panel"'), 'the panel renders when open');
  assert.ok(open.indexOf('id="new-panel"') < open.indexOf('<div class="view-switch" role="group" aria-label="Project view">'), 'the panel sits under the header, above the All/One view switch');
  assert.ok(open.includes('aria-expanded="true"'), 'aria-expanded flips to true while open');
  assert.ok(open.includes('New project') && open.includes('GitHub repo'), 'the panel has both tabs');
  assert.ok(open.includes('data-action="add-new-project"'), 'the New project tab defaults open with its add form');

  const repoTabUi = { ...openUi, newPanelTab: 'repo' };
  const repoTabNoToken = renderProjectSidebar({ projects, projectCategories: [] }, repoTabUi, projects, false);
  assert.ok(repoTabNoToken.includes('Connect GitHub in') && repoTabNoToken.includes('href="settings.html"'), 'no token -- just the Settings line, nothing else');
  assert.ok(!repoTabNoToken.includes('data-action="track-repo"') && !repoTabNoToken.includes('data-action="create-repo"'), 'no repo picker or Create when there is no token');

  const repoTabWithToken = renderProjectSidebar({ projects, projectCategories: [] }, { ...repoTabUi, newPanelRepos: { list: [{ full_name: 'me/one', private: false }, { full_name: 'me/two', private: true }] } }, projects, true);
  assert.ok(repoTabWithToken.includes('me/one') && repoTabWithToken.includes('me/two') && repoTabWithToken.includes('>Private<'), 'Your repos lists the untracked repos, with a Private chip');
  assert.ok(repoTabWithToken.includes('data-action="track-repo" data-repo="me/one"'), 'each row has a Track button');
  assert.ok(repoTabWithToken.includes('data-action="paste-repo"') && repoTabWithToken.includes('owner/repo or URL'), 'the paste field is present');
  assert.ok(repoTabWithToken.includes('Create a new repo on GitHub') && repoTabWithToken.includes('data-action="create-repo"'), 'the create-a-repo disclosure is present');

  const loading = renderProjectSidebar({ projects, projectCategories: [] }, { ...repoTabUi, newPanelRepos: { loading: true } }, projects, true);
  assert.ok(loading.includes('Loading your repos…'), 'a loading state shows while the fetch is in flight');
  const errored = renderProjectSidebar({ projects, projectCategories: [] }, { ...repoTabUi, newPanelRepos: { error: 'boom' } }, projects, true);
  assert.ok(errored.includes('boom') && errored.includes('data-action="retry-new-panel-repos"'), 'an error shows the message and a Retry link');

  // Edit panel: Link to GitHub repo row for a hand-made project, nothing new for a repo project
  const cardUi = () => ({ doneOpen: {}, pendingRemove: {}, projectCollapsed: {}, editingProject: { p1: true }, addingTask: {}, selectedProjectId: null, editingTask: null, projectView: 'all' });
  const manualCard = renderProjectCard({ id: 'p1', name: 'Alpha', color: 'red', source: 'manual', tasks: [] }, cardUi(), [], [], true);
  assert.ok(manualCard.includes('data-action="toggle-link-panel" data-project="p1">Link to GitHub repo<'), 'a hand-made project\'s Edit panel offers Link to GitHub repo');
  const manualCardNoToken = renderProjectCard({ id: 'p1', name: 'Alpha', color: 'red', source: 'manual', tasks: [] }, cardUi(), [], [], false);
  assert.ok(!manualCardNoToken.includes('Link to GitHub repo'), 'no token -- no link row either');
  const ghCard = renderProjectCard({ id: 'p1', name: 'Alpha', color: 'red', source: 'github', repoFullName: 'o/r', htmlUrl: 'u', tasks: [] }, cardUi(), [], [], true);
  assert.ok(!ghCard.includes('Link to GitHub repo'), 'a project already tracking a repo gets nothing new');

  const linkOpenCard = renderProjectCard({ id: 'p1', name: 'Alpha', color: 'red', source: 'manual', tasks: [] }, { ...cardUi(), linkPanel: { projectId: 'p1', open: true, repos: { list: [{ full_name: 'me/untracked', private: false }] } } }, [], [], true);
  assert.ok(linkOpenCard.includes('data-action="link-repo" data-repo="me/untracked"'), 'the inline link panel lists untracked repos with a Link button');
  assert.ok(linkOpenCard.includes('data-action="paste-link-repo"'), 'the inline link panel also takes a pasted repo');
}

console.log('RENDER CHIP TESTS PASSED');

// #97/#92: the chips column's ceiling eases from half the row down to a third as the title grows,
// and the row carries it as --chips-max
assert.strictEqual(chipsMaxPct('Short'), 50, 'a short title lets the chips take up to half the row');
assert.strictEqual(chipsMaxPct('x'.repeat(30)), 50, 'up to 30 characters the ceiling stays at half');
assert.strictEqual(chipsMaxPct('x'.repeat(60)), 40, 'a 60-character title caps the chips at 40%');
assert.strictEqual(chipsMaxPct('x'.repeat(200)), 33, 'however long the title, the chips can still have a third');
assert.strictEqual(chipsMaxPct(''), 50, 'an empty title is treated as short');
assert.ok(renderTaskRow({ id: 't9', title: 'Short', status: 'next', categoryIds: [] }, { id: 'p1' }, [], { editingTask: null }).includes('style="--chips-max:50%"'), 'the row carries its chips ceiling');
