# In-tray

## What it owns

The Unsorted card restyled as an in-tray of torn-off jotter slips (#121, part of #116). The look is the
second phone ("Sorting the Unsorted in-tray") in the "Your pick" section of
`docs/plans/redesign-directions.html`, screenshots `docs/generated/redesign-mockup/r5-sort-*.png`.
It reuses the #120 wallets (`js/wallet.js`, `docs/4-systems/wallets.md`) for "1. Which folder?" and
"2. Stick on category flags", so both follow the "Choosing a card" setting.

## Status (read this first)

**Built but not wired in.** `js/render.js`'s old Unsorted pills (`renderInbox`, `unsortedKindsAndLabels`,
`unsortedProjectPills`) and `js/app.js`'s old actions are still the live code, because the edit that
removes them was refused during the build (nobody was available to approve it). What exists:

- `js/in-tray.js` — pure decisions: `orderTray`, `sendToBack`, `toggleToken`, `toggleFolder`,
  `flagCards`, `folderCards`, `selectionToIds`, `fileSlip`.
- `js/in-tray-view.js` — `renderInTrayCard(st, ui)`, the replacement for `renderInbox`.
- `css/app.css`, the "In-tray (#121)" section at the end.
- `js/wallet.js` — `data-verb` on a wallet's track (the in-tray says "use", not "draw").
- `js/render.js` — `sleeve` (new `picked`), `walletInner` (new `verb`), `mutedChip` are now exported.
- Tests: `js/in-tray.test.mjs`.

To wire it: in `renderApp` call `renderInTrayCard` instead of `R.renderInbox`; delete the old pill code;
in `js/app.js` rename `ui.unsorted.skipped` to `later` and add `facingFolder`/`facingFlag` to
`freshUnsortedScratch`; `unsorted-skip` becomes `later = sendToBack(later, key)`; `unsorted-file` and
`unsorted-save` call `fileSlip` (deps: `M.fileInboxItem`, `M.updateTaskFields`,
`createIssueIfGithubProject`, `labelIdByName`); `walletHooks.onFacing` stores the facing key for
`tray-folders` / `tray-flags`; `walletHooks.onChoose` toggles the folder (`toggleFolder`) or the flag
(`toggleToken`) and repaints (returns true); `announceWallet` falls back to `#tray-live`; drop
`sort-toggle`, `sort-more-labels`, `unsorted-more-projects`, `unsorted-project`,
`unsorted-change-project`, `unsorted-restart`; update `js/render.test.mjs` (its Unsorted tests describe
the pills).

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
