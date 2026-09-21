# Gist Sync

## What it owns

Merging local Focus Deck state with the remote copy stored in a GitHub Gist, so edits made
on two devices (or a device and a stale local cache) combine instead of one clobbering the
other. Lives in `js/sync.js`, principally `mergeStates` (`js/sync.js:19`).

## How it works

Per-task `updatedAt` (added in Task 3) decides the winner when the same task differs
between local and remote; projects and inbox items merge by union-of-ids — a task neither
side has decided to delete just reappears if only one side has seen it yet, rather than
vanishing.

### Deletion tombstones

<!-- ref:bce8 -->
A deliberate deletion is different and is tracked explicitly via `deletedTaskIds` (task id
-> deletion timestamp, see `deleteTask` in `mutations.js`). Deletion is treated as a write
like any other: a tombstone beats a task copy that's no newer than it (so it stays
deleted), but a copy edited elsewhere *after* the deletion still wins, same as any other
newer write. Without this, deleting a task and reloading before the Gist push lands
(`persist()` debounces it 3s) would pull the old copy straight back in.

## Invariants

- A deletion tombstone beats a task copy that is no newer than it; a copy edited after the
  tombstone still wins (deletion is just another timestamped write, not a special case that
  always wins).
- A task with no tombstone on either side merges by union-of-ids: it survives being absent
  from one side's copy, so it doesn't vanish just because the other device hasn't seen it yet.

## Traps

- `deleteTask` in `js/mutations.js` (`js/mutations.js:85`) is what writes the tombstone —
  `state.deletedTaskIds[taskId] = Date.now()`. Any future "remove this task" code path
  (bulk delete, archive, a new UI entry point) must write to `deletedTaskIds` the same way,
  or the deletion will silently stop sticking: the task will reappear on the next sync once
  a stale remote Gist copy is merged back in. This is exactly the bug fixed for issue #10
  ("pressing x on a task... on reload being back").
