# Decisions

A running, append-mostly log of what was decided, when, why, and what it replaced. Newest entry
at the top. Entries are never rewritten or deleted; the one allowed edit is flipping a `Status`
line to `Superseded` when a later entry replaces it.

## 2026-09-30 — Claude provenance comes back as an icon after the title, not a chip (#104)

**Context.** The 2026-09-26 redesign cut the "Claude created"/"Claude completed" chips, so nothing on
a task row said which tasks Claude opened. That matters again now that Claude opens a parent issue
per plan and a child per step (Ajw2003/AjsClaudeCodeTools#107).

**Decision.** A four-point spark after the title for `claudeCreated`, and a ringed tick beside it for
`claudeCompleted` on a done task. After review the same day, a neutral "Claude created" chip was
added to the chips column as well, so the label renders like the other labels (the user's ask); the
icons stay. No chip for `claudeCompleted`. The chip is drawn from the flag, not a category, because
the label is reserved. Both are 14px, faint, with a tooltip and `aria-label`, inside
`.task-title`. The issue offered "icon beside the title" or "chip in the chips column".

**Why.** An icon in the title zone leaves the chips column, `chipsMaxPct` and the long-row wrapping
untouched, where an extra chip would have competed with labels for a column that is already the
crowded part of the row. The redesign removed chips precisely because they crowded; an icon is the
quietest thing that still answers "who opened this?" at a glance. The tick is a second icon rather
than a colour change so it reads on a struck-through done title.

**Status.** Standing. Mechanism: `docs/4-systems/claude-integration.md#where-the-marker-shows`.

## 2026-09-28 — Calls made while building task dragging (PR 11)

**Context.** The two entries below fixed the design (drag tasks, the GitHub moves and their messages,
no message for offline projects); these are the interpretation calls.

- **Order is per project, per record.** `sortOrder` is numbered per project (not per group), so a
  task changing group keeps a sensible number; a move writes only the moved task's number
  (`positionBetween`), like projects. Done tasks keep array order.
- **Both groups always render.** So a task can be dropped into an empty "In progress" or "Up next";
  an empty group is hidden until a task is dragged, then shows "Drop here". The cost: rows below it
  shift down when the drag starts.
- **Status on a cross-project move is set directly**, not through `setTaskStatus`: that would PATCH
  the old repo's issue open, and a move is not a completion change. Within a project it does go
  through `setTaskStatus`, as the brief asked.
- **The move happens in Focus Deck first, then GitHub is asked.** So a refusal (or a network failure)
  leaves the task where the person dropped it, with its old link (transfer) or unlinked (create), and
  a toast that says why. Cancel never moves anything.
- **The dialog defaults focus to Cancel**, so a stray Enter cancels rather than creating or
  transferring an issue.
- **A move stamps the task** (`updatedAt`) and the Gist merge keeps the newest copy of a task id
  wherever it lives (`dedupeMovedTasks`); an edit made on another device after the move therefore
  puts the task back in that device's project (last write wins). Chosen over tombstoning the old
  location, which would resurrect nothing but could delete a task under a slower device.
- **Sync matches issues to tasks across all projects** (`upsertRepoProject`), and closes a moved task
  wherever it lives, rather than remembering "moved out of" markers per project.
- **Keyboard moves are within one project only**, by the brief; a move to another project is drag only.
- **The real `transferIssue` call was not run against GitHub**: it is tested against a stub of the
  documented REST/GraphQL shapes.

**Status.** Standing.

## 2026-09-28 — Calls made while building colour without right-click (PR 10, #95)

**Context.** The entry below fixed the design; these are the interpretation calls.

- The label swatch is a native colour input inside the label option, outside the checkbox's hit area, so
  tapping it never toggles the label. It previews on every chip of that label on the page.
- The tooltips ("Right-click to change color") were left as they are: still true on desktop, and
  no shorter wording fits a tooltip that only touch users would miss.
- `cssColorToHex` returns a `#rrggbb` input as is and `#888888` when there is no DOM, so the render
  tests can run in Node.

**Status.** Standing.

## 2026-09-28 — Task dragging split into two PRs

**Decision.** The PR planned as "PR 11 (tasks: dragging, moving between projects, selecting several
tasks and projects)" in the entry "Dragging tasks, selecting several, and colour on phones" is
built as two: PR 11 drags single tasks within a project and into other projects, with the GitHub
moves and their messages; PR 12 adds selecting several tasks or projects and dragging them
together. Dropping a task into a project's other group (In progress / Up next) changes its status
to that group's; done tasks don't drag.

**Why.** Each half is large on its own, and the GitHub moves (transfer, create-and-link) need
their own careful check. The status-by-group rule is the natural meaning of dropping a task under
"In progress", and was told to the user when announced.

**Status.** Standing.

## 2026-09-28 — Dragging tasks, selecting several, and colour on phones (Q32a, Q33b, #95)

**Context.** Asked while PR 9 (dragging projects) was being built. The user wants tasks draggable
within and between projects (#73, #7), several tasks or projects selected and dragged together,
and a way to set colours on a phone, where there is no right-click (#95).

**Decision.**
- Selecting several: Shift-click adds or removes an item; dragging a box over empty space selects
  what it touches; the selection then drags as one. On a phone, press and hold an item to start
  selecting, then tap others to add or remove them (Q32a). Applies to tasks and to projects.
- A task dragged into another project moves there. A GitHub-linked task dropped into a
  GitHub-connected project also moves its issue to that project's repo on GitHub (Q33b), but
  first a message says exactly what will happen on GitHub and offers Cancel. Moves into or within
  a project with no GitHub repo never show a message (the user: "Offline projects should never
  warn you"): a linked task moved there keeps its issue link. A hand-made task dropped into a
  GitHub-connected project gets a new issue created in that repo and is linked to it, after the
  same message with Cancel (corrected by the user 2026-09-28; my first reading left it unlinked).
  GitHub can only transfer an issue between repos with the same owner; for any other pair the
  message says so and the task moves in the app only, keeping its link (confirmed by the user).
- Colour on phones (#95): each project's Edit panel gets its colour and its category's colour,
  and the task editor's label list gets a colour swatch per label. Right-click keeps working on
  desktop; Settings keeps its colour lists.

**Order.** PR 9 (dragging projects, in progress), then PR 10 (colours on phones, #95, small), then
PR 11 (tasks: dragging, moving between projects, selecting several tasks and projects).

**Status.** Standing. Both edge cases confirmed with the user on 2026-09-28.

## 2026-09-28 — Calls made while building drag-to-reorder (PR 9), beyond the entry below

**Context.** Building PR 9 hit four cases the entry below doesn't settle.

**Decision.**
1. *The first drag from another sort re-numbers the group.* A project's number only means something
   in Custom order. If the person drags while the screen is sorted by Name (or any other sort),
   placing one number between two neighbours would put the project somewhere they didn't drop it.
   So in that one case the displayed projects take each other's existing numbers in the order on
   screen (`moveProject`, js/project-filter.js), and Custom matches what they saw. Every later drag
   in Custom changes exactly one record. Hidden projects are untouched.
2. *The sort choice is now remembered per device* (`focusdeck-project-sort`). It used to reset to Name
   on every load; a drag that switched to Custom would have looked lost after a reload.
3. *A drop lands right next to the neighbour on the side it was dropped,* not halfway to the neighbour
   on the other side, so projects hidden by a filter keep their positions and a new number can never
   equal a hidden project's. A gap under 1e-6 renumbers everything 1..n.
4. *The drag gesture is its own module* (`js/project-drag.js`), added to the service worker's shell list
   (cache name bumped to v14); app.js only supplies "move this project to that index".

**Why.** 1 is the only way to keep "the order I saw is the order I get". 2 follows from the required
"reload keeps it". 3 and 4 are small and keep the design's promise of one changed record per move.

**Status.** Standing.

## 2026-09-28 — How dragging projects works (PR 9)

**Context.** The user asked for dragging projects into order (#73, Q27a) after PR 8. They gave the
goal, not the mechanics; these are the calls made, told to the user before building.

**Decision.** Drag handles: a grip on each tile header and each sidebar/drawer row; touch starts
a drag on press-and-hold; the grip also takes arrow keys. A drag switches the sort to a new
"Custom" option; the custom order is kept when another sort is picked. Each project carries its
own position (`sortOrder`), and a move changes only the moved project's position (placed between
its new neighbours), so the per-record newest-wins Gist merge carries it without special code and
two devices reordering different projects don't overwrite each other. New projects go to the end.

**Why.** One changed record per move is what the existing merge handles well; rewriting a whole
order array on every move would make the last device to sync win every project's position.

**Status.** Standing.

## 2026-09-28 — Task row chips column scales with its chips, not a fixed 25%

**Context.** PR 8 first built #97 as a fixed 75/25 split. On a phone the 25% column was about
80px: chips stacked one per line and longer ones were cut. The user asked for it to "scale with
text and scale such that multiple category pills can be stacked or sit beside each other ...
dynamically with text amount and category amount".

**Decision.** The chips column is `fit-content` up to a per-row ceiling: as wide as its chips
need, several side by side, never more than half the row, and the ceiling eases down to a third
as the title grows (`chipsMaxPct`, js/render.js: 50% up to 30 characters, minus 1% per 3 more,
floor 33%). The title takes the rest. Neither enters the other's column; an over-long chip is
still cut with an ellipsis, full name in `title`/`aria-label`.

**Why.** "Scale with text amount" needs the title's length in the rule, which CSS can't read, so
the row carries its ceiling as `--chips-max`. The numbers were checked on every row in real
Chromium: one chip takes 3-16% of the row, seven chips spread to half, a long title with four
chips keeps 55-61%.

**Status.** Standing. Supersedes the "empty 25% on chipless rows" half of the entry below (a
chipless row's title now takes the whole width); its ellipsis half stands.

## 2026-09-28 — Task row zones: ellipsis for over-long chips, empty 25% on chipless rows

**Decision.** "Never let either exist outside its zone" (#97, #92) is taken literally. A label chip
too long for the 25% zone is cut with an ellipsis and carries its full displayed name in `title`
and `aria-label` (this replaces the chip's old "Right-click to change color" tooltip). A row with
no chips keeps the 25% zone empty, so a long title wraps inside its 75% instead of using the space.
**Tier.** Systems (`docs/4-systems/styling.md`, "Task rows and the editor").

## 2026-09-28 — PR 7 interpretations ("+ New" panel)

**Context.** The 2026-09-28 "+ New" panel decision above left a few implementation calls open.

**Decision.**
- `untrackedRepos` drops repos in `state.excludedRepos` from "Your repos", not just already-tracked
  ones: that list means "the user removed this repo as a project" (`excludeRepo`, js/mutations.js),
  so surfacing it in the picker would invite tracking it right back the moment it was dropped.
  Pasting the same `owner/repo`, or using **Create**, still works regardless (both un-exclude on
  success, unchanged from `addRepoManually`'s existing behaviour).
- `listYourRepos()` reads one page (100 repos, `/user/repos` with
  `affiliation=owner,collaborator,organization_member`) and doesn't follow further pages: `ghFetch`
  doesn't expose response headers, so reading the `Link` header would need its own change there.
  Noted as a known cap rather than built around.
- Every result and error in the "+ New" panel and the Edit panel's inline chooser shows inline (a
  paragraph in the panel), not the toast: the panel already carries its own error slots (paste,
  create), and a person adding several repos in a row shouldn't have each one's outcome sitting in
  the one pinned toast instead of next to the field they just used. `addRepoManually`'s own
  `ui.syncError` (used when Track/Paste hits a network error) is read once and moved into the
  panel's own field before the next paint, rather than shown as a toast too — one place per error,
  not two.
- The Edit panel's inline repo chooser keeps its state in one shared `ui.linkPanel` slot
  (`{projectId, open, repos, error}`), not one per project: only one project's Edit panel is
  realistically open with the chooser open at a time, and a second `toggle-link-panel` just replaces
  it. Simpler than a per-project map for no real loss.

**Why.** Each call follows the same rule: keep the person's most recent, most specific action
in view (the field they're looking at, the repo they just excluded) rather than a general
history or a farther-away notice.

**Status.** Standing.

## 2026-09-28 — Adding projects and GitHub repos gets a "+ New" panel

**Context.** After PR 6 (#86) the user found no way to add a GitHub repo or link an existing one.
The only way in was PR 4's "New project or owner/repo" field at the bottom of the project list:
its placeholder didn't say repos went there, and after PR 6 sized the sidebar to fit the screen
the field sat below the fold at 900px tall (measured: field top 805px, visible list ends 818px).
Creating a repo on GitHub (#39) and linking a hand-made project to a repo had never existed.

**Decision.**
- Q29a: a "+ New" button in the project list's header (sidebar and drawer) opens a panel with
  **New project** and **GitHub repo**. The single bottom field goes.
- Q30c: both kinds of linking. **GitHub repo** lists the user's repos that no project tracks yet
  (one tap to track) and takes a pasted `owner/repo` or URL. A hand-made project's Edit panel gets
  **Link to GitHub repo**: the repo's issues come in as tasks in that project, its hand-made tasks
  stay unlinked, and a repo another project already tracks is refused with a message naming it.
- Q31a: **GitHub repo** can create a new repo on GitHub (name, private by default, optional
  description) and track it straight away (#39's repo half). The token then needs Administration:
  Read and write; Settings says so, and a refusal from GitHub says so too.

**Why.** A picker beats typing `owner/repo`, and a header button can't scroll out of sight. The
alternative, keeping one field but moving it to the top, would still not say what it's for.

**Status.** Standing.

## 2026-09-27 — PR 6 interpretations (All/One switch, minimising back)

**Context.** The task for PR 6 ("Minimising comes back; 'All' or 'One' becomes a per-device
switch") left one call explicitly open: "on phones, keep the drawer open after switching (so the
user sees the change behind it) — your call if closing reads better." Everything else it asked for
(the switch's wording, placement, and pill styling; the resolver function's shape; where minimised
tiles gather) was specified closely enough that building it isn't a separate decision.

**Decision.** The Projects drawer stays open after tapping "All" or "One" in it
(`set-project-view` in js/app.js does not call `setProjectsDrawerOpen(false)`).

**Why.** Closing the drawer on every other row tap makes sense there because the point of tapping
a project row is to go look at it, off in the main column, where the drawer would only be in the
way. Tapping the view switch is different: its whole effect plays out in the list the switch itself
sits in (fewer/more cards, tiles turning into a stack or back), so closing it would hide the very
change being confirmed and cost an extra tap to reopen and see it. It also matches how every other
setting in the same header behaves — search, category pills and sort all repaint in place without
closing the drawer.

**Status.** Standing.

## 2026-09-27 — Minimising comes back; "All" or "One" becomes a per-device switch

**Context.** After PR 5 (#85) the user found multi-project work "a nightmare" without minimising:
PR 5 had hidden the per-project minimise button and Collapse all at both widths (an
interpretation, not the user's call). The user also wanted the tile view and the
one-project-at-a-time view as a choice on every device, not fixed by screen width.

**Decision.**
- Minimising is back: the per-project button and Collapse all / Expand all, using the saved
  per-device flags PR 5 kept (nothing was lost). They show in the "All" view; in the "One" view
  they stay hidden, since minimising the only project on screen does nothing useful.
- In the wide-screen tile view, minimised projects gather below the full-size tiles as a compact
  group of header-only cards, two to a row, in the same sort order. A minimised tile left in its
  grid cell would sit beside a full-height one and bring back #82's gap.
- A two-option switch, "All" / "One", in the project list's header (the sidebar on wide screens,
  the drawer on phones), remembered per device. "All" on wide screens is the 2x2 tiles; "All"
  below 1100px is every project stacked at its natural height (tiles are too small on a phone).
  "One" is the one-project-at-a-time view with the Q23a starting project, on any width. Defaults
  keep today's behaviour: "All" from 1100px, "One" below.

**Why.** Both requests are the user's own, made after using the builds. Grouping minimised tiles
was chosen over leaving them in place (gaps, #82) and over a dense-packed grid (keeps no gaps but
shuffles the order, which would fight the drag-to-reorder PR next).

**Status.** Standing. Supersedes, in part, "Wide screens get 2x2 tiles; one project at a time moves
to phones" (the layout is now a switch, not a width rule; minimising is no longer hidden) and the
collapse items of "PR 5 interpretations".

## 2026-09-27 — PR 5 interpretations (2x2 tiles / one project at a time)

**Context.** The plan (`docs/plans/handcrafted-redesign.md`, "Wide screens: 2x2 tiles") specified
the tile height as "half of the space below the sticky topbar, e.g.
`calc((100dvh - <topbar height> - <gaps>) / 2)`, with a sensible minimum (~320px); measure the
topbar the same way `scrollToProject` does, or expose it as a CSS custom property set from JS on
resize, your call" and left a few other implementation calls open.

**Decisions.**
- **The topbar height is a JS-measured CSS custom property (`--topbar-h`), not a guessed
  constant.** `updateTopbarHeightVar()` sets it from `.topbar.offsetHeight` on load and on window
  resize; `css/app.css`'s tile-height `calc()` reads it back with a `64px` fallback. The plan
  offered either this or reusing `scrollToProject`'s inline measurement; a CSS variable was chosen
  because the tile height is a layout property every tile needs continuously, not a one-off scroll
  offset computed at click time — recomputing it via JS on every render would mean threading it
  through render.js's string-building for no benefit CSS doesn't already give for free.
- **The minimum tile height is exactly the plan's suggested 320px**, via `max(320px, calc(...))` —
  the plan called it "a sensible minimum (~320px)" without pinning a number; 320px was kept as
  literally suggested rather than picking a different one.
- **The wide-screen sidebar row carries no `.is-selected`/`aria-current`, which needed a new
  `isWide` argument on `renderProjectSidebar`.** The plan says explicitly "no selection state, no
  `aria-current` there" for >=1100px, but `js/render.js`'s functions are otherwise pure and don't
  know the viewport width (the CSS breakpoint alone decided visibility before this PR). Rather than
  leave a `.is-selected`/`aria-current` in the DOM at every width and rely on CSS to just not paint
  it differently (which would satisfy "no selection state" visually but not literally "no
  `aria-current`"), `renderProjectSidebar` takes an `isWide` boolean (from `isWideScreen()` in
  js/app.js) and only ever adds the class/attribute when it's false. This is the one place PR 5
  breaks from "the same markup renders both ways, switched purely by CSS" (see
  `docs/4-systems/styling.md`'s "How it works") — everywhere else (`.project-card.is-selected`
  itself, the tile/one-at-a-time hiding) still is.
- **The per-project collapse toggle and "Collapse all" are hidden unconditionally**, not scoped to
  either breakpoint with a media query, since the plan hides them at both of the app's only two
  widths — see the entry below.
- **A project's saved collapsed flag is ignored for every card now, not just the selected/tiled
  one.** With the toggle hidden everywhere, a flag saved before this PR (from a phone, under PR 3/4)
  could otherwise hide a tile's content with no UI left to undo it; `renderProjectCard` now always
  renders expanded, and nothing writes the flag any more (the storage and the now-unreachable
  `toggle-project-collapse` action are left in place, unused, rather than removed, since the plan
  asks only that it be hidden, not deleted).

**Status.** Superseded in part by [2026-09-27 — Minimising comes back; "All" or "One" becomes a per-device switch](#2026-09-27--minimising-comes-back-all-or-one-becomes-a-per-device-switch) on 2026-09-27.

## 2026-09-27 — Wide screens get 2x2 tiles; one project at a time moves to phones

**Context.** PR 4 (#84) made wide screens show one project at a time (Q22b), opening on the
last-viewed or busiest project (Q23a), to fix #82's gaps between grid rows. Using it on a desktop
the same day, the user wanted to see several projects at once and to drag them into order (#73),
which one-at-a-time rules out.

**Decision.** From 1100px, projects sit in two columns of equal tiles, each half the screen tall,
scrolling inside when their tasks don't fit (Q26a). Below 1100px, the one-project-at-a-time layout
with the Q23a starting project applies instead (Q28): the user judged it fits a phone better than
a desktop. Dragging projects into order follows as its own PR (Q27a).

**Why.** Equal tiles keep #82 fixed (no tile can be taller than its neighbour) while showing four
projects, and give a drag a steady grid to drop into. The rejected options: two columns at natural
height packed down each column (no gaps, but a 55-task project becomes very tall and the order
reads down columns), and two columns in rows (brings #82's gaps back). One-at-a-time survives
where screen space is scarce. Interpretations: tablets between 700px and 1100px count as phones
here (the app's one layout breakpoint is 1100px); on wide screens the per-project collapse toggle
and Collapse all are hidden, since a tile's height is fixed and collapsing one would break the grid.

**Status.** Superseded in part by [2026-09-27 — Minimising comes back; "All" or "One" becomes a per-device switch](#2026-09-27--minimising-comes-back-all-or-one-becomes-a-per-device-switch) on 2026-09-27. Replaced the wide-screen half of Q22b in
`docs/plans/handcrafted-redesign.md` (built in PR 4, #84).

## 2026-09-27 — PR 4 interpretations (control moves, one project at a time)

**Context.** PR 4 of `docs/plans/handcrafted-redesign.md` specified most of "the control moves"
precisely, but left a handful of implementation calls open.

**Decisions.**
- **The add field's repo-vs-name detection reuses `parseRepoInput` (js/github-sync.js)
  unchanged**, rather than writing a new regex: it's already exactly "owner/repo, or a
  github.com URL" (used by `addRepoManually` and `createGithubIssueFromTask`), so a second
  implementation of the same rule would just be a second place for the two to drift apart.
  `parseRepoInput(value)` truthy takes the track-repo path; falsy takes the add-project path with
  no category.
- **The project add-task form stays open after a submit, cleared and refocused**, rather than
  collapsing back to the "+ Add task" link. The plan asked for "fast entry"; collapsing after
  every single task would undo that for anyone adding several at once. `ui.addingTask[projectId]`
  is left `true` across the mutation, and the freshly rendered (empty) form's own `autofocus`
  attribute re-fires the same way `ui.editingTask`'s form already relies on across repaints.
- **The selected card on wide screens ignores its own `projectCollapsed` flag, but never writes
  to it.** Render-time only: `renderProjectCard` computes `collapsed = collapsedFlag &&
  !isSelected`, so a project minimised on a phone still opens expanded the first time it's
  selected on a wide screen, without silently un-minimising it for the next time it's viewed on a
  phone.
- **`resolveSelectedProject` resolves against every project, not the filtered/searched sidebar
  list.** The plan says search/category filtering "only filters the list; the open project stays
  open even if filtered out" — resolving against the full `st.projects` (not
  `filterAndSortProjects`'s output) is what makes that true, since a filtered-out id would
  otherwise look like it "doesn't exist" and fall back to the busiest project instead.
- **Tie-breaking in `resolveSelectedProject`'s "most open tasks" fallback** uses the stable sort
  already in `sortProjects('open-tasks')` against whatever order the caller passed in — the plan's
  "ties → first by current sort" is exactly what falls out of that without extra code, so no
  separate tie-break was written.

**Why.** Each of these fills a gap the plan left open rather than overriding anything it
specified; where the plan already gave an answer (e.g. the row's exact control set, the editor's
action row, the header's two-line shape), that answer was implemented as written.

**Status.** Standing.

## 2026-09-27 — Visual system interpretations

**Context.** PR 3 of `docs/plans/handcrafted-redesign.md` specified the visual system precisely
in most places, but left a few calls to the implementer's judgement, most centrally "project
colour is identity only."

**Decisions.**
- **Project pills are neutral, with a colour dot.** "Identity only" reads as: a project's colour
  may mark *which* project something is (the sidebar/drawer dot, a project card's top edge), but
  must not tint a control's fill or text the way a label's colour does. So the focus picker's
  project-scope pills, Unsorted's "Which project?" pills, and `.proj-chip` are plain,
  undifferentiated `.filter-pill`/`.chip` with a small `.proj-dot` in the project's colour before
  the name, and the *chosen* one gets the ordinary accent `.filter-pill.active` treatment — the
  same visual language any other chosen pill gets — rather than its own project-coloured active
  state.
- **Progress fill is `--ink-soft`.** With project colour reserved for identity, the per-project
  progress bar (`.progress-fill`, previously `--proj-color`) needed a neutral colour instead of
  disappearing or turning into another accent use. `--ink-soft` was chosen over `--accent` so the
  bar doesn't compete visually with the one accent colour now reserved for actionable buttons.
- **Label colour muting ratio.** `mutedChip()` (js/render.js) uses
  `color-mix(in oklab, <color> 65% var(--ink-soft))` — 65% of the raw GitHub hue mixed with
  `--ink-soft` — tuned against the plan's named colours (`#a2eeef`, `#fbca04`, `#7057ff`) so each
  reads as a calmer version of itself rather than desaturating past recognition, in both themes.

**Why.** Each of these turns "identity only"/"calmer" into a checkable rule instead of a matter of
taste applied inconsistently file to file, and keeps every colour use in the redesign traceable to
one of exactly two roles: accent (action) or identity (a dot).

## 2026-09-26 — Delete the energy system fully

**Context.** #48 (time-of-day suggestions) renewed the tension the "Priority and labels replace
energy levels in the UI" decision below had left open: `ENERGY_UI_ENABLED = false` kept the
energy UI switched off but not deleted, on the reasoning that the owner might want it back
"temporarily". Half a year on, nothing had turned it back on, priority and labels had fully taken
over the job energy used to do, and the redesign's cuts (PR 2 of `docs/plans/handcrafted-redesign.md`)
gave a natural point to settle it either way rather than carry the dead-looking-but-not-dead code
into the new visual system.

**Decision.** Delete the energy system fully: the `ENERGY`/`ENERGY_UI_ENABLED` constants and every
UI branch gated on them, the `energy`/`energyAuto` task fields (dropped silently on load — no
migration, nothing to migrate to), the `--energy-*` CSS tokens (a plain `--danger` token takes
over the one non-focus-picker use, `.btn-text.danger`/toast/delete-hover styling), the
`set-energy`/`surprise`/`cycle-energy` actions and their mutations, and the GitHub-label-to-energy
sync (`energyFromLabels`/`resolveIssueEnergy` in js/github-sync.js and the `js/complexity.js`
heuristic that backed it, which had no other caller). The `.energy-btn`/`.energy-grid`/
`.energy-label`/`.energy-desc` CSS classes stay — they're the focus picker's label cards and the
Unsorted flow's kind cards now, not energy UI.

**Why.** Keeping switched-off code "in case" only pays off if it actually gets switched back on;
this one didn't, and every day it sat there was a day #48 and any other work touching task shape
had to reason about `energy` fields that did nothing. Deleting outright, now, with a real feature
(priority + labels) already covering the job, costs less than the ongoing tax of the halfway
state.

**Status.** Standing. Supersedes the "Priority and labels replace energy levels in the UI" entry
below (see its own Status line).

## 2026-09-26 — Handcrafted redesign direction

**Context.** A question-and-answer session on the app's look and feel and its accumulated
duplicate controls, recorded in full in `docs/plans/handcrafted-redesign.md`.

**Decision.** Redesign direction: focus-first (the focus card leads, everything else is a
quieter reference area), phone and desktop weighted equally, and a "handcrafted" look defined as
warm editorial with a touch of notebook — Fraunces headings, one raised card (the focus card),
everything else flat with thin rules. Cuts: the energy system UI (already off via
`ENERGY_UI_ENABLED`), the "+ Priority" placeholder chip, the Recently done strip, the "Claude
created"/"Claude completed" chips, `migrate-from-artifact.html`, the sync row (replaced by a
top-bar icon), and the project-pills row plus filter bar (replaced by one project list with a
phone drawer). The work lands as four ordered PRs: (1) this docs restructure, (2) the cuts, (3)
the visual system, (4) the control moves (task rows open the editor, collapsed "+ Add task",
Remove/Add project relocated).

**Why.** Full reasoning per question is in `docs/plans/handcrafted-redesign.md`; recorded here so
the decision has a dated entry independent of the plan file, which will move to `docs/archive/`
once all four PRs land.

**Status.** Standing.

## 2026-09-26 — Priority and labels replace energy levels in the UI

**Context.** Tasks could hold one category, and the focus picker chose by Low / Medium / High
energy (README: "Energy-based, not priority-based"). In use, the energy tiers weren't useful
(issue #47), issues with several labels showed only one of them (e.g. PlunderSpell's "art",
"design" and "lighting" showed as just "art"), and there was no priority visible on GitHub.

**Decision.** The owner asked to switch the energy UI off for now and replace it with:
several labels per task (`task.categoryIds`, GitHub is the source of truth on sync); a
four-level priority (`urgent`/`high`/`medium`/`low`) that syncs as `priority: …` labels; and a
focus pick that chooses at random within a label and/or project (#43, #47). Energy is hidden
behind `ENERGY_UI_ENABLED` in `js/state.js`, and tasks keep their `energy` fields.

**Why.** Considered deleting the energy code outright. Rejected: the owner said "temporarily",
and keeping the data plus one switch makes turning it back on a one-line change. Considered
P0–P3 labels for priority. The owner chose `priority: <level>` labels with four levels; P0–P4
and similar labels are still read.

**Status.** Superseded by the "Delete the energy system fully" entry above (2026-09-26), which
deleted the `energy` fields and `ENERGY_UI_ENABLED` switch this entry kept around. Also supersedes
the "Energy-based, not priority-based" principle in the README.
---
## 2026-09-23 — Newest edit wins for every synced record, stamped automatically

**Context.** After the storage fixes deployed, colors, project categories, Unsorted discards,
removals and new issue links still didn't stick across close/reopen or reach other devices.
`mergeStates` only compared timestamps for tasks; everything else was "local copy wins", so the
device that pushed last overwrote the Gist, and a fresh device kept its default category colors
forever. Commit `2f9d1fd` (titled as a label-color fix) had replaced `js/mutations.js` with a
different draft, and the hand rebuild in `4bcf2dd` never stamped anything but tasks; issue
link/create/unlink didn't stamp tasks either. A two-device browser check of 18 user actions
failed 15 on the live code.

**Decision.** Every synced record kind (tasks, projects, categories, project categories,
Unsorted items) has `updatedAt` and a tombstone map; the repo lists are stamped as whole lists.
`saveStateLocal` stamps changes by diffing against the last loaded/saved copy (`stampChanges`),
so no code path has to remember. On a tie the remote copy wins. All 18 actions pass.

**Why.** Considered adding `updatedAt = Date.now()` to every mutation instead. Rejected: it's
exactly what was missed before (link/create/unlink, colors), and every future mutation would
have to remember it too. The diff catches any path, including ones that don't exist yet.

**Status.** Standing.
---
## 2026-09-22 — Churn guard reads every commit message in the pushed range

**Context.** Merging PR #18 failed the deploy's `test` job, so GitHub Pages kept serving the old
app, whose cache-first service worker (v11) kept running a `js/mutations.js` that writes
`"undefined"` over saved data. `scripts/guard-file-churn.mjs` diffs the whole pushed range
but read only the head commit's message. On a merge, that is the merge commit, and the
`File-Rewrite-Ack:` line sits on the PR's own commit, so a correctly acknowledged rewrite was
blocked.

**Decision.** Without `--message`/`--message-file`, the guard reads every message in
`base..head`. An unacknowledged rewrite is still blocked.

**Why.** Putting the ack on the merge commit as well only works if whoever merges knows to do
it. The ack belongs to the commit that made the change.

**Status.** Standing.
---
## 2026-09-22 — Make saved data and the Gist ID impossible to lose by accident

**Context.** Reloading still wiped projects and the Gist ID after the `persist()` fix below.
An audit found several independent causes: installed copies kept running the pre-fix
`js/mutations.js` because the service worker was cache-first; `loadState()` replaced unreadable
data with defaults and the next save made that permanent; Settings' "Connect" saved a stale
copy, so the next category edit erased the Gist ID (a stale app tab did the same); pushes
replaced the Gist without reading it; most edits never pushed at all; categories lost their
color or assignment on reload. Details: `docs/4-systems/local-storage.md#traps`.

**Decision.** Service worker is network-first. `saveStateLocal` refuses non-state input, keeps
the Gist ID in its own key that only `setGistId`/`disconnectGist` change, merges another tab's
newer save instead of overwriting it, and backs up before any shrinking or unreadable
overwrite. `loadState` recovers from backups instead of defaults. Pushes merge the Gist first.
A lost Gist ID is rediscovered from the token. Covered by `js/storage-safety.test.mjs`.

**Why.** Considered moving state to IndexedDB. Rejected: it gets evicted under the same rules as
localStorage, so it wouldn't fix eviction, and it would make every save async. The Gist, plus
rediscovery by file name, is the durable copy.

**Status.** Standing.
---
## 2026-09-22 — Guard against silent full-file overwrites and CSS regressions

**Context.** GitHub issue #17: commit `af88e6d`, made the previous day and titled as a one-line
fix ("give the New Project category select a solid background"), actually replaced almost all of
`css/app.css` (129 of 290 lines) with a different, unrelated draft stylesheet. Most of the app's
real styling — the colored Low/Medium/High focus buttons, the serif heading font, the page's
max-width layout, card borders — silently stopped applying. The app kept working functionally
(data still saved and synced correctly), so nothing about the failure mode raised an error or
warning; it shipped to production and stayed live for about a day until the person using the app
noticed it "wasn't pretty anymore" and asked why. Full root-cause writeup:
`docs/4-systems/styling.md#traps`.

Two structural gaps let this happen and stay unnoticed: (1) `css/app.css` had zero test coverage
of any kind, even though every JS module with real logic did; (2) even the tests that existed for
other modules were never wired into CI — `.github/workflows/deploy.yml` deployed straight to
GitHub Pages on every push with no test gate at all, so a broken commit and a clean one deployed
identically.

**Decision.** Added two automated guards, both now run in CI before every deploy
(`.github/workflows/deploy.yml`), and the first is also available as an opt-in local git hook:

1. `scripts/guard-file-churn.mjs` — flags any commit that deletes ≥40% of an existing file's
   prior lines, and blocks it unless the commit message explicitly acknowledges the rewrite with
   a `File-Rewrite-Ack: <path>` line. General-purpose, not CSS-specific: it targets the actual
   mechanism of the incident (a diff far larger than its stated intent), not just its symptom.
   Verified against the historical repo: it blocks the real `af88e6d` diff retroactively, and
   does not false-positive on the restorative fix commit (`0c1657d`) that legitimately rewrote
   most of the same file back.
2. `js/style-contract.test.mjs` — a plain `node:test` file (no new dependency, matching every
   other test in the repo) with two checks: every class name used in `js/render.js`/`js/app.js`/
   `index.html`/`settings.html` must have a matching `css/app.css` rule (or be explicitly
   allowlisted as a JS-only hook — see `docs/4-systems/styling.md#invariants`); and a hand-picked
   set of the most visually load-bearing rules must keep specific properties, not just keep
   existing, since a selector surviving with its properties gutted (`.card` losing its `border`
   while the rule itself stayed) is exactly what happened and a plain existence check would have
   missed it.
3. `.github/workflows/deploy.yml` gained a `test` job (`node --test js/*.test.mjs` plus the churn
   guard against the push's prior SHA) that `deploy` now depends on — closing gap (2) above
   directly. This is arguably the more important half of the fix: without it, guards 1 and 2
   only protect a contributor who runs them locally and doesn't skip the hook.

**Why.** Considered and rejected:

- *Playwright/headless-browser screenshot diffing in CI.* Would catch a broader class of visual
  regression, but adds a new dependency and a slower, flakier CI step to a repo whose stated
  design goal is "no framework, no build step" (`README.md`). The static property-level checks in
  `js/style-contract.test.mjs` were shaped specifically around what actually broke here (missing
  selectors, gutted properties) and catch that class of bug with zero new infrastructure. Not
  ruled out permanently — if a future regression slips past the static checks, revisit this.
- *A blanket "no file may shrink by more than X%" rule with no escape hatch.* Rejected because a
  genuine full-file rewrite is sometimes the right call, and a hard block just invites `--no-verify`
  or force-pushing around it. The `File-Rewrite-Ack:` acknowledgment line keeps the guard but
  makes bypassing it a deliberate, auditable, one-line statement of intent instead of a silent
  accident.
- *Requiring every markup class to have a CSS rule, with no allowlist.* Rejected once it produced
  false positives on real JS-hook-only classes (`cat-remove-btn`, etc.) — a check that cries wolf
  gets disabled. The allowlist is short, commented per entry, and the test itself asserts it never
  accumulates an entry for a class that stops being used.

**Status.** Standing.
---
## 2026-09-22 — Fix silent state-wiping bug in `persist()` and add a regression test

**Context.** A user reported losing all local data and their sync Gist ID ("the changes made
deleted all of my credentials from my local copy and the web version got cleared too... with a
gist Id that is simply gone now"). The user attributed what they *saw* to Chrome's "Desktop
site" mode, but that only explains a rendering/viewport issue and cannot explain actual data
loss, since toggling a browser display mode does not touch localStorage. Auditing every
`saveStateLocal()` call site in the app (`docs/4-systems/gist-sync.md`) turned up a real, severe,
currently-live bug that fit the reported symptoms exactly: `js/mutations.js`'s `persist()`
called `saveStateLocal()` with no arguments, so `state.js`'s `saveStateLocal(state)` received
`undefined` for its `state` parameter instead of picking up the module's `state` singleton.
`JSON.stringify(undefined)` stringifies to the literal text `"undefined"`, which
`localStorage.setItem` happily wrote on every mutation. The app looked fine in the moment
(the in-memory `state` singleton was still correct), but the next `loadState()` — a reload, or
a new tab — called `JSON.parse("undefined")`, threw, was silently swallowed, and fell back to
`defaultState()`, wiping every project, category, and the gistId.

**Decision.** Changed `persist()` in `js/mutations.js` to call `saveStateLocal(state)`,
matching every other call site (`js/sync.js`, `settings.html`). Added
`js/persist-storage.test.mjs`, a regression test that exercises the real module (mocked
localStorage with the same `String()`-coercion `setItem()` behavior as the real API) rather
than a text-pattern check, calling a real mutation and inspecting both what lands in
localStorage and what `loadState()` reads back afterward — reproducing the reload where the
user actually saw their data disappear. Recorded the invariant ("every `saveStateLocal()` call
site must pass `state` explicitly") and this incident in `docs/4-systems/gist-sync.md`
(see `#invariants` and `#traps`, doc-ref `2425`).

**Why.** A static/text-pattern check (like `style-contract.test.mjs`'s class-name matching)
would not have caught this: the defect is a runtime data-flow bug, not a shape mismatch — the
call site is syntactically valid, it just silently drops its argument. Only a test that
actually calls the mutation and inspects the real serialized/deserialized round-trip surfaces
it, so that's the form the regression test takes.

**Status.** Fixed and standing; regression test is green (`js/persist-storage.test.mjs`).
