# Today — 2026-09-27

## What today was

PR 3 of the handcrafted redesign: the visual system. A prior run of this PR was interrupted
mid-way by a session restart, with `css/app.css`, `js/render.js`, `js/state.js` modified and
`js/icons.js` plus two test files added but nothing committed; today's work picked that up,
fixed the one failing test it had left behind, finished the parts of the plan it hadn't reached
yet, and committed it in logical steps.

## What was done

- Fixed `js/render.test.mjs`: two assertions still expected the old tinted-pill/proj-chip markup
  (`--chip-color` style, `.tint-pill` class) for project identity, while `js/render.js` had
  already moved to neutral pills/chips with a `.proj-dot` — updated the assertions to match the
  code, per the "project colour is identity only" decision, rather than reverting the code.
- Replaced the last emoji in the UI with hand-drawn SVG line icons from `js/icons.js`'s paths:
  the brand-mark compass (`index.html`, `settings.html`, and the favicon `data:` URI), the
  settings gear, and the Projects drawer button (now an `.icon-btn` with `aria-label="Projects"`,
  keeping its id/aria-expanded/aria-controls/data-action); removed the 📥 before "Unsorted".
  Confirmed with a full emoji grep over every `.html` and `js/*.js`/`*.mjs` file: no matches.
- Updated both HTML files' Google Fonts `<link>` to also load Fraunces italic weights.
- Finished the `--r-control` migration the interrupted run had left partway done: `.btn`, the
  capture input/button, and `.project-cat-edit select` were still on `--r-pill`; `.toast-close`'s
  leftover literal `1.25rem` font-size is now `--text-h`; `.group-label`'s heading (rendered as
  `h4`) was on `--text-sm` instead of the plan's `--text-body`.
- Wrote `docs/4-systems/styling.md`'s "Visual system" section (five sizes, three radii, one
  raised card, heading style, icons, colour rules, label names) and fixed passages it made wrong
  (tinted project pills, the ⚙️/📥 emoji references).
- Updated `docs/3-state/ProjectState.md` (milestone 6: PR 3 built) and added a dated
  `docs/6-decisions/Decisions.md` entry for the interpretation calls PR 3's brief left open.

## What was deliberately not done

`generate_icons.py`'s PNG app icons were not regenerated — a separate asset pipeline this pass
didn't touch. PR 4 (task rows open the editor, collapsed "+ Add task", Remove/Add project
relocated) is not started; PR 3 changes nothing about controls or interaction, only appearance.

## What got surfaced that isn't today's job

- The interrupted run's own test/code mismatch (fixed today) is worth noting as a pattern: when
  resuming interrupted redesign work, re-run the full suite before assuming "29/30 passing" means
  the code is wrong rather than the test being stale.

## Next, in order

1. PR 4 — the control moves (task rows open the editor, collapsed "+ Add task", Remove/Add
   project relocated), per `docs/plans/handcrafted-redesign.md`.

---

# Today (continued) — PR 4, 2026-09-27

## What today was

PR 4 of the handcrafted redesign: the control moves, plus one project at a time on wide screens
(#82, #83).

## What was done

- Task rows (`renderTaskRow`, js/render.js): stripped to checkbox/title/labels/deadline/priority.
  A linked task's title is no longer an `<a>` to its issue — every title now opens the editor, the
  same `role="button"` span/role, Enter/Space included.
- Editor (`renderTaskEditForm`): added `renderTaskEditActions` — Focus on this (closes the form),
  Open issue ↗ `owner/repo#N` for linked tasks (a real link), Delete (`confirmDeleteTask`, shared
  with the old row's ×).
- Collapsed "+ Add task": each project card ends with a `.link-btn` line
  (`open-add-task`/`cancel-add-task`, `ui.addingTask`, not persisted) instead of an always-open
  form; adding a task re-renders a fresh, still-open, empty form.
- Project header: restructured into two always-present lines (name+controls, then badges) so a
  long name can never push the controls to a second line (#83); added `renderProjectEditPanel`
  (category select + Remove project, both moved off the header) behind a new Edit link.
- Add project/repo: replaced the two bottom-of-page forms with one field,
  `renderAddProjectField`, at the bottom of the project list; `add-project-field` in js/app.js
  picks the track-repo vs. add-project path with the existing `parseRepoInput`.
- One project at a time on wide screens (#82): `resolveSelectedProject` (js/project-filter.js,
  pure, tested) plus `ui.selectedProjectId` persisted per device
  (`focusdeck-selected-project`); CSS at >=1100px shows only `.is-selected` and drops the grid to
  one column; `scrollToProject` and the new `afterProjectAdded` branch on
  `matchMedia('(min-width:1100px)')` to select instead of scroll.
- Updated `js/render.test.mjs`, `js/project-filter.test.mjs`, `js/github-sync.test.mjs` for all of
  the above; added CSS for the new classes and ran `js/style-contract.test.mjs` clean.
- Updated `docs/4-systems/styling.md` (task rows/editor, project header/Edit panel, collapsed
  add-task, the sidebar/add-field/one-project-at-a-time sections), `docs/4-systems/github-sync.md`
  ("where the GitHub controls live"), `docs/3-state/ProjectState.md` and
  `docs/2-roadmap/Roadmap.md` (milestone 6 to ~100%, pending merge).

## What was deliberately not done

Verification against a real Chromium build (screenshots, the numeric #83 measurements, the
add-field's live repo-tracking behaviour) is reported separately in the PR's own report, not
duplicated here.

## Next, in order

1. Merge PR 4 (`claude/laughing-einstein-wtt7t6`) once reviewed.
2. Milestone 7 onward, per `docs/2-roadmap/Roadmap.md`.

# Today (continued) — PR 5, 2026-09-27

## What today was

PR 5 of the handcrafted redesign: flip PR 4's breakpoint per the same day's reversal of Q22b
(Decisions, "Wide screens get 2x2 tiles; one project at a time moves to phones"). >=1100px now
shows every visible project as its own tile, two columns, equal height; <1100px now shows only the
selected project, the same layout PR 4 had built for wide screens.

## What was done

- `js/render.js`: `renderProjectCard` — the collapse toggle/"Collapse all" are hidden at both
  widths now, so a saved collapsed flag is ignored for rendering unconditionally (not just for the
  selected card); wrapped the task groups, the "+N done" toggle, the done group and "+ Add task" in
  a new `.project-body` scroll region (`tabindex="0" role="region" aria-label="<name> tasks"`),
  keyboard-reachable and independently scrollable inside a fixed-height tile. `renderProjectSidebar`
  takes a new `isWide` argument: a wide-screen row carries no `.is-selected`/`aria-current` (there
  is no "current" project once every one shows as a tile), only a narrow-screen one does.
- `js/app.js`: `isWideScreen()`'s breakpoint is now a named constant (`WIDE_BREAKPOINT_PX`, still
  1100, still coupled to `css/app.css`'s media query only by both spelling it the same way).
  `scrollToProject` and `afterProjectAdded` are inverted from PR 4: at >=1100px they just scroll to
  the project's tile (already rendered, no selection to set); below it they select
  (`ui.selectedProjectId`, `focusdeck-selected-project`) and then scroll, same as PR 4's wide-screen
  branch did. Added `updateTopbarHeightVar()` (called on init and window resize) to set
  `--topbar-h`, the real measured topbar height the tile-height CSS calc reads back — chosen over a
  guessed constant since the topbar's height varies with width and content, the same reasoning
  `scrollToProject`'s own offset already used. Added `scrollOpenedFormIntoView(selector)`, called
  after opening a task's editor or a project's "+ Add task" form, so it scrolls into view *within*
  its tile (`scrollIntoView({block:'nearest'})`) rather than just onto the page.
- `css/app.css`: the >=1100px media query now sets `.projects-grid` to two columns with
  `grid-auto-rows:max(320px, calc((100dvh - var(--topbar-h, 64px) - 16px) / 2))` (so every row, not
  just the first, gets the same tile height) and makes `.project-card` a `min-height:0` flex column
  whose `.project-body` scrolls; a new <1100px query holds the one-project-at-a-time hiding rule
  and the sidebar's selected-row highlight that PR 4 had at >=1100px. `.project-card`'s
  `margin-bottom` is zeroed at >=1100px — `.card`'s own margin was stacking on top of the grid gap
  between rows, doubling it, until this fix (found via the Chromium row-height check below). The
  collapse toggle and "Collapse all" get an unconditional `display:none` (no width scoping — see
  the Decisions entry: they're gone at both widths now).
- Updated `js/render.test.mjs`: the collapsed-flag test now expects it ignored for every project,
  not just the selected one; added a `.project-body` markup check and a wide-screen sidebar test
  asserting no `.is-selected`/`aria-current`.
- Updated `docs/4-systems/styling.md` (project sidebar/drawer section, rewritten for tiles vs.
  one-at-a-time; the collapse-toggle invariant), `docs/3-state/ProjectState.md`,
  `docs/2-roadmap/Roadmap.md` (milestone 6 to ~95%, PR 5 pending merge), and
  `docs/6-decisions/Decisions.md` (one entry for the sidebar-highlight/`isWide`-argument call and
  the tile-height source, since the plan left both open).

## Verified in real Chromium (Playwright, headless off, the seeded 11-project state)

1440x900 and 1920x1080: two columns confirmed via `grid-template-columns`; all 11 tiles the exact
same height (409px / 499px); after scrolling to the first tile, tiles 1-4 land fully inside the
viewport; row 2's top is row 1's top + tile height + the 16px grid gap, within 1px, after the
margin-collapse fix above; the 55-task tile's `.project-body` has `scrollHeight` (2336px) far past
its `clientHeight` (293px), scrolls independently (`window.scrollY` unchanged while its inner
`scrollTop` moves), and a sidebar click lands the clicked tile's top 12px below the topbar with no
`.is-selected` class and no `aria-current`; the 113-character project name's Edit link still shares
line 1 with the name (#83); opening a task's editor and "+ Add task" both land inside the tile's
own scroll region; no collapse toggle or Collapse all anywhere; no JS errors beyond the expected
Google Fonts failure. One caveat, not a regression: the progress-bar offset is uniform (~85px)
across every tile except the 113-char-name one (~127px), because that name wraps to several lines
within a ~530-620px-wide tile column and grows line 1 itself — pre-existing #83/PR 3/4 behaviour
(the badges line's fixed `min-height` only equalizes line 2, not a wrapped line 1), not something
PR 5 introduced or was asked to fix.

390x844 and 820x1180: exactly one project card visible at both; the busiest project (55 tasks) by
default with no stored key; a drawer row tap selects another (`aria-current`, the card switches,
the drawer closes), survives a reload, and lands the card below the topbar — though for a short
project on a short page the browser's own max-scroll clamp can leave it well below rather than
flush against the topbar (there's nowhere further to scroll; not a defect, just page-length
physics); the focus card's project chip and adding a project via the drawer field both select their
project; no collapse toggle or Collapse all at either width.

Screenshots in `docs/generated/pr5/`: `desktop-1440-tiles`, `desktop-1920-tiles`,
`desktop-1440-tile-scrolled`, `desktop-1440-editor-in-tile`, `phone-one-project`,
`phone-drawer-selected`, `tablet-820-one-project`. Google Fonts is blocked in this sandbox, so
every screenshot shows the system-serif/sans fallback, not Fraunces/IBM Plex Sans.

## What was deliberately not done

Dragging projects into order (Q27a, PR 6) — explicitly the next PR in the plan, not this one.

## Next, in order

1. Push this branch and open PR 5 for review (the task said not to open the PR itself; that's
   left to whoever picks this up next).
2. PR 6: dragging projects into order (Q27a, the project half of #73).
3. Milestone 7 onward, per `docs/2-roadmap/Roadmap.md`.

# Today (continued) — PR 6, 2026-09-27

## What today was

PR 6 of the handcrafted redesign: minimising comes back, and "All" or "One" becomes a per-device
switch (see `docs/6-decisions/Decisions.md`, "Minimising comes back...").

## What was done

- A two-option segmented control ("All"/"One", `renderViewSwitch`, js/render.js) sits right under
  the "Projects" title row in the sidebar/drawer, styled as pills, `role="group"` with
  `aria-pressed` on the chosen option. `ui.projectView` is persisted per device
  (`focusdeck-project-view`) and resolved once at load by `resolveProjectView(stored, isWide)`
  (js/project-filter.js, pure, tested) -- a stored value wins at every width from then on; before
  that, "All" from 1100px and "One" below, matching the old width-only behaviour.
- The per-project minimise button and "Collapse all"/"Expand all" are back, showing in "All" at
  every width and left out of the markup entirely in "One" (`renderProjectCard`,
  `collapseAllButton`, js/render.js) -- the saved `ui.projectCollapsed` flags PR 5 left unused are
  now read (and written) again, unchanged storage.
- In the wide "All" tile grid, minimised projects are pulled out of `.projects-grid` and gathered
  below it in their own `.minimised-grid`, two to a row, under a "Minimised" label, in the same
  sort order (`renderProjectsMain`, js/render.js, new and directly tested) -- keeps #82's
  equal-height tile grid intact. Below 1100px in "All", minimised projects just show header-only
  in their normal stacked position; no separate group.
- `scrollToProject`/`afterProjectAdded` (js/app.js) now branch on `ui.projectView` instead of
  `isWideScreen()`: "One" selects and scrolls (closing the drawer first); "All" expands the target
  if it was minimised (restoring what `scrollToProject` did before PR 5 hid minimising) and
  scrolls. `isWideScreen()` now only decides the "All" layout's shape (tiles vs. stacked) and the
  view's width default.
- CSS: the `@media (max-width:1099px)`/`(min-width:1100px)` one-at-a-time/tile rules moved under
  `.view-one`/`.view-all` (set on `.main-col`); the unconditional `.collapse-toggle,
  [data-action="toggle-collapse-all"]{display:none;}` rule is gone (js/render.js decides visibility
  now, not CSS); a small `.collapse-toggle` rule and `.minimised-projects`/`.view-switch` rules were
  added.
- `js/render.test.mjs`: rewrote the stale "collapse toggle hidden everywhere" assertions to match
  minimising being back, added tests for the view switch's markup and the new
  `renderProjectsMain` (all/one, wide/narrow, the minimised group and its sort order).
  `js/project-filter.test.mjs`: added `resolveProjectView` tests (stored all/one wins at both
  widths; nothing/junk stored falls back to the width default). No `style-contract.test.mjs`
  changes were needed once `.collapse-toggle` got its own small CSS rule (removing the old
  `display:none` rule would otherwise have left it unstyled).
- Docs: rewrote `docs/4-systems/styling.md`'s "Project sidebar / Projects drawer" section around
  the switch and minimised group; one Decisions.md entry for the one interpretation call the task
  left open (the drawer stays open after switching, since the switch's own effect plays out in the
  list it sits in); ProjectState/Roadmap/README updated to say PR 6 is built.

## Verified in real Chromium (Playwright, headless off, the seeded 11-project state)

1440x900, no stored view: "All" chosen (`localStorage` empty, active pill "all"); 2 columns, all 11
tiles exactly 409px. Minimising 3 tiles (the busiest/55-task one plus two others) pulled them out of
the tile grid into a 2-column `.minimised-grid` (heights 148/148/106px -- the 113-char-name one is
taller since its name wraps); the remaining 8 tiles stayed 409px each with row 2's top matching
`row1.top + tileHeight + 16px gap` within 1px. "Collapse all" minimised all 11 (0 still uncollapsed
after; 11 total), "Expand all" restored all 11 (0 collapsed after). Re-minimising the same 3 and
reloading kept the same 3 in the minimised group (`focusdeck-collapsed-projects` round-tripped).
Clicking a minimised project's sidebar row expanded it (`is-collapsed` gone) and scrolled it to 79px
below the topbar.

1440x900, switching to "One": exactly one project card visible (the busiest, 55 tasks, with no
stored selection); no `.collapse-toggle` and no `[data-action="toggle-collapse-all"]` anywhere in
the DOM. A sidebar row click selected another project (`aria-current="true"`, the visible card
switched to it) and a reload kept both the "one" view and that selection. Switching back to "All"
restored the 2-column tile grid; the minimised group was gone because switching to "One" and back
doesn't touch `ui.projectCollapsed` -- the 3 minimised from the block above were a fresh browser
context by then, so there was nothing to restore in this run (each Playwright context starts with
empty storage; the persistence itself was already confirmed above).

390x844, no stored view: "One" chosen (checked the drawer's active pill after opening it, since the
switch itself lives in the drawer at this width); one project card visible. A drawer row tap
selected another project, closed the drawer, and showed that project's card. Switching to "All" in
the drawer left the drawer open (the decision above) and switched the main column to every project
stacked (11 of 11 visible, 11 minimise buttons). Tapping the first minimise button collapsed that
card (`is-collapsed`); "Collapse all" (reopening the drawer to reach it) collapsed all 11. Reloading
kept "All" as the active pill.

# Today (continued) — PR 7, 2026-09-28

## What today was

PR 7 of the handcrafted redesign: a "+ New" panel for projects and GitHub repos (pick one of yours,
paste one, or create one), and linking a hand-made project to a repo — Q29a, Q30c, Q31a/#39's repo
half, per `docs/6-decisions/Decisions.md`.

## What was done

- `js/github.js`: `listYourRepos()` (`/user/repos` with `affiliation=owner,collaborator,organization_member`,
  wider than the existing owner-only `listRepos()`), `createRepo(name, isPrivate, description)`
  (POST `/user/repos`), and `ghFetch` now attaches GitHub's own `message` to a thrown 403 and reads
  it on 422 (`err.githubMessage`), so the "+ New" panel can show GitHub's real wording.
- `js/github-sync.js`: `untrackedRepos` (pure, tested — drops already-tracked and excluded repos,
  case-insensitively), `isValidRepoName`/`REPO_NAME_RULE`, `createRepoAndTrack`, `linkProjectToRepo`
  (pure — keeps id/name/colour/category/hand-made tasks, refuses if another project tracks the
  repo), `linkProjectToRepoOnGithub` and `linkProjectToRepoByInput` (the network halves). Confirmed
  and tested that `upsertRepoProject` already finds an existing project by `repoFullName` before
  creating one, so linking never creates a second project.
- `js/render.js`: `renderProjectSidebar`'s header always carries a "+ New" button
  (`aria-expanded`/`aria-controls`), opening `renderNewPanel` (New project / GitHub repo tabs — Your
  repos with a filter box past 8, Paste, a Create-a-repo disclosure, or a Settings line with no
  token) under the header row. Removed `renderAddProjectField` and its bottom-of-list markup.
  `renderProjectEditPanel` gained a "Link to GitHub repo" row (hand-made projects only) opening
  `renderLinkRepoPanel` inline.
- `js/app.js`: `ui.newPanel*` and `ui.linkPanel` state (not persisted); handlers for opening/closing
  the panel, switching tabs, fetching repos, Track/Paste/Create, the Edit panel's Link
  chooser, and Escape closing whichever panel focus is inside and returning it to the button that
  opened it. Every result/error shows inline in the panel it happened in, not the toast (see
  today's Decisions.md entry for why).
- `css/app.css`: `.new-panel`/`.repo-list`/`.repo-row`/`.new-repo-disclosure`/`.field-error` and
  friends; `.link-repo-panel{flex-basis:100%}` so the Edit panel's inline chooser sits below its own
  "Link to GitHub repo" toggle instead of wrapping ahead of it in the Edit panel's flex row (caught
  in the Chromium pass below).
- `settings.html`: a token step for **Administration: Read and write**, "only needed to create new
  repos from Focus Deck; everything else works without it."
- Tests: `js/github-sync.test.mjs` (`untrackedRepos`, `isValidRepoName`, `linkProjectToRepo`
  including the refusal, `linkProjectToRepoOnGithub` reusing the linked project), `js/render.test.mjs`
  (the "+ New" button always in the header, the panel's markup for both tabs and the no-token line,
  the Edit panel's Link row and inline chooser). `js/style-contract.test.mjs` passed unchanged once
  every new class had a CSS rule.
- Docs: `docs/4-systems/github-sync.md` (the "+ New" panel's tracking/creating/linking, doc-ref
  17bf), `docs/4-systems/styling.md` (replaced the old add-field section, added the Edit panel's
  link row), `docs/3-state/ProjectState.md` and `docs/2-roadmap/Roadmap.md` (PR 7 built), `README.md`
  (how to add projects and repos), one Decisions.md entry for the interpretation calls (the
  excludedRepos rule, the 100-repo pagination cap, inline vs. toast, the shared `ui.linkPanel` slot).

## Verified in real Chromium (Playwright, headless off, the seeded 11-project state, GitHub stubbed)

1440x900: "+ New" sat at (visible, in-viewport) top of the header with all 11 projects loaded; the
panel opened directly under the header row (its top at the header's bottom edge). New project added
a 12th project card and closed the panel. GitHub repo tab, Your repos listed exactly the 10
untracked repos out of 11 stubbed (`me/fresh-one` through `me/fresh-nine` plus `someorg/collab-repo`
— `Octo-Org/Octo-Repo` was correctly left out, matching the seed's tracked `octo-org/octo-repo`
case-insensitively); the filter narrowed to `me/fresh-one` alone. Track added a repo project card
with exactly 3 task rows (the stubbed issues). Paste with `someone/else` added another project.
Create posted `{"name":"my-new-repo","private":true,"description":"A test repo","auto_init":true}`
and the new repo then appeared as a project. A stubbed 403 on create showed "GitHub refused: your
token needs Administration: Read and write to create repos. See Settings. (Resource not accessible
by personal access token)" inline; a stubbed 422 showed GitHub's own "name already exists on this
account" inline. With no token, the GitHub repo tab showed only the Settings line, no Track/Create
UI. Escape while focus was inside the panel closed it and returned focus to `#new-panel-toggle`.

Linking: opening "Empty Garden" (hand-made)'s Edit panel, Link to GitHub repo, listed the same 10
untracked repos; picking `me/fresh-two` (private) turned it into a repo project (12 → 12 project
cards, no new one created) with 3 issue tasks and a "Private · GitHub ↗" badge, name still "Empty
Garden". Pasting `octo-org/octo-repo` (already tracked by the long-named project) into "Busiest
Workshop"'s own Link chooser showed the refusal inline: "octo-org/octo-repo is already tracked as
“A Very Long Project Name That Used To Wrap The Header Controls Onto A Second Line And Push The
Progress Bar Down”." — and Busiest Workshop was untouched.

Caught and fixed in this pass: the Edit panel's `.link-repo-panel` (inside `.project-edit-panel`'s
flex row) wrapped ahead of the "Link to GitHub repo" button that opens it, since the wide panel
didn't fit the row's remaining space; `flex-basis:100%` fixed it, confirmed by bounding-rect checks
before/after.

390x844 (drawer): "+ New" visible without scrolling, panel opened under the header, above the
All/One switch — screenshot at `docs/generated/pr7/phone-drawer-new-panel.png`.

No JS errors beyond the sandbox's Google Fonts TLS failure (confirmed separately: the only
`requestfailed`/non-OK response on a plain load is `fonts.googleapis.com` with
`ERR_CERT_AUTHORITY_INVALID`) and two harmless 404s from an unrelated background call
(`/user`/`/gists` from the app's own auto-sync-on-load, not stubbed in every scenario — pre-existing
behaviour, not part of this PR). The 403/422 console entries during the create-repo scenarios are
the test's own stubbed failures, already asserted as handled above.

Screenshots: `docs/generated/pr7/desktop-new-panel-project.png`,
`desktop-new-panel-your-repos.png`, `desktop-new-panel-create.png`,
`desktop-link-in-edit-panel.png`, `phone-drawer-new-panel.png`. Fonts render as the system
sans/serif fallback in every shot (the sandbox proxy blocks Google Fonts), not Fraunces/IBM Plex
Sans.

## What was deliberately not done

Unlinking a repo project back to hand-made (Q30c said linking only). `listYourRepos()` doesn't
follow GitHub's `Link` pagination header past the first 100 repos — `ghFetch` doesn't expose
response headers, so this was noted as a cap rather than built around (see today's Decisions.md
entry). Dragging projects into order is PR 8.

## What got surfaced that isn't today's job

Nothing beyond the `.link-repo-panel` flex-wrap bug above, which was fixed in this same PR rather
than filed separately, since it was caught and understood before the pass finished.

## Next, in order

1. PR 8 — dragging projects into order (Q27a, the project half of #73).
2. Milestone 7 onward, per `docs/2-roadmap/Roadmap.md`.

Every tile/card's progress-bar offset from its own top was a uniform 85px, except the 112-character
project name (offset 127px) -- its name wraps to multiple lines and grows line 1 itself, the same
pre-existing #83 behaviour PR 5's report already noted (the badges line's fixed `min-height` only
equalizes line 2, not a wrapped line 1); not something this PR introduced or was asked to fix. No
JS errors beyond the expected Google Fonts failure in this sandbox.

Screenshots in `docs/generated/pr6/`: `desktop-all-with-minimised`, `desktop-one`,
`desktop-sidebar-switch`, `phone-one`, `phone-all-with-minimised`, `phone-drawer-switch`. Google
Fonts is blocked in this sandbox, so every screenshot shows the system-serif/sans fallback, not
Fraunces/IBM Plex Sans.

## What was deliberately not done

Dragging projects into order (Q27a, PR 7) -- explicitly the next PR in the plan, not this one.

## Next, in order

1. Push this branch (the task said not to open the PR itself; that's left to whoever picks this up
   next).
2. PR 7: dragging projects into order (Q27a, the project half of #73).
3. Milestone 7 onward, per `docs/2-roadmap/Roadmap.md`.

## 2026-09-28 — next, in the order the user set

1. **PR 8: task rows split 75% title / 25% chips (#97, #92).** The title sits in the left 75% of
   the row beside the checkbox; the chips (priority, labels, deadline) are anchored right in the
   other 25%; neither leaves its zone. Replaces PR 4's rule where a long title took the whole line
   and dropped its chips underneath.
2. **PR 9: drag projects into order** (the project half of #73).
3. **PR 10: drag tasks into order** (the task half of #73; whether #7, dragging a task into another
   project, joins it is still to be asked).

The roadmap now carries all 21 open issues, including the nine opened since 2026-09-27 and #69,
which was missed when the roadmap was first written. Surfaced, not in the order above: #93 and
#94 are GitHub sync bugs (reopening milestone 2 at ~90%), raised with the user on 2026-09-28.

## 2026-09-28 — PR 8 built (pending merge)

Task rows are now checkbox + title zone (left 75%) + `.task-chips` zone (right 25%, chips
right-anchored, wrapping inside it; over-long labels ellipsised with the full name in `title` and
`aria-label`). `.task-main` is gone. Measured in real Chromium at 390, 1440 and 1920 wide; no chip
left its zone. Screenshots in `docs/generated/pr8/` (fonts fall back in the sandbox). Fixes #97 and
#92 once merged. Next: PR 9, dragging projects.

## 2026-09-28 — PR 9 built (pending merge)

Dragging projects into order (the project half of #73). Each project has a `sortOrder`; the sort menu
has "Custom order"; the grip on each "All"-view header and every sidebar/drawer row are drag handles
(mouse and pen after 4px, touch after a 350ms hold, arrow keys on the grip, Alt+Up/Down on a row), with
a ghost, dashed placeholder, drop line and edge auto-scroll. A move changes one project record, so the
Gist merge keeps two devices' moves. Unit tests in `js/sort-order.test.mjs`; checked in real Chromium
(mouse, touch via CDP touch events, keyboard) at 1440x900 and 390x844; screenshots in
`docs/generated/pr9/` (fonts fall back in the sandbox). Judgement calls are in Decisions, 2026-09-28
("Calls made while building drag-to-reorder"). Next: PR 10, dragging tasks.
