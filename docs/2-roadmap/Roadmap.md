# Roadmap

Milestones for Focus Deck, derived from the repo's own README (root `README.md`) and the live
plan at `docs/plans/handcrafted-redesign.md`. Each is scored 0-100% against what actually runs,
not what is merely written.

Milestones 7-13 come from the open GitHub issues on `Ajw2003/focus-deck-app` as of 2026-09-26
(19 open). Every open issue sits in exactly one milestone; the grouping is a proposal, not
something the issues themselves say. A new issue should be added to a milestone here when it is
opened.

## 1. Core focus-picker PWA — 100%

One-line: pick a task type (or Surprise me), get one open task at random, install it as an app.

**Contains:** the focus-card picker, priority chips, projects with categories/colors, wide-screen
sidebar layout, inbox capture / Unsorted sorting flow, installable manifest + service worker
(`index.html`, `js/render.js`, `js/mutations.js`, `js/app.js`, `manifest.webmanifest`,
`service-worker.js`).

**Acceptance:** `node --test js/*.test.mjs` passes, and the app installs and runs offline (PWA
shell documented in `docs/4-systems/pwa-shell.md`). Checked — this is the shipped, deployed app
described start to finish in root `README.md`.

## 2. GitHub issue sync — ~90%, two open sync bugs

One-line: link tasks to GitHub issues so labels, priority, and completion stay in sync both ways.

**Contains:** pull/push issues as tasks, category<->label sync, priority<->label sync, link/unlink,
completion sync, auto-sync on load/focus (`js/github.js`, `js/github-sync.js`).

**Acceptance:** `js/github-sync.test.mjs` passes and `docs/4-systems/github-sync.md` describes the
live invariants. Checked — covered by root `README.md`'s "GitHub issue sync" section.

**Open issues (reported 2026-09-28, reopening this milestone):**
- #93 — GitHub issues not being pulled into Focus Deck properly, and new tasks not reaching GitHub
- #94 — a task and a GitHub issue with the same number: when the local task is older, the issue
  is silently ignored instead of added or merged

## 3. Cross-device sync (Gist) — 100%

One-line: an optional private Gist mirrors the whole app state across a person's own devices,
merging record-by-record rather than last-write-wins.

**Contains:** `js/sync.js` (push/pull), `js/merge.js` (`mergeStates`, per-record `updatedAt` and
tombstones).

**Acceptance:** `js/sync.test.mjs` / `js/merge.test.mjs`-style tests pass and
`docs/4-systems/gist-sync.md` matches the code. Checked — see the 2026-09-23 entry in
`docs/6-decisions/Decisions.md` for the merge-correctness fix that brought this to 100%.

## 4. Claude integration (on-demand) — 100%

One-line: Claude can create, comment on, close, and reopen GitHub issues for a linked task, with
sticky/live provenance chips so the user can always see and undo what Claude touched.

**Contains:** provenance labels (`Claude created this` / `Claude completed this`) ->
`task.claudeCreated` / `task.claudeCompleted` (`js/github-sync.js:69-71`), the row marker
(`claudeMarks`, `js/render.js`, #104), the contract doc `docs/4-systems/claude-integration.md`.

**Acceptance:** `js/github-sync.test.mjs` covers the provenance-label read path; visual
verification recorded in `docs/archive/2026-09-21-claude-issues-provenance.md`. Checked and
archived (see `docs/archive/README.md`).

## 5. Claude integration (autonomous check-in) — 100%, shelved

One-line: a scheduled, read-only daily check-in reads the sync Gist and pushes a notification of
overdue/stale/changed tasks.

**Contains:** a `create_trigger`-based scheduled session that GETs the sync Gist unauthenticated
and reports in three buckets (overdue/stale, changed, everything else open). No code in this
repo — the logic lives entirely in the scheduled prompt.

**Acceptance:** the trigger fires daily and either sends nothing (nothing due) or one push
notification with a correctly-bucketed report. **Checked by the user, 2026-09-26:** it works,
after tweaks to the original plan and scheduled prompt that are not recorded in this repo (the
archived plan, `docs/archive/2026-09-21-claude-daily-checkin.md`, is the pre-tweak version).
Shelved the same day as less useful than expected; nothing further is planned for it.

## 6. Handcrafted redesign — ~93%, PRs 1-7 merged, PRs 8-11 built (pending merge), PR 12 next

One-line: a focus-first, warm-editorial visual and structural redesign of the existing screens,
landed as ordered PRs: (1) the docs move, (2) feature/control cuts, (3) the visual system,
(4) control moves, (5) 2x2 tiles on wide screens and one project at a time on phones,
(6) minimising comes back and "All"/"One" becomes a per-device switch, (7) the "+ New" panel.

**Contains:** the decisions and PR breakdown in `docs/plans/handcrafted-redesign.md`
("Pull requests (Q21a)"). PRs 1-7 are merged (#79, #80, #81, #84, #85, PR 6, PR 7). PR 5 replaced PR 4's one-project-at-a-time wide-screen layout with 2x2 tiles (every
visible project its own tile, two columns, equal height, scrolling inside itself) and moves
one-at-a-time to phones instead (Decisions, 2026-09-27). PR 6 brought minimising back (the
per-project toggle and Collapse all, hidden by PR 5) and replaced the width-based tiles/one-at-a-time
split with a per-device "All"/"One" switch in the sidebar/drawer header: "All" is tiles from
1100px (minimised projects gathering below the grid) or a stacked column below it; "One" is
one-project-at-a-time, now at any width. PR 7 (2026-09-28) brought adding back into view: the
sidebar/drawer header always carries a "+ New" button opening a two-tab panel (New project;
GitHub repo — Your repos, filterable and fetched on open, Paste, and a "Create a new repo on
GitHub" disclosure that needs a token with Administration: Read and write), and a hand-made
project's Edit panel gets "Link to GitHub repo" (turns it into a repo project in place, keeping its
id/name/colour/category and hand-made tasks, refusing a repo another project already tracks). See
`docs/4-systems/github-sync.md` and `docs/6-decisions/Decisions.md` (2026-09-28). Next, in the
order the user set on 2026-09-28: PR 8, task rows with the title and a scaling chips column (#97, #92),
built, pending merge; then PR 9, dragging projects into order (the project half of #73), built,
pending merge (2026-09-28: grip on each header and every sidebar row are handles, mouse/touch/keyboard,
"Custom order" sort, a per-project `sortOrder` that syncs as an ordinary field); then PR 10 (colour without right-click, #95);
then PR 11, dragging single tasks within a project and into others with the GitHub moves (the task half of
#73 and #7, milestone 8), built, pending merge; PR 12, selecting several tasks or projects and dragging
them together, is next.

**Acceptance:** PRs 1-10 merged, `node --test js/*.test.mjs` and
`node scripts/guard-file-churn.mjs` still pass after each, and the plan's own acceptance notes
(inside `docs/plans/handcrafted-redesign.md`) are satisfied.

**Open issues:** #82 (wonky layout when several projects are open on wide screens) and #83
(project headers that don't line up) were fixed by PR 4 and PR 5 keeps both fixed (equal tile
heights rule out #82's gaps; the header's line-1/line-2 split from #83 is untouched); PR 6 keeps
minimised tiles out of the tile grid for the same reason. #27 and #46 (usability audits) are
milestone 9.

Still open here (added 2026-09-28):
- #97 — task rows: title left, chips anchored right, neither leaving its zone (asked as 75/25; built
  as a chips column that scales with its chips, 2026-09-28)
  (fixed by PR 8, pending merge)
- #92 — chips anchored to the right side of a task row (same fix as #97; fixed by PR 8, pending merge)
- #95 — a phone equivalent of right-click, for colour changing and the other right-click actions
  (colour half fixed by PR 10, pending merge: Edit-panel colour rows and label swatches)
- #90 — make the completion bar a little more distinct
- #87 — warmer: "like a nice notebook with leather edges, quality thick paper and a sense of
  familiarity"

## 7. Unsorted and focus flow polish — 0%

One-line: the sort flow and the focus card should draw attention to the item, not the action,
and make finishing, deleting and switching between them deliberate.

**Contains:**
- #70 — edit an Unsorted entry's text before filing it
- #72 — label and categorise when filing into a project from Unsorted
- #74 — focus card: **Back** instead of **Clear**, and auto-clear the pick on close, behind a
  setting that can be turned off
- #75 — in the sort flow, the item being sorted is the headline, not "Sort unlabelled"
- #76 — make the sort flow's **Done** more deliberate and set apart; make switching between the
  sort flow and the focus flow easier
- #77 — delete from the sort flow, just as deliberately
- #89 — filter the projects, or pick several, for Surprise me and the random pick
- #69 — make reminder tasks schedulable: a date (and maybe a time) when a `reminder` task comes back
  to attention (split out of #42; missed when this roadmap was first written, added 2026-09-28)
- #96 — in the "One project" view, "What's your focus right now?" switches to the open project

**Acceptance:** each issue above is closed with its behaviour checked in the running app.

**Note:** PR #78 (merged 2026-09-26) replaced the "Sort N unlabelled" takeover with the item-first
Unsorted flow, added Delete to it, and added labels for thoughts before filing. #72, #75 and #77
may already be fully or partly covered by it; check each against the app and close or narrow it.

## 8. Reordering and task status — 0%

One-line: arrange projects and tasks by hand, and make a task's status follow its GitHub issue.

**Contains:**
- #73 — drag to reorder projects and tasks: the project half is done by PR 9 and the task half by
  PR 11 (both built 2026-09-28, pending merge); selecting several items to drag together is PR 12
- #7 — drag a task from one project into another: done by PR 11 (built 2026-09-28, pending merge)
- #6 — rework how Waiting becomes In progress, linked to GitHub issue labels

**Acceptance:** each issue above is closed; a drag reorder survives a reload and a Gist sync to a
second device.

## 9. Usability and accessibility audit — 0%

One-line: a structured review of how usable, readable and accessible the app is, using the real
deck.

**Contains:**
- #27 — audit the usability and accessibility of Focus Deck
- #46 — question the user on usability and readability, using their current deck

**Acceptance:** findings written up under `docs/` and each one either fixed or filed as an issue.
The 2026-09-26 design Q&A (`docs/plans/handcrafted-redesign.md`) covered visual design, not this.

## 10. GitHub depth and progress visuals — 0%

One-line: show how much work is really happening on a project, and create repos from the app.

**Contains:**
- #36 — sync pull requests as well as issues, to show work done, not just issues closed
- #35 — a small visual of commits and commit frequency, joined with the existing task-completion
  visual
- #39 — from Unsorted, create a new repo and project that syncs with GitHub (creating a repo from
  the project list's "+ New" panel is PR 7 of the redesign; doing it from Unsorted stays here)

**Acceptance:** each issue above is closed and covered by `js/github-sync.test.mjs`-style tests
where it touches sync.

## 11. Teams and shared repos — 0%

One-line: work out what happens when more than one person's deck points at the same repo, and
bring tasks in from other tools.

**Contains:**
- #51 — what happens when two people on the same repo create and link the same issue from
  separate decks (a review, not a build)
- #4 — port ClickUp tasks to GitHub issues so it works for team projects

**Acceptance:** #51's findings written up in `docs/4-systems/github-sync.md` (Traps or
Invariants); #4 closed with an import run against a real ClickUp export.

## 12. Time-of-day suggestions — 0%

One-line: suggest tasks according to the time of day, since focus and energy change through the
day.

**Contains:**
- #48 — time-of-day categories and suggestions

**Acceptance:** #48 closed.

**Note:** the user decided on 2026-09-26 to delete the energy system fully (PR 2 of the redesign;
see `docs/6-decisions/Decisions.md`). If #48 goes ahead, it builds on labels and time of day, not
on the deleted energy levels.

## 13. Pilot and public rollout — 0%

One-line: put Focus Deck in front of other people.

**Contains:**
- #44 — small tests at the school with specific students, then a public release, pay what you
  want

**Acceptance:** #44 closed, with what the pilot taught recorded in `docs/6-decisions/`.

## 14. Due dates, repeats and reminders — 0%

One-line: due-date tasks turn white, yellow, then red as the date nears; some tasks repeat on a
schedule; Focus Deck notifies at a time the user sets.

**Contains:**
- #106 — the whole feature, planned in `docs/plans/due-dates-and-repeats.md` as five PRs (stages, time
  of day, repeating tasks, in-app reminders, phone notifications)
- #69 — make reminder tasks schedulable: folded into PR 4 of that plan

**Acceptance:** #106 and #69 closed; a task turns yellow then red in both themes; a repeating task
comes back on the right date and never advances twice across two devices; a phone notification
arrives at the set time with the app closed. Five questions in the plan are open; the notification
route is chosen by a spike, not assumed.
