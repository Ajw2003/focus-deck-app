# Tidy up (#255)

## What it owns

`js/tidy.js` (pure grouping, `tidyGroups`, `confirmIds`), `js/tidy-view.js` (markup), `confirmTidy` in
`js/mutations.js`, the `tidy-*` actions in `js/app.js`, the `.td-*` rules at the end of `css/app.css`. Tests:
`js/tidy.test.mjs`; browser check: `scripts/check-tidy-browser.mjs` (390 and 1440 wide; screenshots in
`docs/generated/build-checks/step7/`).

## How it works

- A sixth screen "Tidy up", last in the rail / bottom nav (step 11 regroups the tabs). Title "Tidy up: <view name>";
  it follows the All | Area | Project switch (`inView`). The badge counts every grouped task, ignoring the switch.
- Four groups, each only when not empty, each with a one-line reason; a task is in the first that fits:
  1. Built, waiting for your review: status `review`. (No GitHub PR data is stored, so none is used.)
  2. Replaced by newer work: title or notes say "replaced by" / "superseded by"; or "see #N" where N is another
     open task's issue number that is higher than this task's; or a label (kind of work) named superseded,
     replaced or obsolete.
  3. Looks the same as another: open pairs whose titles match after lowercasing and dropping punctuation, emoji
     and extra spaces, or one (5+ letters) inside the other, or an edit distance of at most 2 (and under 15% of
     the length, titles 8+ letters). One row "A · B" with Merge; the older is closed, the newer kept.
  4. Not touched in 60 days: open, `updatedAt` (else `createdAt`) over 60 days ago. Tasks with neither are left out.
- Keep / Close / Merge only mark (`ui.tidyMarks`, memory only; pressing again unmarks). The side panel (a sticky
  bar above the tabs on a phone) shows "open now → open after" and "Confirm N".
- Confirm closes the marked Close/Merge tasks that are listed in the current view (`confirmIds`), through
  `setTaskStatus(id, 'done')`: the same route as ticking Done, so GitHub closes the issue as completed (there is
  no "not planned" route). They move to a "Closed" list (`ui.tidyClosed`, memory only) with Undo = `undoDone`,
  which restores `statusBeforeDone`.

## Invariants

- Nothing changes until Confirm. Done tasks never appear. A task is in at most one group.
- Marks on tasks outside the view stay marked but are not closed by a Confirm in another view.

## Traps

- `tidyGroups` is O(n^2) in open tasks for the "same" scan. GitHub's `updated_at` is not kept on tasks.

See also [review-tab.md](./review-tab.md), [view-switch.md](./view-switch.md), [github-sync.md](./github-sync.md).
