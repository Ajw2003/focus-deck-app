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

// deletion-is-not-propagated: an item present locally but absent remotely survives the merge
// (union-of-ids by design — see the comment above mergeStates in sync.js).
const localWithExtra = { projects: [{ id: 'p1', tasks: [{ id: 't1', title: 'still here', updatedAt: 1 }, { id: 't-gone-on-remote', title: 'local only', updatedAt: 1 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } };
const remoteMissingTask = { projects: [{ id: 'p1', tasks: [{ id: 't1', title: 'still here', updatedAt: 1 }] }], inbox: [], categories: [], githubSync: { lastSyncedAt: 0 } };
const mergedNoDelete = mergeStates(localWithExtra, remoteMissingTask);
assert.strictEqual(mergedNoDelete.projects[0].tasks.length, 2, 'a task missing from remote should NOT be deleted locally');

console.log('MERGE TESTS PASSED');
