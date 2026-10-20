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
thought, `updateTaskFields` for a task). The main button is Next on parts 1 and 2 and File/Save on 3.

Since #205 (2026-10-19) every step tab can be tapped while its step is allowed. With no folder chosen
yet, tabs 2 and 3 are `aria-disabled` rather than `disabled`, so a tap on one shows "Choose a project
first. Labels and links open once the thought has a project." in a `.step-why` line (`STEP_LOCKED_WHY`
and `stepBar`, `app/js/in-tray-view.js:66-69`). A long note ends above the tray's lip, because
`.jot-slip` keeps 34px of padding at its foot (`app/css/app.css:827`).

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
