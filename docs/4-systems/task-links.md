# Task links: subtasks, "waits on", notes, and the blocker-first focus pick

What this system owns: three task fields (`notes`, `parentId`, `waitsOn`), the rules that keep them
consistent, the three-part Sort screen (the in-tray) that sets them, and how the focus pick uses them. Approved
2026-10-18 on the proposal page `docs/plans/sort-flow-asap.html` (issues #180, #181, #182; answers
1A 2A 3A 4A 5A 6A), then redrawn on the current Sort screen in `docs/plans/sort-steps.html` (awaiting
aj's confirmation). The tray itself is in [in-tray.md](./in-tray.md); its wallets in [wallets.md](./wallets.md).

## The fields

| Field | Shape | Meaning |
|---|---|---|
| `notes` | string, may be absent | Free text about the task. Local only: never written to a GitHub issue. |
| `parentId` | task id or absent | This task is a subtask of that task. |
| `waitsOn` | list of task ids, may be absent | This task can't start until those are done. Any project. |

"Holds up" is never stored: it is `waitsOn` read from the other side (every task whose `waitsOn`
holds this id). Storing both would let the two copies disagree after a merge.

All three ride along with the task record, so they sync between devices through the Gist with no
merge changes: the newest copy of a task wins whole (see [gist-sync.md](./gist-sync.md)).

## The rules (enforced in `app/js/task-links.js`)

- **Parent is in the same project.** A subtask lives in its parent's project. "Waits on" is the
  cross-project link.
- **One level deep.** A task that has subtasks can't become a subtask, and a subtask can't have
  subtasks. This rules out parent loops without a graph walk. Ceiling: no sub-subtasks; lift it by
  walking `parentId` upward to refuse loops.
- **No circular waits.** Adding "A waits on B" is refused when B already (directly or through other
  tasks) waits on A, and a task never waits on itself.
- **Dangling links are ignored, then dropped.** A link to a task that no longer exists (deleted
  here, or on another device) is skipped everywhere it is read. `deleteTask` also removes the id
  from every other task's `parentId` and `waitsOn`.
- **Moving a task to another project** clears its own `parentId` and turns its subtasks into
  ordinary tasks, because the parent rule would otherwise break. `waitsOn` links survive a move.

## What "blocked" means

A task is **blocked** while any task it waits on is open, or while any of its own subtasks is open.
A task **unblocks** each open task that waits on it, plus its parent when that parent is open.

## The focus pick (`pickFocus`, `app/js/mutations.js`)

1. Build the pool as before: open tasks matching the chosen label and project.
2. Keep only the tasks that aren't blocked. If none are left, keep the whole pool and set
   `focus.allBlocked`, which the focus card states in words.
3. Pick at random among the tasks that unblock the most. "Not this one" picks at random from the
   rest of the step-2 pool, as before.

The focus card shows at most one extra thing: an **Unblocks N tasks** chip, or, for a task with
open subtasks, a **Next step: <subtask> · N subtasks left** line whose **Start it** button focuses
that subtask.

## GitHub

Nothing here is written to GitHub (answer 6A); GitHub's own sub-issues and "blocked by" links are a
separate follow-up. A GitHub-linked task's title is read-only on the slip, because the next
issue sync overwrites the title from the issue (`app/js/github-sync.js:530`).
