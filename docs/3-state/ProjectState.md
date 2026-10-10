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
| 2 | GitHub issue sync | ~90% | Shipped, tested; two sync bugs reported 2026-09-28 (#93, #94) |
| 3 | Cross-device sync (Gist) | 100% | Shipped, tested |
| 4 | Claude integration (on-demand) | 100% | Shipped, tested, archived plan |
| 5 | Claude integration (autonomous check-in) | 100% | Works (user-confirmed 2026-09-26), shelved |
| 6 | Handcrafted redesign | ~93% (PRs 1-7 merged; PRs 8-9 built, pending merge) | PR 8 task rows (#97, #92) and PR 9 drag projects into order (project half of #73) built, pending merge; PR 11 drag tasks built, pending merge, next PR 12 select several; #95 (colour without right-click) fixed by PR 10, pending merge; also open: #90, #87 |
| 7 | Unsorted and focus flow polish | 0% | #70 #72 #74 #75 #76 #77 #89 #96 #69 open; #72, #75, #77 may be covered by PR #78 |
| 8 | Reordering and task status | ~50% | #73 (project half PR 9, task half PR 11) and #7 (task into another project, PR 11) built, pending merge, checked in real Chromium with mouse, touch and keyboard; selecting several is PR 12; #6 open |
| 9 | Usability and accessibility audit | 0% | #27 #46 open |
| 10 | GitHub depth and progress visuals | 0% | #36 #35 #39 open |
| 11 | Teams and shared repos | 0% | #51 #4 open |
| 12 | Time-of-day suggestions | 0% | #48 open; the user decided 2026-09-26 to delete energy fully, so #48 (if built) builds on labels and time of day, not energy |
| 13 | Pilot and public rollout | 0% | #44 open |
| 14 | Due dates, repeats and reminders | ~15% (PR 1 of 6 built, pending merge) | PR 1 of #106: stage colours, `dueSetAt`, skippable step, Settings defaults; PRs 2-6 not started |
| 15 | Consumer product: desk redesign, landing page, onboarding | 100% built (10 of 10), not deployed | Design agreed 2026-10-09 (mockup `docs/plans/redesign-directions.html`); plan `docs/plans/consumer-product.md`; #117-#126 built, checked in Chromium and merged on `ccr-1569909b-xe23b7` (2026-10-10), not yet deployed; nothing merged to `main` yet; see `docs/plans/consumer-product-handoff.md` |

**After the merge (2026-10-10), on `ccr-1569909b-xe23b7`:** #131 and #132 (wallets let the page
scroll, and take a tap and a push-up in every mode; Swipe up mode retired), #133 (Category choices),
#128 and #129 (wallets laid flat with one click on a wide screen, projects as paper folders), and
#135 (one screen at a time from a side rail: Focus, Sort, Projects; the jotter on every screen; it
replaces #130's two-column desk). Checks: `check-wallet-touch-browser.mjs` 22/22,
`check-category-filter-browser.mjs` 11/11, `check-desktop-browser.mjs` 25/25, everything else still
green; unit 163/163.

## What's built / not built, per milestone

**15. Consumer product** — Built on `ccr-1569909b-xe23b7`, not deployed (#117-#126). Agreed design: the "Your pick" section of
`docs/plans/redesign-directions.html` (a lamp-lit desk of stationery: sticky note, index-card and
folder wallets, jotter, paper checkbox, Unsorted in-tray), screenshots in
`docs/generated/redesign-mockup/`. Plan and decisions: `docs/plans/consumer-product.md`. Ten child
issues #117-#126 under #116. Built: #117, the app now lives in `app/` with a forwarding root page
(`forward.js`), the manifest at the root keeping the install identity (`id "./"`, `start_url "app/"`),
the app's own worker (`app/service-worker.js`, cache prefix `focus-deck-app-shell-`) and a retirement
worker at the old root URL (`service-worker.js`); see `docs/4-systems/pwa-shell.md`. Checked in
Chromium under a `/focus-deck-app/` subpath (data survives, old worker and caches gone, fresh visitor
not forwarded, standalone forwarded); not checked: a real installed PWA's identity, iOS, the live
GitHub Pages deploy. Also built: #118, the landing page at the root (`index.html`, `site.css`,
`site.js`; `?about` skips forwarding), checked in Chromium (no sideways scroll at 390/1280 in both
themes, device-matched install tabs, forwarding cases); `beforeinstallprompt` did not fire on the root
page, so Install scrolls to the instructions. #119, the desk look for the focus area: the Low light
tokens and faces, the jotter, the sticky-note focus card, the paper checkbox with the biro cross-out
(`app/js/focus-complete.js`), the ticket-stub "Not this one"; see `docs/4-systems/styling.md`. The
due-now stage and light-mode High/Medium priority colours were darkened to keep contrast. #120 wallets: the focus picker is a folder wallet and an index-card
wallet (`app/js/wallet.js`, `docs/4-systems/wallets.md`), and "Choosing a card" (Swipe up / Tap / Tap
twice, default Tap twice) is a synced setting on the Settings page (`state.choosingMode`, merged like
`dueDefaults`). Dropped from the old picker: "+N more", "Show all N labels", and "1 urgent" (now
"top: Urgent"). Chromium check `scripts/check-wallets-browser.mjs`: 44/44. #121 the Unsorted in-tray:
slips in a tray, filed with the folder and flag wallets (`app/js/in-tray.js`, `app/js/in-tray-view.js`,
`docs/4-systems/in-tray.md`); dropped: "+N more"/"Show fewer", "N skipped for now" with "Go through
them again" (Later now sends a slip to the back), and the "· change" project chip. Chromium check
`scripts/check-in-tray-browser.mjs`: 46/46. #122 the note-writing setting (Handwriting / Print /
OpenDyslexic, self-hosted): `app/js/note-face.js`; Chromium check `scripts/check-note-faces-browser.mjs`:
64/64, OpenDyslexic loads offline; Kalam not seen on a real network (this sandbox blocks Google
Fonts). Offline: `app/js/icons.js` was missing from the worker's cache list (fixed); the worker install
and an offline reload are checked by `scripts/check-service-worker-browser.mjs` (run
`python3 generate_icons.py` first: the icons are generated, not committed). All on branch
`ccr-1569909b-xe23b7`; unit tests 134/134. #123 the desk look for the rest of the app: project folders, ruled task lists, paper editor, dialog, toast and Settings cards (CSS only, `docs/4-systems/styling.md#the-rest-of-the-desk`); also fixes the wallet cards drawing over the sticky topbar. Chromium tour `scripts/check-desk-screens-browser.mjs`: 60/60 at 390/1280 in both themes. #124 first-run onboarding (welcome, first folder, a few tasks, first pick, sync offer; once per device, not for existing data or a second device; replay from Settings > Help) and the no-projects empty states, `docs/4-systems/onboarding.md`; Chromium check `scripts/check-onboarding-browser.mjs`: 48/48. #125 guided sync setup (`app/setup.html`, `docs/4-systems/sync-setup.md`): one step per screen, the pasted key checked at once with each problem named (9 unit tests on fixture responses, not live GitHub), the first device makes the sync Gist and a second finds and pulls it; Chromium check `scripts/check-sync-setup-browser.mjs`: 22/22 with GitHub simulated. Unconfirmed: whether GitHub pre-fills the new-key form from the link. #126 Settings grouped (How it looks / How it works / Sync and GitHub / Help) with a setup checklist at the top, `docs/4-systems/onboarding.md#the-setup-checklist`; Chromium check `scripts/check-settings-browser.mjs`: 26/26. Resume from
`docs/plans/consumer-product-handoff.md`.

**14. Due dates, repeats and reminders** — Built, pending merge (PR 1 of #106, branch
`claude/due-stages-pr1`): `js/due-stage.js`, `task.dueSetAt`/`dueStages`, `state.dueDefaults` with its
merge rule, stage-coloured task deadline chips, the skippable lead-time step, the Settings "Due dates"
section; covered by `js/due-stage.test.mjs` and `js/due-dates.test.mjs`, checked in real Chromium
(`docs/generated/pr106/`). Not built: PRs 2-6 (red rises, time of day, repeats, in-app reminders,
phone notifications). Tasks that had a deadline before this PR are stamped with `dueSetAt` = now
on first load (`ensureDueSetAt`). See `docs/4-systems/due-dates.md`.

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
(`js/render.js`) were removed in PR 2 of the redesign (2026-09-26); #104 (2026-09-30) brought the
information back as a neutral "Claude created" chip plus a quiet spark/tick icon after the task title (`claudeMarks`, `js/render.js`).

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
made along the way. And PR 7 (the "+ New" panel, 2026-09-28): the sidebar/drawer header always
carries a "+ New" button (`renderProjectSidebar`, js/render.js) opening a two-tab panel -- New
project, and GitHub repo (Your repos fetched on open and filterable, Paste, and a Create a new repo
on GitHub disclosure) -- replacing PR 4's one bottom field. A hand-made project's Edit panel gets
"Link to GitHub repo", turning it into a repo project in place (same id, name, colour, category,
hand-made tasks left unlinked) via `linkProjectToRepo`/`linkProjectToRepoOnGithub`
(js/github-sync.js); `upsertRepoProject` already found an existing project by `repoFullName` before
creating one, so this never creates a second project. See `docs/4-systems/github-sync.md` and
`docs/6-decisions/Decisions.md` (2026-09-28). And PR 9 (dragging projects into order, 2026-09-28,
built, pending merge): each project carries a `sortOrder` (`ensureSortOrder`, `moveProject`,
`positionBetween`, js/project-filter.js) and the sort menu gains "Custom order"; a grip on each
"All"-view project header and every sidebar/drawer row are drag handles, by mouse, pen, touch
(press and hold) and keyboard (`js/project-drag.js`); a move changes only the moved project's record
so the Gist merge carries it. Tested in `js/sort-order.test.mjs` and checked in real Chromium at
1440x900 and 390x844 (`docs/generated/pr9/`). Not built: unlinking a repo project back to
hand-made. And PR 11 (dragging single tasks, 2026-09-28, built, pending merge): tasks carry a `sortOrder`
(`ensureTaskSortOrder`, `taskOrderChanges`, js/task-move.js), every open task row has a `.task-grip`, and
a task can be dragged within its group, into the other group (status follows), and into another
project, including a minimised one or an empty group (`js/project-drag.js`, `moveTaskTo` in js/app.js);
keyboard moves within and across the two groups. A cross-project move into a repo project asks first
(`planTaskMove`, `js/move-dialog.js`) and then creates the issue, transfers it (GraphQL `transferIssue`)
or, for a different owner, moves in the app only; `upsertRepoProject` now matches issues to tasks across
all projects and `mergeStates` keeps one copy of a moved task. Tested in `js/task-move.test.mjs` and
checked in real Chromium at 1440x900 and 390x844 with GitHub stubbed (`docs/generated/pr11/`). The real
GitHub `transferIssue` call has not been run against GitHub itself. Not built: selecting several items
and dragging them together (PR 12), moving a task to another project by keyboard.

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
