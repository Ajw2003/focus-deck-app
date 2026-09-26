// focus-deck-app/js/sync.js
import { state, saveStateLocal, serializeState, setGistId } from './state.js';
import { ghFetch, getToken } from './github.js';
import { mergeStates } from './merge.js';

export { mergeStates };

export const GIST_FILE = 'focus-deck-state.json';
// Set whenever a local change hasn't reached the Gist yet, so a reload or closed tab inside the
// push debounce window still gets pushed on the next load instead of silently never syncing.
const PUSH_PENDING_KEY = 'focusdeck-push-pending';

// paint is set by app.js after module init to avoid a circular import (app.js imports this module).
let paintFn = () => {};
export function registerPaint(fn) { paintFn = fn; }

function setPushPending(isPending) {
  try {
    if (isPending) localStorage.setItem(PUSH_PENDING_KEY, '1');
    else localStorage.removeItem(PUSH_PENDING_KEY);
  } catch (e) { /* the next persist() retries */ }
}
function isPushPending() {
  try { return localStorage.getItem(PUSH_PENDING_KEY) === '1'; } catch (e) { return false; }
}

// Returns the parsed remote state, or throws. GitHub truncates file content over ~1MB in the
// Gist API response, so a truncated file is fetched in full from raw_url instead of being parsed
// half-read.
async function readGistState(gist) {
  const file = gist && gist.files && gist.files[GIST_FILE];
  if (!file) throw new Error('That Gist has no ' + GIST_FILE + ' file.');
  let content = file.content;
  if (file.truncated && file.raw_url) {
    const resp = await fetch(file.raw_url);
    if (!resp.ok) throw new Error('Could not read the full sync file (' + resp.status + ').');
    content = await resp.text();
  }
  const remote = JSON.parse(content);
  if (!remote || typeof remote !== 'object' || !Array.isArray(remote.projects)) throw new Error('The sync Gist’s data isn’t in the expected shape.');
  return remote;
}

function applyMerged(merged) {
  Object.keys(merged).forEach((k) => { if (!k.startsWith('_')) state[k] = merged[k]; });
}

export async function pullFromGist() {
  if (!state.gistId) return;
  const remote = await readGistState(await ghFetch('/gists/' + state.gistId));
  applyMerged(mergeStates(state, remote));
  saveStateLocal(state);
}

// Always merges with what's in the Gist before writing it: a push from a device that hasn't pulled
// yet (offline start, failed pull, fresh browser) must add to the Gist, never replace it with a
// smaller copy.
export async function pushToGist() {
  if (!state.gistId) return;
  const gist = await ghFetch('/gists/' + state.gistId);
  let remote = null;
  try { remote = await readGistState(gist); } catch (e) {
    // The Gist keeps every revision, so writing over an unreadable file loses nothing on GitHub.
    console.warn('Sync Gist content unreadable, overwriting with local copy (previous revision stays in Gist history):', e.message);
    showOnPage('notice', 'Your sync Gist couldn’t be read, so it was replaced with this device’s data. The previous version is still in the Gist’s history on GitHub.');
  }
  if (remote) { applyMerged(mergeStates(state, remote)); saveStateLocal(state); }
  await ghFetch('/gists/' + state.gistId, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [GIST_FILE]: { content: serializeState(state) } } }),
  });
  setPushPending(false);
}

// Finds the user's existing sync Gist by its file name — how a device that lost its Gist ID (or a
// new browser with only the token) reconnects instead of starting over. Newest wins if several.
export async function findSyncGist() {
  const gists = await ghFetch('/gists?per_page=100');
  const matches = (gists || []).filter((g) => g.files && g.files[GIST_FILE]);
  matches.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return matches.length ? matches[0].id : null;
}

// Background sync runs with no button pressed, so its problems are put in the page's toast
// (state._ui is set by the main page's renderApp; pages without it, like settings, skip this).
function showOnPage(field, message) {
  if (!state._ui) return;
  state._ui[field] = message;
  paintFn();
}

let pushTimer = null;
export function persist() {
  // save first: saveStateLocal may fold in another tab's newer copy, and the repaint should show it
  saveStateLocal(state);
  paintFn();
  if (!state.gistId) return;
  setPushPending(true);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushToGist().catch((e) => {
      console.warn('sync push failed:', e.message);
      showOnPage('syncError', 'Couldn’t send your changes to your other devices (' + e.message + '). They’re saved on this device and will be sent next time the app opens or you make a change.');
    });
  }, 3000);
}

// A Gist ID can go missing (browser storage evicted, older app versions that wiped it) while the
// token survives, or the token gets re-entered on a fresh browser — reconnect automatically.
async function reconnectIfNeeded() {
  if (state.gistId || !getToken()) return;
  const id = await findSyncGist();
  if (id) setGistId(id);
}

async function initialSync() {
  await reconnectIfNeeded();
  if (!state.gistId) return;
  await pullFromGist();
  paintFn();
  if (isPushPending()) await pushToGist();
}

export function initSyncLifecycle() {
  initialSync().catch((e) => {
    console.warn('initial sync failed:', e.message);
    // With no Gist connected, the failure is the optional reconnect lookup (e.g. a token without
    // Gist access), which isn't worth an error on every app open.
    if (state.gistId) showOnPage('syncError', 'Couldn’t sync with your other devices (' + e.message + '). Use ⬇ Pull latest to try again.');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.gistId) {
      pullFromGist().then(() => paintFn()).catch((e) => {
        console.warn('foreground pull failed:', e.message);
        showOnPage('syncError', 'Couldn’t pull the latest from your other devices (' + e.message + '). Use ⬇ Pull latest to try again.');
      });
    }
  });
}
