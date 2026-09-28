# Project State

## Headline: milestones 1-5 done, 6 started, 7-13 not started

Five of six milestones are done: four shipped and covered by passing tests, and the autonomous
check-in confirmed working by the user and then shelved. The redesign milestone has six of its
seven PRs built on this branch, pending merge. Milestones 7-13, added on 2026-09-26 from the 19
open GitHub issues, are all at 0%. There is no single overall percentage: the new milestones are
not sized, so averaging them with the finished ones would say nothing true.

## Status by milestone

| # | Milestone | % | Status |
|---|---|---|---|
| 1 | Core focus-picker PWA | 100% | Shipped, tested |
| 2 | GitHub issue sync | 100% | Shipped, tested |
| 3 | Cross-device sync (Gist) | 100% | Shipped, tested |
| 4 | Claude integration (on-demand) | 100% | Shipped, tested, archived plan |
| 5 | Claude integration (autonomous check-in) | 100% | Works (user-confirmed 2026-09-26), shelved |
| 6 | Handcrafted redesign | ~95% (PRs 1-6 merged) | PR 7: "+ New" panel for projects and repos, link a project to a repo; then PR 8: drag projects into order |
| 7 | Unsorted and focus flow polish | 0% | #70 #72 #74 #75 #76 #77 open; #72, #75, #77 may be covered by PR #78 |
| 8 | Reordering and task status | 0% | #73 #7 #6 open |
| 9 | Usability and accessibility audit | 0% | #27 #46 open |
| 10 | GitHub depth and progress visuals | 0% | #36 #35 #39 open |
| 11 | Teams and shared repos | 0% | #51 #4 open |
| 12 | Time-of-day suggestions | 0% | #48 open; the user decided 2026-09-26 to delete energy fully, so #48 (if built) builds on labels and time of day, not energy |
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
`task.claudeCreated` / `task.claudeCompleted` (`js/github-sync.js`), contract doc
`docs/4-systems/claude-integration.md`. The "Claude created"/"Claude completed" row chips
(`js/render.js`) that used to render those flags were removed in PR 2 of the redesign
(2026-09-26) — the flags are still read and stored exactly as before, just not shown anywhere.

**5. Claude integration (autonomous check-in)** — Built: the trigger itself
(`trig_01DrH7KqRxHMEzANb9kgbYKe`, daily at 13:00 UTC, push notification), per
`docs/archive/2026-09-21-claude-daily-checkin.md`. The plan's one open question — whether a fired
session can read the sync Gist, after an early attempt hit a proxy `403` — is closed: the user
confirmed on 2026-09-26 that it works, after tweaks to the plan and prompt that are not recorded
in this repo, and shelved it as less useful than expected. No code in this repo implements or
tests this milestone; it lives entirely in the trigger's stored prompt.

**6. Handcrafted redesign** — Built: the docs restructure (PR 1), "the cuts" (PR 2): the energy
system deleted outright (data, UI and GitHub sync alike), the Recently done strip, the Claude
chips, the "+ Priority" placeholder chip, and `migrate-from-artifact.html` all removed; the sync
row replaced by a top-bar sync icon; the project-pills row and filter bar folded into one project
list that's a sidebar at >=1100px and a drawer below it. And PR 3 (visual system): the five-size
type scale and three-radius token system (`css/app.css`), one raised card (`.focus-card`) with
everything else flat, Fraunces-italic section headings replacing uppercase micro-labels, every
emoji in the UI replaced by hand-drawn SVG line icons (`js/icons.js`), one accent colour for every
action button, GitHub label colours muted through `mutedChip()`, project colour reduced to
identity only (a dot, never a fill), and display-only label-name formatting
(`formatLabelName`, js/state.js). And PR 4 (control moves, plus one project at a time on wide
screens): task rows show only checkbox/title/labels/deadline/priority, tapping the title always
opens the editor (linked tasks too), which gains Focus on this / Open issue ↗ / Delete; each
project card ends with a collapsed "+ Add task" line; a project header's Edit link opens a panel
with the category picker and Remove project, replacing the header's own Remove button and
"+ Category" placeholder, and the header's controls no longer wrap onto a second line regardless of
name length (#83); the two add-project/add-repo forms are replaced by one field at the bottom of
the project list. And PR 5 (2x2 tiles / one project at a time, flipping PR 4's breakpoint per
Q26a/Q28): >=1100px now shows every visible project as its own tile, two columns, every tile the
same height (half the space below the sticky topbar, a JS-measured `--topbar-h` custom property),
scrolling inside itself when its tasks overflow (`.project-body`); <1100px shows only the selected
project's card, full width, the same way PR 4 did for wide screens, via `resolveSelectedProject`
(js/project-filter.js) and a persisted per-device selection (#82). And PR 6 (minimising comes back;
"All"/"One" becomes a per-device switch): a two-option segmented control in the project
sidebar/drawer header (`renderViewSwitch`, js/render.js) picks `ui.projectView`, persisted per
device (`focusdeck-project-view`) and resolved at load by `resolveProjectView` (js/project-filter.js)
-- a stored choice wins at every width, else "All" from 1100px and "One" below, same defaults as
before. The per-project minimise button and Collapse all are back, showing in "All" at every width
(`ui.projectCollapsed`, unchanged storage); in the wide-screen "All" tile grid, minimised projects
leave the grid and gather below it as header-only cards, two to a row, under a "Minimised" label
(`renderProjectsMain`, js/render.js) -- below 1100px in "All" they just show header-only in place,
one column. "One" is PR 5's one-project-at-a-time view, now available at every width; the shown
card always renders expanded and has no minimise button. See `docs/4-systems/styling.md`'s "Project
sidebar / Projects drawer" section and `docs/6-decisions/Decisions.md` (2026-09-27) for the calls
made along the way. Not built: dragging projects into order (PR 7, Q27a, the project half of #73).

## The one thing that is not what it looks like

Nothing currently qualifies. (Until 2026-09-26 this section held the energy system — its UI was
switched off but the data model and label-sync logic still ran underneath; PR 2 deleted it
outright, so there's nothing to flag there any more. Before that it held the autonomous check-in,
whose Gist read was unconfirmed; the user has since confirmed it works, see milestone 5.)

## Cross-cutting issues that belong to no milestone

Nothing currently qualifies. (Until 2026-09-26 this held two items — the Claude chips being both
a shipped feature and a scheduled deletion, and `ENERGY_UI_ENABLED` masking still-live energy
data/sync logic — both resolved by PR 2: the chips are gone and the energy system was deleted
outright, so neither is a live discrepancy any more.)
