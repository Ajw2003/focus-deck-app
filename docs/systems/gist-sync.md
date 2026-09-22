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
