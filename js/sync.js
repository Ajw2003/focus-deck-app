// focus-deck-app/js/sync.js
import { state, saveStateLocal } from './state.js';
import { ghFetch } from './github.js';

// paint is set by app.js after module init to avoid a circular import (app.js imports this module).
let paintFn = () => {};
export function registerPaint(fn) { paintFn = fn; }

// Per-task updatedAt (added in Task 3) decides the winner when the same task differs between
// local and remote; projects and inbox items merge by union-of-ids (nothing here deletes something
// the other side didn't also decide to delete — for a single user's own two devices that's the safe
// default: an item removed on one device while the other was offline reappears rather than silently
// vanishing, and gets deleted again once both are synced, which is a far better failure mode than
// silent data loss).
export function mergeStates(local, remote) {
  if (!remote) return local;
  const merged = JSON.parse(JSON.stringify(local));

  const localProjectIds = new Set(local.projects.map((p) => p.id));
  remote.projects.forEach((rp) => {
    if (!localProjectIds.has(rp.id)) { merged.projects.push(rp); return; }
    const lp = merged.projects.find((p) => p.id === rp.id);
    const localTaskIds = new Set(lp.tasks.map((t) => t.id));
    rp.tasks.forEach((rt) => {
      if (!localTaskIds.has(rt.id)) { lp.tasks.push(rt); return; }
      const lt = lp.tasks.find((t) => t.id === rt.id);
      const lu = lt.updatedAt || 0, ru = rt.updatedAt || 0;
      if (ru > lu) Object.assign(lt, rt);
    });
  });

  const localInboxIds = new Set(local.inbox.map((i) => i.id));
  remote.inbox.forEach((ri) => { if (!localInboxIds.has(ri.id)) merged.inbox.push(ri); });

  const localCatIds = new Set(local.categories.map((c) => c.id));
  remote.categories.forEach((rc) => { if (!localCatIds.has(rc.id)) merged.categories.push(rc); });

  const localPCatIds = new Set((local.projectCategories || []).map((c) => c.id));
  (remote.projectCategories || []).forEach((rpc) => { if (!localPCatIds.has(rpc.id)) merged.projectCategories.push(rpc); });

  // last-write-wins for singleton fields — focus/githubSync aren't meaningfully mergeable per-field
  if ((remote.githubSync?.lastSyncedAt || 0) > (local.githubSync?.lastSyncedAt || 0)) merged.githubSync = remote.githubSync;

  return merged;
}

export async function pullFromGist() {
  if (!state.gistId) return;
  const gist = await ghFetch('/gists/' + state.gistId);
  const remote = JSON.parse(gist.files['focus-deck-state.json'].content);
  const merged = mergeStates(state, remote);
  Object.assign(state, merged);
  saveStateLocal(state);
}

export async function pushToGist() {
  if (!state.gistId) return;
  await ghFetch('/gists/' + state.gistId, {
    method: 'PATCH',
    body: JSON.stringify({ files: { 'focus-deck-state.json': { content: JSON.stringify(state) } } }),
  });
}

let pushTimer = null;
export function persist() {
  paintFn();
  saveStateLocal(state);
  if (!state.gistId) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushToGist().catch((e) => console.warn('sync push failed:', e.message)); }, 3000);
}

export function initSyncLifecycle() {
  if (state.gistId) pullFromGist().then(() => paintFn()).catch((e) => console.warn('initial pull failed:', e.message));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.gistId) {
      pullFromGist().then(() => paintFn()).catch((e) => console.warn('foreground pull failed:', e.message));
    }
  });
}
