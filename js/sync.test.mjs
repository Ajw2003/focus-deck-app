// focus-deck-app/js/sync.test.mjs — run with: node js/sync.test.mjs
import { mergeStates } from './sync.js';
import assert from 'node:assert';

const local = { projects: [{ id: 'p1', tasks: [{ id: 't1', title: 'Local edit', updatedAt: 200 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 100 } };
const remote = { projects: [{ id: 'p1', tasks: [{ id: 't1', title: 'Remote edit (older)', updatedAt: 100 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 50 } };

const merged = mergeStates(local, remote);
assert.strictEqual(merged.projects[0].tasks[0].title, 'Local edit', 'newer local edit should win');

const remote2 = { projects: [{ id: 'p1', tasks: [{ id: 't1', title: 'Remote edit (newer)', updatedAt: 300 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 50 } };
const merged2 = mergeStates(local, remote2);
assert.strictEqual(merged2.projects[0].tasks[0].title, 'Remote edit (newer)', 'newer remote edit should win');

// mergeStates must be pure: neither input is mutated.
const localSnapshotBefore = JSON.stringify(local);
const remoteSnapshotBefore = JSON.stringify(remote2);
mergeStates(local, remote2);
assert.strictEqual(JSON.stringify(local), localSnapshotBefore, 'local input must not be mutated');
assert.strictEqual(JSON.stringify(remote2), remoteSnapshotBefore, 'remote input must not be mutated');

// remote === null/undefined returns local unchanged (and unmerged, per the short-circuit).
assert.strictEqual(mergeStates(local, null), local, 'no remote should return local as-is');

// union-of-ids: a new project/task/inbox item/category on the remote side gets added locally.
const localEmpty = { projects: [], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } };
const remoteWithNewStuff = {
  projects: [{ id: 'p2', tasks: [{ id: 't2', title: 'New from remote', updatedAt: 10 }] }],
  inbox: [{ id: 'i1', text: 'captured elsewhere' }],
  categories: [{ id: 'cat_new', name: 'New', color: 'red' }],
  githubSync: { lastSyncedAt: 5 },
};
const mergedNew = mergeStates(localEmpty, remoteWithNewStuff);
assert.strictEqual(mergedNew.projects.length, 1, 'new remote project should be added');
assert.strictEqual(mergedNew.projects[0].tasks[0].title, 'New from remote');
assert.strictEqual(mergedNew.inbox.length, 1, 'new remote inbox item should be added');
assert.strictEqual(mergedNew.categories.length, 1, 'new remote category should be added');

// a task missing from the OTHER side survives the merge, as long as neither side has actually
// decided to delete it (no tombstone) — the other side simply hasn't seen it yet.
const localWithExtra = { projects: [{ id: 'p1', tasks: [{ id: 't1', title: 'still here', updatedAt: 1 }, { id: 't-gone-on-remote', title: 'local only', updatedAt: 1 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } };
const remoteMissingTask = { projects: [{ id: 'p1', tasks: [{ id: 't1', title: 'still here', updatedAt: 1 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } };
const mergedNoDelete = mergeStates(localWithExtra, remoteMissingTask);
assert.strictEqual(mergedNoDelete.projects[0].tasks.length, 2, 'a task the other side has not seen yet (no tombstone) should NOT be deleted locally');

// deletion tombstones: a task deleted locally must not be resurrected by an older remote copy.
const localDeleted = { projects: [{ id: 'p1', tasks: [] }], inbox: [], categories: [], deletedTaskIds: { 't-deleted': 500 }, githubSync: { lastSyncedAt: 0 } };
const remoteStillHasIt = { projects: [{ id: 'p1', tasks: [{ id: 't-deleted', title: 'should stay deleted', updatedAt: 400 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } };
const mergedAfterDelete = mergeStates(localDeleted, remoteStillHasIt);
assert.strictEqual(mergedAfterDelete.projects[0].tasks.length, 0, 'a task deleted locally (tombstoned) must not be resurrected by an older remote copy — this is the "deleted task comes back after reload" bug');

// ...but an edit made elsewhere AFTER the local deletion still wins, same as any other newer write.
const remoteEditedAfterDelete = { projects: [{ id: 'p1', tasks: [{ id: 't-deleted', title: 'edited elsewhere after delete', updatedAt: 600 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } };
const mergedAfterLaterEdit = mergeStates(localDeleted, remoteEditedAfterDelete);
assert.strictEqual(mergedAfterLaterEdit.projects[0].tasks.length, 1, 'a remote edit made after the local deletion should still win, like any other newer write');
assert.strictEqual(mergedAfterLaterEdit.projects[0].tasks[0].title, 'edited elsewhere after delete');

// symmetric case: the task was deleted on the remote (tombstoned there); a stale local copy
// that never heard about the deletion should be removed too.
const localStillHasIt = { projects: [{ id: 'p1', tasks: [{ id: 't-remote-deleted', title: 'stale local copy', updatedAt: 100 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } };
const remoteDeletedIt = { projects: [{ id: 'p1', tasks: [] }], inbox: [], categories: [], deletedTaskIds: { 't-remote-deleted': 200 }, githubSync: { lastSyncedAt: 0 } };
const mergedRemoteDelete = mergeStates(localStillHasIt, remoteDeletedIt);
assert.strictEqual(mergedRemoteDelete.projects[0].tasks.length, 0, 'a task deleted on the remote (tombstone newer than the stale local copy) should be removed locally too');

// deletedTaskIds itself unions across both sides, keeping the later timestamp for an id seen on both.
const localTombstones = { projects: [], inbox: [], categories: [], deletedTaskIds: { a: 100 }, githubSync: { lastSyncedAt: 0 } };
const remoteTombstones = { projects: [], inbox: [], categories: [], deletedTaskIds: { a: 50, b: 200 }, githubSync: { lastSyncedAt: 0 } };
const mergedTombstones = mergeStates(localTombstones, remoteTombstones);
assert.deepStrictEqual(mergedTombstones.deletedTaskIds, { a: 100, b: 200 }, 'deletedTaskIds should union, keeping the later timestamp for an id present on both sides');

// projectCategories merge mirrors categories: union-of-ids, and tolerates a remote object saved by
// a pre-feature client that has no projectCategories field at all.
const localWithPCat = { projects: [], inbox: [], categories: [], projectCategories: [{ id: 'pcat_work', name: 'Work', color: 'blue' }], githubSync: { lastSyncedAt: 0 } };
const remoteWithPCat = { projects: [], inbox: [], categories: [], projectCategories: [{ id: 'pcat_personal', name: 'Personal', color: 'green' }], githubSync: { lastSyncedAt: 0 } };
const mergedPCat = mergeStates(localWithPCat, remoteWithPCat);
assert.strictEqual(mergedPCat.projectCategories.length, 2, 'new remote project category should be added');
assert.ok(mergedPCat.projectCategories.some((c) => c.id === 'pcat_personal'), 'remote-only project category should be present after merge');

const remoteMissingPCatField = { projects: [], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } };
const mergedMissingPCatField = mergeStates(localWithPCat, remoteMissingPCatField);
assert.strictEqual(mergedMissingPCatField.projectCategories.length, 1, 'a remote with no projectCategories field should not error and should keep local project categories');

// completedLog: a completed Unsorted thought (M.completeInboxItem) has no taskId, so it must not be
// filtered out by the doneTaskIds check that keeps ordinary task completions -- it has no task to
// check against and would otherwise be silently dropped on the next Gist merge.
const localWithCompletedThought = { projects: [], inbox: [], categories: [], completedLog: [{ id: 'log1', taskId: null, inboxId: 'i1', title: 'call the plumber', projectId: null, color: 'var(--ink-faint)', completedAt: 100 }], githubSync: { lastSyncedAt: 0 } };
const mergedCompletedThought = mergeStates(localWithCompletedThought, { projects: [], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } });
assert.strictEqual(mergedCompletedThought.completedLog.length, 1, 'a completed Unsorted thought survives the merge even though it has no task');
assert.strictEqual(mergedCompletedThought.completedLog[0].inboxId, 'i1');

console.log('MERGE TESTS PASSED');
