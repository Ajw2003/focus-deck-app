// focus-deck-app/js/storage-safety.test.mjs — run with: node --test js/storage-safety.test.mjs
//
// Each test reproduces one way Focus Deck used to lose projects or the Gist ID on reload.
// Background: docs/4-systems/local-storage.md#traps. The tests drive the real modules against a
// mocked localStorage (with the browser's String() coercion) and a fake Gist API.
import test from 'node:test';
import assert from 'node:assert';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

// A second copy of state.js is a second tab: same storage, its own in-memory singleton.
let tabCounter = 0;
const openTab = () => import('./state.js?tab=' + (++tabCounter));

const KEY = 'focusdeck-state-v1';
const GIST_KEY = 'focusdeck-gist-id';
const saved = () => JSON.parse(store.get(KEY));

test('saveStateLocal refuses to write anything that is not the state object', async () => {
  store.clear();
  const tab = await openTab();
  tab.state.projects.push({ id: 'p1', name: 'Keep me', tasks: [] });
  tab.saveStateLocal(tab.state);
  assert.throws(() => tab.saveStateLocal(), /refusing to overwrite/);
  assert.throws(() => tab.saveStateLocal(undefined), /refusing to overwrite/);
  assert.strictEqual(saved().projects[0].id, 'p1', 'the stored data must be untouched after a refused save');
});

test('unreadable saved data is backed up and recovered, never silently replaced by defaults', async () => {
  store.clear();
  const first = await openTab();
  first.state.projects.push({ id: 'p1', name: 'Real work', tasks: [{ id: 't1', title: 'x' }] });
  first.saveStateLocal(first.state);
  first.state.projects = [];
  first.saveStateLocal(first.state); // shrinking save: the fuller copy must land in the backups
  store.set(KEY, 'undefined'); // exactly what the old persist() bug wrote

  const reloaded = await openTab();
  assert.ok(reloaded.storageProblem, 'the user must be told their data could not be read');
  assert.ok(reloaded.readBackups().some((b) => b.raw === 'undefined'), 'the unreadable value itself is kept, not discarded');
  assert.strictEqual(reloaded.state.projects[0]?.id, 'p1', 'the last backup with content is restored');
});

test('a corruption right after a normal reload still recovers from the load-time snapshot', async () => {
  store.clear();
  store.set(KEY, JSON.stringify({ projects: [{ id: 'p9', name: 'Only copy', tasks: [] }] }));
  await openTab(); // an ordinary page load
  store.set(KEY, 'undefined');
  const reloaded = await openTab();
  assert.strictEqual(reloaded.state.projects[0]?.id, 'p9');
});

test('the Gist ID survives a save from code that does not know it', async () => {
  store.clear();
  const tab = await openTab();
  tab.setGistId('gist123');
  assert.strictEqual(store.get(GIST_KEY), 'gist123');
  tab.state.gistId = null; // e.g. a stale copy, or an old code path
  tab.saveStateLocal(tab.state);
  assert.strictEqual(saved().gistId, 'gist123', 'a missing gistId is restored, not saved as a gap');
  assert.strictEqual(tab.state.gistId, 'gist123');
});

test('a wiped main key still reconnects to the Gist on reload', async () => {
  store.clear();
  const tab = await openTab();
  tab.setGistId('gist456');
  store.delete(KEY); // storage eviction / older bug cleared the main blob
  const reloaded = await openTab();
  assert.strictEqual(reloaded.state.gistId, 'gist456');
});

test('existing users get the Gist ID copied to its own key on first load', async () => {
  store.clear();
  store.set(KEY, JSON.stringify({ projects: [], gistId: 'legacy789' }));
  await openTab();
  assert.strictEqual(store.get(GIST_KEY), 'legacy789');
});

test('only disconnectGist() can clear the Gist ID', async () => {
  store.clear();
  const tab = await openTab();
  tab.setGistId('gistABC');
  tab.disconnectGist();
  assert.strictEqual(store.get(GIST_KEY), undefined);
  assert.strictEqual(saved().gistId, null);
});

test('a stale tab saving does not roll back another tab (projects or Gist ID)', async () => {
  store.clear();
  const settingsTab = await openTab();
  const appTab = await openTab(); // loaded before the other tab's changes, never told about them
  settingsTab.state.projects.push({ id: 'pA', name: 'From tab A', tasks: [] });
  settingsTab.setGistId('gistFromSettings');

  appTab.state.projects.push({ id: 'pB', name: 'From tab B', tasks: [] });
  appTab.saveStateLocal(appTab.state);

  const ids = saved().projects.map((p) => p.id).sort();
  assert.deepStrictEqual(ids, ['pA', 'pB'], 'both tabs\' projects survive');
  assert.strictEqual(saved().gistId, 'gistFromSettings', 'the stale tab must not erase the Gist ID');
});

test('runtime-only "_" fields never reach storage', async () => {
  store.clear();
  const tab = await openTab();
  tab.state._ui = { syncing: true, syncError: 'boom' };
  tab.state._persistHook = () => {};
  tab.saveStateLocal(tab.state);
  assert.ok(!('_ui' in saved()) && !('_persistHook' in saved()));
  assert.ok(tab.state._ui, 'the in-memory runtime field is left alone');
});

test('mergeStates treats a partial remote as nothing to add, not as a deletion', async () => {
  const { mergeStates } = await import('./merge.js');
  const local = { projects: [{ id: 'p1', tasks: [{ id: 't1', updatedAt: 1 }] }], inbox: [{ id: 'i1' }], categories: [], gistId: 'g' };
  const merged = mergeStates(local, {});
  assert.strictEqual(merged.projects.length, 1);
  assert.strictEqual(merged.inbox.length, 1);
  assert.strictEqual(merged.gistId, 'g');
  assert.doesNotThrow(() => mergeStates(local, { projects: [{ id: 'p1' }] }));
});

// ---- Gist push/pull, against a fake GitHub API ----

function fakeGistServer(initialRemote) {
  const server = { remote: initialRemote, patches: 0, gistList: [] };
  globalThis.fetch = async (url, opts = {}) => {
    const path = url.replace('https://api.github.com', '');
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (path.startsWith('/gists?')) return json(server.gistList);
    if (path.startsWith('/gists/') && (!opts.method || opts.method === 'GET')) {
      return json({ files: { 'focus-deck-state.json': { content: JSON.stringify(server.remote) } } });
    }
    if (path.startsWith('/gists/') && opts.method === 'PATCH') {
      server.patches++;
      server.remote = JSON.parse(JSON.parse(opts.body).files['focus-deck-state.json'].content);
      return json({});
    }
    throw new Error('unexpected request ' + path);
  };
  return server;
}

test('pushing from a device that never pulled adds to the Gist instead of replacing it', async () => {
  store.clear();
  store.set('focusdeck-github-token', 'test-token');
  const server = fakeGistServer({ projects: [{ id: 'remoteP', name: 'On the other device', tasks: [] }], inbox: [], categories: [] });
  const { state, setGistId } = await import('./state.js');
  const { pushToGist } = await import('./sync.js');
  setGistId('gistX');
  state.projects.push({ id: 'localP', name: 'Here', tasks: [] });
  await pushToGist();
  const ids = server.remote.projects.map((p) => p.id).sort();
  assert.deepStrictEqual(ids, ['localP', 'remoteP'], 'the Gist keeps what the other device wrote');
  assert.ok(!('_ui' in server.remote), 'runtime fields are not pushed');
  assert.ok(state.projects.some((p) => p.id === 'remoteP'), 'and this device picks it up too');
});

test('every mutation marks a Gist push as pending, so a quick reload still syncs it', async () => {
  const { state } = await import('./state.js');
  const { addProject } = await import('./mutations.js');
  assert.ok(state.gistId, 'relies on the Gist connected in the previous test');
  store.delete('focusdeck-push-pending');
  addProject('Queued', null);
  assert.strictEqual(store.get('focusdeck-push-pending'), '1');
});

test('findSyncGist rediscovers the sync Gist from the token alone', async () => {
  const server = fakeGistServer({ projects: [] });
  server.gistList = [
    { id: 'unrelated', updated_at: '2026-09-21T00:00:00Z', files: { 'notes.md': {} } },
    { id: 'older', updated_at: '2026-01-01T00:00:00Z', files: { 'focus-deck-state.json': {} } },
    { id: 'newest', updated_at: '2026-09-01T00:00:00Z', files: { 'focus-deck-state.json': {} } },
  ];
  const { findSyncGist } = await import('./sync.js');
  assert.strictEqual(await findSyncGist(), 'newest');
});

test('categories created from the UI keep their color and id through a reload', async () => {
  store.clear();
  // Shapes older builds saved: nextHue passed as a color (dropped by JSON), cat object as an id.
  store.set(KEY, JSON.stringify({
    projects: [{ id: 'p1', categoryId: { id: 'pcat_x', name: 'X' }, tasks: [{ id: 't1', categoryId: { id: 'cat_y', name: 'Y' } }] }],
    categories: [{ id: 'cat_y', name: 'Y' }],
    projectCategories: [{ id: 'pcat_x', name: 'X' }],
  }));
  const tab = await openTab();
  assert.strictEqual(tab.state.projects[0].categoryId, 'pcat_x');
  assert.deepStrictEqual(tab.state.projects[0].tasks[0].categoryIds, ['cat_y'], 'a saved single categoryId becomes the task\'s label list');
  assert.ok(!('categoryId' in tab.state.projects[0].tasks[0]), 'the old single field is dropped once folded in');
  assert.match(tab.state.categories[0].color, /^hsl\(/);
  assert.match(tab.state.projectCategories[0].color, /^hsl\(/);

  const M = await import('./mutations.js');
  const cat = M.addCategory('Errands', () => 'not a color');
  assert.match(cat.color, /^hsl\(/, 'a non-string color falls back to a real one');
  assert.strictEqual(typeof M.removeCategory, 'function');
  assert.strictEqual(typeof M.removeProjectCategory, 'function');
});

// ---- Newest edit wins for every record, not just tasks (2026-09-23) ----
// Before this, projects, categories, Unsorted items and repo lists had no timestamps, so the
// device that pushed last overwrote everyone's colors, and deletions came back on the next pull.

test('stampChanges timestamps edits that code paths forgot to stamp, and tombstones removals', async () => {
  const { stampChanges } = await import('./merge.js');
  const before = {
    projects: [{ id: 'p1', color: 'red', tasks: [{ id: 't1', title: 'x', updatedAt: 5 }] }],
    categories: [{ id: 'c1', color: 'red' }], projectCategories: [], inbox: [{ id: 'i1', text: 'hi' }], pinnedRepos: ['a/b'],
  };
  const after = JSON.parse(JSON.stringify(before));
  after.projects[0].color = 'blue';
  after.projects[0].tasks[0].issueNumber = 7; // linking used to leave updatedAt untouched
  after.categories[0].color = 'green';
  after.inbox = [];
  after.pinnedRepos = [];
  stampChanges(after, before, 1000);
  assert.strictEqual(after.projects[0].updatedAt, 1000);
  assert.strictEqual(after.projects[0].tasks[0].updatedAt, 1000);
  assert.strictEqual(after.categories[0].updatedAt, 1000);
  assert.strictEqual(after.deletedRecordIds.inbox.i1, 1000, 'a discarded Unsorted item leaves a tombstone');
  assert.strictEqual(after.listStamps.pinnedRepos, 1000);
});

test('the newer color wins in both directions, and a fresh device adopts the Gist colors', async () => {
  const { mergeStates } = await import('./merge.js');
  const base = { projects: [], inbox: [] };
  const older = { ...base, categories: [{ id: 'cat_bug', color: 'red', updatedAt: 10 }] };
  const newer = { ...base, categories: [{ id: 'cat_bug', color: 'green', updatedAt: 20 }] };
  assert.strictEqual(mergeStates(older, newer).categories[0].color, 'green');
  assert.strictEqual(mergeStates(newer, older).categories[0].color, 'green');
  const freshDefaults = { ...base, categories: [{ id: 'cat_bug', color: 'hsl(4 70% 55%)' }] };
  const gistLegacy = { ...base, categories: [{ id: 'cat_bug', color: '#00ff00' }] };
  assert.strictEqual(mergeStates(freshDefaults, gistLegacy).categories[0].color, '#00ff00');
});

test('a project edit and a task edit on different devices both survive', async () => {
  const { mergeStates } = await import('./merge.js');
  const a = { projects: [{ id: 'p1', color: 'blue', updatedAt: 30, tasks: [{ id: 't1', title: 'old', updatedAt: 1 }] }], inbox: [], categories: [] };
  const b = { projects: [{ id: 'p1', color: 'red', updatedAt: 1, tasks: [{ id: 't1', title: 'new', updatedAt: 40 }] }], inbox: [], categories: [] };
  const m = mergeStates(a, b);
  assert.strictEqual(m.projects[0].color, 'blue');
  assert.strictEqual(m.projects[0].tasks[0].title, 'new');
});

test('discarded Unsorted items, removed projects and unpinned repos stay gone after a sync', async () => {
  const { mergeStates } = await import('./merge.js');
  const staleGist = { projects: [{ id: 'p1', updatedAt: 5, tasks: [] }], inbox: [{ id: 'i1', text: 'x', updatedAt: 5 }], categories: [], pinnedRepos: ['a/b'] };
  const here = { projects: [], inbox: [], categories: [], pinnedRepos: [], listStamps: { pinnedRepos: 50 },
    deletedRecordIds: { projects: { p1: 50 }, inbox: { i1: 50 } } };
  const m = mergeStates(here, staleGist);
  assert.strictEqual(m.inbox.length, 0);
  assert.strictEqual(m.projects.length, 0);
  assert.deepStrictEqual(m.pinnedRepos, []);
  const editedAfter = { ...staleGist, projects: [{ id: 'p1', updatedAt: 60, tasks: [] }] };
  assert.strictEqual(mergeStates(here, editedAfter).projects.length, 1, 'an edit after the removal still wins');
});

test('an issue link made on one device reaches the other through the Gist', async () => {
  store.set('focusdeck-github-token', 'test-token');
  const server = fakeGistServer({ projects: [{ id: 'p1', name: 'P', updatedAt: 1, tasks: [{ id: 't1', title: 'T', source: 'manual', updatedAt: 1 }] }], inbox: [], categories: [] });
  const { pullFromGist, pushToGist } = await import('./sync.js'); // bound to the shared state.js
  const shared = await import('./state.js');
  shared.setGistId('gistX');
  await pullFromGist();
  const task = shared.state.projects.find((p) => p.id === 'p1').tasks[0];
  Object.assign(task, { source: 'github', repoFullName: 'me/app', issueNumber: 9 }); // what linking does, with no updatedAt bump
  shared.saveStateLocal(shared.state);
  await pushToGist();
  const gistP1 = () => server.remote.projects.find((p) => p.id === 'p1');
  assert.strictEqual(gistP1().tasks[0].issueNumber, 9, 'the link is in the Gist');
  const { mergeStates } = await import('./merge.js');
  const otherDevice = { projects: [{ id: 'p1', name: 'P', updatedAt: 1, tasks: [{ id: 't1', title: 'T', source: 'manual', updatedAt: 1 }] }], inbox: [], categories: [] };
  assert.strictEqual(mergeStates(otherDevice, server.remote).projects.find((p) => p.id === 'p1').tasks[0].issueNumber, 9, 'and wins over the other device\'s unlinked copy');
});
