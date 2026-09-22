// focus-deck-app/js/storage-safety.test.mjs — run with: node --test js/storage-safety.test.mjs
//
// Each test reproduces one way Focus Deck used to lose projects or the Gist ID on reload.
// Background: docs/systems/local-storage.md#traps. The tests drive the real modules against a
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
  assert.strictEqual(tab.state.projects[0].tasks[0].categoryId, 'cat_y');
  assert.match(tab.state.categories[0].color, /^hsl\(/);
  assert.match(tab.state.projectCategories[0].color, /^hsl\(/);

  const M = await import('./mutations.js');
  const cat = M.addCategory('Errands', () => 'not a color');
  assert.match(cat.color, /^hsl\(/, 'a non-string color falls back to a real one');
  assert.strictEqual(typeof M.removeCategory, 'function');
  assert.strictEqual(typeof M.removeProjectCategory, 'function');
});
