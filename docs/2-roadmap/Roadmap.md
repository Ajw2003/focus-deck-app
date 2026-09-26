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

## 2. GitHub issue sync — 100%

One-line: link tasks to GitHub issues so labels, priority, and completion stay in sync both ways.

**Contains:** pull/push issues as tasks, category<->label sync, priority<->label sync, link/unlink,
completion sync, auto-sync on load/focus (`js/github.js`, `js/github-sync.js`).

**Acceptance:** `js/github-sync.test.mjs` passes and `docs/4-systems/github-sync.md` describes the
live invariants. Checked — covered by root `README.md`'s "GitHub issue sync" section.

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
`task.claudeCreated` / `task.claudeCompleted` (`js/github-sync.js:69-71`), provenance chips
(`js/render.js:379-380`), the contract doc `docs/4-systems/claude-integration.md`.

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

## 6. Handcrafted redesign — 0%, in progress (today's live plan)

One-line: a focus-first, warm-editorial visual and structural redesign of the existing screens,
landed as four ordered PRs: (1) this docs move, (2) feature/control cuts, (3) the visual system,
(4) control moves.

**Contains:** the decisions and PR breakdown in `docs/plans/handcrafted-redesign.md`
("Pull requests (Q21a)"); PR 1 (this docs restructure) is in progress now, PRs 2-4 have not
landed in `js/` or `css/app.css` yet.

**Acceptance:** all four PRs merged, `node --test js/*.test.mjs` and
`node scripts/guard-file-churn.mjs` still pass after each, and the plan's own acceptance notes
(inside `docs/plans/handcrafted-redesign.md`) are satisfied. TODO — not started as of today.

**Open issues:** none belong here directly. #27 and #46 (usability audits) are milestone 9.

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

**Acceptance:** each issue above is closed with its behaviour checked in the running app.

**Note:** PR #78 (merged 2026-09-26) replaced the "Sort N unlabelled" takeover with the item-first
Unsorted flow, added Delete to it, and added labels for thoughts before filing. #72, #75 and #77
may already be fully or partly covered by it; check each against the app and close or narrow it.

## 8. Reordering and task status — 0%

One-line: arrange projects and tasks by hand, and make a task's status follow its GitHub issue.

**Contains:**
- #73 — drag to reorder projects and tasks
- #7 — drag a task from one project into another
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
- #39 — from Unsorted, create a new repo and project that syncs with GitHub

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

**Note:** this pulls against the redesign's decision to delete the energy system (PR 2, decision
Q8a in `docs/plans/handcrafted-redesign.md`). If #48 goes ahead, it builds on labels and time,
not on the deleted energy levels. Undecided as of 2026-09-26.

## 13. Pilot and public rollout — 0%

One-line: put Focus Deck in front of other people.

**Contains:**
- #44 — small tests at the school with specific students, then a public release, pay what you
  want

**Acceptance:** #44 closed, with what the pilot taught recorded in `docs/6-decisions/`.
