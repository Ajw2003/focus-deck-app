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
- `js/app.js` — `ui.unsorted` is `{ later, projectId, selected, newLabels, facingFolder, facingFlag,
  currentKey }`. `walletHooks.onFacing` remembers the facing card of `tray-folders` / `tray-flags` so
  a repaint keeps it; `walletHooks.onChoose` toggles the folder or flag and repaints. `unsorted-file`
  and `unsorted-save` both go through `fileSlip`; `unsorted-skip` is Later (`sendToBack`). The
  wallets announce into `#tray-live` when the focus wallets' `#wallet-live` isn't on the page.
- `css/app.css`, the "In-tray (#121)" section.
- Tests: `js/in-tray.test.mjs` (the card and the decisions); `js/render.test.mjs` keeps the queue
  order test. Browser check: `scripts/check-in-tray-browser.mjs` (46 checks, tap and tap-twice, dark
  and light; filing, flags on and off, Later, a task slip, Already done, Bin it, the empty tray).
  Screenshots in `docs/generated/pr121/`.

Known: the flag tabs on the slip's edge are 46px wide, so a long name is clipped ("Reminder" shows
its end). The full name is in the tab's `title` and on the flag card.

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
| "New labels, comma-separated" field | keep |
| Done ✓ (`completeInboxItem` / `setTaskStatus done`) | keep as "Already done" |
| Delete (`discardInbox` + notice / `deleteTask` after confirm) | keep as "Bin it" |
| Skip hides the item until "Go through them again"; "N skipped for now" | change: Later puts it at the back; the tray always shows its next slip. "Go through them again" and "N skipped for now" are dropped |
| "1 of N" position | change: "N in the tray" |
| "Thought · 3m ago" chip, `#issue` chip on a task | keep, on the slip |
| "change" project chip | drop (choose the folder again) |
