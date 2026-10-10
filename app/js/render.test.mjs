// focus-deck-app/js/render.test.mjs — run with: node app/js/render.test.mjs
import { renderTaskRow, chipsMaxPct, renderToast, renderFocus, renderCategoryWalletInner, renderTaskEditForm, unsortedQueue, renderProjectSidebar, renderProjectCard, renderProjectsMain, renderSyncButton, syncButtonTitle } from './render.js';
import { renderInTrayCard, unsortedCurrent } from './in-tray-view.js';
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

// focus picker (#120): a wallet of folders (projects) and a wallet of index cards (categories)
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
  const keys = (html, wallet) => {
    const track = html.slice(html.indexOf('data-wallet="' + wallet + '"'));
    const end = track.indexOf('<div class="flip-pad"></div></div>', 10);
    return [...track.slice(0, end).matchAll(/class="sleeve" data-key="([^"]*)"/g)].map((m) => m[1]);
  };
  const html = renderFocus(st, () => null, { focusFilter: {} });
  assert.deepStrictEqual(keys(html, 'categories'), ['c_art', 'c_chore', 'any'], 'category cards busiest first, labels with nothing open left out, "Surprise me" last');
  assert.deepStrictEqual(keys(html, 'projects'), ['all', 'pA', 'pB'], 'All projects first, then the folders busiest first');
  assert.ok(html.includes('data-wallet="projects" data-mode="twice" data-facing="all"'), 'the folder wallet faces All projects by default, in the default choosing mode (tap twice)');
  assert.ok(html.includes('data-wallet="categories" data-mode="twice" data-facing="c_art"'), 'the category wallet faces its first card');
  assert.ok(html.includes('>3 open · top: Urgent · 2 projects<'), 'a card says how many are open, the highest priority present, and across how many projects');
  assert.ok(!html.includes('<select') && !html.includes('data-action="pick-focus"'), 'no dropdowns, and no per-card action: the wallets choose');
  assert.ok(!html.includes('more<') && !html.includes('Show all'), 'no "+N more" or "Show all N labels": the wallets scroll through everything');
  const narrowed = renderFocus(st, () => null, { focusFilter: { projectId: 'pB' } });
  assert.ok(narrowed.includes('data-wallet="projects" data-mode="twice" data-facing="pB"'), 'the remembered folder faces you');
  assert.ok(narrowed.includes('>1 open<') && !narrowed.includes('2 projects'), 'the facing folder narrows the counts');
  assert.deepStrictEqual(keys(narrowed, 'categories'), ['c_art', 'c_chore', 'any'], 'and the index cards to that project');
  assert.ok(renderFocus(st, () => null, { focusFilter: { projectId: 'gone' } }).includes('data-wallet="projects" data-mode="twice" data-facing="all"'), 'a remembered project that no longer exists falls back to All projects');
  assert.ok(renderFocus(st, () => null, { focusFilter: {}, focusCategory: 'c_chore' }).includes('data-wallet="categories" data-mode="twice" data-facing="c_chore"'), 'the facing category is kept across a repaint');
  assert.ok(renderFocus({ ...st, choosingMode: { mode: 'tap' } }, () => null, { focusFilter: {} }).includes('data-mode="tap"'), 'the Choosing a card setting is written into the markup');
  assert.ok(renderFocus({ ...st, choosingMode: { mode: 'swipe' } }, () => null, { focusFilter: {} }).includes('data-mode="tap"'), 'a save from the retired Swipe up mode draws as Tap');
  assert.ok(renderFocus({ ...st, choosingMode: { mode: 'junk' } }, () => null, { focusFilter: {} }).includes('data-mode="twice"'), 'an unknown mode reads as the default');
  // every project is in the wallet however many there are (it scrolls)
  const many = { ...st, projects: Array.from({ length: 9 }, (_, i) => ({ id: 'p' + i, name: 'project-' + i, color: '#123456', tasks: [task('t' + i, ['c_art'])] })) };
  assert.strictEqual(keys(renderFocus(many, () => null, { focusFilter: {} }), 'projects').length, 10, 'All projects plus all nine folders');
  // the category wallet renders alone for a project flip
  assert.ok(renderCategoryWalletInner(st, { focusFilter: { projectId: 'pB' } }).includes('data-wallet="categories"') && !renderCategoryWalletInner(st, { focusFilter: {} }).includes('data-wallet="projects"'), 'the category wallet slot renders on its own');
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
  assert.ok(picker.includes('data-key="__none__"') && picker.includes('>Unlabelled<') && picker.includes('>2 open · top: Urgent<'), 'an Unlabelled card counts open tasks with no label');
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
  assert.strictEqual(unsortedCurrent(st, { later: [] }).key, 'i:th1', 'the top slip is the first in queue order');
  assert.strictEqual(unsortedCurrent(st, { later: ['i:th1', 'i:th2'] }).key, 't:u1', 'slips sent to the back by Later come after the rest');
  assert.strictEqual(unsortedCurrent(st, { later: ['i:th1', 'i:th2', 't:u1', 't:u2'] }).key, 'i:th1', 'the tray never runs dry by Later: everything at the back comes round again');
  assert.strictEqual(unsortedCurrent({ inbox: [], categories: [], projects: [] }, { later: [] }), null, 'null only when the tray is empty');
}

const freshUnsorted = () => ({ later: [], projectId: null, selected: [], newLabels: '', facingFolder: null, facingFlag: null, currentKey: null });

// The in-tray card itself is tested in in-tray.test.mjs.

// a picked task's project chip jumps to that project
{
  const st = { focus: { taskId: 'x1', pool: ['x1'] }, categories: [], projects: [{ id: 'pZ', name: 'PlunderSpell', color: 'red', tasks: [{ id: 'x1', title: 'Pick me', status: 'next', categoryIds: [] }] }] };
  const find = (id) => ({ task: st.projects[0].tasks.find((t) => t.id === id), project: st.projects[0] });
  const active = renderFocus(st, find, { focusFilter: {} });
  assert.ok(active.includes('<button type="button" class="note-project" data-action="scroll-project" data-project="pZ"'), 'the picked task\'s project, on the note, is a button that jumps to the project');
}

// the focus area as a sticky note with a paper checkbox and a ticket stub (#119)
{
  const cats = [{ id: 'c_bug', name: 'bug', color: '#f00' }, { id: 'c_art', name: 'art', color: '#0f0' }];
  const task = (id, extra) => ({ id, title: 'Reply to <Sam>', status: 'next', categoryIds: ['c_bug'], priority: 'high', ...extra });
  const mk = (focus, tasks) => ({ focus, categories: cats, projects: [{ id: 'pZ', name: 'Home', color: 'red', tasks }] });
  const findIn = (st) => (id) => { const t = st.projects[0].tasks.find((x) => x.id === id); return t ? { task: t, project: st.projects[0] } : null; };
  const st = mk({ taskId: 'x1', pool: ['x1', 'x2'], filter: { categoryId: 'c_bug', projectId: null } }, [task('x1'), task('x2', { title: 'b' })]);
  const html = renderFocus(st, findIn(st), { focusFilter: {} });
  assert.ok(html.includes('<div class="note-shadow"><div class="note">'), 'the shadow sits on a wrapper around the clipped note');
  assert.ok(/<div class="note-meta">.*Home ↓<\/button><span>Bug<\/span><span>High<\/span>/.test(html), 'project, labels and priority form the line above the title');
  assert.ok(html.includes('<h2 class="focus-title"><span class="ink">Reply to &lt;Sam&gt;</span></h2>'), 'the title is escaped and wrapped in the span the biro line is drawn on');
  assert.ok(html.indexOf('note-meta') < html.indexOf('focus-title'), 'the meta line is above the title');
  assert.ok(html.includes('class="check-btn" data-action="complete-focus"') && html.includes('I&rsquo;ve done it') && html.includes('<path class="tick"'), '"I\'ve done it" is the paper checkbox with its tick');
  assert.ok(html.includes('class="slip-btn" data-action="reroll"') && html.includes('slip it back in the deck'), '"Not this one" is the ticket stub');
  assert.ok(html.includes('data-action="clear-focus">Clear<'), 'Clear is still there');
  // no pool to re-roll from: no stub
  const single = mk({ taskId: 'x1', pool: ['x1'] }, [task('x1')]);
  const one = renderFocus(single, findIn(single), { focusFilter: {} });
  assert.ok(!one.includes('data-action="reroll"') && one.includes('desk-acts is-single'), 'with nothing to swap to there is no stub');
  assert.ok(one.includes('<span>Random pick</span>'), 'a pick with no label filter says it was a random pick');
  // deadline chip still shows on the note
  const dated = mk({ taskId: 'x1' }, [task('x1', { deadline: '2999-01-01' })]);
  assert.ok(renderFocus(dated, findIn(dated), { focusFilter: {} }).includes('deadline-chip'), 'the deadline chip is on the note');
  // a repaint mid-sequence redraws the phase it had reached, only for that task
  const mid = renderFocus(st, findIn(st), { focusFilter: {}, completing: { taskId: 'x1', phase: 'crossed' } });
  assert.ok(mid.includes('class="note is-crossed"') && mid.includes('class="check-btn is-ticked"'), 'a repaint keeps the tick and the cross-out');
  const other = renderFocus(st, findIn(st), { focusFilter: {}, completing: { taskId: 'zzz', phase: 'peeling' } });
  assert.ok(!other.includes('is-peeling') && !other.includes('is-ticked'), 'another task\'s sequence does not leak onto this note');
  // nothing open: the empty desk says what to do next
  const empty = mk(null, [task('x1', { status: 'done' })]);
  const emptyHtml = renderFocus(empty, () => null, { focusFilter: {} });
  assert.ok(emptyHtml.includes('desk-empty') && emptyHtml.includes('Add a task to a folder on the Projects screen') && emptyHtml.includes('data-action="set-screen" data-screen="projects"') && emptyHtml.includes('jot a thought'), 'the empty desk names the next step');
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
  const inbox = renderInTrayCard({ inbox: [{ id: 'i1', text: 'idea', createdAt: Date.now() }], projects: [{ id: 'p1', name: 'P', color: 'red', tasks: [] }], categories: cats }, { inboxOpen: true, unsorted: freshUnsorted() });
  assert.ok(inbox.includes('Which folder?') && inbox.includes('data-key="p1"') && inbox.includes('Choose a folder first'), 'a captured thought is guided to a folder before it can be filed');
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

// One screen at a time (#135): the rail lists Focus, Sort (with its count) and Projects, marks the
// current one, and anything unknown reads as Focus.
{
  const { renderRail, normalizeScreen } = await import('./render.js');
  const rail = renderRail('sort', 2);
  assert.deepStrictEqual([...rail.matchAll(/data-screen="([a-z]+)"/g)].map((m) => m[1]), ['focus', 'sort', 'projects'], 'three screens, in order');
  assert.ok(/data-screen="sort" aria-current="page"/.test(rail), 'the current screen is marked');
  assert.ok(rail.includes('>2</b>'), 'Sort shows how many are waiting');
  assert.ok(!renderRail('focus', 0).includes('rail-count'), 'no count when the tray is empty');
  assert.strictEqual(normalizeScreen('board'), 'focus');
  assert.strictEqual(normalizeScreen('projects'), 'projects');
}
