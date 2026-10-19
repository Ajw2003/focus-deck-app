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

const fresh = () => ({ skipped: [], later: [], projectId: null, selected: [], step: 1, find: '', title: null, notes: null, notesOpen: false, facingFolder: null, facingFlag: null, currentKey: null });
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
  const out = fileSlip(cur, { projectId: 'pB', selected: ['c_art', 'c_chore'] }, deps);
  assert.strictEqual(out.outcome, 'filed');
  assert.deepStrictEqual(calls.map((c) => c[0]), ['file', 'issue'], 'file first, then the issue hook, nothing else');
  assert.deepStrictEqual(calls[0].slice(1), ['th1', 'pB', ['c_art', 'c_chore'], { title: undefined, notes: undefined }]);
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
  const out = fileSlip(unsortedQueue(state)[0], { projectId: 'pA', selected: [] }, { labelIdByName: () => 'x', fileInboxItem: M.fileInboxItem, updateTaskFields: () => assert.fail('not for a thought'), createIssue: () => {} });
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

test('the card: count, top slip, folder on it, flags on it, wallets, quiet links', () => {
  seed();
  const ui = { inboxOpen: true, unsorted: Object.assign(fresh(), { projectId: 'pB', selected: ['c_art'] }) };
  let html = renderInTrayCard(state, ui);
  assert.ok(html.includes('>Unsorted <span class="count">3<'), 'header count is the whole queue');
  assert.ok(html.includes('3 in the tray') && html.includes('slip-behind two'), 'a small stack with a count');
  assert.ok(html.includes('Buy a card') && html.includes('Going in <span class="folder-chip"') && html.includes('>Home<'), 'the chosen folder shows on the slip');
  assert.ok(/class="slip-flag"[^>]*>Art</.test(html), 'the chosen flag is stuck on the slip');
  assert.ok(html.includes('step-tab now') && html.includes('>Next: flags →<') && !html.includes('tray-flags'), 'part 1: the folder wallet and Next');
  assert.ok(html.includes('data-wallet="tray-folders"') && html.includes('data-verb="use"'));
  const part2 = renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), { step: 2, projectId: 'pB', selected: ['c_art'] }) });
  assert.ok(part2.includes('data-wallet="tray-flags"') && !part2.includes('tray-folders') && part2.includes('>Next: tie to tasks →<') && part2.includes('data-action="sort-back">← Back<'));
  html = renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), { step: 3, projectId: 'pB', selected: ['c_art'] }) });
  assert.ok(/icard project is-picked/.test(renderInTrayCard(state, ui)) && /icard is-picked/.test(part2), 'chosen cards are marked');
  assert.ok(html.includes('data-action="unsorted-file" data-inbox="th1">File it in Home →<'));
  assert.ok(html.includes('>Already done<') && html.includes('data-action="unsorted-skip">Later<') && html.includes('>Bin it<'));
  const none = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() });
  assert.ok(none.includes('No folder yet') && none.includes('disabled>Choose a folder first<') && !none.includes('unsorted-file'), 'no folder: File it is off');
  assert.ok(!html.includes('sort-more-labels') && !html.includes('unsorted-more-projects'), 'the old pills are not in the in-tray');
});

test('the card: a task slip starts in its own project (chosen on part 1), and the tray can be empty or closed', () => {
  seed();
  state.inbox.length = 0;
  const html = renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), { step: 3 }) });
  assert.ok(html.includes('Unlabelled A') && html.includes('In <span class="folder-chip"'), 'a task shows its own project');
  assert.ok(renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() }).includes('icard project is-picked') && renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() }).includes('>Next: flags →<'), 'part 1 shows its folder as chosen');
  assert.ok(html.includes('data-action="unsorted-save" data-task="a2" data-project="pA">Save in School →<') && html.includes('1 in the tray') && !html.includes('slip-behind'));
  state.projects[0].tasks.pop();
  const empty = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() });
  assert.ok(empty.includes('The tray is empty. Everything has a home.') && empty.includes('0 in the tray') && !empty.includes('jot-slip'), 'an empty tray says so plainly');
  const closed = renderInTrayCard(state, { inboxOpen: false, unsorted: fresh() });
  assert.ok(!closed.includes('tray'.concat('-lip')) && closed.includes('Unsorted'), 'closed: just the header');
  seed();
  state.projects.length = 0;
  const noProjects = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() });
  assert.ok(noProjects.includes('Add a project below to file this thought into.') && !noProjects.includes('tray-folders'));
});

test('Later puts the front slip last in the rendered tray', () => {
  seed();
  const html = renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), { later: ['i:th1'] }) });
  assert.ok(html.includes('Email Ms Patel') && !html.includes('Buy a card'));
});

const card = (u) => renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), u) });

test('step bar: three tabs, later ones off, finished ones tappable, summaries', () => {
  seed();
  const p1 = card({ projectId: 'pB' });
  assert.ok(p1.includes('class="step-tab now" data-action="sort-step" data-step="1"') && !p1.includes('locked') && !p1.includes('aria-disabled'), 'with a folder every step is open');
  const lk = card({ why: 'x' });
  assert.ok(lk.includes('step-tab locked" data-action="sort-step" data-step="2" aria-disabled="true"') && lk.includes('class="step-why"'), 'no folder: 2 and 3 are locked and say why');
  assert.ok(p1.includes('<small>Home</small>'), 'part 1 summary is the folder');
  const p3 = card({ step: 3, projectId: 'pB', selected: ['c_art', 'c_chore'] });
  assert.ok(p3.includes('class="step-tab done" data-action="sort-step" data-step="1"') && !p3.includes('data-step="2" aria-disabled'));
  assert.ok(p3.includes('<small>Art, Chore</small>') && p3.includes('<small>optional</small>') && p3.includes('>Across all folders<'));
  assert.ok(!p3.includes('data-wallet=') && p3.includes('File it in Home →') && p3.includes('data-action="sort-back"'));
});

test('folder search filters folders; flag search filters flags and shows all', () => {
  seed();
  const f = card({ find: 'hom' });
  assert.ok(f.includes('data-key="pB"') && !f.includes('data-key="pA"'), 'only Home is left in the wallet');
  assert.ok(card({ find: 'zzz' }).includes('No folder matches “zzz”.'));
  const g = card({ step: 2, projectId: 'pB', find: 'st' });
  assert.ok(g.includes('data-key="c_study"') && !g.includes('data-key="c_chore"') && !g.includes('More categories'), 'Study shows though Home never uses it; no More card while searching');
  assert.ok(card({ step: 2, projectId: 'pB' }).includes('More categories'), 'the More card stays when not searching');
});

test('+ New flag shows only with text and no exact (case-insensitive) match', () => {
  seed();
  assert.ok(!card({ step: 2, projectId: 'pB' }).includes('new-flag'));
  assert.ok(card({ step: 2, projectId: 'pB', find: 'Garden' }).includes('data-action="sort-new-flag">+ New flag “Garden”<'));
  assert.ok(card({ step: 2, projectId: 'pB', find: 'ar' }).includes('new-flag'), 'a partial match still offers it');
  assert.ok(!card({ step: 2, projectId: 'pB', find: 'ART' }).includes('new-flag'), 'exact match ignoring case: no button');
});

test('the slip: editable title unless GitHub-linked, notes box or link', () => {
  seed();
  assert.ok(card({}).includes('contenteditable="true" spellcheck="false" data-slip-title') && card({}).includes('data-action="sort-add-notes">+ Add notes<'));
  assert.ok(card({ notesOpen: true }).includes('<textarea class="slip-notes"'));
  state.inbox.length = 0;
  state.projects[0].tasks[1].issueNumber = 7;
  state.projects[0].tasks[1].notes = 'old note';
  const t = card({});
  assert.ok(!t.includes('contenteditable') && t.includes('#7') && t.includes('>old note</textarea>'), 'linked task: title fixed, existing notes shown');
});

test('saving a thought: edited title and notes go to the new task', () => {
  seed();
  const deps = { labelIdByName: (n) => n, fileInboxItem: M.fileInboxItem, updateTaskFields: () => assert.fail(), createIssue: () => {} };
  const out = fileSlip(unsortedQueue(state)[0], { projectId: 'pB', selected: [], title: '  Buy two cards ', notes: ' for Gran ' }, deps);
  assert.strictEqual(out.task.title, 'Buy two cards');
  assert.strictEqual(out.task.notes, 'for Gran');
  const blank = fileSlip(unsortedQueue(state)[0], { projectId: 'pB', selected: [], title: '   ', notes: '' }, deps);
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

test('part 3: Inside / Across groups, tags, and the search limited to the folder or not', () => {
  seed();
  state.projects[0].tasks.push({ id: 'a4', title: 'Essay', status: 'next', categoryIds: [] });
  state.projects[1].tasks[0].waitsOn = ['a1'];
  const part3 = (over) => renderInTrayCard(state, { inboxOpen: true, unsorted: Object.assign(fresh(), { step: 3, projectId: 'pA', parent: null, subtasks: [], waitsOn: [], holdsUp: [], newSubtasks: [], picking: null, pickQuery: '' }, over) });
  let html = part3({});
  assert.ok(html.includes('>Inside School<') && html.includes('>Across all folders<'));
  ['Part of', 'Subtasks', 'Waits on', 'Holds up'].forEach((l) => assert.ok(html.includes('>' + l + '<'), l));
  assert.strictEqual((html.match(/data-action="tie-open"/g) || []).length, 4);
  html = part3({ waitsOn: ['b1'], picking: 'parent' });
  assert.ok(/link-tag[^>]*>Bins <small>· Home<\/small><button[^>]*data-action="tie-remove" data-field="waitsOn" data-id="b1"/.test(html), 'a tag from another folder names it');
  assert.ok(html.includes('data-tie-find') && html.includes('data-field="parent" data-id="a4"') && !html.includes('data-field="parent" data-id="b2"'), 'Part of searches this folder only');
  html = part3({ picking: 'waitsOn', pickQuery: 'home' });
  assert.ok(html.includes('data-field="waitsOn" data-id="b2"') && !html.includes('data-field="waitsOn" data-id="a4"'), 'Waits on searches every folder, by folder name too');
  html = part3({ picking: 'subtasks', pickQuery: 'Esx' });
  assert.ok(html.includes('data-action="tie-new-sub"') && html.includes('“Esx”'), 'new subtask from the typed text');
  assert.ok(!part3({ picking: 'subtasks', pickQuery: '' }).includes('tie-new-sub'));
});

test('saving ties through fileSlip: parent, waits-on, holds-up, new subtask; refused ones skipped', () => {
  seed();
  const deps = { labelIdByName: (n) => n, fileInboxItem: M.fileInboxItem, updateTaskFields: M.updateTaskFields, applyTaskMove: M.applyTaskMove, addTask: M.addTask, projects: state.projects, createIssue: () => {} };
  const find = (id) => state.projects.flatMap((p) => p.tasks).find((x) => x.id === id);
  const out = fileSlip(unsortedQueue(state)[0], { projectId: 'pA', selected: [], parent: 'a1', waitsOn: ['b1', 'nope'], holdsUp: ['b2'], subtasks: [], newSubtasks: [] }, deps);
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
