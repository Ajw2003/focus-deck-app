# The Review tab (#254)

> **2026-11-12 (#259):** the Board and Projects screens were removed in the five-tab change; the Roadmap took over their jobs. Where this file describes them as current it is history. See [tabs.md](./tabs.md).

## What it owns

`js/review-view.js` (markup), `reviewLists` in `js/board.js` (the two lists), `undoDone` and the stored
`statusBeforeDone` in `js/mutations.js`, the `review-*` actions in `js/app.js`, the `.rv-*` rules at the end of
`css/app.css`. Tests: `js/review-tab.test.mjs`; browser check: `scripts/check-review-tab-browser.mjs` (390 and
1440 wide; screenshots in `docs/generated/build-checks/step6/`).

## How it works

- A fifth screen, "Review", last in the rail / bottom nav (step 11 reorders the tabs). Its badge counts every task
  with status `review`, ignoring the All | Area | Project switch (like Sort's badge).
- The switch sits at the top and filters both lists (`inView`).
- "Waiting for your review": every `review` task, newest first by `updatedAt`, with title, project name and the
  issue number (a link when the task has a `url`). Two buttons:
  - "Looks good · Done" = `setTaskStatus(id, 'done')`: closes the GitHub issue and removes the "needs review"
    label, exactly as ticking done does (`syncIssueCompletion`, `pushReviewToIssue`).
  - "Needs more work" = `setTaskStatus(id, 'doing')`: removes the label.
- "Done this week": the Board's rule (`boardColumns`: finished since Monday). Each has Undo (`undoDone`): back to
  `task.statusBeforeDone`, which `setTaskStatus` stores whenever a task becomes done; 'next' if it is missing.
  Undo of a task that came from review puts the label back (it is a status change like any other).
- A title is a button that opens the existing Task details as a side panel (`ui.boardSelected`; Escape or Close).
- Empty states are one calm line each. Phones stack the lists; the phone bottom bar has five equal columns.

## Traps

- Subtasks are listed too (the Board hides subtasks of a live parent; this tab does not).
- `statusBeforeDone` is a plain task field, so it syncs with the task.

See also [calm-board.md](./calm-board.md), [github-sync.md](./github-sync.md), [view-switch.md](./view-switch.md), [styling.md](./styling.md).
