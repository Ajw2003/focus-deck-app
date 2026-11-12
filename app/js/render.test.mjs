// focus-deck-app/js/render.test.mjs — run with: node app/js/render.test.mjs
import { renderTaskRow, chipsMaxPct, renderToast, jotTarget, renderJotScreen, renderFocus, renderCategoryWalletInner, renderTaskEditForm, unsortedQueue, renderNewPanel, renderProjectEditPanel, renderSyncButton, syncButtonTitle } from './render.js';
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
  assert.ok(idleHtml.includes('class="sync-light"') && !idleHtml.includes('is-syncing') && !idleHtml.includes('class="sync-drawer"'), 'a green light, drawer shut when idle');

  const syncingHtml = renderSyncButton({ ...synced, _ui: { syncing: true } });
  assert.ok(syncingHtml.includes('is-syncing'), 'the light pulses while syncing');
  assert.ok(syncingHtml.includes('title="Sync with GitHub · synced 4m ago"'), 'title stays current even while syncing');
  assert.ok(renderSyncButton({ ...synced, _ui: { syncError: 'x' } }).includes('is-error'), 'red after an error');
  const open = renderSyncButton({ ...synced, _ui: { syncOpen: true } });
  assert.ok(open.includes('data-action="sync-github"') && open.includes('href="settings.html#sync-section"') && open.includes('aria-expanded="true"'), 'the open drawer has Sync now and Sync settings');
  assert.ok(renderSyncButton({ ...synced, _ui: { syncOpen: true, syncing: true } }).includes('data-action="sync-github" disabled'), 'Sync now waits while syncing');
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
assert.ok(/<div class="task-chips"><span class="pick-wrap">[^]*<\/span><\/div>/.test(row({ categoryIds: [], priority: undefined, deadline: undefined })), 'a row with nothing set holds only the quiet chips');
const longCat = renderTaskRow({ ...base, categoryIds: ['cat_long'] }, p, [{ id: 'cat_long', name: 'a very long label name that cannot fit', color: '#fbca04' }], ui);
assert.ok(/class="chip cat-chip small"[^>]*title="A Very Long Label Name That Cannot Fit" aria-label="A Very Long Label Name That Cannot Fit"/.test(longCat), 'a label chip carries its full (displayed) name in title and aria-label');

const multi = renderTaskRow({ ...base, categoryIds: ['cat_bug', 'cat_art'] }, p, cats.concat([{ id: 'cat_art', name: 'Art', color: '#fbca04' }]), ui);
assert.ok(multi.includes('>Bug<') && multi.includes('>Art<'), 'every label on a task gets its own chip');
assert.ok(row({ priority: 'urgent' }).includes('class="chip pick-chip small priority-chip" data-action="open-pick" data-field="priority"') && row({ priority: 'urgent' }).includes('>Urgent ▾<'), 'a task with a priority shows it as a chip');
assert.ok(row({ priority: null }).includes('is-empty') && row({ priority: null }).includes('>Priority ▾<'), 'an open task with no priority shows a quiet "Priority ▾" chip');
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

// the focus note says what the pick frees, or the next subtask (#191)
{
  const projects = [{ id: 'pZ', name: 'H', tasks: [
    { id: 'u', title: 'Blocker', status: 'next' }, { id: 'w1', title: 'W1', status: 'next', waitsOn: ['u'] }, { id: 'w2', title: 'W2', status: 'next', waitsOn: ['u'] },
    { id: 'par', title: 'Parent', status: 'next' }, { id: 's1', title: 'Order <it>', status: 'next', parentId: 'par' }, { id: 's2', title: 'S2', status: 'next', parentId: 'par' },
  ] }];
  const find = (id) => ({ task: projects[0].tasks.find((t) => t.id === id), project: projects[0] });
  const draw = (focus) => renderFocus({ focus, categories: [], projects }, find, { focusFilter: {} });
  const a = draw({ taskId: 'u', pool: ['u', 'par'] });
  assert.ok(a.includes('<b class="unblocks">Unblocks 2 tasks</b>') && !a.includes('Random pick'), 'Unblocks N replaces Random pick');
  assert.ok(draw({ taskId: 's1', pool: ['s1', 'u'] }).includes('Unblocks 1 task</b>'), 'singular for one');
  const b = draw({ taskId: 'par', pool: ['par', 'u'] });
  assert.ok(b.includes('<p class="next-sub">Next step: <b>Order &lt;it&gt;</b> · 2 subtasks left') && b.includes('data-action="focus-subtask" data-task="s1"'), 'next step line with a Start it button');
  assert.ok(draw({ taskId: 'w1', pool: ['w1'], allBlocked: true }).includes('Everything here is waiting on something'), 'all-blocked is said in words');
}

// a picked task's project chip jumps to that project
{
  const st = { focus: { taskId: 'x1', pool: ['x1'] }, categories: [], projects: [{ id: 'pZ', name: 'PlunderSpell', color: 'red', tasks: [{ id: 'x1', title: 'Pick me', status: 'next', categoryIds: [] }] }] };
  const find = (id) => ({ task: st.projects[0].tasks.find((t) => t.id === id), project: st.projects[0] });
  const active = renderFocus(st, find, { focusFilter: {} });
  assert.ok(active.includes('<button type="button" class="note-project" data-action="rm-open" data-project="pZ"'), 'the picked task\'s project, on the note, is a button that opens it on the Roadmap');
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
  assert.ok(html.includes('class="slip-btn" data-action="reroll"') && html.includes('pick another task'), '"Not this one" is the ticket stub');
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
  assert.ok(emptyHtml.includes('desk-empty') && emptyHtml.includes('Add a task to a project on the Roadmap') && emptyHtml.includes('data-action="set-screen" data-screen="roadmap"') && emptyHtml.includes('jot a thought'), 'the empty desk names the next step');
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
  assert.ok(inbox.includes('Choose a project') && inbox.includes('data-key="p1"') && inbox.includes('Choose a project first'), 'a captured thought is guided to a folder before it can be filed');
}

// The "+ New" panel (PR 7, Q29a/Q30c): always in the header, opens under it, two tabs, the
// no-token line, and the Edit panel's Link to GitHub repo row.
{
  const projects = [{ id: 'p1', name: 'Alpha', color: 'red', tasks: [] }];
  const baseUi = {};
  const panel = (ui, tok) => renderNewPanel(ui, tok);

  const openUi = { ...baseUi, newPanelOpen: true };
  const open = panel(openUi, true);
  assert.ok(open.includes('id="new-panel"'), 'the panel renders when open');
  assert.ok(open.includes('New project') && open.includes('GitHub repo'), 'the panel has both tabs');
  assert.ok(open.includes('data-action="add-new-project"'), 'the New project tab defaults open with its add form');

  const repoTabUi = { ...openUi, newPanelTab: 'repo' };
  const repoTabNoToken = panel(repoTabUi, false);
  assert.ok(repoTabNoToken.includes('Connect GitHub in') && repoTabNoToken.includes('href="settings.html"'), 'no token -- just the Settings line, nothing else');
  assert.ok(!repoTabNoToken.includes('data-action="track-repo"') && !repoTabNoToken.includes('data-action="create-repo"'), 'no repo picker or Create when there is no token');

  const repoTabWithToken = panel({ ...repoTabUi, newPanelRepos: { list: [{ full_name: 'me/one', private: false }, { full_name: 'me/two', private: true }] } }, true);
  assert.ok(repoTabWithToken.includes('me/one') && repoTabWithToken.includes('me/two') && repoTabWithToken.includes('>Private<'), 'Your repos lists the untracked repos, with a Private chip');
  assert.ok(repoTabWithToken.includes('data-action="track-repo" data-repo="me/one"'), 'each row has a Track button');
  assert.ok(repoTabWithToken.includes('data-action="paste-repo"') && repoTabWithToken.includes('owner/repo or URL'), 'the paste field is present');
  assert.ok(repoTabWithToken.includes('Create a new repo on GitHub') && repoTabWithToken.includes('data-action="create-repo"'), 'the create-a-repo disclosure is present');

  const loading = panel({ ...repoTabUi, newPanelRepos: { loading: true } }, true);
  assert.ok(loading.includes('Loading your repos…'), 'a loading state shows while the fetch is in flight');
  const errored = panel({ ...repoTabUi, newPanelRepos: { error: 'boom' } }, true);
  assert.ok(errored.includes('boom') && errored.includes('data-action="retry-new-panel-repos"'), 'an error shows the message and a Retry link');

  // Edit panel: Link to GitHub repo row for a hand-made project, nothing new for a repo project
  const cardUi = () => ({ doneOpen: {}, pendingRemove: {}, projectCollapsed: {}, editingProject: { p1: true }, addingTask: {}, selectedProjectId: null, editingTask: null, projectView: 'all' });
  const manualCard = renderProjectEditPanel({ id: 'p1', name: 'Alpha', color: 'red', source: 'manual', tasks: [] }, cardUi(), [], true);
  assert.ok(manualCard.includes('data-action="toggle-link-panel" data-project="p1">Link to GitHub repo<'), 'a hand-made project\'s Edit panel offers Link to GitHub repo');
  const manualCardNoToken = renderProjectEditPanel({ id: 'p1', name: 'Alpha', color: 'red', source: 'manual', tasks: [] }, cardUi(), [], false);
  assert.ok(!manualCardNoToken.includes('Link to GitHub repo'), 'no token -- no link row either');
  const ghCard = renderProjectEditPanel({ id: 'p1', name: 'Alpha', color: 'red', source: 'github', repoFullName: 'o/r', htmlUrl: 'u', tasks: [] }, cardUi(), [], true);
  assert.ok(!ghCard.includes('Link to GitHub repo'), 'a project already tracking a repo gets nothing new');

  const linkOpenCard = renderProjectEditPanel({ id: 'p1', name: 'Alpha', color: 'red', source: 'manual', tasks: [] }, { ...cardUi(), linkPanel: { projectId: 'p1', open: true, repos: { list: [{ full_name: 'me/untracked', private: false }] } } }, [], true);
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

// Six tabs (#262): the rail lists Sort, Organize, Projects, Roadmap, Focus, Review with icons and no numbers; counts only on Sort and Review.
{
  const { renderRail, normalizeScreen } = await import('./render.js');
  const rail = renderRail('sort', 2, 3);
  assert.deepStrictEqual([...rail.matchAll(/rail-icon" aria-hidden="true">(\S+)<\/span>(?:<b[^>]*>\d<\/b>)?<span class="rail-label">([A-Za-z ]+)</g)].map((m) => m[1] + m[2]), ['📥Sort', '🧹Organize', '📁Projects', '🗺Roadmap', '◎Focus', '✓Review'], 'six tabs, icons, in order');
  assert.ok(!rail.includes('rail-num') && rail.includes('dk-tabs'), 'no numbers; drawn as binder dividers');
  assert.ok(/data-screen="sort" aria-current="page"/.test(rail), 'the current screen is marked');
  assert.strictEqual((rail.match(/rail-count/g) || []).length, 2, 'badges on Sort and Review only');
  assert.ok(rail.includes('>2</b>') && rail.includes('>3</b>'));
  assert.ok(!renderRail('focus', 0).includes('rail-count'), 'no count when nothing waits');
  assert.ok(renderRail('triage', 0).includes('data-go="triage"') && renderRail('tidy', 0).includes('rail-sub is-on'), 'Organize holds Tidy up and Triage');
  assert.ok(!renderRail('focus', 0).includes('rail-tools'), 'sync and Settings moved to the header');
  assert.strictEqual(normalizeScreen('nonsense'), 'focus');
  assert.strictEqual(normalizeScreen('board'), 'projects');
  assert.strictEqual(normalizeScreen('projects'), 'projects');
  assert.strictEqual(normalizeScreen('start'), 'focus');
}

// #193: ties on Project rows
{
  const proj = (ties) => ({ id: 'p1', name: 'P', color: '#3E8E5E', tasks: [
    { id: 'a', title: 'Parent', status: 'next', sortOrder: 1, categoryIds: [] },
    { id: 'z', title: 'Zed', status: 'next', sortOrder: 2, categoryIds: [] },
    { id: 'b', title: 'Child <i>', status: 'next', sortOrder: 0, categoryIds: [], ...(ties ? { parentId: 'a' } : {}) },
    { id: 'c', title: 'Waiter', status: 'next', sortOrder: 3, categoryIds: [], ...(ties ? { waitsOn: ['z'] } : {}) },
  ] });
  const card = (pr) => pr.tasks.map((t) => renderTaskRow(t, pr, [], { editingTask: null, doneOpen: {}, pendingRemove: {} }, [pr], !!t.parentId)).join('');
  const h = card(proj(true));
  assert.ok(/class="task-row[^"]*is-sub[^"]*" data-task="b"/.test(h) && !/is-sub[^"]*" data-task="a"/.test(h), 'is-sub on the child only');
  assert.ok(h.includes('1 subtask \u00b7 0 done') && h.includes('waits on <button') && h.includes('holds up 1'), 'tie lines');
  assert.ok(!h.includes('\u21b3 in'), 'a Project row never repeats "in <parent>"');
  assert.strictEqual((h.match(/task-row has-grip is-waiting/g) || []).length, 2, 'parent and waiter are soft');
  assert.ok(h.includes('Child &lt;i&gt;'), 'escaped');
  const plain = card(proj(false));
  assert.ok(!plain.includes('tie-line') && !plain.includes('is-waiting') && !plain.includes('is-sub'), 'no ties, nothing added');
  const q = { id: 'q', title: 'Q', status: 'next' };
  assert.strictEqual(renderTaskRow(q, p, [], ui), renderTaskRow(q, p, [], ui, [{ id: 'p1', tasks: [q] }]), 'a tie-less row is byte-identical');
}

// the jotter's To: stamp (#242): target resolution and the toast's optional action
{
  const st = { projects: [{ id: 'a' }, { id: 'b' }] };
  assert.strictEqual(jotTarget(st, { screen: 'focus' }), '', 'follows nothing on Focus: Unsorted');
  assert.strictEqual(jotTarget(st, { screen: 'roadmap', view: { mode: 'project', id: 'b' } }), 'b', 'follows the Roadmap project');
  assert.strictEqual(jotTarget(st, { screen: 'roadmap' }), '', 'Roadmap with all projects: Unsorted');
  assert.strictEqual(jotTarget(st, { screen: 'roadmap', view: { mode: 'project', id: 'a' } }), 'a', 'follows the one project view');
  assert.strictEqual(jotTarget(st, { screen: 'roadmap', view: { mode: 'all' } }), '', 'all view: Unsorted');
  assert.strictEqual(jotTarget(st, { screen: 'roadmap', view: { mode: 'project', id: 'b' }, jotTo: 'a' }), 'a', 'a manual pick wins');
  assert.strictEqual(jotTarget(st, { screen: 'roadmap', view: { mode: 'project', id: 'b' }, jotTo: '' }), '', 'a manual Unsorted wins');
  assert.strictEqual(jotTarget(st, { screen: 'focus', jotTo: 'gone' }), '', 'deleted project falls back to Unsorted');
  assert.strictEqual(jotTarget(st, { screen: 'roadmap', view: { mode: 'project', id: 'gone' } }), '', 'deleted Roadmap project falls back');
  assert.ok(!renderToast('Hi', 'info').includes('toast-action'), 'no action, no button');
  const withAct = renderToast('Added', 'info', { label: 'Open', action: 'open-added-task', attrs: { 'data-task': 't"1', 'data-project': 'p' } });
  assert.ok(withAct.includes('class="btn ghost toast-action" data-action="open-added-task" data-task="t&quot;1" data-project="p">Open</button>'), 'action button, escaped');
  assert.ok(withAct.indexOf('toast-action') < withAct.indexOf('toast-close'), 'before the close button');
}

// the + Jot screen (#263)
{ // renderJotScreen: closed is empty; open shows Sort by default, the drawer lists Sort and projects
  const st = { projects: [{ id: 'a', name: 'Home' }] };
  assert.strictEqual(renderJotScreen(st, {}), '');
  const open = renderJotScreen(st, { jotOpen: true, jotDraft: '<b>x' });
  assert.ok(open.includes('Jot a thought') && open.includes('📥 Sort ▾') && open.includes('data-action="jot-save"') && open.includes('&lt;b&gt;x') && !open.includes('Where should it go?'));
  const drawer = renderJotScreen(st, { jotOpen: true, jotPick: true, jotTo: 'a' });
  assert.ok(drawer.includes('Where should it go?') && drawer.includes('data-jot-search') && drawer.includes('📁 Home ▾') && drawer.includes('data-id="a"'));
}
