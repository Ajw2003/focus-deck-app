// focus-deck-app/js/sync.js
import { state, saveStateLocal } from './state.js';
import { ghFetch } from './github.js';

// paint is set by app.js after module init to avoid a circular import (app.js imports this module).
let paintFn = () => {};
export function registerPaint(fn) { paintFn = fn; }

// doc-ref bce8 docs/systems/gist-sync.md
export function mergeStates(local, remote) {
  if (!remote) return local;
  const merged = JSON.parse(JSON.stringify(local));

  const deletedIds = Object.assign({}, local.deletedTaskIds, remote.deletedTaskIds);
  Object.keys(remote.deletedTaskIds || {}).forEach((id) => {
    const l = (local.deletedTaskIds || {})[id] || 0;
    deletedIds[id] = Math.max(l, remote.deletedTaskIds[id]);
  });
  merged.deletedTaskIds = deletedIds;

  const localProjectIds = new Set(local.projects.map((p) => p.id));
  remote.projects.forEach((rp) => {
    if (!localProjectIds.has(rp.id)) { merged.projects.push(rp); return; }
    const lp = merged.projects.find((p) => p.id === rp.id);
    const localTaskIds = new Set(lp.tasks.map((t) => t.id));
    rp.tasks.forEach((rt) => {
      const tombstoneAt = deletedIds[rt.id];
      if (tombstoneAt !== undefined && tombstoneAt >= (rt.updatedAt || 0)) return; // stays deleted
      if (!localTaskIds.has(rt.id)) { lp.tasks.push(rt); return; }
      const lt = lp.tasks.find((t) => t.id === rt.id);
      const lu = lt.updatedAt || 0, ru = rt.updatedAt || 0;
      if (ru > lu) Object.assign(lt, rt);
    });
  });

  // Covers the symmetric case: a tombstone that arrived without its task (the other side already
  // dropped it from its own list) still needs to remove any surviving copy that's no newer than it.
  merged.projects.forEach((p) => {
    p.tasks = p.tasks.filter((t) => {
      const tombstoneAt = deletedIds[t.id];
      return tombstoneAt === undefined || tombstoneAt < (t.updatedAt || 0);
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
