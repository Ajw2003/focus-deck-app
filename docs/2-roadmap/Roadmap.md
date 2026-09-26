# Roadmap

Milestones for Focus Deck, derived from the repo's own README (root `README.md`) and the live
plan at `docs/plans/handcrafted-redesign.md`. Each is scored 0-100% against what actually runs,
not what is merely written.

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

## 5. Claude integration (autonomous check-in) — ~70%, unverified

One-line: a scheduled, read-only daily check-in reads the sync Gist and pushes a notification of
overdue/stale/changed tasks.

**Contains:** a `create_trigger`-based scheduled session that GETs the sync Gist unauthenticated
and reports in three buckets (overdue/stale, changed, everything else open). No code in this
repo — the logic lives entirely in the scheduled prompt.

**Acceptance:** the trigger fires daily and either sends nothing (nothing due) or one push
notification with a correctly-bucketed report. **Not fully checked** — the trigger
(`trig_01DrH7KqRxHMEzANb9kgbYKe`) was created and a test fire was started, but whether the fired
session can actually read the Gist (an earlier attempt hit a proxy restriction, see
`docs/archive/2026-09-21-claude-daily-checkin.md`) was never confirmed. TODO: verify a real fire
produces a correct report, or redesign the data source if the restriction is permanent.

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
