# Project State

## Headline: ~78% against the roadmap

Five of six milestones are shipped and covered by passing tests; the sixth (autonomous check-in)
is created but unverified, and the redesign milestone is just starting (this docs move is its
first PR).

## Status by milestone

| # | Milestone | % | Status |
|---|---|---|---|
| 1 | Core focus-picker PWA | 100% | Shipped, tested |
| 2 | GitHub issue sync | 100% | Shipped, tested |
| 3 | Cross-device sync (Gist) | 100% | Shipped, tested |
| 4 | Claude integration (on-demand) | 100% | Shipped, tested, archived plan |
| 5 | Claude integration (autonomous check-in) | ~70% | Trigger created, unverified |
| 6 | Handcrafted redesign | 0% (PR 1 in progress) | This commit is PR 1 |

## What's built / not built, per milestone

**1. Core focus-picker PWA** — Built: focus cards, priority chips (`js/render.js`), project
categories/colors, wide-screen sidebar (`css/app.css`), inbox capture and Unsorted sorting
(`js/mutations.js`), manifest + service worker (`service-worker.js`,
`manifest.webmanifest`). Not built: nothing outstanding.

**2. GitHub issue sync** — Built: pull/push issues, label<->category and label<->priority sync,
link/unlink, completion sync both ways, auto-sync on load/focus (`js/github-sync.js`,
`js/github.js:1-117`). Not built: nothing outstanding; see Traps in
`docs/4-systems/github-sync.md` for known sharp edges (still current behaviour, not gaps).

**3. Cross-device sync** — Built: Gist push/pull (`js/sync.js`), per-record `updatedAt` +
tombstone merge (`js/merge.js`). Not built: nothing outstanding.

**4. Claude integration (on-demand)** — Built: provenance labels read into
`task.claudeCreated` / `task.claudeCompleted` (`js/github-sync.js:69-71`), rendered as chips
(`js/render.js:379-380`), contract doc `docs/4-systems/claude-integration.md`. Not built:
nothing outstanding for this milestone as scoped — though the live redesign plan removes these
chips entirely (`docs/plans/handcrafted-redesign.md`, "Removed" / Q12c), so this feature's UI
surface is slated to disappear in PR 2.

**5. Claude integration (autonomous check-in)** — Built: the trigger itself
(`trig_01DrH7KqRxHMEzANb9kgbYKe`, daily at 13:00 UTC, push notification), per
`docs/archive/2026-09-21-claude-daily-checkin.md`. Not built / not verified: whether a fired
session can actually read the sync Gist — an earlier attempt hit
`403 This GitHub API path is not available: sessions are bound to their configured repositories`
from this environment's proxy, and the same execution notes say "the design needs a rethink" if
scheduled sessions carry the same restriction. No code in this repo implements or tests this
milestone; it lives entirely in the trigger's stored prompt.

**6. Handcrafted redesign** — Built: this docs restructure (PR 1). Not built: PR 2 (cuts), PR 3
(visual system), PR 4 (control moves) — none of their changes exist yet in `js/` or
`css/app.css`.

## The one thing that is not what it looks like

**The autonomous Claude check-in (milestone 5) reads as "done" in the plan file's own progress
checklist** (`docs/archive/2026-09-21-claude-daily-checkin.md` shows "Scheduled task created" as
`[x]`), but the same file's execution notes immediately below say the one thing that would prove
it actually works — a real Gist read from a fired session — was never confirmed, and flag that
"the design needs a rethink" if it turns out not to work. A trigger that *exists* is not a
check-in that *works*; nothing in this repo re-verifies it after that day.

## Cross-cutting issues that belong to no milestone

- **The "Claude" chips are both a shipped feature (milestone 4) and a scheduled deletion (PR 2 of
  milestone 6).** Anyone reading `docs/4-systems/claude-integration.md` or
  `js/render.js:379-380` in isolation would not know the chips are about to be cut; only
  `docs/plans/handcrafted-redesign.md` says so.
- **`ENERGY_UI_ENABLED` (`js/state.js:7`) is `false`, but the `energy` data model and
  `energyFromLabels` sync logic are still live underneath the switched-off UI** (see the
  2026-09-26 Decisions entry "Priority and labels replace energy levels in the UI"). The
  redesign plan's "Removed" section treats this the same way — flipped off, not deleted — so
  this is a long-standing, deliberate piece of dead-looking-but-not-dead code, not a bug.
