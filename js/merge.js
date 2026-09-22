// focus-deck-app/js/merge.js
// Pure: no imports, no DOM, no network. Shared by state.js (stale-tab protection) and sync.js
// (Gist pull/push), which is why it isn't inside either of them.

// doc-ref bce8 docs/systems/gist-sync.md
export function mergeStates(local, remote) {
  if (!remote) return local;
  const merged = JSON.parse(JSON.stringify(local));
  // A partial remote (older schema, hand-edited Gist) must merge as "nothing to add", never throw
  // halfway through and never be read as "the other side deleted everything".
  remote = Object.assign({}, remote);
  ['projects', 'inbox', 'categories', 'projectCategories'].forEach((k) => { if (!Array.isArray(remote[k])) remote[k] = []; });
  ['projects', 'inbox', 'categories'].forEach((k) => { if (!Array.isArray(merged[k])) merged[k] = []; });
  if (!Array.isArray(merged.projectCategories)) merged.projectCategories = [];

  const deletedIds = Object.assign({}, local.deletedTaskIds, remote.deletedTaskIds);
  Object.keys(remote.deletedTaskIds || {}).forEach((id) => {
    const l = (local.deletedTaskIds || {})[id] || 0;
    deletedIds[id] = Math.max(l, remote.deletedTaskIds[id]);
  });
  merged.deletedTaskIds = deletedIds;

  const localProjectIds = new Set(merged.projects.map((p) => p.id));
  remote.projects.forEach((rp) => {
    if (!localProjectIds.has(rp.id)) { merged.projects.push(rp); return; }
    const lp = merged.projects.find((p) => p.id === rp.id);
    if (!Array.isArray(lp.tasks)) lp.tasks = [];
    const localTaskIds = new Set(lp.tasks.map((t) => t.id));
    (rp.tasks || []).forEach((rt) => {
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
    p.tasks = (p.tasks || []).filter((t) => {
      const tombstoneAt = deletedIds[t.id];
      return tombstoneAt === undefined || tombstoneAt < (t.updatedAt || 0);
    });
  });

  const localInboxIds = new Set(merged.inbox.map((i) => i.id));
  remote.inbox.forEach((ri) => { if (!localInboxIds.has(ri.id)) merged.inbox.push(ri); });

  const localCatIds = new Set(merged.categories.map((c) => c.id));
  remote.categories.forEach((rc) => { if (!localCatIds.has(rc.id)) merged.categories.push(rc); });

  const localPCatIds = new Set(merged.projectCategories.map((c) => c.id));
  remote.projectCategories.forEach((rpc) => { if (!localPCatIds.has(rpc.id)) merged.projectCategories.push(rpc); });

  // last-write-wins for singleton fields — focus/githubSync aren't meaningfully mergeable per-field
  if ((remote.githubSync?.lastSyncedAt || 0) > (local.githubSync?.lastSyncedAt || 0)) merged.githubSync = remote.githubSync;

  // The sync connection is only ever dropped by an explicit disconnect, so if either side knows
  // it, the merge keeps it.
  merged.gistId = local.gistId || remote.gistId || null;

  return merged;
}
