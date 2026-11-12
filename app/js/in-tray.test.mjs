// focus-deck-app/js/in-tray.test.mjs -- run with: node --test app/js/in-tray.test.mjs
// The Unsorted in-tray (#121): tray order, flag ranking, and that filing does what the old Unsorted
// pills did (same mutations, same GitHub effect). See docs/4-systems/in-tray.md
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const { state } = await import('./state.js');
const M = await import('./mutations.js');
const { orderTray, sendToBack, toggleToken, toggleFolder, flagCards, folderCards, selectionToIds, fileSlip } = await import('./in-tray.js');
const { wording, cornerHint } = await import('./wallet.js');
const { renderInTrayCard } = await import('./in-tray-view.js');
const { unsortedQueue } = await import('./render.js');

const fresh = () => ({ skipped: [], later: [], projectId: null, selected: [], step: 0, sub: null, menu: false, find: '', title: null, notes: null, facingFolder: null, facingFlag: null, currentKey: null, dueStages: null });
function seed() {
  state.projects.length = 0;
  state.categories.length = 0;
  state.inbox.length = 0;
  state.projects.push(
    { id: 'pA', name: 'School', color: '#4D6FB8', tasks: [{ id: 'a1', title: 'Read', status: 'next', categoryIds: ['c_study'] }, { id: 'a2', title: 'Unlabelled A', status: 'next', categoryIds: [] }] },
    { id: 'pB', name: 'Home', color: '#3E8E5E', tasks: [{ id: 'b1', title: 'Bins', status: 'next', categoryIds: ['c_chore'] }, { id: 'b2', title: 'Mop', status: 'next', categoryIds: ['c_chore'] }] },
  );
  state.categories.push({ id: 'c_study', name: 'Study', color: '#4D6FB8' }, { id: 'c_chore', name: 'Chore', color: '#3E8E5E' }, { id: 'c_art', name: 'Art', color: '#C2731E' });
  state.inbox.push({ id: 'th1', text: 'Buy a card', createdAt: Date.now() - 60000 }, { id: 'th2', text: 'Email Ms Patel', createdAt: Date.now() });
}

test('the tray keeps queue order; Later sends a slip to the back, once', () => {
  seed();
  const q = unsortedQueue(state);
  assert.deepStrictEqual(q.map((x) => x.key), ['i:th1', 'i:th2', 't:a2'], 'thoughts first, then unlabelled tasks (unchanged)');
  assert.deepStrictEqual(orderTray(q, []).map((x) => x.key), ['i:th1', 'i:th2', 't:a2']);
  let later = sendToBack([], 'i:th1');
  assert.deepStrictEqual(orderTray(q, later).map((x) => x.key), ['i:th2', 't:a2', 'i:th1']);
  later = sendToBack(later, 'i:th2');
  assert.deepStrictEqual(orderTray(q, later).map((x) => x.key), ['t:a2', 'i:th1', 'i:th2']);
  later = sendToBack(later, 'i:th1');
  assert.deepStrictEqual(later, ['i:th2', 'i:th1'], 'sending one again moves it, never duplicates');
  assert.deepStrictEqual(orderTray(q, ['gone']).map((x) => x.key), ['i:th1', 'i:th2', 't:a2'], 'a key no longer in the queue is ignored');
  assert.strictEqual(orderTray([], later).length, 0, 'an empty queue is an empty tray');
});

test('choosing a card again undoes it', () => {
  assert.deepStrictEqual(toggleToken([], 'c1'), ['c1']);
  assert.deepStrictEqual(toggleToken(['c1', 'c2'], 'c1'), ['c2'], 'peels one flag, keeps the others');
  assert.strictEqual(toggleFolder(null, 'pA'), 'pA');
  assert.strictEqual(toggleFolder('pA', 'pA'), null, 'choosing the chosen folder clears it');
  assert.strictEqual(toggleFolder('pA', 'pB'), 'pB', 'another folder replaces it');
});

test('flags: kinds first, then labels ranked for the chosen project, as the old pills were', () => {
  seed();
  const home = state.projects[1];
  const names = (project) => flagCards(state, project, { showAll: true }).map((c) => c.name);
  assert.deepStrictEqual(names(home), ['Reminder', 'Build', 'Fix', 'Chore', 'Study', 'Art'], 'Chore is busiest in Home so it leads; Art is unused');
  assert.deepStrictEqual(names(state.projects[0]), ['Reminder', 'Build', 'Fix', 'Study', 'Chore', 'Art'], 'in School, Study leads');
  assert.deepStrictEqual(flagCards(state, null).map((c) => c.token).slice(0, 3), ['kind:reminder', 'kind:build', 'kind:fix'], 'a kind with no label yet is a kind: token');
  state.categories.push({ id: 'c_fix', name: 'fix', color: '#d93f0b' });
  const fix = flagCards(state, null).find((c) => c.name === 'Fix');
  assert.strictEqual(fix.token, 'c_fix', 'a kind that already exists as a label uses that label');
  assert.ok(!flagCards(state, null).slice(3).some((c) => c.token === 'c_fix'), 'and is not offered twice');
  assert.deepStrictEqual(folderCards(state).map((f) => f.id), ['pB', 'pA'], 'folders: busiest first, ties by name (Home before School)');
  state.projects[0].tasks.push({ id: 'a3', title: 'x', status: 'next', categoryIds: [] });
  assert.deepStrictEqual(folderCards(state).map((f) => f.id), ['pA', 'pB'], 'a busier folder moves up');
});

test('Category choices (#133): only the project’s labels, then More categories; off shows all', () => {
  seed();
  const home = state.projects[1];
  const filtered = flagCards(state, home);
  assert.deepStrictEqual(filtered.map((c) => c.name), ['Reminder', 'Build', 'Fix', 'Chore', 'More categories'], 'Home only uses Chore');
  assert.strictEqual(filtered.at(-1).more, 2, 'it counts the two left out');
  assert.deepStrictEqual(flagCards(state, home, { selected: ['c_art'] }).map((c) => c.name), ['Reminder', 'Build', 'Fix', 'Chore', 'Art', 'More categories'], 'a picked label stays');
  assert.ok(!flagCards(state, null).some((c) => c.more), 'a thought with no folder yet: everything shows');
  state.categoryFilter = { on: false, updatedAt: 1 };
  assert.deepStrictEqual(flagCards(state, home).map((c) => c.name), ['Reminder', 'Build', 'Fix', 'Chore', 'Study', 'Art'], 'setting off: all of them');
  state.categoryFilter = { on: true, updatedAt: 0 };
});

test('selectionToIds: flags, kind labels created on first use, typed labels de-duplicated', () => {
  const made = [];
  const byName = (name, color) => { made.push([name, color]); return 'id_' + name; };
  const ids = selectionToIds(['c_art', 'kind:fix', 'c_art'], byName);
  assert.deepStrictEqual(ids, ['c_art', 'id_fix'], 'duplicate pick dropped');
  assert.deepStrictEqual(made[0], ['fix', '#d93f0b'], 'a kind token creates its label with the kind colour');
});

// "same mutations, same GitHub effects as today's Unsorted filing": the old app.js did, in order,
//   ids = unsortedSelectionToIds(); task = M.fileInboxItem(inboxId, projectId, ids);
//   createIssueIfGithubProject(task, projectId)   (thought)
//   if (ids.length) M.updateTaskFields(taskId, { categoryIds: ids }) else skip   (task)
test('filing a thought: the same task in that project with those labels, then the GitHub hook', () => {
  seed();
  const calls = [];
  const deps = {
    labelIdByName: (n) => 'id_' + n,
    fileInboxItem: (...a) => { calls.push(['file', ...a]); return M.fileInboxItem(...a); },
    updateTaskFields: (...a) => calls.push(['update', ...a]),
    createIssue: (...a) => calls.push(['issue', a[0] && a[0].title, a[1]]),
  };
  const cur = unsortedQueue(state)[0];
  assert.deepStrictEqual(fileSlip(cur, { projectId: null, selected: ['c_art'] }, deps), { outcome: 'none' }, 'no folder: nothing happens');
  assert.strictEqual(calls.length, 0);
  const out = fileSlip(cur, { priority: 'high', projectId: 'pB', selected: ['c_art', 'c_chore'] }, deps);
  assert.strictEqual(out.outcome, 'filed');
  assert.deepStrictEqual(calls.map((c) => c[0]), ['file', 'issue'], 'file first, then the issue hook, nothing else');
  assert.deepStrictEqual(calls[0].slice(1), ['th1', 'pB', ['c_art', 'c_chore'], { title: undefined, notes: undefined, priority: 'high', deadline: undefined, dueStages: undefined }]);
  assert.deepStrictEqual(calls[1], ['issue', 'Buy a card', 'pB']);
  const filed = state.projects[1].tasks.at(-1);
  assert.strictEqual(filed.title, 'Buy a card');
  assert.deepStrictEqual(filed.categoryIds, ['c_art', 'c_chore']);
  assert.strictEqual(filed.status, 'next');
  assert.strictEqual(filed.source, 'manual');
  assert.ok(!state.inbox.some((i) => i.id === 'th1'), 'the thought left the inbox');
  assert.strictEqual(out.task, filed);
});

test('filing with no flags is allowed for a thought (as before)', () => {
  seed();
  const out = fileSlip(unsortedQueue(state)[0], { priority: 'high', projectId: 'pA', selected: [] }, { labelIdByName: () => 'x', fileInboxItem: M.fileInboxItem, updateTaskFields: () => assert.fail('not for a thought'), createIssue: () => {} });
  assert.strictEqual(out.outcome, 'filed');
  assert.deepStrictEqual(state.projects[0].tasks.at(-1).categoryIds, []);
});

test('saving a task: flags go on it; none means nothing is saved and it goes to the back (as before)', () => {
  seed();
  const calls = [];
  const deps = { labelIdByName: (n) => 'id_' + n, fileInboxItem: () => assert.fail('not for a task'), updateTaskFields: (...a) => calls.push(a), createIssue: () => assert.fail('no issue for a save') };
  const cur = unsortedQueue(state).find((x) => x.kind === 'task');
  assert.deepStrictEqual(fileSlip(cur, { projectId: null, selected: [] }, deps), { outcome: 'later' });
  assert.strictEqual(calls.length, 0);
  assert.deepStrictEqual(fileSlip(cur, { projectId: null, selected: ['c_art'] }, deps), { outcome: 'saved', taskId: 'a2' });
  assert.deepStrictEqual(calls, [['a2', { categoryIds: ['c_art'] }]]);
});

test('wallet wording: the in-tray uses cards, it does not draw a task', () => {
  assert.strictEqual(wording('Swipe sideways to flip · swipe a card up to draw', 'use'), 'Swipe sideways to flip · swipe a card up to use');
  assert.strictEqual(wording('Draw ↑', 'use'), 'Use ↑');
  assert.strictEqual(wording('Tap it again to draw.', ''), 'Tap it again to draw.', 'no verb leaves the focus wallets as they were');
  assert.strictEqual(cornerHint('tap', false), 'Tap to draw');
  assert.strictEqual(cornerHint('tap', false, 'use'), 'Tap to use');
  assert.strictEqual(cornerHint('twice', true, 'use'), 'Tap again');
});

test('the card: the thought on a slip with the ⋯ drawer, Sort several and a stamped Sort this one', () => {
  seed();
  const html = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() });
  assert.ok(html.includes('>3 to sort<') && !html.includes('section-toggle'), 'the heading is the whole queue');
  assert.ok(html.includes('Buy a card') && html.includes('No project yet') && html.includes('class="jot-slip"'), 'the oldest thought is on the slip');
  assert.ok(html.includes('data-action="sort-menu"') && !html.includes('class="dk-sheet'), 'the ⋯ pull is there, the drawer is shut');
  assert.ok(html.includes('data-action="bulk-toggle">Sort several<'), 'Sort several keeps the Select many list');
  assert.ok(html.includes('data-action="sort-next">Sort this one<') && !html.includes('data-wallet='), 'one stamp, no choices yet');
  const one = (() => { state.inbox.length = 1; state.projects[0].tasks.pop(); return renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() }); })();
  assert.ok(one.includes('>1 to sort<') && !one.includes('Sort several'), 'nothing to sort several of');
});

test('the ⋯ drawer holds Add notes, Done already, Later and Delete with the ids they act on', () => {
  seed();
  const html = card({ menu: true });
  assert.ok(html.includes('role="dialog"') && html.includes('This thought'));
  assert.ok(html.includes('data-action="sort-add-notes">📝 Add notes<') && html.includes('data-action="unsorted-complete" data-inbox="th1">✓ Done already<'));
  assert.ok(html.includes('data-action="unsorted-skip">⏭ Later<') && html.includes('data-action="unsorted-delete" data-inbox="th1">Delete<'));
  state.inbox.length = 0;
  const t = card({ menu: true });
  assert.ok(t.includes('This task') && t.includes('data-action="unsorted-complete" data-task="a2" data-project="pA"'));
});

test('step 1 project carousel, step 2 priority flags: Next waits for each, a task starts in its own project', () => {
  seed();
  const p1 = card({ step: 1, projectId: 'pB' });
  assert.ok(p1.includes('Which project?') && p1.includes('data-wallet="tray-folders"') && p1.includes('data-verb="use"') && /icard project is-picked/.test(p1), 'the chosen folder is marked');
  assert.ok(p1.includes('data-action="sort-new-project">+ New project<') && p1.includes('data-action="sort-back"') && !p1.includes('sort-skip'), 'Back and a new project; no Skip');
  assert.ok(p1.includes('Going in <span class="folder-chip"') && p1.includes('data-action="sort-next"'), 'the folder shows on the slip');
  const none = card({ step: 1 });
  assert.ok(none.includes('disabled>Next<') && none.includes('Choose a project first.'), 'no folder: Next is off and says why');
  const p2 = card({ step: 2, projectId: 'pB' });
  assert.ok(p2.includes('How important?') && p2.includes('data-value="urgent"') && !p2.includes('data-value="none"') && !p2.includes('sort-skip'), 'a thought has to have a priority: no None, no Skip');
  assert.ok(p2.includes('disabled>Next<') && p2.includes('Pick a priority to go on.'));
  assert.ok(card({ step: 2, projectId: 'pB', priority: 'high' }).includes('class="sort-flag on" data-level="high"') && !card({ step: 2, projectId: 'pB', priority: 'high' }).includes('disabled>Next<'));
  state.inbox.length = 0;
  const t = card({ step: 1 });
  assert.ok(/icard project is-picked/.test(t) && t.includes('In <span class="folder-chip"') && t.includes('Unlabelled A') && !t.includes('disabled>Next<'), 'a task is in its own project');
  assert.ok(card({ step: 2 }).includes('data-value="none"'), 'a task may have no priority');
});

test('the card: the tray can be empty ("All sorted" with an Organize card), closed, or have no projects', () => {
  seed();
  state.inbox.length = 0;
  state.projects[0].tasks.pop();
  const empty = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() });
  assert.ok(empty.includes('All sorted ✓') && empty.includes('data-action="set-screen" data-screen="tidy">Organize<') && !empty.includes('sort-menu'), 'an empty tray says so and offers Organize');
  const closed = renderInTrayCard(state, { inboxOpen: false, unsorted: fresh() });
  assert.ok(!closed.includes('to sort') && !closed.includes('jot-slip'), 'closed: nothing');
  seed();
  state.projects.length = 0;
  const noProjects = card({ step: 1 });
  assert.ok(noProjects.includes('Add a project to file this thought into.') && !noProjects.includes('tray-folders'));
});

test('Later puts the front slip last in the rendered tray', () => {
  seed();
  const html = renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), { later: ['i:th1'] }) });
  assert.ok(html.includes('Email Ms Patel') && !html.includes('Buy a card'));
});

const card = (u) => renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), u) });

test('progress dots, Back and Skip: nine dots, Skip only on steps 3 to 8, the receipt has Back and Save', () => {
  seed();
  const p3 = card({ step: 3, priority: 'high', projectId: 'pB', selected: ['c_art', 'c_chore'] });
  assert.strictEqual((p3.match(/<i( class="on")?><\/i>/g) || []).length, 9, 'nine dots');
  assert.strictEqual((p3.match(/<i class="on"><\/i>/g) || []).length, 3, 'three are punched');
  assert.ok(p3.includes('aria-label="Step 3 of 9"') && p3.includes('data-action="sort-skip">Skip<') && p3.includes('data-action="sort-back">‹ Back<'));
  assert.ok(/class="slip-flag"[^>]*>Art</.test(p3) && /class="slip-flag"[^>]*>Chore</.test(p3), 'the chosen labels show on the slip');
  assert.ok(p3.includes('data-wallet="tray-flags"') && p3.includes('📎') && p3.includes('data-action="sort-flag" data-token="c_art"'), 'a carousel and the picked tags underneath');
  assert.ok(p3.includes('data-action="sort-azl">A–Z<') && p3.includes('data-action="sort-new-label">+ New label<'));
  [1, 2, 9].forEach((n) => assert.ok(!card({ step: n, projectId: 'pB', priority: 'high' }).includes('sort-skip'), 'no Skip on step ' + n));
  [4, 5, 6, 7, 8].forEach((n) => assert.ok(card({ step: n, projectId: 'pB' }).includes('data-action="sort-skip"'), 'Skip on step ' + n));
});

test('the receipt: a line and a pencil for each step, then Save to the project', () => {
  seed();
  const html = card({ step: 9, projectId: 'pB', priority: 'high', selected: ['c_art'], due: '2026-11-13', newSubtasks: ['Draft'], notes: 'for Gran' });
  assert.ok(html.includes('All good?') && html.includes('>Home<') && html.includes('>High<') && html.includes('>Art<') && html.includes('Fri 13 Nov') && html.includes('>Draft<') && html.includes('>for Gran<'));
  [1, 2, 3, 4, 5, 6, 7, 8, 'notes'].forEach((n) => assert.ok(html.includes('data-action="sort-step" data-step="' + n + '"'), 'a pencil for ' + n));
  assert.ok(html.includes('data-action="unsorted-file" data-inbox="th1">Save to Home<') && !html.includes('disabled'));
  assert.ok(card({ step: 9, projectId: 'pB' }).includes('disabled>Save to Home<'), 'no priority: Save is off');
  state.inbox.length = 0;
  const t = card({ step: 9 });
  assert.ok(t.includes('data-action="unsorted-save" data-task="a2" data-project="pA">Save to School<') && t.includes('No label yet, so this task stays in Sort.'));
});

test('folder search filters folders; flag search filters flags and shows all', () => {
  seed();
  const f = card({ step: 1, find: 'hom' });
  assert.ok(f.includes('data-key="pB"') && !f.includes('data-key="pA"'), 'only Home is left in the wallet');
  assert.ok(card({ step: 1, find: 'zzz' }).includes('No project matches “zzz”.'));
  const g = card({ step: 3, projectId: 'pB', find: 'st' });
  assert.ok(g.includes('data-key="c_study"') && !g.includes('data-key="c_chore"') && !g.includes('More categories'), 'Study shows though Home never uses it; no More card while searching');
  assert.ok(card({ step: 3, projectId: 'pB' }).includes('More categories'), 'the More card stays when not searching');
});

test('+ New label and + New project open their own page with a field and an Add stamp', () => {
  seed();
  const l = card({ step: 3, projectId: 'pB', sub: 'newlabel', find: 'Garden' });
  assert.ok(l.includes('New label') && l.includes('value="Garden"') && l.includes('data-action="sort-new-flag">Add<') && !l.includes('disabled>Add<'));
  assert.ok(card({ step: 3, projectId: 'pB', sub: 'newlabel' }).includes('disabled>Add<'), 'nothing typed: Add is off');
  const p = card({ step: 1, sub: 'newproject', find: 'Shed' });
  assert.ok(p.includes('New project') && p.includes('data-action="sort-add-project">Add<'));
});

test('A–Z: letter tabs and the labels under the chosen letter, picked ones clipped', () => {
  seed();
  const a = card({ step: 3, projectId: 'pB', sub: 'azl', selected: ['c_art'] });
  assert.ok(a.includes('data-action="sort-letter" data-letter="A"') && a.includes('data-letter="C"') && a.includes('data-letter="S"'));
  assert.ok(/dk-choice on" data-action="sort-flag" data-token="c_art"/.test(a) && !a.includes('data-token="c_chore"'), 'only the A labels, Art picked');
  const c = card({ step: 3, projectId: 'pB', sub: 'azl', letter: 'C' });
  assert.ok(c.includes('data-token="c_chore"') && !c.includes('data-token="c_art"'));
});

test('the slip: editable title unless GitHub-linked; notes are their own page', () => {
  seed();
  assert.ok(card({}).includes('contenteditable="true" spellcheck="false" data-slip-title'));
  assert.ok(!card({ step: 1 }).includes('contenteditable'), 'the steps show the slip as a label only');
  const n = card({ sub: 'notes', notes: 'for Gran' });
  assert.ok(n.includes('<textarea class="slip-notes"') && n.includes('>for Gran</textarea>') && n.includes('data-action="sort-notes-done">Save notes<'));
  state.inbox.length = 0;
  state.projects[0].tasks[1].issueNumber = 7;
  state.projects[0].tasks[1].notes = 'old note';
  const t = card({});
  assert.ok(!t.includes('contenteditable') && t.includes('#7'), 'linked task: title fixed');
  assert.ok(card({ sub: 'notes' }).includes('>old note</textarea>'), 'existing notes are shown');
});

test('saving a thought: edited title and notes go to the new task', () => {
  seed();
  const deps = { labelIdByName: (n) => n, fileInboxItem: M.fileInboxItem, updateTaskFields: () => assert.fail(), createIssue: () => {} };
  const out = fileSlip(unsortedQueue(state)[0], { priority: 'high', projectId: 'pB', selected: [], title: '  Buy two cards ', notes: ' for Gran ' }, deps);
  assert.strictEqual(out.task.title, 'Buy two cards');
  assert.strictEqual(out.task.notes, 'for Gran');
  const blank = fileSlip(unsortedQueue(state)[0], { priority: 'high', projectId: 'pB', selected: [], title: '   ', notes: '' }, deps);
  assert.strictEqual(blank.task.title, 'Email Ms Patel', 'an empty title keeps the text');
  assert.ok(!('notes' in blank.task), 'empty notes set nothing');
});

test('saving a task: moves it, sets title and notes, and a linked task keeps its title', () => {
  seed();
  const cur = unsortedQueue(state).find((x) => x.kind === 'task');
  const deps = { labelIdByName: (n) => n, applyTaskMove: M.applyTaskMove, updateTaskFields: M.updateTaskFields, fileInboxItem: () => assert.fail(), createIssue: () => assert.fail() };
  const out = fileSlip(cur, { projectId: 'pB', selected: ['c_art'], title: 'Renamed', notes: ' hi ' }, deps);
  assert.deepStrictEqual(out, { outcome: 'saved', taskId: 'a2' });
  assert.ok(!state.projects[0].tasks.some((t) => t.id === 'a2'));
  const moved = state.projects[1].tasks.find((t) => t.id === 'a2');
  assert.deepStrictEqual([moved.title, moved.notes, moved.categoryIds], ['Renamed', 'hi', ['c_art']]);
  assert.strictEqual(fileSlip({ kind: 'task', task: moved, project: state.projects[1] }, { projectId: 'pB', selected: [], title: 'x', notes: '' }, deps).outcome, 'later', 'no flags still goes to the back');
  assert.ok(!('notes' in moved), 'empty notes remove the field');
  assert.strictEqual(moved.title, 'x');
  moved.issueNumber = 3;
  fileSlip({ kind: 'task', task: moved, project: state.projects[1] }, { projectId: 'pB', selected: [], title: 'y', notes: null }, deps);
  assert.strictEqual(moved.title, 'x', 'a GitHub-linked title is not changed');
});

test('steps 5 to 8: a find box and task rows, the picked ones clipped; folder-only for part of and subtasks', () => {
  seed();
  state.projects[0].tasks.push({ id: 'a4', title: 'Essay', status: 'next', categoryIds: [] });
  state.projects[1].tasks[0].waitsOn = ['a1'];
  const step = (n, over) => renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), { step: n, projectId: 'pA', parent: null, subtasks: [], waitsOn: [], holdsUp: [], newSubtasks: [], pickQuery: '' }, over) });
  ['Part of a bigger task?', 'Any smaller steps?', 'What has to happen first?', 'What is waiting on this?'].forEach((h, i) => assert.ok(step(5 + i, {}).includes(h), h));
  let html = step(5, {});
  assert.ok(html.includes('data-tie-find') && html.includes('data-field="parent" data-id="a4"') && !html.includes('data-field="parent" data-id="b2"'), 'Part of searches this folder only');
  html = step(7, { waitsOn: ['b1'] });
  assert.ok(/dk-choice on" data-action="tie-remove" data-field="waitsOn" data-id="b1"[^>]*><span>Bins<\/span><small>Home<\/small>/.test(html), 'the picked one is clipped and names its folder');
  html = step(7, { pickQuery: 'home' });
  assert.ok(html.includes('data-field="waitsOn" data-id="b2"') && !html.includes('data-field="waitsOn" data-id="a4"'), 'Waits on searches every folder, by folder name too');
  html = step(6, { pickQuery: 'Esx', newSubtasks: ['Draft'] });
  assert.ok(html.includes('data-action="tie-new-sub"') && html.includes('+ Add “Esx”') && html.includes('data-field="newSubtasks" data-id="0"'), 'a new step from the typed text, the earlier one listed');
  assert.ok(!step(6, { pickQuery: '' }).includes('tie-new-sub'));
  html = step(6, { parent: 'a1', pickQuery: 'Esx' });
  assert.ok(html.includes('can’t have smaller steps') && !html.includes('tie-new-sub') && !html.includes('data-tie-find'), 'a task that is part of another has no steps of its own');
});

test('saving ties through fileSlip: parent, waits-on, holds-up, new subtask; refused ones skipped', () => {
  seed();
  const deps = { labelIdByName: (n) => n, fileInboxItem: M.fileInboxItem, updateTaskFields: M.updateTaskFields, applyTaskMove: M.applyTaskMove, addTask: M.addTask, projects: state.projects, createIssue: () => {} };
  const find = (id) => state.projects.flatMap((p) => p.tasks).find((x) => x.id === id);
  const out = fileSlip(unsortedQueue(state)[0], { priority: 'high', projectId: 'pA', selected: [], parent: 'a1', waitsOn: ['b1', 'nope'], holdsUp: ['b2'], subtasks: [], newSubtasks: [] }, deps);
  const t = out.task;
  assert.strictEqual(out.outcome, 'filed');
  assert.strictEqual(t.parentId, 'a1');
  assert.deepStrictEqual(t.waitsOn, ['b1'], 'a task that does not exist is skipped');
  assert.deepStrictEqual(find('b2').waitsOn, [t.id], 'holds up is stored on the other task');
  state.projects[0].tasks.push({ id: 'a3', title: 'Plan', status: 'next', categoryIds: [] });
  // a task slip: its subtask and a new subtask are tied; itself and a loop are refused
  const cur = unsortedQueue(state).find((x) => x.kind === 'task' && x.task.id === 'a2');
  fileSlip(cur, { projectId: 'pA', selected: [], parent: null, subtasks: ['a3'], waitsOn: ['a2', t.id], holdsUp: [], newSubtasks: ['Draft'] }, deps);
  assert.strictEqual(find('a3').parentId, 'a2', 'a3 becomes its subtask');
  const draft = state.projects[0].tasks.find((x) => x.title === 'Draft');
  assert.ok(draft && draft.parentId === 'a2', 'the new subtask is created in the same folder');
  assert.deepStrictEqual(find('a2').waitsOn, [t.id], 'waiting on itself is refused');
  M.deleteTask('a1', 'pA');
  assert.ok(!find(t.id).parentId, 'deleting a task removes it from every tie');
});

// ---- Sort many at once ("Select many") --------------------------------------------------------
const { pickedSlips, bulkProjectId, bulkBlocker, bulkSort } = await import('./in-tray.js');
const { splitLongThought } = await import('./state.js');
const bulkDeps = (issues = []) => ({
  fileInboxItem: M.fileInboxItem, updateTaskFields: M.updateTaskFields, applyTaskMove: M.applyTaskMove, addTask: M.addTask,
  projects: state.projects, createIssue: (t, p) => issues.push([t.title, p]), labelIdByName: (name) => 'id_' + name,
});
const findTask = (id) => state.projects.flatMap((p) => p.tasks).find((t) => t.id === id);

test('select many: only ticked slips still in the queue count, in tray order', () => {
  seed();
  const q = unsortedQueue(state);
  assert.deepStrictEqual(pickedSlips(q, ['t:a2', 'i:th1', 'i:gone']).map((x) => x.key), ['i:th1', 't:a2']);
  assert.deepStrictEqual(pickedSlips(q, null), []);
});

test('select many: what has to be chosen before Apply can run', () => {
  seed();
  const q = unsortedQueue(state);
  const th = q.filter((x) => x.kind === 'thought'), tk = q.filter((x) => x.kind === 'task');
  assert.match(bulkBlocker([], {}), /Tick at least one/);
  assert.match(bulkBlocker(th, { selected: ['c_art'] }), /project for the thoughts/, 'thoughts have no project of their own');
  assert.match(bulkBlocker(tk, { selected: [] }), /Choose a project, a label or a group/, 'nothing chosen');
  assert.strictEqual(bulkBlocker(tk, { selected: ['c_art'] }), '', 'tasks can be labelled where they are');
  assert.strictEqual(bulkBlocker(tk, { selected: [], groupTitle: 'Week' }), '', 'tasks all in one project group there');
  assert.strictEqual(bulkProjectId(tk, null), 'pA');
  assert.strictEqual(bulkProjectId(q, null), null);
  assert.strictEqual(bulkProjectId(q, 'pB'), 'pB');
});

test('select many: files every ticked thought, moves and labels tasks, in one go', () => {
  seed();
  const issues = [];
  const slips = unsortedQueue(state); // th1, th2, a2
  const out = bulkSort(slips, { priority: 'high', projectId: 'pB', selected: ['c_art', 'kind:fix'], groupTitle: '' }, bulkDeps(issues));
  assert.deepStrictEqual({ ...out, parent: !!out.parent }, { filed: 2, moved: 1, labelled: 1, grouped: 0, parent: false, skipped: 0 });
  assert.strictEqual(state.inbox.length, 0, 'both thoughts left the inbox');
  const home = state.projects.find((p) => p.id === 'pB');
  const titles = home.tasks.map((t) => t.title);
  assert.ok(titles.includes('Buy a card') && titles.includes('Email Ms Patel') && titles.includes('Unlabelled A'), 'all three are in Home');
  home.tasks.filter((t) => ['Buy a card', 'Email Ms Patel', 'Unlabelled A'].includes(t.title))
    .forEach((t) => assert.deepStrictEqual(t.categoryIds, ['c_art', 'id_fix'], t.title + ' got both labels'));
  assert.deepStrictEqual(issues.map((i) => i[1]), ['pB', 'pB'], 'each filed thought goes through the GitHub issue hook');
  assert.strictEqual(unsortedQueue(state).length, 0, 'the tray is empty');
  assert.ok(findTask('a1') && findTask('b1') && findTask('b2'), 'tasks that were not ticked are untouched');
  assert.deepStrictEqual(findTask('b1').categoryIds, ['c_chore']);
});

test('select many: groups the ticked items under one new task', () => {
  seed();
  const slips = unsortedQueue(state).filter((x) => x.kind === 'thought');
  const out = bulkSort(slips, { priority: 'high', projectId: 'pA', selected: [], groupTitle: '  Errands  ' }, bulkDeps());
  assert.strictEqual(out.filed, 2);
  assert.strictEqual(out.grouped, 2);
  assert.strictEqual(out.parent.title, 'Errands');
  const school = state.projects.find((p) => p.id === 'pA');
  const kids = school.tasks.filter((t) => t.parentId === out.parent.id).map((t) => t.title);
  assert.deepStrictEqual(kids.sort(), ['Buy a card', 'Email Ms Patel']);
});

test('select many: labels only, tasks stay in their own projects', () => {
  seed();
  state.projects[1].tasks.push({ id: 'b3', title: 'Unlabelled B', status: 'next', categoryIds: [] });
  const slips = unsortedQueue(state).filter((x) => x.kind === 'task');
  const out = bulkSort(slips, { priority: 'high', projectId: null, selected: ['c_study'] }, bulkDeps());
  assert.strictEqual(out.labelled, 2);
  assert.strictEqual(out.moved, 0);
  assert.ok(state.projects[0].tasks.some((t) => t.id === 'a2'), 'a2 still in School');
  assert.ok(state.projects[1].tasks.some((t) => t.id === 'b3'), 'b3 still in Home');
  assert.deepStrictEqual(findTask('b3').categoryIds, ['c_study']);
});

test('select many: blocked picks change nothing', () => {
  seed();
  const before = JSON.stringify({ p: state.projects, i: state.inbox });
  const out = bulkSort(unsortedQueue(state), { priority: 'high', projectId: null, selected: ['c_art'] }, bulkDeps());
  assert.strictEqual(out.filed + out.moved + out.labelled, 0);
  assert.strictEqual(JSON.stringify({ p: state.projects, i: state.inbox }), before);
});

test('select many: a slip that went away meanwhile is skipped, not errored', () => {
  seed();
  const slips = unsortedQueue(state);
  M.discardInbox('th1');
  const out = bulkSort(slips, { priority: 'high', projectId: 'pB', selected: [] }, bulkDeps());
  assert.strictEqual(out.skipped, 1);
  assert.strictEqual(out.filed, 1);
});

test('the select many list and panel render, with the ticks and the reason Apply waits', () => {
  seed();
  const html = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh(), bulk: { on: true, picked: ['i:th1'], projectId: null, selected: [], groupTitle: '', newLabel: '', why: '' } });
  assert.match(html, /1 of 3 ticked/);
  assert.strictEqual((html.match(/data-bulk-key=/g) || []).length, 3, 'one row per slip');
  assert.match(html, /data-bulk-key="i:th1" checked/);
  assert.match(html, /Choose a project for the thoughts you ticked/);
  assert.match(html, /data-action="bulk-apply" disabled/);
  const off = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh(), bulk: { on: false } });
  assert.match(off, /data-action="bulk-toggle">Sort several/, 'the one-at-a-time tray offers Sort several');
});

test('long thoughts: nothing is cut off when filed', () => {
  const short = 'Ring the dentist';
  assert.deepStrictEqual(splitLongThought(short), { title: short, notes: '' }, 'short thoughts file exactly as before');
  const at400 = 'x'.repeat(400);
  assert.deepStrictEqual(splitLongThought(at400), { title: at400, notes: '' }, 'up to the old 400 limit is unchanged');
  const long = 'Plan for the week: '.repeat(200);
  const split = splitLongThought(long);
  assert.ok(split.title.length <= 120 && split.title.endsWith('…'));
  assert.strictEqual(split.notes, long.trim(), 'the whole text is kept as notes');
  const lines = 'Shopping\nmilk\neggs';
  assert.deepStrictEqual(splitLongThought(lines), { title: 'Shopping', notes: lines });
  seed();
  state.inbox.push({ id: 'big', text: long.trim(), createdAt: Date.now() });
  const t = M.fileInboxItem('big', 'pA', [], { notes: 'my own note', priority: 'high' });
  assert.strictEqual(t.notes, long.trim() + '\n\nmy own note', 'the text and any typed notes both survive');
});
