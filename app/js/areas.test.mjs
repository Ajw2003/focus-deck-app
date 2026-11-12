// focus-deck-app/js/areas.test.mjs -- run with: node --test app/js/areas.test.mjs
// Areas (#251, docs/4-systems/areas.md): the default set, the one-time migration (idempotent, merge-safe
// across two devices), Unsorted being fixed, delete moving projects to Unsorted, kinds of work and the
// label-to-priority mapping.
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const { state, loadState, openTasksMatching, UNLABELLED } = await import('./state.js');
const { mergeStates } = await import('./merge.js');
const M = await import('./mutations.js');
const A = await import('./areas.js');
const { renderCategoryWalletInner } = await import('./focus-view.js');
const { cardKey } = await import('./card-key.js');

const names = (st) => st.projectCategories.map((c) => c.name);
const OLD = () => ({ projects: [{ id: 'p1', name: 'Essay', tasks: [], categoryId: 'pcat_learning' }], inbox: [],
  projectCategories: [{ id: 'pcat_work', name: 'Work', color: 'red' }, { id: 'pcat_personal', name: 'Personal', color: 'green' }, { id: 'pcat_learning', name: 'Learning', color: 'gold' }, { id: 'pcat_x', name: 'garden', color: 'blue' }] });

test('a fresh user gets the eight default areas, each with its own colour, Unsorted last', () => {
  store['focusdeck-state-v1'] = undefined; delete store['focusdeck-state-v1'];
  const fresh = loadState();
  assert.deepStrictEqual(names(fresh), ['Personal', 'Lists', 'Home', 'Apps', 'Games', 'Work', 'School', 'Unsorted']);
  assert.strictEqual(new Set(fresh.projectCategories.map((c) => c.color)).size, 8);
  assert.strictEqual(fresh.areasMigrated, true);
});

test('migration keeps an existing user\'s areas, adds the missing defaults by name, once', () => {
  store['focusdeck-state-v1'] = JSON.stringify(OLD());
  const st = loadState();
  assert.ok(names(st).includes('Learning') && names(st).includes('garden'), 'existing areas survive');
  assert.strictEqual(st.projects[0].categoryId, 'pcat_learning', 'and so does the project in Learning');
  ['Lists', 'Home', 'Apps', 'Games', 'School', 'Unsorted'].forEach((n) => assert.strictEqual(names(st).filter((x) => x === n).length, 1, n));
  assert.strictEqual(names(st).filter((n) => n === 'Work').length, 1, 'Work was not duplicated');
  assert.strictEqual(st.areasMigrated, true);
});

test('migration is idempotent, and matches a custom "home" by name without a second Home', () => {
  const o = OLD(); o.projectCategories.push({ id: 'pcat_mine', name: 'home', color: 'pink' });
  const st = A.migrateAreas(o) && o;
  const before = JSON.stringify(st.projectCategories);
  assert.strictEqual(A.migrateAreas(st), false, 'second run does nothing');
  assert.strictEqual(JSON.stringify(st.projectCategories), before);
  assert.strictEqual(names(st).filter((n) => n.toLowerCase() === 'home').length, 1);
  // a user who deletes an added default is not given it back on the next load
  st.projectCategories = st.projectCategories.filter((c) => c.name !== 'Games');
  store['focusdeck-state-v1'] = JSON.stringify(st);
  assert.ok(!names(loadState()).includes('Games'));
});

test('two devices that both migrated merge to one copy of each default', () => {
  const a = (store['focusdeck-state-v1'] = JSON.stringify(OLD()), loadState());
  const b = (store['focusdeck-state-v1'] = JSON.stringify(OLD()), loadState());
  const merged = mergeStates(a, b);
  assert.strictEqual(new Set(merged.projectCategories.map((c) => c.id)).size, merged.projectCategories.length, 'no duplicate ids');
  assert.deepStrictEqual(names(merged).filter((n) => n === 'Home' || n === 'Unsorted'), ['Home', 'Unsorted']);
  assert.strictEqual(merged.areasMigrated, true);
  // an old device that never migrated: the flag and the defaults still win
  assert.strictEqual(mergeStates(a, OLD()).areasMigrated, true);
});

test('Unsorted is fixed: cannot be renamed or deleted; no area counts as Unsorted', () => {
  Object.assign(state, loadState());
  assert.strictEqual(M.renameProjectCategory(A.UNSORTED_ID, 'Misc'), false);
  assert.strictEqual(M.removeProjectCategory(A.UNSORTED_ID), false);
  assert.ok(state.projectCategories.some((c) => c.id === A.UNSORTED_ID && c.name === 'Unsorted'));
  state.projects = [{ id: 'a', name: 'A', tasks: [], categoryId: null }, { id: 'b', name: 'B', tasks: [], categoryId: 'gone' }, { id: 'c', name: 'C', tasks: [], categoryId: 'pcat_home' }];
  assert.strictEqual(A.areaCount(state, A.UNSORTED_ID), 2, 'no area and an unknown area both count');
  assert.strictEqual(A.areaCount(state, 'pcat_home'), 1);
  M.setProjectCategory('c', A.UNSORTED_ID);
  assert.strictEqual(state.projects[2].categoryId, null, 'moving to Unsorted stores no area');
  assert.strictEqual(M.renameProjectCategory('pcat_home', 'House'), true);
});

test('deleting an area moves its projects to Unsorted', () => {
  state.projects = [{ id: 'a', name: 'A', tasks: [], categoryId: 'pcat_games' }];
  assert.strictEqual(M.removeProjectCategory('pcat_games'), true);
  assert.ok(!state.projectCategories.some((c) => c.id === 'pcat_games'));
  assert.strictEqual(A.areaIdOf(state, state.projects[0]), A.UNSORTED_ID);
  const added = M.addProjectCategory('Garden');
  M.setProjectCategory('a', added.id);
  assert.strictEqual(A.areaCount(state, added.id), 1, 'one project, one area');
});

const labels = () => [
  { id: 'c1', name: 'Bug', color: 'red' }, { id: 'c2', name: 'needs review', color: 'grey' }, { id: 'c3', name: 'wip', color: 'grey' },
  { id: 'c4', name: 'AjsAgent created this', color: 'grey' }, { id: 'c5', name: 'Asap', color: 'orange' }, { id: 'c6', name: 'highest priority', color: 'red' }, { id: 'c7', name: 'Duplicate', color: 'grey' }, { id: 'c8', name: 'priority: high', color: 'red' } ];

test('kinds of work: workflow and priority labels start unticked, a tick overrides', () => {
  const st = { categories: labels() };
  assert.deepStrictEqual(A.kindsOfWork(st).map((c) => c.name), ['Bug']);
  st.categories[1].kind = true; st.categories[0].kind = false;
  assert.deepStrictEqual(A.kindsOfWork(st).map((c) => c.id), ['c2']);
});

test('the Focus kinds row offers only ticked labels', () => {
  Object.assign(state, loadState());
  state.categories = [{ id: 'c1', name: 'Bug', color: 'red' }, { id: 'c2', name: 'Chore', color: 'blue' }];
  state.projects = [{ id: 'p', name: 'P', color: 'red', tasks: [{ id: 't1', title: 'x', status: 'next', categoryIds: ['c1'] }, { id: 't2', title: 'y', status: 'next', categoryIds: ['c2'] }] }];
  const html = () => renderCategoryWalletInner(state, {});
  assert.ok(html().includes('Bug') && html().includes('Chore'));
  M.setKindOfWork('c2', false);
  assert.ok(html().includes('Bug') && !html().includes('Chore'), 'unticked Chore is gone');
  assert.deepStrictEqual(state.projects[0].tasks[1].categoryIds, ['c2'], 'but it stays on the task');
});

test('a mapped label counts as that priority when the task has none; own priority wins', () => {
  const st = { categories: labels() };
  st.categories[4].priority = 'urgent'; st.categories[5].priority = 'urgent'; st.categories[7].priority = 'high';
  assert.strictEqual(A.effectivePriority({ categoryIds: ['c5'] }, st), 'urgent');
  assert.strictEqual(A.effectivePriority({ categoryIds: ['c8', 'c6'] }, st), 'urgent', 'the most urgent mapped label');
  assert.strictEqual(A.effectivePriority({ categoryIds: ['c5'], priority: 'low' }, st), 'low', 'own priority first');
  assert.strictEqual(A.effectivePriority({ categoryIds: ['c1'] }, st), null);
  assert.strictEqual(cardKey({ categoryIds: ['c5'] }, st, ['priority']).name, 'Urgent priority', 'card colour reads it');
});

test('setLabelPriority maps and clears, and refuses unknown levels', () => {
  state.categories = [{ id: 'c1', name: 'Asap', color: 'red' }];
  M.setLabelPriority('c1', 'urgent'); assert.strictEqual(state.categories[0].priority, 'urgent');
  M.setLabelPriority('c1', 'bogus'); assert.strictEqual(state.categories[0].priority, undefined);
});

test('a task whose only labels are unticked counts as Unlabelled on Focus, and is picked by it', () => {
  Object.assign(state, loadState());
  state.categories = [{ id: 'c1', name: 'Bug', color: 'red' }, { id: 'c2', name: 'Chore', color: 'blue', kind: false }];
  state.projects = [{ id: 'p', name: 'P', color: 'red', tasks: [{ id: 't1', title: 'x', status: 'next', categoryIds: ['c2'] }] }];
  assert.ok(renderCategoryWalletInner(state, {}).includes('Unlabelled'));
  assert.deepStrictEqual(openTasksMatching({ categoryId: UNLABELLED }), ['t1']);
  state.categories[1].kind = true;
  assert.deepStrictEqual(openTasksMatching({ categoryId: UNLABELLED }), []);
});
