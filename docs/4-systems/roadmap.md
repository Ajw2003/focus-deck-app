# Roadmap (#257)

## What it owns

`js/roadmap.js` (pure: the data model, `roadmapOf`, `percent`, add / move / step functions), `js/roadmap-view.js`
(markup), `js/roadmap-drag.js` (mouse drag and Alt+Arrow), `editRoadmap` and `setTaskMilestone` in
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
- Group view (All, Area): title "Roadmap: <view>", "+ New project" top right (the existing New panel: name, or
  link/create a GitHub repo). One row per project: dot, name, "N% done", then a card per milestone (name, count,
  bar in the project's colour). Clicking a row or card switches the view to that project. On a phone each project is
  one card: "N% done", "Now: <current milestone> · X of Y", a bar.
- Project view (switch on Project): name, big "N%", a bar, then the sections. The current milestone is open with four
  columns (Up next, In progress, Review, Done = status next / doing / review / done); the others are collapsed rows
  "tasks X of Y ▸" that open on a click. "+ Add a task" inside a milestone (its add row; the task gets that
  `milestoneId`), "+ Add a milestone" (end of the last section), "+ Add a section". Top right: "Edit project" (the
  existing edit panel: rename is not there today, area, colours, link to a GitHub repo, Remove), "Sync now" for a
  GitHub project, "+ New project". Clicking a task opens Task details under the sections, with a Milestone menu and
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

## GitHub milestones

`listIssues` now reads `issue.milestone.title` from the issues it already fetches (no new request). A sync stores it
on the task as `githubMilestone` and creates one milestone per title (`syncGithubMilestones`), once. Read only: a
milestone made in the app is not created on GitHub, a rename on GitHub is not followed, and closed issues keep the
title they last had. shortcut: upgrade when milestones should be written back.

## Invariants

- Nothing on the Projects screen or the Board is removed; both still work.
- A task is in exactly one milestone; no change here moves a task between projects.

See also [triage.md](./triage.md), [view-switch.md](./view-switch.md), [github-sync.md](./github-sync.md),
[calm-board.md](./calm-board.md).
