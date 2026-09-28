# Gist Sync

## What it owns

Merging local Focus Deck state with the remote copy stored in a GitHub Gist, so edits made
on two devices (or a device and a stale local cache) combine instead of one clobbering the
other. `mergeStates` lives in `js/merge.js` (pure, shared with `js/state.js`); pulling and
pushing live in `js/sync.js`. Local storage and the Gist ID's own key are in
[local-storage.md](./local-storage.md).

## How it works

Every synced record carries an `updatedAt`: tasks, projects, task categories, project
categories and Unsorted (inbox) items. When both sides have the same record, the newer copy
wins; on a tie (neither side edited it since stamping existed) the remote copy wins, which is
how a fresh device adopts the colors already in the Gist instead of keeping its defaults.
Records only one side has are kept (union of ids). A project's own fields (name, color,
category) follow the newer project copy, while its tasks merge one by one from both copies.
The repo lists (`excludedRepos`, `pinnedRepos`, `excludedIssues`) are stamped as whole lists
in `listStamps`; the newer list wins, and two unstamped lists are unioned. `completedLog`
keeps entries only for tasks that exist and are done — except an entry with no `taskId` (a
completed Unsorted thought, `M.completeInboxItem`, which never became a task) is kept outright,
identified by carrying an `inboxId` instead. `focus` is per-device and never merged.

### Change stamping

Nothing has to remember to set `updatedAt`. `saveStateLocal` calls `stampChanges`
(`js/merge.js`), which diffs the state against the copy this page last loaded or saved:
every record that changed, appeared or disappeared gets the current time (or a tombstone).
A record whose `updatedAt` already moved (a mutation set it, or a merge brought in the other
side's copy) is left alone, so merged-in data isn't mistaken for a local edit.

### sortOrder: a project's hand-made position

Each project carries a numeric `sortOrder` (PR 9). It is an ordinary per-project field, so it rides
on the project record: the newest copy of a project wins, like its name or colour, and no merge code
knows about it. That is why a move must change **one record**: `moveProject`
(`js/project-filter.js:84`) gives only the moved project a new number, next to its new neighbour and
strictly between it and the project beyond (`positionBetween`, `:63`), so `stampChanges` stamps that
one project and two devices moving different projects both survive the merge (tested in
`js/sort-order.test.mjs`). Rewriting an order array instead would make the last device to sync win
every project's place.

`ensureSortOrder` (`:51`) numbers any project without one after the current maximum, in array order:
on load (old saves), after a merge (an older device's projects) and when a project is added, including
repo projects from sync and "+ New", so new projects go to the end. On load it runs before the
snapshot `stampChanges` compares against, so numbering old data is not itself a change to stamp; the
first save after it writes the numbers out.

Two cases change more than one record, both rare and both still ordinary project edits:
- **Renumbering.** If the two neighbours are closer than `MIN_SORT_GAP` (1e-6, after many moves into
  the same gap), every project is renumbered 1..n in custom order.
- **First drag from another sort.** When the order on screen is not the custom order (the person was
  on Name, say), the group's projects take each other's existing numbers so Custom matches what they
  saw; hidden projects and the set of numbers are untouched.

Two devices moving the *same* project: the newer move wins. Projects that end up with the same number
tie-break by name in `sortProjects('custom')`, so both devices show the same order.

### Task sortOrder, and a task moving between projects

Tasks carry a `sortOrder` the same way projects do (PR 11): a per-record field, numbered per project by
`ensureTaskSortOrder` (`js/task-move.js`; on load, after a merge, when a task is added or comes from
GitHub), and a move gives only the moved task a new number next to its new neighbour
(`taskOrderChanges`, reusing `positionBetween`), so `stampChanges` stamps that one task. The group is
renumbered 1..n only when the two neighbours are closer than `MIN_SORT_GAP`. The numbers order each
group (In progress, Up next) within a project; done tasks keep array order.

Tasks are nested in projects, so a move to another project is a task leaving one project's list and
joining another's. Two things make that merge cleanly:
- **The move stamps the task.** Nothing in the task changes (same id, same fields), so `stampChanges`
  would not notice it; `applyTaskMove` sets `updatedAt` explicitly. No tombstone is written, because
  the stamper compares tasks across all projects by id and the task never disappears.
- **A task lives in one project.** The per-project union in `mergeStates` would otherwise keep the
  old copy in P1 (device B, unchanged) and the new one in P2 (device A, moved). After merging,
  `dedupeMovedTasks` (`js/merge.js`) keeps one copy per task id: the newest by `updatedAt`, and on a tie
  the copy the remote side has (like `newer`). So a move made after another device's last edit wins
  the task's *place*; an edit made on another device after the move puts it back where that device had
  it (last write wins). Tested in `js/task-move.test.mjs` (device A moved T from P1 to P2, device B
  unchanged: merged once, in P2, whichever side merges).

### Deletion tombstones

<!-- ref:bce8 -->
A deliberate deletion is different and is tracked explicitly: `deletedTaskIds` for tasks
(task id -> deletion timestamp) and `deletedRecordIds.{projects,categories,projectCategories,inbox}`
for everything else. `stampChanges` writes them for any record that disappears, whatever
code path removed it. Deletion is treated as a write
like any other: a tombstone beats a task copy that's no newer than it (so it stays
deleted), but a copy edited elsewhere *after* the deletion still wins, same as any other
newer write. Without this, deleting a task and reloading before the Gist push lands
(`persist()` debounces it 3s) would pull the old copy straight back in.

### Push merges first

`pushToGist` reads the Gist and merges it in before writing. A device that hasn't pulled yet
(offline start, failed pull, a fresh browser) adds to the Gist rather than replacing it with
its smaller copy. `focusdeck-push-pending` survives a reload inside the 3s debounce, so that
change is pushed on the next load. There is one `persist()` (`js/sync.js`); `mutations.js`
re-exports it. Its old private copy saved locally but never pushed.

## Invariants

- A push never writes the Gist without first merging what's in it.
- Every synced record kind has an `updatedAt` and a tombstone map. Adding a new synced kind
  means adding it to `RECORD_KINDS` (or `SYNCED_LISTS`) in `js/merge.js`; anything left out
  falls back to "local copy wins" and its edits won't reach other devices.

- A deletion tombstone beats a task copy that is no newer than it; a copy edited after the
  tombstone still wins (deletion is just another timestamped write, not a special case that
  always wins).
- A task with no tombstone on either side merges by union-of-ids: it survives being absent
  from one side's copy, so it doesn't vanish just because the other device hasn't seen it yet.
- Every `saveStateLocal()` call site must pass the `state` object explicitly.
  `saveStateLocal(state)` (`js/state.js`) takes `state` as a parameter; calling it with no
  argument silently serializes `undefined` (stringified to the literal text `"undefined"`)
  into localStorage instead of the real app state, corrupting the persisted state on every
  mutation. See the Traps entry below for the incident this caused.

## Traps

- `deleteTask` in `js/mutations.js` (`js/mutations.js:85`) is what writes the tombstone —
  `state.deletedTaskIds[taskId] = Date.now()`. Any future "remove this task" code path
  (bulk delete, archive, a new UI entry point) must write to `deletedTaskIds` the same way,
  or the deletion will silently stop sticking: the task will reappear on the next sync once
  a stale remote Gist copy is merged back in. This is exactly the bug fixed for issue #10
  ("pressing x on a task... on reload being back").

- **2026-09-22 — `persist()` called `saveStateLocal()` with no argument, silently wiping local
  state.**
  <!-- ref:2425 -->
  Found while investigating a user report of losing all local data and their sync
  Gist ID ("the changes made deleted all of my credentials from my local copy and the web
  version got cleared too... with a gist Id that is simply gone now"). The user later
  attributed the symptoms they *saw* to Chrome's "Desktop site" mode, but that only explains a
  rendering/viewport issue -- it can't explain actual data loss, since toggling a browser
  display mode does not touch localStorage. Auditing every `saveStateLocal()` call site in the
  app turned up a real, severe, currently-live bug that fits the reported symptoms exactly:

  `js/mutations.js`'s `persist()` called `saveStateLocal()` with NO arguments. Every other call
  site in the app (`js/sync.js`, `settings.html`) correctly passes the state object. But
  `state.js`'s `saveStateLocal(state)` takes `state` as a parameter -- when called with zero
  arguments, that parameter shadows the module's `state` singleton and is simply `undefined`
  inside the function. `JSON.stringify(undefined)` is the value `undefined`, and
  `localStorage.setItem` coerces it to the *string* `"undefined"` -- so every mutation (adding
  a task, completing one, editing a category, anything that goes through `mutations.js`, which
  is nearly everything the app does) overwrote `localStorage['focusdeck-state-v1']` with the
  literal text `"undefined"`.

  The app didn't notice immediately because the in-memory `state` singleton was still correct
  and the UI rendered from that -- exactly matching the user's report that it "looked fine" in
  the moment. But the next time `loadState()` ran (a page reload, or opening a new tab) it
  called `JSON.parse("undefined")`, which throws a `SyntaxError`, is silently swallowed, and
  falls through to `defaultState()` -- wiping every project, category, and the gistId back to
  nothing. This reproduces "gist Id that is simply gone now" precisely, without needing any
  browser-mode explanation.

  Fixed by passing `state` explicitly at the call site (`js/mutations.js`), and covered by a
  regression test that exercises the real module (not a text-pattern check like
  `style-contract.test.mjs`), because the bug is a runtime data-flow defect, not a
  static-shape one: `js/persist-storage.test.mjs` calls a real mutation and inspects what
  actually lands in (mocked) localStorage, plus what `loadState()` reads back afterward --
  simulating the reload where the user actually saw their data disappear.

- **2026-09-23 — Only tasks had timestamps, so most edits never synced.** Commit `2f9d1fd`
  (titled as a label-color fix) replaced `js/mutations.js` with a different draft, and
  `4bcf2dd` rebuilt the 12 functions it dropped by hand. Neither the merge nor those rebuilds
  timestamped anything but tasks, and several task paths (issue link/create/unlink) didn't
  bump `updatedAt` either. Result: category/project colors, project categories, Unsorted
  discards, project/category removals and issue links were reverted by whichever device
  pushed last, and a fresh device never adopted the Gist's colors. Fixed by stamping every
  record kind automatically (`stampChanges`) and merging newest-wins across all of them.
  Covered by `js/storage-safety.test.mjs`.
