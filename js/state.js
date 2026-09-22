// focus-deck-app/js/state.js
import { mergeStates, stampChanges } from './merge.js';

export const ENERGY = { low: { label: 'Low' }, medium: { label: 'Medium' }, high: { label: 'High' } };

// doc-ref 7f3a docs/systems/local-storage.md
// These key names are part of the user's data: renaming one without a migration that reads the
// old key first orphans everything stored under it.
export const STORAGE_KEY = 'focusdeck-state-v1';
export const GIST_ID_KEY = 'focusdeck-gist-id';
export const BACKUPS_KEY = 'focusdeck-state-backups';
const MAX_BACKUPS = 5;

function defaultState() {
  return {
    projects: [],
    inbox: [],
    focus: null,
    completedLog: [],
    excludedRepos: [],
    pinnedRepos: [],
    excludedIssues: [], // "owner/repo#123" entries for issues explicitly unlinked — keeps repo sync from re-creating them
    deletedTaskIds: {}, // taskId -> deletion timestamp; stops a stale remote copy from resurrecting a deleted task
    categories: [
      { id: 'cat_bug', name: 'Bug', color: 'hsl(4 70% 55%)' },
      { id: 'cat_feature', name: 'Feature', color: 'hsl(150 55% 40%)' },
      { id: 'cat_chore', name: 'Chore', color: 'hsl(210 15% 55%)' },
    ],
    projectCategories: [
      { id: 'pcat_work', name: 'Work', color: 'hsl(210 55% 45%)' },
      { id: 'pcat_personal', name: 'Personal', color: 'hsl(150 50% 40%)' },
      { id: 'pcat_learning', name: 'Learning', color: 'hsl(35 65% 45%)' },
    ],
    githubSync: { user: null, lastSyncedAt: null },
    gistId: null,
  };
}

// Set when loading or saving hit a problem the user needs to know about (unreadable saved data,
// storage full). app.js surfaces it; nothing here clears it.
export let storageProblem = null;

// The saveId of the copy this page last read or wrote. If storage holds a different one when we
// save, another tab/window (or this page restored from the back-forward cache) wrote in between,
// and a blind write would roll its changes back — see saveStateLocal.
let lastSaveId = null;

// A plain copy of what this page last loaded or saved. saveStateLocal diffs against it to
// timestamp every changed record (see stampChanges in merge.js), so each edit wins the next merge.
let lastSaved = null;
const snapshot = (st) => JSON.parse(serializeState(st));

function readRaw(key) {
  if (typeof localStorage === 'undefined') return null; // Node tests that don't mock it
  try { return localStorage.getItem(key); } catch (e) { console.error('localStorage read failed:', e); return null; }
}

function parseSaved(raw) {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.projects)) return parsed;
  } catch (e) { /* unreadable — caller decides */ }
  return null;
}

function contentSize(st) {
  if (!st) return 0;
  const tasks = (st.projects || []).reduce((n, p) => n + ((p && p.tasks) || []).length, 0);
  return (st.projects || []).length + tasks + (st.inbox || []).length + (st.gistId ? 1 : 0);
}

export function readBackups() {
  try { return JSON.parse(readRaw(BACKUPS_KEY)) || []; } catch (e) { return []; }
}

// Copies a raw saved value aside before anything replaces it. Never throws: a failed backup is
// logged, and the caller still gets to decide whether to proceed.
export function backupRaw(raw, reason) {
  if (raw == null || raw === '') return;
  try {
    const backups = readBackups().filter((b) => b.raw !== raw);
    backups.unshift({ at: Date.now(), reason, raw });
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups.slice(0, MAX_BACKUPS)));
  } catch (e) { console.error('Could not back up Focus Deck data (' + reason + '):', e); }
}

// Only these two functions ever change the stored Gist ID. Everything else that sees a missing
// gistId restores it from GIST_ID_KEY instead of saving the gap.
export function setGistId(id) {
  id = String(id || '').trim();
  if (!id) return;
  try { localStorage.setItem(GIST_ID_KEY, id); } catch (e) { console.error('Could not save Gist ID:', e); }
  state.gistId = id;
  saveStateLocal(state);
}

export function disconnectGist() {
  try { localStorage.removeItem(GIST_ID_KEY); } catch (e) { console.error('Could not clear Gist ID:', e); }
  state.gistId = null;
  saveStateLocal(state, { allowGistDisconnect: true });
}

function withDefaults(parsed) {
  const d = defaultState();
  return Object.assign(d, parsed, {
    projects: parsed.projects || d.projects,
    categories: parsed.categories || d.categories,
    projectCategories: parsed.projectCategories || d.projectCategories,
    deletedTaskIds: parsed.deletedTaskIds || d.deletedTaskIds,
    inbox: Array.isArray(parsed.inbox) ? parsed.inbox : d.inbox,
    completedLog: Array.isArray(parsed.completedLog) ? parsed.completedLog : d.completedLog,
    excludedRepos: Array.isArray(parsed.excludedRepos) ? parsed.excludedRepos : d.excludedRepos,
    pinnedRepos: Array.isArray(parsed.pinnedRepos) ? parsed.pinnedRepos : d.pinnedRepos,
    excludedIssues: Array.isArray(parsed.excludedIssues) ? parsed.excludedIssues : d.excludedIssues,
  });
}

// Repairs shapes older code saved by mistake, so the data they carried is used instead of being
// silently ignored: a category object stored where its id belongs, and categories saved without a
// color (the nextHue function was passed as the color and dropped by JSON.stringify).
function repairLoaded(st) {
  const fixRef = (holder) => {
    if (holder && holder.categoryId && typeof holder.categoryId === 'object') holder.categoryId = holder.categoryId.id || null;
  };
  st.projects.forEach((p) => { fixRef(p); (p.tasks || []).forEach(fixRef); });
  [st.categories, st.projectCategories].forEach((list, listIdx) => (list || []).forEach((c, i) => {
    if (typeof c.color !== 'string' || !c.color) c.color = 'hsl(' + Math.round(((i + listIdx * 7) * 137.508) % 360) + ' var(--proj-sat) var(--proj-light))';
  }));
  return st;
}

// Never returns defaults over data it couldn't read without first copying that data aside and
// trying the backups — an unreadable save is a problem to report, not an empty deck.
export function loadState() {
  const raw = readRaw(STORAGE_KEY);
  let parsed = parseSaved(raw);
  if (raw != null && !parsed) {
    backupRaw(raw, 'unreadable on load');
    const recovered = readBackups().map((b) => parseSaved(b.raw)).find((b) => b && contentSize(b) > 0);
    parsed = recovered || null;
    storageProblem = recovered
      ? 'Your saved data couldn’t be read, so Focus Deck restored the most recent backup.'
      : 'Your saved data couldn’t be read. It was kept as a backup, not deleted.';
    console.error(storageProblem, 'Raw value starts with:', String(raw).slice(0, 80));
  }
  // One known-good snapshot per page load, so a later corruption always has something local to
  // fall back to even if no shrinking save happened in between.
  if (parsed && raw != null && contentSize(parsed) > 0) backupRaw(raw, 'last good copy at load');
  const loaded = parsed ? repairLoaded(withDefaults(parsed)) : defaultState();

  const storedGistId = readRaw(GIST_ID_KEY);
  if (!loaded.gistId && storedGistId) loaded.gistId = storedGistId;
  if (loaded.gistId && !storedGistId) {
    try { localStorage.setItem(GIST_ID_KEY, loaded.gistId); } catch (e) { /* retried on next save */ }
  }
  return loaded;
}

// Drops runtime-only fields (anything starting with "_", e.g. the UI object app.js hangs on
// state) so they never reach localStorage or the Gist.
export function serializeState(st) {
  return JSON.stringify(st, (key, value) => (key.startsWith('_') ? undefined : value));
}

function newSaveId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// Returns true when the write landed. `opts.allowGistDisconnect` is only for disconnectGist().
export function saveStateLocal(st, opts = {}) {
  if (!st || typeof st !== 'object' || !Array.isArray(st.projects)) {
    // Fail loudly: this is the exact shape of the bug that wrote "undefined" over everything.
    throw new Error('saveStateLocal needs the state object; refusing to overwrite saved data with ' + String(st));
  }

  if (!st.gistId && !opts.allowGistDisconnect) {
    const storedGistId = readRaw(GIST_ID_KEY);
    if (storedGistId) st.gistId = storedGistId;
  }

  stampChanges(st, lastSaved);

  const storedRaw = readRaw(STORAGE_KEY);
  const stored = parseSaved(storedRaw);
  if (stored && stored.saveId && stored.saveId !== lastSaveId && stored.saveId !== st.saveId) {
    // Someone else saved since we last looked: fold their copy in rather than roll it back.
    const merged = mergeStates(st, stored);
    Object.keys(merged).forEach((k) => { if (!k.startsWith('_')) st[k] = merged[k]; });
  }
  if (storedRaw != null && (!stored || contentSize(stored) > contentSize(st))) {
    backupRaw(storedRaw, stored ? 'before a save with less content' : 'unreadable before save');
  }

  st.saveId = newSaveId();
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(st));
    lastSaveId = st.saveId;
    lastSaved = snapshot(st);
    if (st.gistId) localStorage.setItem(GIST_ID_KEY, st.gistId);
    return true;
  } catch (e) {
    storageProblem = 'Couldn’t save to this browser’s storage (' + (e && e.name) + '). Recent changes may not survive a reload.';
    console.error(storageProblem, e);
    return false;
  }
}

export const state = loadState();
lastSaveId = state.saveId || null;
lastSaved = snapshot(state);

// Replaces the in-memory singleton with what's in storage (keeping runtime "_" fields) and tells
// the page to repaint. Used when another tab saved, or this page came back from the bfcache.
const externalChangeListeners = [];
export function onExternalStateChange(fn) { externalChangeListeners.push(fn); }
export function reloadStateFromStorage() {
  const fresh = loadState();
  Object.keys(state).forEach((k) => { if (!k.startsWith('_')) delete state[k]; });
  Object.assign(state, fresh);
  lastSaveId = state.saveId || null;
  lastSaved = snapshot(state);
  externalChangeListeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY && e.key !== GIST_ID_KEY) return;
    // Another tab removing the data outright is not a reason for this tab to forget its copy too:
    // write ours back instead (and let saveStateLocal restore the Gist ID from state if needed).
    if (e.key === STORAGE_KEY && e.newValue == null) { saveStateLocal(state); return; }
    reloadStateFromStorage();
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) reloadStateFromStorage(); });
}

// Asks the browser not to evict this origin's storage under pressure (and, on Safari, exempts an
// installed home-screen app from the 7-day script-storage cap). Best-effort: resolves false when
// unsupported or declined, never throws.
export async function requestPersistentStorage() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) return false;
    if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (e) { console.warn('storage.persist() failed:', e); return false; }
}

export function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 9); }

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function findProjectIdForTask(taskId) {
  for (const p of state.projects) if (p.tasks.some((t) => t.id === taskId)) return p.id;
  return null;
}

export function findTaskWithProject(taskId) {
  for (const p of state.projects) {
    const t = p.tasks.find((t) => t.id === taskId);
    if (t) return { task: t, project: p };
  }
  return null;
}

export function candidatesForEnergy(level) {
  const doing = [], next = [];
  state.projects.forEach((p) => p.tasks.forEach((t) => {
    if (t.status === 'done' || t.energy !== level) return;
    (t.status === 'doing' ? doing : next).push(t);
  }));
  let list = doing.concat(next);
  if (list.length === 0) {
    state.projects.forEach((p) => p.tasks.forEach((t) => {
      if (t.status !== 'done') (t.status === 'doing' ? doing : next).push(t);
    }));
    list = doing.concat(next);
  }
  list.sort((a, b) => {
    const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return ad - bd;
  });
  return list.map((t) => t.id);
}

export function relTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + 'm ago';
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + 'h ago';
  return Math.round(hr / 24) + 'd ago';
}

export function deadlineChip(iso) {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((d - startToday) / 86400000);
  const label = days < 0 ? Math.abs(days) + 'd overdue' : days === 0 ? 'due today' : 'due in ' + days + 'd';
  return '<span class="chip deadline-chip">' + label + '</span>';
}

export function shortName(name) { return name.length > 14 ? name.slice(0, 13) + '…' : name; }

export function nextHue() { return Math.round((state.projects.length * 137.508) % 360); }

// Resolves any category color string (literal hsl(), or one referencing var(--proj-sat)/
// var(--proj-light)) to #rrggbb, for pre-filling <input type="color">. Shared by settings.html
// and app.js.
export function cssColorToHex(cssColor) {
  const el = document.createElement('span');
  el.style.color = cssColor;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  const nums = rgb.match(/\d+/g);
  if (!nums) return '#888888';
  return '#' + nums.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
