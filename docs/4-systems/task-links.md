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
3. Pick at random among the tasks that unblock the most (open tasks waiting on it, plus its open
   parent). "Not this one" picks at random from the pool minus the current task, preferring tasks
   that aren't blocked.

The focus card's "Random pick" text becomes **Unblocks N tasks** (or "Everything here is waiting on
something" when `focus.allBlocked`); a task with open subtasks also gets a **Next step: <subtask> ·
N subtasks left** line whose **Start it** button focuses that subtask. Both can show on one card.

## Seeing ties on the Board and in Projects (built, #193)

Approved 2026-10-18 on `docs/plans/ties-everywhere.html` (1A 2A 3A 4A 5A).

- **One tie line.** A task with ties gets one quiet line, built by one helper in
  `app/js/task-links.js` so the Board and Projects say the same thing: "in <parent>" (Board only),
  "N subtasks · M done", "waits on <task>" (with the other folder's name when it differs) and
  "holds up N". Tapping a task name scrolls to that task. Tasks without ties are unchanged.
- **Projects** (`renderTaskRow`, `app/js/render.js`): a subtask is drawn straight after its parent,
  indented with a connector, and does not repeat "in <parent>". Sort orders still apply among
  siblings (nesting is within the In progress or Up next group the parent is in; a subtask in the
  other group stays in its own). Dragging a parent does not carry its subtasks.
- **Board** (`card`, `app/js/board-view.js:54-60`): since the calm Board (#200, 2026-10-19) a subtask
  no longer gets its own card. It shows inside its parent as "1/2 done" with a bar of segments
  (`subsLine`, `:37`), and the card's tie line drops the subtask count so it is not said twice. The
  Board's Filter can show only tasks that have subtasks, wait on something, or hold others up
  (`SHOW_INFO`, `:21`). Subtasks are edited in Task details (`docs/4-systems/calm-board.md`).
- **Waiting tasks** (open "waits on" or open subtasks) have a softer title in both views, matching
  the focus pick, which skips them.

## GitHub (writing built in #195; reading built in #196)

A tie is mirrored on GitHub only when both tasks are linked to issues:

| Focus Deck | GitHub | API |
|---|---|---|
| `parentId` | sub-issue | `POST/DELETE /repos/{o}/{r}/issues/{n}/sub_issues` (body `sub_issue_id`) |
| `waitsOn` | blocked by | `POST /repos/{o}/{r}/issues/{n}/dependencies/blocked_by` (body `issue_id`), `DELETE .../blocked_by/{issue_id}` |
| holds up | blocking | read only; it is "blocked by" seen from the other side |

- **Issue ids.** Both calls take the issue's internal `id`, not its `#number` (issue #188 is id
  5908483975). `mapIssue` (`app/js/github.js`) keeps `id`, `sub_issues_summary.total` and
  `issue_dependencies_summary.total_blocked_by`; a linked task stores `issueId`.
- **Writing** (built, #195: `pushTiesToIssue` in `app/js/github-sync.js`, called from
  `app/js/mutations.js`) happens when a task's ties change (saving or filing a slip, deleting,
  moving to another folder), like label pushes: best-effort, errors in the toast, never rolled back.
  Moving or deleting also pushes the other tasks whose ties it cut. Changing a parent sends DELETE
  on the old parent's issue and POST (`replace_parent: true`) on the new one; a parent in another
  repo is never written (subtasks share a folder, a folder is one repo).
- **Reading** (built, #196: `readTiesForRepo` in `app/js/github-sync.js`, called by `syncGithub` after
  each repo's upsert) happens only for open issues whose summaries say they have ties: sub-issues if
  `subIssueCount > 0`, blocked-by if `blockedByCount > 0`; no ties, no extra requests. GitHub wins on a
  clash, as with labels (4A): a task's linked `waitsOn` entries are replaced by its blockers (and
  other-repo sub-issues); `waitsOn` entries pointing at tasks not on GitHub are kept. A sub-issue
  removed on GitHub clears `parentId` on that child, only if the child is linked to an issue. Reads
  write fields directly and never call `pushTiesToIssue`; ties `task-links.js` refuses are skipped.
- **A sub-issue that is not yet a task** comes in as a subtask in its parent's folder (5A), and lands
  in the Sort tray if it has no labels.
- **Set without asking:** a sub-issue more than one level deep stays a plain task; a sub-issue in
  another of the user's repositories is read as "waits on"; ties to tasks not on GitHub stay local.
- A GitHub-linked task's title is read-only on the slip, because the next issue sync overwrites the
  title from the issue (`app/js/github-sync.js:530`).
- Checked on 2026-10-18 with read-only calls: both endpoints answer with the token the app already
  uses, and issue lists carry the summaries. Limits on depth, count and cross-repository ties are not
  stated in GitHub's docs; a refused write shows in the toast.
