# Project State

## Headline: milestones 1-5 done, 6 started, 7-13 not started

Five of six milestones are done: four shipped and covered by passing tests, and the autonomous
check-in confirmed working by the user and then shelved. The redesign milestone is just starting
(this docs move is its first PR). Milestones 7-13, added on 2026-09-26 from the 19 open GitHub
issues, are all at 0%. There is no single overall percentage: the new milestones are not sized,
so averaging them with the finished ones would say nothing true.

## Status by milestone

| # | Milestone | % | Status |
|---|---|---|---|
| 1 | Core focus-picker PWA | 100% | Shipped, tested |
| 2 | GitHub issue sync | 100% | Shipped, tested |
| 3 | Cross-device sync (Gist) | 100% | Shipped, tested |
| 4 | Claude integration (on-demand) | 100% | Shipped, tested, archived plan |
| 5 | Claude integration (autonomous check-in) | 100% | Works (user-confirmed 2026-09-26), shelved |
| 6 | Handcrafted redesign | 0% (PR 1 in progress) | This commit is PR 1 |
| 7 | Unsorted and focus flow polish | 0% | #70 #72 #74 #75 #76 #77 open; #72, #75, #77 may be covered by PR #78 |
| 8 | Reordering and task status | 0% | #73 #7 #6 open |
| 9 | Usability and accessibility audit | 0% | #27 #46 open |
| 10 | GitHub depth and progress visuals | 0% | #36 #35 #39 open |
| 11 | Teams and shared repos | 0% | #51 #4 open |
| 12 | Time-of-day suggestions | 0% | #48 open; conflicts with deleting energy, undecided |
| 13 | Pilot and public rollout | 0% | #44 open |

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
`docs/archive/2026-09-21-claude-daily-checkin.md`. The plan's one open question — whether a fired
session can read the sync Gist, after an early attempt hit a proxy `403` — is closed: the user
confirmed on 2026-09-26 that it works, after tweaks to the plan and prompt that are not recorded
in this repo, and shelved it as less useful than expected. No code in this repo implements or
tests this milestone; it lives entirely in the trigger's stored prompt.

**6. Handcrafted redesign** — Built: this docs restructure (PR 1). Not built: PR 2 (cuts), PR 3
(visual system), PR 4 (control moves) — none of their changes exist yet in `js/` or
`css/app.css`.

## The one thing that is not what it looks like

**The energy system looks gone but is not.** Its UI is switched off (`ENERGY_UI_ENABLED = false`,
`js/state.js:7`), yet the energy data model and the label-to-energy sync logic still run
underneath (see the energy entry under cross-cutting issues below). PR 2 of the redesign deletes
it.

(Until 2026-09-26 this section held the autonomous check-in, whose Gist read was unconfirmed. The
user has since confirmed it works; see milestone 5.)

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
