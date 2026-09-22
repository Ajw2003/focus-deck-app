// focus-deck-app/js/merge.js
// Pure: no imports, no DOM, no network. Shared by state.js (stale-tab protection and change
// stamping) and sync.js (Gist pull/push), which is why it isn't inside either of them.

// doc-ref bce8 docs/systems/gist-sync.md

// The record kinds that sync. Every record carries an id and an `updatedAt`; the newest copy of
// a record wins, and a deletion is a timestamped tombstone that beats any copy no newer than it.
// Tasks keep their tombstones in `deletedTaskIds` (older data already has them there); every
// other kind keeps them in `deletedRecordIds[kind]`.
export const RECORD_KINDS = ['projects', 'categories', 'projectCategories', 'inbox'];
// Whole-list fields with no per-item identity worth tracking: the newest list wins.
export const SYNCED_LISTS = ['excludedRepos', 'pinnedRepos', 'excludedIssues'];

const stamp = (r) => (r && r.updatedAt) || 0;
const copy = (v) => JSON.parse(JSON.stringify(v));

function mergeTombstones(a, b) {
  const out = Object.assign({}, a);
  Object.keys(b || {}).forEach((id) => { out[id] = Math.max(out[id] || 0, b[id]); });
  return out;
}

const survives = (record, tombstones) => {
  const deletedAt = tombstones[record.id];
  return deletedAt === undefined || deletedAt < stamp(record);
};

// On equal stamps the remote copy wins. Local edits are always stamped by saveStateLocal before
// any merge runs, so a tie only happens between copies neither side has edited since stamping
// existed -- e.g. a fresh device's default categories against the colors already in the Gist.
function newer(localRecord, remoteRecord) {
  return stamp(remoteRecord) >= stamp(localRecord) ? remoteRecord : localRecord;
}

// Union by id, keeping local order and appending remote-only records.
function mergeRecordList(localList, remoteList, tombstones, mergeOne = newer) {
  const order = [];
  const byId = new Map();
  (localList || []).forEach((r) => { if (r && r.id != null && !byId.has(r.id)) { byId.set(r.id, r); order.push(r.id); } });
  (remoteList || []).forEach((r) => {
    if (!r || r.id == null) return;
    if (!byId.has(r.id)) { byId.set(r.id, r); order.push(r.id); return; }
    byId.set(r.id, mergeOne(byId.get(r.id), r));
  });
  return order.map((id) => byId.get(id)).filter((r) => r && survives(r, tombstones));
}

export function mergeStates(local, remote) {
  if (!remote) return local;
  const l = copy(local);
  const r = copy(remote);
  const merged = l;

  merged.deletedTaskIds = mergeTombstones(l.deletedTaskIds, r.deletedTaskIds);
  const deletedRecordIds = {};
  RECORD_KINDS.forEach((kind) => {
    deletedRecordIds[kind] = mergeTombstones((l.deletedRecordIds || {})[kind], (r.deletedRecordIds || {})[kind]);
  });
  merged.deletedRecordIds = deletedRecordIds;

  // A project's own fields (name, color, category) follow the newer project copy; its tasks
  // merge one by one from both copies, so a task edit is never lost to a project edit.
  const mergeProject = (lp, rp) => {
    const winner = newer(lp, rp);
    return Object.assign({}, winner, { tasks: mergeRecordList(lp.tasks, rp.tasks, merged.deletedTaskIds) });
  };
  merged.projects = mergeRecordList(l.projects, r.projects, {}, mergeProject)
    .map((p) => Object.assign(p, { tasks: (p.tasks || []).filter((t) => survives(t, merged.deletedTaskIds)) }))
    // a deleted project stays deleted unless it (or a task in it) was edited after the deletion
    .filter((p) => {
      const deletedAt = deletedRecordIds.projects[p.id];
      return deletedAt === undefined || stamp(p) > deletedAt || p.tasks.some((t) => stamp(t) > deletedAt);
    });

  ['categories', 'projectCategories', 'inbox'].forEach((kind) => {
    merged[kind] = mergeRecordList(l[kind], r[kind], deletedRecordIds[kind]);
  });

  const listStamps = Object.assign({}, l.listStamps);
  SYNCED_LISTS.forEach((key) => {
    const ls = (l.listStamps || {})[key] || 0;
    const rs = (r.listStamps || {})[key] || 0;
    const localList = Array.isArray(l[key]) ? l[key] : [];
    const remoteList = Array.isArray(r[key]) ? r[key] : [];
    if (rs > ls) merged[key] = remoteList;
    else if (ls > rs) merged[key] = localList;
    else merged[key] = [...new Set([...localList, ...remoteList])]; // neither stamped: lose nothing
    listStamps[key] = Math.max(ls, rs);
  });
  merged.listStamps = listStamps;

  // Done-list entries follow their task: kept only while that task exists and is done.
  const doneTaskIds = new Set();
  merged.projects.forEach((p) => p.tasks.forEach((t) => { if (t.status === 'done') doneTaskIds.add(t.id); }));
  const logById = new Map();
  [...(l.completedLog || []), ...(r.completedLog || [])].forEach((e) => { if (e && !logById.has(e.id)) logById.set(e.id, e); });
  const seenTasks = new Set();
  merged.completedLog = [...logById.values()]
    .filter((e) => doneTaskIds.has(e.taskId) && !seenTasks.has(e.taskId) && seenTasks.add(e.taskId))
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, 12);

  if ((r.githubSync?.lastSyncedAt || 0) > (l.githubSync?.lastSyncedAt || 0)) merged.githubSync = r.githubSync;

  // The sync connection is only ever dropped by an explicit disconnect, so if either side knows
  // it, the merge keeps it. `focus` stays per-device on purpose.
  merged.gistId = l.gistId || r.gistId || null;

  return merged;
}

// Record-level fields that don't count as an edit when comparing against the last save.
const IGNORED = new Set(['updatedAt', 'tasks']);
const content = (record) => JSON.stringify(record, (k, v) => (IGNORED.has(k) ? undefined : v));

// Compares `st` with `previous` (the copy this page last loaded or saved) and timestamps every
// record that changed, appeared, or disappeared since. This is what makes an edit win the next
// merge: code paths don't have to remember to bump updatedAt themselves (several didn't -- issue
// linking, colors, categories -- and those edits were silently reverted by the next Gist sync).
// A record whose updatedAt already changed (a mutation stamped it, or a merge brought in the
// other side's copy) is left alone.
export function stampChanges(st, previous, now = Date.now()) {
  if (!previous) return;
  const stampList = (list, prevList, tombstones) => {
    const prevById = new Map((prevList || []).map((r) => [r.id, r]));
    const currentIds = new Set();
    (list || []).forEach((r) => {
      if (!r || r.id == null) return;
      currentIds.add(r.id);
      const before = prevById.get(r.id);
      if (!before) { if (!r.updatedAt) r.updatedAt = now; return; }
      if (stamp(r) === stamp(before) && content(r) !== content(before)) r.updatedAt = Math.max(now, stamp(before) + 1);
    });
    prevById.forEach((r, id) => { if (!currentIds.has(id) && !(id in tombstones)) tombstones[id] = now; });
  };

  if (!st.deletedTaskIds) st.deletedTaskIds = {};
  if (!st.deletedRecordIds) st.deletedRecordIds = {};
  RECORD_KINDS.forEach((kind) => { if (!st.deletedRecordIds[kind]) st.deletedRecordIds[kind] = {}; });

  RECORD_KINDS.forEach((kind) => stampList(st[kind], previous[kind], st.deletedRecordIds[kind]));

  const prevTasks = [];
  (previous.projects || []).forEach((p) => (p.tasks || []).forEach((t) => prevTasks.push(t)));
  const tasks = [];
  (st.projects || []).forEach((p) => (p.tasks || []).forEach((t) => tasks.push(t)));
  stampList(tasks, prevTasks, st.deletedTaskIds);

  if (!st.listStamps) st.listStamps = {};
  SYNCED_LISTS.forEach((key) => {
    if (JSON.stringify(st[key] || []) !== JSON.stringify(previous[key] || [])) st.listStamps[key] = now;
  });
}
