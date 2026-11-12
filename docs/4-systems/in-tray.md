# In-tray

## What it owns

The Unsorted card restyled as an in-tray of torn-off jotter slips (#121, part of #116). The look is the
second phone ("Sorting the Unsorted in-tray") in the "Your pick" section of
`docs/plans/redesign-directions.html`, screenshots `docs/generated/redesign-mockup/r5-sort-*.png`.
It reuses the #120 wallets (`js/wallet.js`, `docs/4-systems/wallets.md`) for "1. Which folder?" and
"2. Stick on category flags", so both follow the "Choosing a card" setting.

## Status

**Wired in (2026-10-10).** The tray is the live Unsorted card.

- `js/in-tray.js` — pure decisions: `orderTray`, `sendToBack`, `toggleToken`, `toggleFolder`,
  `flagCards`, `folderCards`, `selectionToIds`, `fileSlip`.
- `js/in-tray-view.js` — `renderInTrayCard(st, ui)` (called from `renderApp` in `js/app.js`) and
  `unsortedCurrent(st, u)`, the top slip in tray order, whose key resets the per-slip scratch.
- `js/render.js` — `unsortedQueue` (unchanged); the old pills (`renderInbox`,
  `unsortedKindsAndLabels`, `unsortedProjectPills`) are gone.
- `js/app.js` — `ui.unsorted` is `{ later, projectId, selected, step, find, title, notes, notesOpen,
  facingFolder, facingFlag, showAllFlags, currentKey }` (three parts, #189: see below). `walletHooks.onFacing` remembers the facing card of `tray-folders` / `tray-flags` so
  a repaint keeps it; `walletHooks.onChoose` toggles the folder or flag and repaints. `unsorted-file`
  and `unsorted-save` both go through `fileSlip`; `unsorted-skip` is Later (`sendToBack`). The
  wallets announce into `#tray-live` when the focus wallets' `#wallet-live` isn't on the page.
- `css/app.css`, the "In-tray (#121)" section.
- Tests: `js/in-tray.test.mjs` (the card and the decisions); `js/render.test.mjs` keeps the queue
  order test. Browser check: `scripts/check-in-tray-browser.mjs` (54 checks, tap and tap-twice, dark
  and light; filing, flags on and off, Later, a task slip, Already done, Bin it, the empty tray).
  Screenshots in `docs/generated/pr121/`.

Known: the flag tabs on the slip's edge are 46px wide, so a long name is clipped ("Reminder" shows
its end). The full name is in the tab's `title` and on the flag card.

## Nine steps, one per screen (#264, built 2026-11-12)

Design approved by Eden ("Design approved: step by step 11 2*", choice 1: each optional step asked with a Skip).
Prototype and visual reference: `docs/generated/friction-steps/prototype.html` (screens s0 to s11, `?all=sort`);
every action the Sort tab had is in `docs/generated/friction-steps/feature-map.json`, "Sort" (checked by
`check-feature-map.cjs`). Only the screens changed: the mutations are the ones above (`fileSlip` ->
`M.fileInboxItem` / `updateTaskFields` / `applyTaskMove`, `applyTies`, `labelIdByName`).

- **Start (s0).** "N to sort", one thought on a jotter slip (text editable unless GitHub-linked) with a **⋯**
  drawer pull (`sort-menu`: Add notes, Done already, Later, Delete, in a `.dk-sheet` card-index drawer), a
  **Sort several** flag (`bulk-toggle`, the existing Select many, below, until #265 redesigns it) and a stamped
  **Sort this one** card. Nothing left: "All sorted ✓" and an **Organize** card.
- **Steps 1 to 9**, each on the clipboard with nine progress dots, a Back corner, a Skip flag (steps 3 to 8 only,
  `canSkip`) and a stamped Next card: 1 project (the `tray-folders` carousel, Find, **+ New project** page),
  2 priority (page flags; a thought must have one, a task may pick None), 3 labels (the `tray-flags` carousel,
  picked tags under it, Find, **A–Z** card drawer with letter tabs, **+ New label** page), 4 due date
  (tear-off calendar pages, **Another date** month page with a typed-date box, then **When should it warn you?**
  = `warnPlan`, the same lead times as the add form's due step), 5 part of a bigger task, 6 smaller steps (type
  a new one or pick a task), 7 what has to happen first (waits on), 8 what is waiting on this (holds up),
  9 the receipt "All good?" with a pencil per line (`sort-step`, `data-step`) that jumps to that step and
  returns to the receipt on Next/Skip/Back (`fromReceipt`), then **Save to <project>** (`unsorted-file` for a
  thought, `unsorted-save` for a task).
- A task that is part of another cannot have steps of its own (two levels only, `canSetParent`), so step 6 says so
  instead of offering them.
- After Save the notice reads "Filed to <project> ✓" with **Open** (`open-added-task`), and the next thought
  shows at its start screen. A task saved with no label still goes to the back (`later`).
- Files: `js/sort-flow.js` (pure: `navigate`, `monthGrid`, `shiftMonth`, `formatDue`, `warnPlan`),
  `js/sort-flow-view.js` (the markup), `js/in-tray-view.js` (the card, plus Select many), `js/app.js`
  (`onSortAction`; `ui.unsorted` gains `step` 0 to 9, `sub`, `menu`, `month`, `letter`, `dueStages`,
  `fromReceipt`). `fileSlip` and `M.fileInboxItem` now carry `dueStages`; a task slip also saves a changed
  priority and due date. `css/app.css`, "Sort in nine steps (#264)", uses the `dk-*` kit.
- Every screen fits a 390x844 phone without the page scrolling and has no text under 13px
  (`scripts/shoot-sort-264.mjs` measures both and writes `docs/generated/sort-264/`). Known: "Sort several" (Select many)
  still has 12px meta text; #265 redesigns it.
- Tests: `js/sort-flow.test.mjs`, `js/in-tray.test.mjs`, `js/in-tray-priority.test.mjs`. Browser checks that drive
  Sort: `check-in-tray-browser.mjs`, `check-priority-browser.mjs`, `check-carousel-browser.mjs`,
  `check-category-filter-browser.mjs`, `check-bulk-sort-browser.mjs`, `check-desktop-browser.mjs`.
- Superseded below: the step bar and its tabs ("Three parts"), the "File to <project>" button and the pickers on the
  slip itself ("A thought needs a priority": now step 2 and step 4). The rules in those sections still hold.

## Delete asks first (#219, #220, #221; built 2026-10-20, design 1A on `docs/plans/tray-delete.html`)

Delete under a thought used to discard it in one tap (`unsorted-delete` in `app/js/app.js:531`), while a
task slip already asked through `confirmDeleteTask`. Now a thought asks too, with the app's own
confirmation card (the one `confirmMove` in `app/js/move-dialog.js` shows before a GitHub-linked move):
'Delete "<thought>"? It leaves the tray for good.' with Cancel and Delete. Cancel, Escape or the
backdrop keeps the thought; Delete discards it and shows the "Deleted" notice as before. Done
already and Later are unchanged. Built: the `unsorted-delete` branch awaits the card
(`app/js/app.js:536`), and `renderMoveDialog` takes the button's label, "Move" by default
(`app/js/render.js:604`). If the thought has gone by the time Delete is pressed, it only repaints.
`scripts/check-in-tray-browser.mjs` presses Cancel, then Delete.

## Three parts (#189)

Part of feature #188 (prototype `docs/generated/sort-steps/prototype.html`). The wallets show one
part at a time under a step bar (`.step-bar`, `data-action="sort-step"`): 1 folder, 2 flags, 3 tie to
tasks (part 3 is a placeholder until a later issue). Both thought and task slips start on part 1; a
task's folder is its own project until another is chosen, and saving moves it
(`applyTaskMove`). Each of parts 1 and 2 has a `.sort-find` search (case-insensitive substring,
`ui.unsorted.find`, cleared on a part change); a non-empty search shows all flags and hides "More
categories", and offers "+ New flag" when no category name matches exactly. The slip text is editable
unless the task is GitHub-linked (`issueNumber`), and a `.slip-notes` box holds notes; both are kept
in the scratch without repainting and saved by `fileSlip` (`fileInboxItem(..., { title, notes })` for a
thought, `updateTaskFields` for a task). The main button for a **thought** is "File to <project>" on parts 1 and 3 (disabled until a project and a priority are picked, #253) and Next on part 2; for a **task** slip it is Next on parts 1 and 2 and Save on 3. Part 1 is the project wallet ("Which project?"), a five-card strip on a wide screen (see wallets.md#the-wide-screen-strip-253); the priority and due pickers sit under it, then "File to <project>" and Done already / Later / Delete.

Since #205 (2026-10-19) every step tab can be tapped while its step is allowed. With no folder chosen
yet, tabs 2 and 3 are `aria-disabled` rather than `disabled`, so a tap on one shows "Choose a project
first. Labels and links open once the thought has a project." in a `.step-why` line (`STEP_LOCKED_WHY`
and `stepBar`, `app/js/in-tray-view.js:66-69`). A long note ends above the tray's lip, because
`.jot-slip` keeps 34px of padding at its foot (`app/css/app.css:827`).

## A thought needs a priority (#249)

Filing a thought needs a priority; a due date is optional. The slip carries the same Priority and
Due buttons as the project add row (`renderPickBlocks` in `js/pick-bits.js`, held in
`ui.unsorted.priority/due/dateOpen`, so they reset with each slip). Until one is picked the file
button on step 3 is disabled and reads "Pick a priority to file". `fileSlip` returns `none` and
`M.fileInboxItem` returns nothing without a valid priority, whatever the button says; both store
`priority` and `deadline` from `extra`. Tasks already in a project keep their own priority and show
no pickers. In "Select many" the pickers appear once a thought is ticked, one priority (and optional
date) for the whole batch, applied to the ticked thoughts only; `bulkBlocker` says "Pick a priority
for the thoughts you ticked." The jotter itself is exempt: jotting into Unsorted needs no priority.

## Sort many at once

Built 2026-10-24 (Aj asked for it with "skip design"). A **Select many** button beside the tray's
count (shown when two or more slips wait) swaps the one-slip tray for a list of every slip, each a
row with a tick box (`.bulk-row`, `data-bulk-key` = the queue key), with **Tick all**, **Clear ticks**
and **One at a time** above it. A panel beside the list (below it on a phone) takes one project
(`<select data-bulk-project>`), any labels (`.bulk-flag` toggles, plus a "New label" field) and an
optional name for a new task to group them under (`data-bulk-group`). **Sort N items** applies all
of it to every ticked slip.

Each row shows the item's whole text, never cut short, with a small line under it: how long ago a
thought was jotted ("4d ago"), or a task's project. Until 2026-10-25 the text was clamped to four
lines with `-webkit-line-clamp` and "Thought · 4d ago" sat beside it; on Aj's phone the clamp cut
each row to one line with the rest spilling over the card, so the clamp is gone
(`.bulk-text`, `.bulk-meta` in `app/css/app.css`).
That alone did not fix it: with many slips (Aj had 41) the list itself was a height-capped
scrolling grid, and that squeezed every row to one line. Since 2026-10-25 the list is a plain block
that grows with the page (`.bulk-list`), and the browser check seeds 41 slips in the dyslexic face
to catch this.

- `app/js/in-tray.js`: `pickedSlips`, `bulkProjectId`, `bulkBlocker` (why Apply waits) and
  `bulkSort`. A ticked thought is filed (`fileInboxItem`, then the GitHub issue hook); a ticked task
  is moved if another project was chosen (`applyTaskMove`) and gets the labels added to any it has
  (`updateTaskFields`). With a group name, one new task is added to the project (`addTask`, with
  the same labels) and every sorted item that `canSetParent` allows becomes its subtask. Thoughts
  need a project; tasks alone can be labelled where they are, and grouped when they all share one
  project. A slip that went away meanwhile (a sync, another tab) is skipped and counted.
- `app/js/in-tray-view.js`: `renderBulk`. `app/js/app.js`: `ui.bulk` (`freshBulk`; memory only,
  apart from `ui.unsorted`, which resets with each top slip) and `onBulkAction`.
- **A copy first.** Before applying, `bulk-apply` saves the stored data as it was into the backup
  list (`backupRaw(..., 'before sorting many at once')`, the same list a load keeps,
  `app/js/state.js:105`).
- Tests: `app/js/in-tray.test.mjs` (the "select many" tests); browser check
  `scripts/check-bulk-sort-browser.mjs` (46 checks on a phone and a wide screen, sample data only).
  Screenshots in `docs/generated/bulk-sort/`.

**Long thoughts.** The jotter has no length limit any more (see `styling.md#the-jotter`). A thought
over the old 400 characters, or written over several lines, is filed with its first line (cut to
120 characters) as the title and the whole text, unchanged, as the task's notes
(`splitLongThought` in `app/js/state.js`, used by `fileInboxItem`). Titles are one-line inputs and
GitHub caps issue titles, so this is how nothing written is lost. Shorter one-line thoughts file
exactly as before. On the slip a long thought scrolls inside the slip (`max-height: 45vh`).

## Category choices

Settings > How it works > Category choices (#133, `state.categoryFilter = { on, updatedAt }`, on by
default, synced and merged like `choosingMode`). It brings back what the old pills' "+N more"
did, as a setting:

- `js/category-filter.js` holds `splitCategories(categories, project, { on, selected })`. It keeps
  the categories the project's tasks use, plus anything already picked, and returns the rest as
  hidden. With the setting off, no project, or a project with no categories yet, nothing is hidden.
  Tested in `js/category-filter.test.mjs`.
- **In-tray flags** (`flagCards`): the kinds always show; then the project's categories, then a
  "More categories" card (`MORE_FLAGS_KEY`, "N more"). Choosing it sets `ui.unsorted.showAllFlags`
  for this slip.
- **Task add and edit forms** (`renderLabelPicker`): hidden labels are drawn with `is-extra`, behind
  "Show all N categories". `label-show-all` adds `show-all` to the picker with no repaint, so a
  half-typed form survives.
- Checked in Chromium by `scripts/check-category-filter-browser.mjs` (11 checks). Screenshots are in
  `docs/generated/pr133/`.

## Old Unsorted flow: keep / change / drop

| Today | Plan |
|---|---|
| Queue: thoughts oldest first, then open unlabelled tasks; live off state (`unsortedQueue`) | keep, unchanged |
| Header "Unsorted N" toggle | keep |
| Thought: "Which project?" pills busiest first | change: folder wallet, same order, choosing again clears |
| Thought: "File →" needs a project; `M.fileInboxItem` + GitHub issue for a linked project + notice "Filed to X." | keep (via `fileSlip`), button reads "File it in X →" |
| Task: its project is fixed; "Save →" puts labels on it; with none it skips | keep (button "Save in X →"; none = to the back) |
| Kind cards (Reminder / Build / Fix, label created on first use) | keep, as the first flag cards |
| "Other labels" ranked for the project | keep, same ranking, as flag cards |
| "+N more" / "Show fewer" for labels and projects | drop (the wallets scroll; every card is in them) |
| "New labels, comma-separated" field | drop (#189, answer 2A): type in the flag search and choose "+ New flag" |
| Done ✓ (`completeInboxItem` / `setTaskStatus done`) | keep as "Already done" |
| Delete (`discardInbox` + notice / `deleteTask` after confirm) | keep as "Bin it" |
| Skip hides the item until "Go through them again"; "N skipped for now" | change: Later puts it at the back; the tray always shows its next slip. "Go through them again" and "N skipped for now" are dropped |
| "1 of N" position | change: "N in the tray" |
| "Thought · 3m ago" chip, `#issue` chip on a task | keep, on the slip |
| "change" project chip | drop (choose the folder again) |

Part 3 ("Tie to tasks", #190): an "Inside <folder>" group (Part of, Subtasks) and an "Across all folders" group (Waits on, Holds up). Each row has tags with an x and "+ Add", which opens a task search (up to 6 open tasks, by title or folder name; Part of and Subtasks search the chosen folder only). Subtasks can also add a new subtask from the typed text. Ties are held in the slip's scratch (`parent`, `subtasks`, `waitsOn`, `holdsUp`, `newSubtasks`, seeded from a task slip's existing ties) and saved by `fileSlip` through `updateTaskFields`, skipping what `app/js/task-links.js` refuses. Rules: [task-links.md](./task-links.md).
