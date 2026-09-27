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
