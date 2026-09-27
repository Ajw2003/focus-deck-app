# Styling

## What it owns

`css/app.css` — the app's single, global, unscoped stylesheet — and the implicit contract it has
with every file that emits HTML: `js/render.js`, `js/app.js`, `index.html`, `settings.html`. There
is no CSS-modules/scoping/build step (see `README.md`'s "How it's built"), so a class name in a
template string and a selector in `css/app.css` are connected by nothing but both spelling the
same string correctly. Nothing enforces that connection except `js/style-contract.test.mjs`.

## How it works

Every visual property (light/dark theme colors, spacing, radius, shadow) is a CSS custom property
on `:root`, redefined under `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`
(css/app.css:1-60). Component styling below that is a flat list of class selectors — no nesting,
no BEM discipline, just one rule block per class, in the same order the sections of the app
appear (topbar, focus card, chips, inbox, project cards, forms).

Two elements stay put while the page scrolls: the sticky `.topbar`, and `.toast`, which is fixed
to the bottom of the viewport. The toast is the one place errors and notices appear, on both
pages, because on a phone you are usually scrolled far from wherever an inline message would sit.
`renderToast(text, kind)` (js/render.js) builds it; `kind` is `'error'` (red edge, `.toast-error`,
announced with `role="alert"`) or `'info'` (accent edge, `role="status"`).

- Main page: it shows `ui.syncError`, or `ui.notice` when there is no error. Background Gist sync
  failures reach it through `showOnPage` in js/sync.js, which used to log them to the console only.
  A failed startup sync is shown only when a Gist is connected, so a token without Gist access
  doesn't raise an error on every open. A manual GitHub sync (see "Sync button" below) that
  succeeds shows an info toast; a tap with no token saved shows one telling you to connect it in
  Settings, instead of syncing.
- Settings page: each button's result goes through its own `showToast`. The line under
  "Cross-device sync" keeps describing the current connection, since that is state, not a notice.

### Focus picker

"What's your focus right now?" (`renderFocusPicker`, js/render.js) shows one big card per label
(task type) that has open tasks, busiest first. Tapping a card picks a random open task with that
label, within the chosen project pill. **Surprise me** picks from every label. It is deliberately
not a card: it sits below the grid in its own `.focus-surprise` row, set apart by space and a
divider, as a `.btn.primary` accent button with the pool size beside it, because it is a
different kind of choice. (It was a full-width "Anything" card until 2026-09-26.)

The cards reuse `.energy-btn` inside `.energy-grid`, the look of the old Low/Medium/High buttons:
surface-2 fill, the label's colour on the top edge, the name, and a detail line ("3 open · 1 urgent
· 2 projects"). `.focus-grid` sets two columns on a phone. Six cards show until "Show all N labels".

Project pills above the cards (`.filter-pills`, plain `.filter-pill`s with a small colour dot for
identity — project colour is not used to tint them, see "Visual system" below — and the same
`.filter-pill.active` accent fill as any other chosen pill) narrow the cards and counts. They are
sorted busiest first, and six show
until the dashed **+N more** pill (`.focus-more-pill`) expands them. The chosen project always
shows, and names are never shortened. The chosen pill is kept per device (`focusdeck-focus-filter`).

Open tasks with no label get an **Unlabelled** card after the label cards (neutral `--ink-faint`
edge, always shown). It picks with the stand-in id `UNLABELLED` (js/state.js). This card is only a
focus pick, though — filing those tasks (and captured thoughts) into projects and labels happens in
the Unsorted card below, not from here.

### Top bar

Brand, the capture form, then `.topbar-tools`: the Projects icon button (phones and tablets only),
the sync button and the settings icon button (`.icon-btn`, `aria-label="Settings"`, gear SVG from
`js/icons.js`'s `ICON_SETTINGS`). Below 700px the capture form takes a full row of its own
under the brand and tools (`order:1; flex-basis:100%`), so the three controls never wrap onto a
row by themselves.

### Sync button

The topbar (`index.html`, outside `#app`) carries a small icon button, right before the settings
icon button: two hand-drawn curved arrows in a circle (`renderSyncButton`, js/render.js), colour
`--ink-soft`, `--ink` on hover. Its `title`/`aria-label` read `syncButtonTitle(st)` — "Sync with
GitHub" or "Sync with GitHub · synced Nm ago" — kept current on every paint via
`paintHeaderControls` in js/app.js, since the button lives outside the `#app` innerHTML replace.
While `ui.syncing` it gets `.is-syncing` (the icon spins, `animation:none` under
`prefers-reduced-motion`) and `disabled`. Tapping it with no GitHub token saved shows the "Connect
GitHub in Settings to sync." toast instead of syncing; a manual sync that finishes without error
shows "Synced with GitHub." (auto-sync on open stays quiet). It replaced the old sync row
(`.sync-row`: a status line plus "🔄 Sync GitHub" and "⬇ Pull latest" buttons) on 2026-09-26 — see
`docs/6-decisions/Decisions.md`.

### Unsorted

One card, one item at a time, guiding a captured thought or an unlabelled task all the way to
filed/labelled — or completed, skipped, or deleted — without ever leaving the flow. `renderInbox`
(js/render.js) builds it, right under the focus card. (Until 2026-09-26 it sat under a "Recently
done" strip, which was removed; `state.completedLog` still exists and is still written to, only
its own display was deleted.)

**The queue.** `unsortedQueue(st)` is computed fresh on every render, never stored: every captured
thought (`state.inbox`, oldest first), then every open task across every project with no labels, in
project order then task order. A task that gets labelled elsewhere, or a new capture, simply drops
out of or into the queue on the next paint. `unsortedCurrent(st, ui.unsorted)` returns the first
item this session hasn't skipped, or `null`. Items are keyed `i:<inboxId>` or `t:<taskId>`.

**The steps.**
- A task already in a project shows its project and issue-number chips and goes straight to the
  label step — it's not being sorted into anything, just labelled.
- A captured thought asks **Which project?** first: full-name pills (plain `.filter-pill` with a
  colour dot, same neutral-pill-plus-dot treatment as the focus picker's project pills), busiest
  (most open tasks) first, eight shown with a **+N more** pill (`unsorted-more-projects`). Tapping
  one (`unsorted-project`) advances to the label step, ranked by *that* project. A
  **`<project> · change`** button (`unsorted-change-project`) in the head row goes back.
- The label step is the old sort flow's, unchanged: the three kinds from #42 (**Reminder**,
  **Build**, **Fix**; `TASK_KINDS` in js/state.js) as `.energy-btn` cards, then every other label as
  a `.tint-pill`, ranked for the project at hand (its own labels first, busiest first, then the rest
  by use elsewhere; eight show, plus any picked, until **+N more**), then a field for new labels. A
  kind is an ordinary label named `reminder`, `build` or `fix`, created with its GitHub colour the
  first time it's used; an existing label with that name (any case) is reused.

**The actions.** A task's primary button is **Save →** (`unsorted-save`, via
`updateTaskFields`, which pushes to a linked issue like any label edit); a thought's is
**File →** (`unsorted-file`, once a project is chosen, via `fileInboxItem` — the same "becomes an
issue automatically in a GitHub project" path as before). **Done ✓** (`unsorted-complete`) closes a
task (`setTaskStatus(id, 'done')`, same as the checkbox) or completes a thought without ever making
it a task (`completeInboxItem` — logged to `state.completedLog` and, per merge.js, kept through a
Gist merge even though it has no task; that log has no on-page display since the "Recently done"
strip was removed on 2026-09-26). **Skip** (`unsorted-skip`) adds the item's key to this session's
skip list (`ui.unsorted.skipped`, never saved) and moves on; once everything left is skipped, a
**Go through them again** link (`unsorted-restart`) clears the list. **Delete**
(`unsorted-delete`, a quiet `.btn-text` at the right of the head row, apart from the flow
buttons so it isn't tapped by mistake, red on hover) removes a task with the same confirm as
the project card's × (`confirmDeleteTask` in js/app.js, shared by both), or discards a thought with
no confirm, showing a "Deleted "…"" toast instead.

Each item's scratch state (chosen project, ticked labels, typed new labels, "show all" toggles)
resets whenever the current item changes — `renderApp` (js/app.js) compares `unsortedCurrent(...)`'s
key against `ui.unsorted.currentKey` and starts fresh when they differ.

Once a task is picked (from the focus card, not here), its project chip is a button
(`scroll-project`, ↓) that jumps to that project's card, the same action as a row in the project
sidebar/drawer (see below). `scrollToProject` in js/app.js closes the Projects drawer first if it's
open, then opens the project if it is minimised and clears the project filter or search if they
hide it. It then scrolls so the card's top sits just below the sticky `.topbar`, measured at the
time, since the header is taller on a phone; `scrollIntoView` put it underneath.

History (2026-09-26): two dropdowns came first and were replaced for breaking the focus card's
glanceable, tap-first style. A **Type | Project** switch followed, where Project mode made the
cards projects and the pills labels. It was removed the same day, because the Type view did the job
better. A saved `mode: 'project'` is ignored. (2026-09-26) The old Unsorted list (a row per thought
with a project chip per project) and the separate Sort unlabelled takeover of the focus card were
merged into this one flow.

### Project sidebar / Projects drawer

`renderProjectSidebar` (js/render.js) is the single project list — search, category pills, sort,
Collapse all, one row per visible project (dot, full name, open task count), and one add field at
the bottom — and it's the only project list in the app; the old project-pills row (`.stats-row`)
and filter bar (`.project-filter-bar`) above the project cards were both deleted on 2026-09-26
(#9a). The same markup renders two ways, switched purely by CSS at the 1100px breakpoint (#50,
#64):

- **>=1100px: sidebar, one project card at a time (Q22b, Q23a, #82, PR 4 2026-09-27).** A sticky
  left column, 270px wide, that scrolls on its own when it's taller than the window. `.wrap` widens
  to 1800px (the 760px base rule is the one the style contract checks). The main column no longer
  shows a grid of every project's card — it shows the focus card, Unsorted, then **only the
  selected project's card**, full width. Every card is still rendered (phones need them all); CSS
  just hides every `.project-card` except `.is-selected` at this width, and `.projects-grid` is a
  single column instead of the old `auto-fill` grid. `[data-action="toggle-collapse-all"]`
  ("Collapse all") is hidden here too — meaningless when only one project shows. The focus picker's
  label cards still fill the row (`auto-fill`, 190px minimum) — that didn't change.

  Selection lives in `ui.selectedProjectId`, resolved every paint by `resolveSelectedProject`
  (js/project-filter.js, pure and tested): the id persisted per device
  (`focusdeck-selected-project`, read/write wrapped in try/catch exactly like
  `focusdeck-focus-filter`) if that project still exists, else the project with the most open
  tasks (ties keep the caller's current sort order, since `Array.sort` is stable), else `null` when
  there are no projects. It's resolved against *every* project, not the search/category-filtered
  list, so the open project stays open even if a filter would hide its sidebar row.

  A sidebar row (`scroll-project`), the focus card's project chip, and any other `scroll-project`
  source all branch on `matchMedia('(min-width:1100px)')` (`scrollToProject`/`isWideScreen` in
  js/app.js): at >=1100px they select that project (and scroll the main column so its card's top
  sits below the sticky topbar) instead of scrolling to it in a shared grid. The selected row gets
  `.is-selected` and `aria-current="true"`. The selected card always shows expanded up here —
  render.js leaves its own `is-collapsed` flag untouched and simply doesn't apply it to the
  selected card at this width — so a card someone minimised on their phone doesn't reopen collapsed
  the first time they look at it on a desktop.

- **<1100px: drawer, every project stacks.** Nothing changed here: hidden off-canvas
  (`transform:translateX(-100%)`, then `visibility:hidden` once it has slid away, so keyboard and
  screen-reader users can't land in it) until opened from the **Projects** button in the topbar
  (`#projects-btn`, hidden itself at >=1100px). Opening it (`toggle-projects-drawer` in js/app.js)
  slides it in from the left over a dim backdrop (`.drawer-backdrop`) and moves focus to the drawer
  itself — not its search box, which would raise the phone keyboard over the list; tapping the
  backdrop, pressing Escape, or tapping a project row (`scroll-project`, which also closes it and
  scrolls to the card, same as before PR 4) closes it and returns focus to the Projects button
  (`setProjectsDrawerOpen` in js/app.js). `ui.projectsDrawerOpen` holds the open state — not
  persisted, not saved. The `<aside>` carries `aria-label="Projects"` and, only while open,
  `role="dialog"` and `aria-modal="true"` (the wide-screen sidebar is not modal); the button carries
  `aria-expanded`/`aria-controls`, kept current by `paintHeaderControls` since the button lives
  outside `#app`.

**Add a project or a repo (Q15a, Q12d, PR 4 2026-09-27).** One field, `renderAddProjectField`,
sits at the bottom of the sidebar/drawer list — "New project, or owner/repo…" — replacing the two
forms (`renderAddProjectForm`) that used to sit at the bottom of the page. `add-project-field` in
js/app.js decides which path with `parseRepoInput` (js/github-sync.js, already used everywhere else
a repo is typed in): if it parses (`owner/repo`, or a `github.com` URL), the value takes the old
track-repo path (`addRepoManually`); otherwise it's a plain project name with no category —
category is set afterward through the project's own Edit panel (see below), since the field has
nowhere to put one. After adding, the new project is selected on wide screens or, on a phone, the
drawer closes and the page scrolls to it — the same split `scrollToProject` already made.

The sidebar/drawer markup is always in the DOM; a repaint rebuilds it, so `paint()` in js/app.js
records whether the one project search box (`.project-search`) had focus and puts the cursor back
in it afterward.

Native `confirm()`/`prompt()` dialogs are questions, not notices, and stay as they are. The toast
stays until the × dismisses it or a new message replaces it. While it shows, `.wrap:has(.toast)`
adds bottom padding so the last controls can still scroll clear of it.

`js/render.js` and friends build HTML as plain string concatenation (see `README.md`'s render
pattern), with class names as literal text inside the strings — e.g.
`'<button type="button" class="energy-btn" ...'` (js/render.js:5). There is no compiler step that
would catch a typo or a deleted rule; a class with no matching CSS rule fails completely silently
in the browser and just renders with default/no styling.

### Task rows and the editor (Q14a, Q12f, PR 4 2026-09-27)

A row (`renderTaskRow`, js/render.js) shows only the checkbox, the title, label chips, the deadline
chip, and the priority chip when one is set (it still cycles on tap). No `#N` GitHub badge, no
"Edit" link, no "Focus →", no × delete button — all four moved into the editor. Tapping the title
always opens `renderTaskEditForm`, linked or not: a linked task's title used to be an `<a>` straight
to its issue, so opening its issue took one tap and editing it took a second (a separate "Edit"
link); now the title is the same `role="button"` span every task's title is, Enter or Space opens
it (`onAppKeydown` in js/app.js), and reaching the issue takes one deliberate tap inside the editor
instead.

The editor's own quiet action row (`renderTaskEditActions`) sits after the GitHub line
(`renderTaskGithubLine`, unchanged — Unlink / + Create issue / Link to an existing issue) and before
Save/Cancel: **Focus on this** (the old row's "Focus →", now `focus-task`; picking it also closes
the form), **Open issue ↗ owner/repo#N** for a linked task only (a real `<a target="_blank"
rel="noopener">`, not another `data-action`), and **Delete** (`.btn-text danger`, the same
`confirmDeleteTask` confirm the row's × used to trigger, closing the form on confirm).

## Visual system

PR 3 (2026-09-27) is a purely visual pass — "warm editorial with a touch of notebook" — over the
same markup and behaviour: no feature or interaction changed (task-row controls, the add-task
form, Remove/Add project placement are all untouched; that's PR 4's job). See
`docs/plans/handcrafted-redesign.md` ("Direction", "Visual system") for the brief this
implements, and `docs/6-decisions/Decisions.md` (2026-09-27) for the calls made where it was
ambiguous.

**Five type sizes**, tokens on `:root` (css/app.css:20-24), and nowhere else — every `font-size`
in `css/app.css`, and every inline one that used to live in `settings.html`, is one of these:
`--text-sm:.8rem` (meta, chips, pills, counts, small buttons), `--text-body:.95rem` (body text,
rows, inputs, buttons, `.group-label`'s "In progress"/"Up next"), `--text-h:1.15rem` (section
headings, project names, the brand `h1`, the Unsorted item title), `--text-q:1.5rem` (the focus
question), `--text-title:2.1rem` (the picked focus task's title). Headings (`h1`-`h4`,
`.section-toggle`, `.sidebar-title`, `.focus-title`/`.focus-q`) are Fraunces; everything else is
IBM Plex Sans (css/app.css:79, 85).

**Three corner radii**, also tokens (css/app.css:26-28): `--r-pill:999px` for anything chip- or
pill-shaped (`.filter-pill`, `.chip`, `.label-option`, sidebar pills, priority chips); `--r-control:10px`
for controls — `.btn`, the capture input/button, other text inputs, `<select>`s, `<textarea>`s,
`.toast`, `.sidebar-project` rows, `.energy-btn` cards; `--r-card:18px`, used by exactly one thing,
`.focus-card`. Circles (`.proj-dot`, `.icon-btn`, `.mini-x`) stay `border-radius:50%`, outside the
token system. `.filter-pill`'s own rule keeps the literal `border-radius:999px` rather than the
token, on purpose — `js/style-contract.test.mjs` asserts that literal string, so the pill shape
stays enforced even if `--r-pill` itself were ever redefined.

**One raised card.** `.card`'s base rule (background, `--r-card`, `--shadow`, padding) is what
`.focus-card` uses, and is the only raised surface in the app. `.inbox-card`, `.project-card`
and settings.html's `.settings-section` override it back to flat — no background fill, no shadow, no side/bottom border, `border-radius:0`
— separated from whatever's above by a 1px `--line` top rule, except a project card's is its
existing 3px project-colour top edge, which doubles as that rule. The wide-screen sidebar
(>=1100px) is flat too, with a rule on its right edge instead of a box; the phone/tablet drawer
stays a solid sliding panel, since it's a distinct surface over a backdrop, not a section of the
page.

**Icons, not emoji.** `js/icons.js` is the one source of truth for the app's hand-drawn-style
inline line icons (`stroke="currentColor"`, `fill="none"`, ~1.75 stroke, round caps/joins,
viewBox 24 except the pre-existing sync icon's viewBox 20) — `js/icons.test.mjs` checks every
export is a well-formed, themeable, non-emoji SVG string. `js/render.js` imports from it
(currently `ICON_SYNC`, for the sync button); `index.html`/`settings.html` have no render step for
their static header markup, so they inline the same paths by hand for the brand mark (compass),
the settings link and the Projects drawer button — all `.icon-btn`s with an `aria-label`. The
favicon `data:` URI is the same compass path in the accent colour, not a rendered glyph. No emoji
remains anywhere in the UI (checked by grepping U+1F300-1FAFF, U+2600-27BF minus the kept
typographic marks `✓ ↓ × − + ▸ ▾`, and U+FE0F, over every `.html` and `js/*.js`/`*.mjs` file); the
PNG app icons under `icons/` (built by `generate_icons.py`) were not regenerated, since they're a
separate asset pipeline this pass didn't touch.

**Colour.** One accent (`--accent`/`--accent-ink`) for every action button — the capture Add
button and each project's add-task button, which both used to carry their own colour
(`--capture`, `--proj-color`), now match `.btn.primary`. A label's own colour (from GitHub) only
ever paints through `mutedChip()` (js/render.js) — `color-mix(in oklab, <color> 65%, --ink-soft)`
— everywhere a label colour is shown (`.energy-btn` top edges, `.cat-chip`, `.tint-pill`s,
`.label-option`, Unsorted kind cards, settings' category chips) so a raw GitHub hue (`#a2eeef`,
`#fbca04`, `#7057ff`, ...) reads as a calmer version of itself in both themes rather than at full
saturation; `--prio-*` priority colours are untouched. A **project's** colour is identity only —
the sidebar/drawer dot and a project card's 3px top edge — never a fill: `.progress-fill` is
neutral `--ink-soft`, and every project pill/chip (`.proj-chip`, the focus picker's project pills,
Unsorted's "Which project?" pills) is a plain, neutral pill with a small `.proj-dot` in the
project's colour before the name; the chosen one gets the ordinary `.filter-pill.active` accent
treatment, same as any other chosen pill, not its own colour.

**Label names.** `formatLabelName(name)` (js/state.js, tested by
`js/format-label-name.test.mjs`) title-cases a label's raw GitHub name for display only — never
touching the stored name or anything sent to GitHub — with a fixed list of acronyms kept upper
(or mixed-)case: UI, UX, API, CI, CD, PR, QA, SEO, CSS, HTML, JS, TS, PWA, iOS, QoL; a word that's
already mixed-case (`GitHub`) is left as written. Used everywhere a label's name is displayed:
focus picker cards, row `.cat-chip`s, the label picker, Unsorted's label pills/kind cards, and
settings' task-category list. Project category names are not labels and are shown as typed.

### Project header and the Edit panel (Q15a, #83, PR 4 2026-09-27)

`renderProjectCard`'s header is two lines that always render in the same shape, whatever the
project's name or badges: **line 1** is the colour dot, the name (`overflow-wrap:break-word` — it
wraps rather than truncates if it must), then the right-aligned collapse toggle and an **Edit**
link, laid out with `flex-wrap:nowrap` so the controls can never be pushed onto a second line by a
long name (#83, the bug where a long name plus badges wrapped the header and left that card's
progress bar sitting lower than its neighbours'). **Line 2** (`.project-badges`) is the GitHub
"Private · GitHub ↗" link and the project category chip — display only here, `min-height` set so
the line takes up the same vertical space even with nothing in it, which is what actually keeps
every card's progress bar at the same offset from its top, not just line 1's layout.

Tapping Edit opens `renderProjectEditPanel` under the header: the category `<select>` (the same
`set-project-category` mechanics, including "+ Add new…", that used to live on the header's own
chip/placeholder) and **Remove project** (the same two-step Yes/No confirm, `remove-project` →
`confirm-remove-project`/`cancel-remove-project`, that used to be the header's own button). "Done"
(`close-project-edit`) closes the panel. The header's old "Remove" button and "+ Category"
placeholder are gone. Right-click-to-recolour still works on the dot and on the category chip
wherever it's shown (`data-project-color`/`data-cat-id`, read by `onAppContextMenu` in js/app.js —
neither depends on where the chip sits in the markup).

### Collapsed "+ Add task" (Q3b, PR 4 2026-09-27)

A project card ends with a single `.link-btn`-style "+ Add task" line (`open-add-task`) instead of
the form always sitting open. Tapping it opens the full form in place (title `autofocus`,
`ui.addingTask[projectId] = true`, not persisted — only one project's form is ever open, since
nothing clears another project's flag but nothing needs to: each card reads only its own). Adding a
task re-renders a fresh, empty, still-open form (autofocus re-fires on the new element), so adding
several in a row is one tap plus Enter each time. Cancel (`cancel-add-task`) or Escape while focus
is inside the form (`onAppKeydown`) collapses it back to the link.

## Invariants

- Every class referenced in `js/render.js`, `js/app.js`, `index.html`, or `settings.html` must
  either have a matching selector somewhere in `css/app.css`, or be listed in
  `ALLOWED_WITHOUT_RULE` in `js/style-contract.test.mjs` with a reason. Enforced by
  `js/style-contract.test.mjs`.

  <!-- ref:f152 -->
  `ALLOWED_WITHOUT_RULE` exists for two legitimate cases: a class that's a pure JS hook, matched
  with `.matches()`/`querySelector` and never meant to be styled (`cat-add-form`,
  `cat-remove-btn`); or a modifier class that only ever appears stacked onto another class that
  carries the actual rule — e.g. `class="card focus-card focus-active"`, where `.card` supplies
  the border/shadow/padding and `focus-active` is a pure state marker `js/app.js` reads back, never
  a CSS target (`focus-card`, `focus-active`). Keep this list short and comment every entry — each
  one is a class the contract test can no longer protect, and the test itself asserts the list
  never grows an entry for a class that isn't actually used anywhere, so it can't silently
  accumulate dead exceptions either.

- A hand-picked set of the most visually load-bearing rules must keep specific properties, not
  just keep existing — a selector surviving with gutted properties is exactly how the issue #17
  regression shipped (see Traps below). Enforced by the second half of
  `js/style-contract.test.mjs`: headings stay on the `'Fraunces'` display font, `.wrap` stays at
  `max-width:760px`, `.energy-btn` keeps its `border-top:3px solid var(--chip-color)` (the thing
  that makes the focus picker's label cards visibly color-coded — it's kept for those cards and the
  Unsorted kind cards even though the energy system itself was deleted), `.card` keeps an actual
  `border`, `.filter-pill` keeps `border-radius:999px`.

- A commit that deletes 40% or more of an existing file's lines must say so explicitly in its
  message (`File-Rewrite-Ack: <path>`), or it's blocked. This isn't CSS-specific — it's a general
  guard (`scripts/guard-file-churn.mjs`) against any commit whose diff silently does far more than
  its stated intent, which is the actual mechanism behind the incident below. See
  `docs/6-decisions/Decisions.md` for why this shape of guard was chosen.

## Traps

**2026-09-21 — a one-line intended fix replaced the entire stylesheet, and nothing noticed for
about a day.** Commit `af88e6d` ("fix: give the New Project category select a solid background
(#14)") was meant to make exactly one change: add `background:var(--surface)` to
`.add-project-form select` (the only `<select>` in the file still using
`background:transparent`, see the trap in `docs/4-systems/pwa-shell.md`). Its actual diff replaced
essentially all of `css/app.css` — 129 of the file's 290 lines deleted, 55 different lines added
— with a different, smaller draft stylesheet that used different class names than the app's real
markup:

- `.energy-btn`/`.energy-grid`/`.energy-label`/`.energy-desc` (the large, color-bordered
  Low/Medium/High focus-picker buttons) didn't exist at all in the replacement, so they silently
  fell back to bare, unstyled `<button>` elements
- `h1`–`h4` lost `font-family:'Fraunces', Georgia, serif;`, replaced with `'IBM Plex Sans'`
- `.wrap` — the page's centering/max-width container, still the class `index.html:16` actually
  uses — was renamed to `.container` in the replacement, which nothing in the app references, so
  the whole layout lost its constrained width
- `.card` kept a rule, but lost its `border`; `.stats-row`/`.stat-pill` (the project progress
  pills) lost their rules entirely

Nothing caught this at the time because:

1. `css/app.css` had zero test coverage of any kind — every other module (`complexity.js`,
   `project-filter.js`, `sync.js`, `render.js`'s chip logic) has a `*.test.mjs`, but the
   stylesheet, despite being exactly as load-bearing, had none.
2. Even the tests that *did* exist were never wired into CI — `.github/workflows/deploy.yml` ran
   `generate_icons.py` and deployed straight to GitHub Pages on every push to `main`, with no test
   job in between. A broken commit and a clean one deployed identically.
3. The app kept working functionally — data still saved, synced, and rendered correctly — so
   nothing about the visible failure mode (still-alive, just plain-looking) tripped an error,
   console warning, or failed request. It was caught only because the person using the app
   happened to notice, two commits later, that it "wasn't pretty anymore," and asked why.

Fixed by commit `0c1657d`: restored the pre-`af88e6d` stylesheet and reapplied only that commit's
actual intended one-line change on top of it. `js/style-contract.test.mjs` and
`scripts/guard-file-churn.mjs`, both added afterward, exist specifically to make each of the three
gaps above unable to repeat silently: a class losing its rule now fails a test, a large unexplained
deletion now blocks the commit, and both now run in CI before every deploy
(`.github/workflows/deploy.yml`).
