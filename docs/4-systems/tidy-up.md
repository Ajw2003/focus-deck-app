# Tidy up (#255)

## What it owns

`js/tidy.js` (pure grouping, `tidyGroups`, `confirmItems`, `confirmIds`), `js/tidy-view.js` (the Organize cards, four tick lists,
"Close these?"), `confirmTidy` in `js/mutations.js`, the `tidy-*` actions and `tidyAdvance` in `js/app.js`, the `.org-*` rules in
`css/app.css`, the desk-object drawings in `js/desk-objects.js`. Tests: `js/tidy.test.mjs`; checks: `scripts/check-tidy-browser.mjs`,
`scripts/shoot-organize-266.mjs` (390x844 walk, screenshots in `docs/generated/organize-266/`).

## How it works (#266: tick lists; was one page of Keep / Close buttons, #255)

- Organize opens on two index cards, 🧹 Tidy up (with its count of grouped tasks) and 📌 Triage, and a Start stamp. The rail's Organize
  tab and `set-screen` always land here (`ui.tidyStep` 0). It follows the view tape (`inView`).
- Tidy up is four screens, one per reason, in this order, a task in the first that fits (`ui.tidyStep` 1 to 4, progress dots 1 to 4):
  1. Finished?: status `review`. (No GitHub PR data is stored, so none is used.)
  2. Replaced?: title or notes say "replaced by" / "superseded by"; or "see #N" where N is another open task's issue number that is higher
     than this task's; or a label named superseded, replaced or obsolete. Rows read "old ➜ new" (the newer task, or the words after
     "replaced by"; just the title for a label).
  3. The same?: open pairs whose titles match after lowercasing and dropping punctuation, emoji and extra spaces, or one (5+ letters)
     inside the other, or an edit distance of at most 2 (under 15% of the length, titles 8+ letters). Rows read "a = b"; the older is
     what Merge closes, the newer is kept.
  4. Still want it?: open, `updatedAt` (else `createdAt`) over 60 days ago. Tasks with neither are left out.
- Each row is a tick box and the task's title; tapping the title opens Task details. ✓ All and Clear tick or clear the screen
  (`ui.tidyTicks`, memory only). The desk objects are disabled until something is ticked: tray = Keep, bin = Close; on The same? the two
  trays = Keep both, the stapler = Merge. Pressing one marks every ticked task (`ui.tidyMarks`, memory only), clears the ticks and goes on.
  Back is the corner, Skip the flag (goes on without marking). An empty reason still shows its screen ("Nothing here ✓").
- After Still want it?, or Skip on it, "Close these?" lists the Close and Merge marks in the view (a merged pair's older half with a 📎).
  With nothing marked it goes straight to Triage. Back returns to Still want it?.
- The Confirm stamp closes them through `setTaskStatus(id, 'done')`: the same route as ticking Done, so GitHub closes the issue as
  completed (no "not planned" route). Then Triage opens with a "Closed N ✓ / Undo" slip (`ui.tidyClosed`, memory only); Undo is
  `undoDone` for each, which restores `statusBeforeDone`. The slip goes when you leave Organize.

### Inventory of what was kept (#266)

Kept (same mutation, new screen): Keep / Close / Merge (`tidy-mark`), Confirm (`tidy-confirm`, `confirmTidy`), Undo (`tidy-undo`, now all
at once), Task details (`task-open`), the four reasons and their rules, view tape filtering. Changed: Keep/Close buttons per row became ticks
plus one desk object; "Confirm N, then Triage" became the Confirm stamp; "Open N → M" numbers became the count on the card. Dropped
(small text, per the 13px rule): the one-line reason under each group, the "Touched 3 days ago" meta line, the project name on each row,
the "Nothing closes until you press Confirm" line, "pressing again unmarks" (a later mark replaces an earlier one). Nothing dropped needs an
issue. New actions: `tidy-step`, `tidy-skip`, `tidy-all`, `tidy-none`.

## Invariants

- Nothing changes until Confirm. Done tasks never appear. A task is in at most one group.
- Marks on tasks outside the view stay marked but are not closed by a Confirm in another view.
- Nothing changes until the Confirm stamp.

## Traps

- `tidyGroups` checks every pair of open tasks for the "same" scan, but each pair fills only a narrow band of the edit-distance table (`within` in `app/js/tidy.js`). The full table froze Organize for about 11 seconds with 800 open tasks; it now opens in under 0.2 s (2026-11-13). GitHub's `updated_at` is not kept on tasks.

See also [review-tab.md](./review-tab.md), [view-switch.md](./view-switch.md), [github-sync.md](./github-sync.md).
