# Roadmap (#257)

> **2026-11-12 (#268):** the Roadmap shows one project, one milestone at a time, on the desk-object clipboard. The sections below that describe four columns side by side, collapsed milestone rows, the inline add boxes, the Edit panel and the settings dialog are history; "How it works now" and "Milestone settings in two steps" replace them. The view tape picks the project; the Roadmap opens on the last-used one.

> **2026-11-12 (#267):** the group view (a row per project, the "+ New project" button and the New panel) is gone from the Roadmap. The project list and New project are the Projects tab: see [projects-tab.md](./projects-tab.md). The Roadmap is one project; its menu has no "+ New project". Read the "Group view" and "+ New project" lines below as history.

> **2026-11-12 (#259):** there are now five tabs; Tidy up and Triage sit under Organize on the wide rail too. The phone-only Organize wording below is history. See [tabs.md](./tabs.md).

## What it owns

`js/roadmap.js` (pure: the data model, `roadmapOf`, `percent`, add / move / step functions), `js/roadmap-view.js`
(markup), `js/milestone-steps.js` (Milestone settings: the two steps; replaces `js/milestone-settings.js`), `js/roadmap-drag.js` (mouse drag and Alt+Arrow), `editRoadmap` and `setTaskMilestone` in
`js/mutations.js`, the `rm-*` actions in `js/app.js`, the `.rm-*` rules (and `.org-*`) at the end of
`css/app.css`. Tests: `js/roadmap.test.mjs`; browser check `scripts/check-roadmap-browser.mjs` (390, 360 and 1440
wide; screenshots in `docs/generated/build-checks/step9/`).

## The data model

- A project may have `sections: [{ id, name, order, updatedAt }]` and
  `milestones: [{ id, name, sectionId, order, githubMilestone?, parentTaskId?, measure?, updatedAt }]`. A save
  without them loads unchanged (nothing is migrated: every reader defaults to empty).
- A task is in a milestone by, in this order: its own `milestoneId`; its `githubMilestone` (the title of the issue's
  GitHub milestone) matching a milestone's `githubMilestone`; being a subtask (`parentId`) of a milestone's
  `parentTaskId`; else the "Unplanned" milestone, shown last and only when it has tasks. A milestone's own parent
  task is not counted as one of its tasks.
- A milestone with no section (or a gone one) sits in a leading, unnumbered "Milestones" section, so a project with
  milestones but no sections still shows them. Sections are numbered 1.. in `order`.
- Percent done = done tasks / all tasks, for the project and for each milestone. The "current" milestone is the
  first, in section order, with open tasks (or none yet); it is the one open by default (`ui.rmOpen` overrides, memory
  only). `measure` (default "tasks") is the word in "tasks 2 of 5"; there is no screen to set it yet.
- Merge (`merge.js`): the project's own fields follow the newest project copy as before; `sections` and `milestones`
  merge by id, newest `updatedAt` wins, both sides' records kept. shortcut: no tombstones, because nothing deletes a
  section or milestone yet; add them with a delete.

## How it works

- Screen "Roadmap" after Triage (rail entry and phone tab). It follows the All | Area | Project switch.
- (History, removed in #267) Group view (All, Area): title "Roadmap: <view>", "+ New project" top right (the existing New panel: name, or
  link/create a GitHub repo). One row per project: dot, name, "N% done", then a card per milestone (name, count,
  bar in the project's colour). Clicking a row or card switches the view to that project. On a phone each project is
  one card: "N% done", "Now: <current milestone> · X of Y", a bar.
- Project view (switch on Project): name, big "N%", a bar, then the sections. The current milestone is open with four
  columns (Up next, In progress, Review, Done = status next / doing / review / done); the others are collapsed rows
  "tasks X of Y ▸" that open on a click. "+ Add a task" inside a milestone (its add row; the task gets that
  `milestoneId`; it needs a priority like every add row, so Add stays off with "Pick a priority to add"; the box stays open, empty and
  focused after each add, and Escape or a click away closes it), "+ Add a milestone" (end of the last section), "+ Add a section". Top right: "Edit project" (the
  existing edit panel: rename is not there today, area, colours, link to a GitHub repo, Remove), "Sync now" for a
  GitHub project (a "+ New project" button was here until #267). Each task row shows a read-only priority chip (when set) and a due chip (open tasks); clicking the chip or the title opens Task details, where both change. Clicking a task opens Task details under the sections, with a Milestone menu and
  "Make this a milestone" (a task with subtasks becomes a milestone; its subtasks are its tasks).
- Phone project view: the four columns become four buttons (Up next / In progress / Review / Done), one column
  visible at a time (`ui.rmCol`, per milestone).
- Moves. A column move is `setTaskStatus`, exactly as the Board's: the "needs review" label, closing the issue on
  done, `completedAt`. Mouse: drag a task by its grip onto a column; a milestone by its grip onto another milestone
  (before it) or onto a section (its end); a section by its grip onto another section. Keyboard: Tab to the grip,
  Alt+Left / Alt+Right for a task, Alt+Up / Alt+Down for a milestone (it steps into the neighbouring section at the
  end of its own) or a section. Phone: grips are hidden; every task has ← → buttons, every milestone and section
  ↑ ↓ buttons (chosen instead of touch drag: simpler, and it never fights scrolling). shortcut: no touch drag, no
  auto-scroll on a drag.
- Phone bar: eight tabs do not fit at 360, so on a phone Tidy up and Triage share one "Organize" tab (seven tabs);
  each of the two screens starts with Tidy up | Triage buttons. A wide screen keeps eight rail entries. Step 11
  regroups into five tabs and removes Board and Projects; until then both stay.

## How it works now (#268)

- **The clipboard** (`main` in `js/roadmap-view.js`): the milestone's name, a progress ruler (`roadmapOf` `pct`), four folder tabs (Up next / Doing / Review / Done = status `next` / `doing` / `review` / `done`, each with its count; the tab per milestone is `ui.rmCol`), the tasks of the chosen tab as tick rows (the tick is `toggle-task`; the title opens the task's drawer), then `‹` and `›` flags (previous / next milestone in section order, Unplanned last), an "All milestones" flag and a "+ Add a task" stamp. The milestone shown is `ui.rmMs`, else the first with open tasks (`currentOf`). The state (`ui.rmMs`, `rmScreen`, `rmDrawer`, `rmTask`, `rmForm`, `rmSet`, `rmEditField`) is memory only and resets when the project changes.
- **The ⋯ drawer** (the brass pull on the clipboard): ⚙ Milestone (not for Unplanned), 🗺 All milestones, 🔍 Find a task, ✏️ Edit project, ⟳ Sync (GitHub projects only).
- **A task's drawer** (tap a title, also from Find): stamps Doing / Review / Done (`setTaskStatus`, exactly the Board's move) and ◎ Focus (`setFocus`, then the Focus tab); ➜ Other milestone (a Move to drawer: `setTaskMilestone`, Unplanned clears it); 🏁 Make it a milestone (`makeMilestone`; only for a task with subtasks that is not one already); Details › (Task details, whose Milestone menu and "Make this a milestone" are as before).
- **All milestones**: sections with ↑↓ keys, each milestone with its ruler and ↑↓ keys (`stepSection`, `stepMilestone`); tapping one puts it on the clipboard; "+ Section" and "+ Milestone" stamps.
- **New task / New milestone / New section**: a jotter field and an Add stamp (off until there is a name). A task goes in the milestone on the clipboard, Up next (`addTask` then `setTaskMilestone`; no priority is asked, as with the Jot; set it in Task details). "More…" adds the task and opens Task details. shortcut: the Sort steps work on tray thoughts, so they are not run for full details; upgrade if Sort should take an existing task. A new milestone picks its section from a list (default the last).
- **Find a task**: a field and the matching tasks of this project; each opens its drawer.
- **Edit project**: a receipt (name, area, colour, repo); a pencil opens a one-question screen (`renameProject` is new, `setProjectCategory`, `setProjectColor`, `link-repo` for a project not yet on GitHub; a linked repo is shown, not changed). "Remove project" asks first in a drawer (Back / Remove, `removeProject`) and then lands on the Projects tab.
- **Computer**: the grips show where there is a mouse. Drag a task by its grip onto a folder tab (`setTaskStatus`), a milestone onto another milestone or a section, a section onto another section (`js/roadmap-drag.js`, unchanged); Alt+Arrow on a grip as before. A phone uses the stamps and the ↑↓ keys.
- **Dropped on purpose**: the collapsed milestone rows and their toggle (`rm-toggle`); the ← → buttons on each task (`rm-task-step`; the stamps do it); the priority and due chips on a task row (they are in Task details, and Find shows the priority); the inline add boxes; the project percent and segmented bar on the Roadmap (the Projects tab's ruler shows the percent); the old Edit panel on this screen. `renderProjectEditPanel` and `renderAddTaskRow` in `js/render.js` are no longer used by the Roadmap.
- The first column is named "Doing" here (`COLS`), not "In progress"; status values are unchanged.
- Text is never under 13px: `.screen-roadmap` lifts `--text-sm` to 13px, which also fixes `.link-btn.small` (12.8px) wherever it shows on the Roadmap.

## Milestone settings in two steps (#268)

Menu, ⚙ Milestone opens a draft (`ui.rmSet`, `settingsDraft`); nothing changes until Save. Step 1 "How big a part?": a ruler slider with the % under it (`sharesAfter` rescales the others from the shares at open). Step 2 "Done means…": Tasks done and Task size choose and Save; A number goes to a name and "done so far of target" fields; A checklist to a tick list (tick, edit, remove) and an Add field. Save is `applyMilestoneSettings`, the same mutation as #258. Back steps back; Escape is Back. The #258 text follows as history.

## Milestone settings (#258, the dialog is replaced by #268)

Clicking a milestone's name on the project view opens "Milestone: <name>" (subline "<project> · <section number> · <section name>"): a centred dialog on a wide screen, a bottom sheet on a phone (`js/milestone-settings.js`, on `<body>` like the move dialog; Escape, Close or Cancel discard, focus is trapped and returns to the name). It works on a draft; nothing changes until "Save milestone".

- Share. A slider sets how much the milestone counts toward the project. Shares are whole numbers that always add up to 100 (`sharesFor`, `sharesAfter`, `split` in `js/roadmap.js`): moving one rescales the others in proportion, from the shares at open, and rounding leftovers go to the largest. Stored as `weight` on the milestone. A milestone with no `weight` (old saves, a milestone added later) makes everyone's share equal again. Unplanned counts as a milestone for shares when it has tasks; its share is kept on the project as `unplannedWeight` and it has no settings of its own.
- Measure. `measureBy` is `tasks` (done / all, the default), `size` (task `size` small 1, medium 2, large 3, no size counts as small; points done / points), `number` (`number: {name, current, target}`, "screens tested 2 of 4") or `checklist` (`checklist: [{id, text, done}]`, ticked / items). A task's size is set in Task details (Priority and due date row) and stored as `size`. The own-number text replaces step 9's `measure` word, which still shows for a `tasks` milestone that has one.
- Project progress = the sum over milestones of share x that milestone's progress, rounded. The project bar is one segment per milestone as wide as it added; hover text names it. The Projects tab's ruler, "N% done" and the milestone cards use the same numbers (`roadmapOf`: `pct`, `text`, `share`, `contribution`).
- All of it is stamped `updatedAt` and merges like any milestone (newest copy wins). shortcut: the settings screen is not offered for Unplanned, and a later milestone resets shares to equal.

## GitHub milestones

`listIssues` now reads `issue.milestone.title` from the issues it already fetches (no new request). A sync stores it
on the task as `githubMilestone` and creates one milestone per title (`syncGithubMilestones`), once. Read only: a
milestone made in the app is not created on GitHub, a rename on GitHub is not followed, and closed issues keep the
title they last had. shortcut: upgrade when milestones should be written back.

## Invariants

- (Until 2026-11-12) nothing on the Projects screen or the Board was removed. Since #259 both screens are gone and the Roadmap has their features: Find a project, project sort and order, Find a task, see [tabs.md](./tabs.md).
- A task is in exactly one milestone; no change here moves a task between projects.

See also [triage.md](./triage.md), [view-switch.md](./view-switch.md), [github-sync.md](./github-sync.md),
[calm-board.md](./calm-board.md).
