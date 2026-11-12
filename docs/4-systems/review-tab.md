# The Review tab (#254)

> **2026-11-12 (#259):** the Board and Projects screens were removed in the five-tab change; the Roadmap took over their jobs. Where this file describes them as current it is history. See [tabs.md](./tabs.md).

## What it owns

`js/review-view.js` (markup), `reviewLists` in `js/board.js` (the two lists), `undoDone` and the stored
`statusBeforeDone` in `js/mutations.js`, the `review-*` actions in `js/app.js`, the `.rv-*` rules in `css/app.css` (the clipboard is Organize's `.org`). Tests: `js/review-tab.test.mjs`; browser check: `scripts/check-review-tab-browser.mjs` (390 and
1440 wide; screenshots in `docs/generated/build-checks/step6/`), `scripts/shoot-review-271.mjs` (390x844 walk, fit and 13px asserts, screenshots in `docs/generated/review-271/`).

## How it works (#271: one task at a time)

- Last in the rail / bottom nav. Its badge counts every task with status `review`, ignoring the All | Area | Project
  switch. The switch still narrows what the screen shows (`inView`).
- **Finished?** is the Organize clipboard: progress dots (tasks stamped this visit + those still waiting), one task card
  (title, project, issue number as a link when the task has a `url`) and two rubber stamps. The newest waiting task by
  `updatedAt` is the one shown. The title opens Task details (`ui.boardSelected`; Escape or Close).
  - ✓ LOOKS GOOD (green) = `setTaskStatus(id, 'done')`: closes the GitHub issue and removes the "needs review" label
    (`syncIssueCompletion`, `pushReviewToIssue`).
  - ✎ MORE WORK (red) = `setTaskStatus(id, 'doing')`: removes the label.
- After a stamp the next task shows with a jotter slip: "Done ✓ / Undo" or "Sent back ✓ / Undo" (`ui.rvLast`). Undo of
  Done is `undoDone` (back to `statusBeforeDone`, which is `review` for a task stamped here, label restored); Undo of
  Sent back is `setTaskStatus(id, 'review')`. The slip hides if the task has since moved elsewhere.
- **Done this week** (a tag at the foot, `ui.rvList`): the Board's rule (`boardColumns`, finished since Monday), each
  task struck through with a ↶ Undo flag (`undoDone`); the Back corner returns to the clipboard.
- Nothing waiting: "All reviewed ✓". No text under 13px and no page scroll at 390x844.
- Memory-only state: `ui.rvDone`, `ui.rvLast`, `ui.rvList`, reset when the tab is opened.

### Every Review action (inventory for #271)

| Action | Verdict |
|---|---|
| `review-open` (title opens Task details) | keep, on the card |
| `review-done` (Looks good · Done) | change: ✓ LOOKS GOOD stamp, same mutation |
| `review-more` (Needs more work) | change: ✎ MORE WORK stamp, same mutation |
| `review-undo` (Done this week) | keep as the ↶ Undo flag; also drives the slip's Undo |
| `review-list`, `review-back` | new: the Done this week tag and its Back corner |
| Both lists side by side, list counts, the "Waiting for your review" heading | dropped: one task at a time, the dots count |

## Traps

- Subtasks are in the queue too (the Board hides subtasks of a live parent; this tab does not).
- `statusBeforeDone` is a plain task field, so it syncs with the task.

See also [calm-board.md](./calm-board.md), [github-sync.md](./github-sync.md), [view-switch.md](./view-switch.md), [styling.md](./styling.md).
