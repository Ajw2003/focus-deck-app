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

`renderProjectSidebar` (js/render.js) is the single project list — the "All"/"One" switch, search,
category pills, sort, Collapse all, one row per visible project (dot, full name, open task count),
and one add field at the bottom — and it's the only project list in the app; the old project-pills
row (`.stats-row`) and filter bar (`.project-filter-bar`) above the project cards were both deleted
on 2026-09-26 (#9a). The same markup renders as a sticky left column at >=1100px or the phone/tablet
drawer, switched purely by CSS at the 1100px breakpoint (#50, #64); what shows inside the main
column depends on `ui.projectView`, not the breakpoint (PR 6, 2026-09-27, see
docs/6-decisions/Decisions.md, "Minimising comes back..."). The sticky column's top and maximum height are
worked out from the measured topbar (`--topbar-h`), so it always fits between the topbar and the
page's bottom padding; a longer list scrolls inside it. (At a fixed `100vh - 100px` it overran by
about 50px, and at the page's end the sticky box was pushed up under the topbar, hiding the
"Projects" title and cutting off "+ Add".)

**The "All"/"One" switch (PR 6).** `renderViewSwitch` (js/render.js) draws a two-option segmented
control — `role="group" aria-label="Project view"`, two `.filter-pill` buttons labelled "All projects" / "One project" (not bare "All" / "One": the
category pills just below start with their own "All", and two "All" pills stacked read as one control) with
`aria-pressed`, the chosen one getting the ordinary `.filter-pill.active` accent treatment — right
under the "Projects" title row, so it reads as the list's own setting rather than a filter. Tapping
one sets `ui.projectView` (`set-project-view` in js/app.js), saves it to
`focusdeck-project-view` (try/catch, like every other per-device key) and repaints; on a phone the
drawer stays open afterward, so the person sees the view change take effect behind it rather than
losing it back into a closed drawer. Before anything is stored, `resolveProjectView(stored, isWide)`
(js/project-filter.js, pure, tested) picks the default from the width at load — "All" from 1100px,
"One" below — the same defaults PR 4/PR 5 hard-wired to the breakpoint; once a device has a stored
choice, that choice holds at every width from then on. `ui.projectView` is resolved once, at `ui`'s
creation, not every paint — unlike `ui.selectedProjectId`, which really does need re-resolving each
time against the live project list.

Minimising is back for this PR: the per-project minimise button (`toggle-project-collapse`, ▾/▸,
`aria-label` "Minimise project"/"Expand project", `aria-expanded`) and `[data-action="toggle-collapse-all"]`
("Collapse all"/"Expand all") show in the "All" view, at every width, using the same saved
per-device flags PR 4 introduced and PR 5 left in storage unused (`ui.projectCollapsed`,
`focusdeck-collapsed-projects`) — nothing about that storage changed. Both are left out of the
markup entirely (not just hidden by CSS) in the "One" view, since minimising the one card on screen
does nothing useful; `renderProjectCard` also stops applying the saved flag there, and never writes
it, so the shown card always renders expanded whatever the flag says.

- **"All" view, >=1100px: 2x2 tiles (Q26a, #82), minimised projects gathered below.** A sticky left
  column, 270px wide, that scrolls on its own when it's taller than the window. `.wrap` widens to
  1800px (the 760px base rule is the one the style contract checks). The main column shows the focus
  card, Unsorted, then the non-minimised visible projects as tiles, two columns
  (`.projects-grid`), every tile exactly the same height regardless of how many tasks it holds.
  `.view-all .projects-grid`'s `grid-auto-rows` is `max(320px, calc((100dvh - var(--topbar-h, 64px) -
  16px) / 2))` — half the space below the sticky topbar, with a 320px floor for a narrow-ish wide
  screen — applied to every row, not just the first, so a project continuing below the fold stays
  level with its row-mate too. `--topbar-h` is a real measured height, not a guess:
  `updateTopbarHeightVar()` (js/app.js), called on load and window resize, sets it from
  `.topbar`'s `offsetHeight`, the same measurement `scrollToProject`'s own scroll offset already
  relied on, since the topbar's height varies with width and content. (`.project-card`'s own
  `margin-bottom` is zeroed at this width — `.card`'s base rule sets one, and left alone it stacks
  on top of the grid's own row gap, doubling the visual gap between rows.)

  Minimised projects are left out of that grid by `renderProjectsMain` (js/render.js, pure, tested)
  and gather below it instead, in a `.minimised-projects` group under a quiet Fraunces-italic "Minimised"
  label (a bare `<h4>`, already styled like `.group-label`'s "In progress"/"Up next" — no extra CSS
  needed), as their own `.minimised-grid`, two to a row, in the same sort order. A minimised project
  is a header-only card: `renderProjectCard` omits `.project-body` outright when `ui.projectCollapsed`
  is set, so line 1 (name, controls), line 2 (badges) and the progress bar are all that renders — a
  minimised tile left in the main tile grid would sit beside a full-height one and reopen #82's gap,
  which is why it's a separate group rather than a dense-packed grid cell. Expanding a minimised
  project (or minimising a full one) moves it between the two groups at its sort position on the next
  repaint.

  Inside a full (non-minimised) tile, the header, badges line, Edit panel and progress bar stay put
  at the top; the task groups, the "+N done" toggle, the done group, "Nothing open…" and "+ Add task"
  all sit in `.project-body` (js/render.js), a `flex:1; min-height:0; overflow-y:auto` region at this
  width (`.view-all .project-card:not(.is-collapsed) .project-body`) — a `.project-card` can't grow
  to fit its own content any more, so this is what scrolls instead, independently of the page and of
  every other tile. Everything else in the tile has `flex-shrink:0`: without it a long list (55
  tasks) squashed the badges line and the progress bar, putting that tile's bar 4px off its
  neighbours' (#83 again). A 1px rule at the bottom of `.project-body` marks where the tile ends, so
  a row cut off by the tile's edge reads as scrollable rather than broken. It's `tabindex="0"
  role="region" aria-label="<project name> tasks"`, so it's keyboard-reachable and named for a screen
  reader even though it has no visible heading of its own. Opening a row's editor or a project's
  "+ Add task" line calls `scrollOpenedFormIntoView` (js/app.js) after the repaint, which does
  `.scrollIntoView({block:'nearest'})` on the new form — inside the tile's own scroll, not the
  page's, since `block:'nearest'` only moves the nearest scrolling ancestor that needs to. The focus
  picker's label cards still fill the row (`auto-fill`, 190px minimum) — that didn't change.

  A sidebar row (`scroll-project`), the focus card's project chip, and any other `scroll-project`
  source (`scrollToProject`/`afterProjectAdded` in js/app.js) branch on `ui.projectView`, not the
  width: in "All" they expand the clicked project first if it's minimised (there'd be nothing to
  scroll to see otherwise, restoring the same expand-then-scroll `scrollToProject` did before PR 5),
  then scroll the main column so the project's card/tile top sits below the sticky topbar. There's
  no selection state at all in "All" — `renderProjectSidebar` only ever adds `.is-selected`/`aria-current`
  to a row when `ui.projectView === 'one'` — since there's no "current" project once every one shows
  as its own tile or stacked card.

- **"All" view, <1100px: every project stacked at its natural height.** The main column shows the
  focus card, Unsorted, then every visible project's card, one column, at whatever height its own
  content needs — the fixed-height tile machinery above is scoped to `.view-all` inside the
  `min-width:1100px` media query, so none of it applies here. A minimised project just shows
  header-only right where it sits in the stack (the same `renderProjectCard` collapsed rendering the
  wide tile group uses) — there's no separate group to gather it into on a single column.

- **"One" view, any width (Q28, Q23a, #82): only the selected project's card, full width.** Every
  card is still rendered into the same `.projects-grid` the "All" tiles/stack use; CSS just hides
  every `.project-card` except `.is-selected` (`.view-one .project-card{display:none;}
  .view-one .project-card.is-selected{display:block;}`, unscoped by width — PR 6 made "One" available
  from 1100px too, where PR 4/PR 5 only offered it below it). `[data-action="toggle-collapse-all"]`
  and the per-project minimise button are left out of the markup entirely here (`collapseAllButton`,
  `renderProjectCard`, both js/render.js) — collapsing the one card shown does nothing useful.

  Selection lives in `ui.selectedProjectId`, resolved every paint by `resolveSelectedProject`
  (js/project-filter.js, pure and tested): the id persisted per device
  (`focusdeck-selected-project`, read/write wrapped in try/catch exactly like
  `focusdeck-focus-filter`) if that project still exists, else the project with the most open tasks
  (ties keep the caller's current sort order, since `Array.sort` is stable), else `null` when there
  are no projects. It's resolved against *every* project, not the search/category-filtered list, so
  the open project stays open even if a filter would hide its sidebar row.

  `scrollToProject`/`afterProjectAdded` select the clicked/added project (`ui.selectedProjectId`,
  saved to `focusdeck-selected-project`) and then scroll the main column so its card's top sits below
  the sticky topbar, on a phone closing the drawer first. The selected row gets `.is-selected` and
  `aria-current="true"` in the sidebar/drawer. The selected card always shows expanded, for the same
  reason minimising is left out of its markup: `renderProjectCard` ignores the project's collapsed
  flag whenever `ui.projectView === 'one'`, and never writes it there.

**The drawer itself: nothing changed here.** Below 1100px it's still hidden off-canvas
(`transform:translateX(-100%)`, then `visibility:hidden` once it has slid away, so keyboard and
screen-reader users can't land in a closed drawer) until opened from the **Projects** button in the
topbar (`#projects-btn`, hidden itself at >=1100px). Opening it (`toggle-projects-drawer` in
js/app.js) slides it in from the left over a dim backdrop (`.drawer-backdrop`) and moves focus to
the drawer itself — not its search box, which would raise the phone keyboard over the list; tapping
the backdrop, pressing Escape, or tapping a project row (`scroll-project`, which also closes it and
scrolls to the card) closes it and returns focus to the Projects button (`setProjectsDrawerOpen` in
js/app.js) — tapping the view switch itself is the one exception, which leaves the drawer open (see
above). `ui.projectsDrawerOpen` holds the open state — not persisted, not saved. The `<aside>`
carries `aria-label="Projects"` and, only while open, `role="dialog"` and `aria-modal="true"` (the
wide-screen sidebar is not modal); the button carries `aria-expanded`/`aria-controls`, kept current
by `paintHeaderControls` since the button lives outside `#app`.

**Add a project or a repo: the "+ New" panel (Q29a, PR 7 2026-09-28).** A small accent
`.link-btn`-style "+ New" button always sits in the sidebar/drawer's header row, next to the visible
count — never inside the scrolling list, so it can't scroll out of sight (the problem the old bottom
field had, per the 2026-09-28 Decisions.md entry). It carries `aria-expanded`/`aria-controls="new-panel"`
and toggles a panel (`renderNewPanel`, js/render.js) directly under the header, above the All/One
switch. This replaces PR 4's single bottom field (`renderAddProjectField`, gone) and, before that,
the two forms (`renderAddProjectForm`) at the bottom of the page.

The panel is a two-option segmented control, the same pill style as the All/One switch:

- **New project** — a name field and Add, straight to `M.addProject(name, null)` — no category;
  set one afterward through the project's own Edit panel, same as before. Adding closes the panel
  and runs `afterProjectAdded` (selects the new project in "One", or scrolls to its tile/card in
  "All" — the same `ui.projectView` split `scrollToProject` uses, PR 6).
- **GitHub repo** — with no token, just a line: "Connect GitHub in Settings to add repos." No token
  means no repo picker, no Create, nothing else in the tab. With a token:
  - **Your repos** — fetched once when the tab first opens (`listYourRepos`, js/github.js: `/user/repos`
    with `affiliation=owner,collaborator,organization_member`, so a repo you collaborate on or reach
    through an org shows up too, not just ones you own), cached in `ui.newPanelRepos` until the panel
    closes. `untrackedRepos` (js/github-sync.js, pure, tested) narrows it to repos no project tracks
    yet and drops ones in `state.excludedRepos` (see doc-ref 17bf docs/4-systems/github-sync.md).
    More than 8 repos gets a filter box (`.repo-filter`). Each row shows the full name, a "Private"
    chip, and a **Track** button straight to `addRepoManually` — the same path the old bottom field's
    repo side used.
  - **Paste** — `owner/repo` or a URL, same `addRepoManually` path; `parseRepoInput`'s rejection
    shows inline (`.field-error`), not in the toast (see the 2026-09-28 PR 7 Decisions.md entry for
    why every result here is inline, not toast).
  - **Create a new repo on GitHub** — a `<details>` disclosure: name (validated to GitHub's allowed
    characters before the request goes out, `isValidRepoName`/`REPO_NAME_RULE`, js/github-sync.js),
    a Private checkbox (checked by default), an optional description, and Create
    (`createRepoAndTrack`: POSTs `/user/repos`, then tracks the result through the same
    `addRepoManually` path). Needs a token with **Administration: Read and write** (settings.html
    says so); a 403/404 shows "GitHub refused: your token needs Administration: Read and write to
    create repos. See Settings." plus GitHub's own message, a 422 shows GitHub's message as-is.

Escape inside the panel closes it and returns focus to "+ New" (`#new-panel-toggle`, `closeNewPanel`,
js/app.js), and only the panel: the handler stops the key there, so on a phone the drawer it sits
in stays open (the drawer's own Escape handler listens on `document`).

**Linking a hand-made project to a repo (Q30c, PR 7).** A project that isn't GitHub-backed gets a
"Link to GitHub repo" row in its Edit panel, opening the same repo picker (Your repos + Paste, no
Create) inline, right there (`renderLinkRepoPanel`, js/render.js; state in the shared `ui.linkPanel`
slot, see the 2026-09-28 PR 7 Decisions.md entry for why it's one slot, not one per project). Picking
or pasting a repo goes through `linkProjectToRepoOnGithub`/`linkProjectToRepoByInput`
(js/github-sync.js): it refuses inline, naming the project already tracking it, or turns this
project into a repo project in place — same id, name, colour, category, and every hand-made task
untouched (still `source:'manual'`, unlinked) — and pulls the repo's issues in as new tasks. A
project already tracking a repo shows nothing new here (unlinking is out of scope). Its badges then
read "GitHub ↗" / "Private · GitHub ↗" exactly like any other repo project — `renderProjectCard`
doesn't distinguish how a project came to have `source:'github'`.

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

A row (`renderTaskRow`, js/render.js) is three things in a grid
(`grid-template-columns:auto minmax(0,3fr) minmax(0,1fr)`, css/app.css `.task-row`): the checkbox,
the title zone (`.task-title`, the `role="button"` span), and the chips zone (`.task-chips`,
holding the priority chip, then label chips, then the deadline chip; the priority chip still
cycles on tap). The row is a grid, `auto minmax(0,1fr) fit-content(var(--chips-max))`, the same at
every width and in every view, done rows included. The chips column is only as wide as its chips
need, up to a ceiling: one short chip takes little room, several sit side by side and wrap into a
small right-anchored block (`justify-content:flex-end`). The ceiling, `--chips-max`, is set on each
row from its title's length by `chipsMaxPct` (js/render.js): half the row for a title up to 30
characters, easing down to a third for long ones, so a long title keeps most of the row. The title
takes everything else and wraps inside it (`overflow-wrap:anywhere`). Neither column ever enters the
other's. A chip still too long for the column is cut with an ellipsis and carries its full
(displayed) name in `title` and `aria-label` (it is also in full in the row's editor).

*2026-09-28 (PR 8, #97, #92):* this replaced PR 4's wrap-under rule, where the title and chips sat
in one wrapping group (`.task-main`, now removed) and a long title took the whole line and pushed
its chips underneath. A fixed 75/25 split came first the same day; the user found it too cramped on a phone (a chip column about 80px wide stacked chips one per line and cut longer ones) and asked for it to scale with the text and the number of chips, which is the rule above.

No `#N` GitHub badge, no
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

**Colour without right-click (#95, PR 10, 2026-09-28).** For phones, the Edit panel also has a
"Colour" row (a native `<input type="color" class="cat-color-input" data-color-for="project">`, the
same look as Settings' colour inputs) and, when the project has a category, a "Category colour" row
(`data-color-for="project-category"`). In the task editor's label picker each label option ends with
a small round swatch (`.cat-color-input.label-swatch`, `data-color-for="label"`); it sits inside the
option but tapping it does not toggle the checkbox. All three are wired by `onAppInput`/`onAppChange`
in js/app.js with Settings' split: `input` only previews (the card's `--proj-color`, or `--chip-color`
on every chip of that category on the page) and never repaints, because a repaint mid-drag closes the
native picker; `change` commits through the same mutations right-click uses (`setProjectColor`,
`setProjectCategoryColor`, `setCategoryColor`), so sync and the GitHub label push behave identically.
Right-click on the project dot and the chips is unchanged on desktop.

### Collapsed "+ Add task" (Q3b, PR 4 2026-09-27)

A project card ends with a single `.link-btn`-style "+ Add task" line (`open-add-task`) instead of
the form always sitting open. Tapping it opens the full form in place (title `autofocus`,
`ui.addingTask[projectId] = true`, not persisted — only one project's form is ever open, since
nothing clears another project's flag but nothing needs to: each card reads only its own). Adding a
task re-renders a fresh, empty, still-open form (autofocus re-fires on the new element), so adding
several in a row is one tap plus Enter each time. Cancel (`cancel-add-task`) or Escape while focus
is inside the form (`onAppKeydown`) collapses it back to the link.

### Dragging projects (PR 9, 2026-09-28)

Projects are put in order by hand. The gesture and its on-screen feedback live in
`js/project-drag.js` (pointer events, no library); the order itself is worked out by `moveProject`
(`js/project-filter.js:84`) and applied by `moveProjectTo` (`js/app.js:160`). See
`docs/4-systems/gist-sync.md#sortorder-a-projects-hand-made-position` for how it is stored and synced.

**Handles.** In the "All" view every project header carries a `.drag-grip` (first thing in
`.project-title`): a real `<button>` with `aria-label="Move <name>"` and a hand-drawn two-column,
six-stroke icon (`ICON_GRIP`, `js/icons.js`). It has `touch-action:none`, so a touch on it never
scrolls the page. It is 28px, 36px on coarse pointers. Minimised cards keep theirs. The "One" view's
single card has none: the list in the sidebar/drawer is the order there. Every sidebar/drawer row is
a handle as a whole; rows keep `touch-action:pan-y`, so a swipe still scrolls the drawer.

**Mouse and pen.** A drag starts once the pointer has moved more than 4px with the button down, so
a plain click on a row still selects/scrolls (the click that follows a drag is swallowed). **Touch**
starts after a 350ms press-and-hold without moving more than 8px (moving sooner is a scroll and
cancels the pending drag); once it has started a non-passive `touchmove` handler stops the page from
scrolling, the pointer is captured, and the phone gives a short vibration where supported. The
long-press context menu is suppressed while pending or dragging.

**While dragging.** The dragged item follows the pointer as a lifted ghost (a clone with
`.drag-ghost`, the only thing in the app that gets a shadow); its place shows as a dashed
`.drag-placeholder`; and a `.drop-indicator` line (accent colour) shows where it will land among the
same kind of items: tiles among the tiles (a vertical bar between columns), minimised cards among
the minimised, rows among the rows (horizontal). Dropping in the same place shows no indicator and
does nothing. Near the top or bottom edge (70px; the top edge sits below the sticky topbar) the page
auto-scrolls, faster nearer the edge; dragging a sidebar row scrolls the sidebar/drawer when that is
what overflows. Escape or `pointercancel` aborts with no change and no save. A repaint that arrives
mid-drag (a sync landing) waits until the drag ends.

**Drop.** The new index among the displayed group goes to `moveProject`; if the order changed the
sort menu switches to "Custom order" (`ui.projectSort = 'custom'`, remembered per device in
`focusdeck-project-sort`), it saves and repaints. Picking another sort later leaves `sortOrder`
alone, so choosing Custom again brings the hand-made order back. Custom applies everywhere the
order shows: tiles, minimised group, stacked cards, the One view's list and the sidebar.

**Keyboard.** With a grip focused, ArrowUp/ArrowLeft move the project one place earlier and
ArrowDown/ArrowRight one later (in the displayed order of its group); focus stays on the grip
across the repaint, and a polite live region (`#drag-live`, in `index.html`) says "<name> moved to
position 3 of 11". At an end it says the project is already first/last. On a sidebar row it is
Alt+ArrowUp/Down (`aria-keyshortcuts` on the row).

**Filtered lists.** Dragging inside a searched or category-filtered list puts the project next to
its visible neighbour; projects hidden by the filter keep their own positions.

### Dragging tasks

Single tasks are moved by hand (PR 11, 2026-09-28): within their group, into the other group, and into other projects.
The gesture is `js/project-drag.js` again (one module, a `task` kind beside `card` and `row`); where
a task lands is worked out by `taskOrderChanges` and what a cross-project move means for GitHub by
`planTaskMove` (both pure, `js/task-move.js`); `moveTaskTo` (`js/app.js`) applies them through
`applyTaskMove` (`js/mutations.js`). See `docs/4-systems/github-sync.md#moving-a-task-to-another-project`
and `docs/4-systems/gist-sync.md#task-sortorder-and-a-task-moving-between-projects`.

**Handle.** Every open task row, in every view, starts with a `.task-grip`: a real `<button>` with
`aria-label="Move <title>"`, `ICON_GRIP` scaled to 13px (15px on coarse pointers, where the button is
30px), `touch-action:none`. Done rows have none and don't drag. Tapping the title still opens the row
editor; an editing row has no grip.

**Gesture.** The same rules as projects: mouse and pen after 4px, touch after a 350ms press-and-hold on
the grip (a quick swipe starting on the grip does nothing), a ghost (`.drag-ghost.is-task`), the dashed
`.drag-placeholder` on the original row, a `.drop-indicator` line between rows, Escape or
`pointercancel` aborts. Auto-scroll: the page near its top/bottom edge, and, when the pointer is over a
tile's own scroll area (`.project-body`) near its top or bottom edge with room to scroll that way, that
area first.

**Targets.** The card under the pointer is the project. On an open card the task group under the
pointer (or the nearest one on that card) is the group, and the slot is the number of the group's other
rows whose middle is above the pointer. A minimised card takes the task at the top of its "Up next"
when dropped anywhere on it (it outlines in the accent colour). Both groups always render
(`data-group="doing"|"next"`); an empty one is hidden until a task is being dragged
(`body.is-dragging-task`), then shows a dashed "Drop here" zone (accent when it is the target). That
appears when the drag starts, so rows below it shift down by the zone's height. In the "One" view only
the shown project is a card, so only it is a target; the sidebar is not a target for tasks. Dropping in
the same place shows no line and does nothing.

**Groups and status.** "In progress" and "Up next" render in ascending `sortOrder`. Dropping into the
other group of the same project changes the status (`doing`/`next`) through `setTaskStatus`, so it
behaves as any status change; into another project the status is set directly (the move is not a
completion change, and it must not PATCH the old repo's issue). Done tasks keep their order.

**Keyboard.** On a focused grip, ArrowUp/ArrowDown move the task one place in its group and cross into
the neighbouring group at the ends (Up next's top to In progress's bottom, and back). Focus stays on
the grip, and the live region says "<title> moved to In progress, position 2 of 4" (or "<title> is
already first/last"). Moving to another project is drag only, by design.

**Confirmation.** A move that touches GitHub asks first, in `js/move-dialog.js`: a small modal card
(`.move-dialog`, `--r-control`, accent **Move**, quiet **Cancel**) appended to `<body>`, so a repaint
can't remove it. Focus goes to Cancel (Enter cancels), Tab cycles the two buttons, Escape or a click
outside is Cancel, and focus returns to the task's grip. The markup is `renderMoveDialog`
(`js/render.js`). Offline targets and moves within a task's own repo never ask.

**Checked in real Chromium** (1440x900 tiles and 390x844 touch, GitHub stubbed with `page.route`):
screenshots in `docs/generated/pr11/`.

## Invariants

- A task row's title and chips never overlap, no chip leaves `.task-chips` or the row, and the chips
  column is never wider than half the row. Checked in real Chromium in PR 8 (every visible row at
  390, 1440 and 1920 wide, both views); markup order and `chipsMaxPct` are asserted in
  `js/render.test.mjs`.
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

- A minimised project (`ui.projectCollapsed`) never sits in the same `.projects-grid` as the
  non-minimised tiles in the "All" view at >=1100px — it renders into the separate
  `.minimised-grid` group instead (`renderProjectsMain`, js/render.js). Mixing the two back into one
  grid reopens #82's gap: a header-only card next to a full-height one leaves the grid's row height
  wrong for one of them. (PR 6, 2026-09-27.)

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
