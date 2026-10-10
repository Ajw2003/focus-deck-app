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

const fresh = () => ({ skipped: [], later: [], projectId: null, selected: [], newLabels: '', facingFolder: null, facingFlag: null, currentKey: null });
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
  const names = (project) => flagCards(state, project).map((c) => c.name);
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

test('selectionToIds: flags, kind labels created on first use, typed labels de-duplicated', () => {
  const made = [];
  const byName = (name, color) => { made.push([name, color]); return 'id_' + name; };
  const ids = selectionToIds(['c_art', 'kind:fix', 'c_art'], 'Chore, chore ,, New', byName);
  assert.deepStrictEqual(ids, ['c_art', 'id_fix', 'id_Chore', 'id_chore', 'id_New'], 'order: picks, then typed; duplicate pick dropped');
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
  assert.deepStrictEqual(fileSlip(cur, { projectId: null, selected: ['c_art'], newLabels: '' }, deps), { outcome: 'none' }, 'no folder: nothing happens');
  assert.strictEqual(calls.length, 0);
  const out = fileSlip(cur, { projectId: 'pB', selected: ['c_art', 'c_chore'], newLabels: '' }, deps);
  assert.strictEqual(out.outcome, 'filed');
  assert.deepStrictEqual(calls.map((c) => c[0]), ['file', 'issue'], 'file first, then the issue hook, nothing else');
  assert.deepStrictEqual(calls[0].slice(1), ['th1', 'pB', ['c_art', 'c_chore']]);
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
  const out = fileSlip(unsortedQueue(state)[0], { projectId: 'pA', selected: [], newLabels: '' }, { labelIdByName: () => 'x', fileInboxItem: M.fileInboxItem, updateTaskFields: () => assert.fail('not for a thought'), createIssue: () => {} });
  assert.strictEqual(out.outcome, 'filed');
  assert.deepStrictEqual(state.projects[0].tasks.at(-1).categoryIds, []);
});

test('saving a task: flags go on it; none means nothing is saved and it goes to the back (as before)', () => {
  seed();
  const calls = [];
  const deps = { labelIdByName: (n) => 'id_' + n, fileInboxItem: () => assert.fail('not for a task'), updateTaskFields: (...a) => calls.push(a), createIssue: () => assert.fail('no issue for a save') };
  const cur = unsortedQueue(state).find((x) => x.kind === 'task');
  assert.deepStrictEqual(fileSlip(cur, { projectId: null, selected: [], newLabels: '' }, deps), { outcome: 'later' });
  assert.strictEqual(calls.length, 0);
  assert.deepStrictEqual(fileSlip(cur, { projectId: null, selected: ['c_art'], newLabels: 'Extra' }, deps), { outcome: 'saved', taskId: 'a2' });
  assert.deepStrictEqual(calls, [['a2', { categoryIds: ['c_art', 'id_Extra'] }]]);
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
  const html = renderInTrayCard(state, ui);
  assert.ok(html.includes('>Unsorted <span class="count">3<'), 'header count is the whole queue');
  assert.ok(html.includes('3 in the tray') && html.includes('slip-behind two'), 'a small stack with a count');
  assert.ok(html.includes('Buy a card') && html.includes('Going in <span class="folder-chip"') && html.includes('>Home<'), 'the chosen folder shows on the slip');
  assert.ok(/class="slip-flag"[^>]*>Art</.test(html), 'the chosen flag is stuck on the slip');
  assert.ok(html.includes('1. Which folder?') && html.includes('2. Stick on category flags'), 'both wallets, numbered');
  assert.ok(html.includes('data-wallet="tray-folders"') && html.includes('data-wallet="tray-flags"') && html.includes('data-verb="use"'));
  assert.ok(/icard project is-picked/.test(html) && /icard is-picked/.test(html), 'chosen cards are marked');
  assert.ok(html.includes('data-action="unsorted-file" data-inbox="th1">File it in Home →<'));
  assert.ok(html.includes('>Already done<') && html.includes('data-action="unsorted-skip">Later<') && html.includes('>Bin it<'));
  const none = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() });
  assert.ok(none.includes('No folder yet') && none.includes('disabled>Choose a folder first<') && !none.includes('unsorted-file'), 'no folder: File it is off');
  assert.ok(!html.includes('sort-more-labels') && !html.includes('unsorted-more-projects'), 'the old pills are not in the in-tray');
});

test('the card: a task slip is already in its project (no folder wallet), and the tray can be empty or closed', () => {
  seed();
  state.inbox.length = 0;
  const html = renderInTrayCard(state, { inboxOpen: true, unsorted: fresh() });
  assert.ok(html.includes('Unlabelled A') && html.includes('In <span class="folder-chip"') && !html.includes('tray-folders'), 'a task shows its own project');
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
