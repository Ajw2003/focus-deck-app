# Calm Board, Task details and Comfort settings

Status: designed and approved (docs/6-decisions/Decisions.md, 2026-10-19) and built on 2026-10-19 under
#198 and its sub-issues #199 to #205; waiting for Aj's QA. The test site it was copied from is
`docs/generated/calm-test/index.html`; this file describes the built code.

## What it owns

- **The frame (#199).** On screens 1100px and wider the header (Focus Deck name, centred jotter) stays at
  the top while the page scrolls, and the side menu is one 232px column below it, with Settings and
  sync at its foot. Phones keep the bottom bar. (`.rail`, `app/css/app.css:1090`; `renderRail`,
  `app/js/render.js:53`)
- **The Board (#200).** One tab at a time: Up next, In progress, Done this week, each with its count.
  Above the tabs: Find (task, project or label), a Project menu, and Filter (Category; Show: Everything,
  Has subtasks, Waiting on something, Holding others up). Cards come in groups of "Cards at once"
  with "Show N more". Up next cards carry "→ In progress"; In progress cards carry "← Up next". A
  card shows its project's name only on "Project: All". Subtasks show inside their parent, not as cards.
  Built: `boardList` (`app/js/board.js:46`) makes the list, `renderBoard` (`app/js/board-view.js:64`) the markup;
  the Board's memory-only state is `ui.board*` in `app/js/app.js` (tab, find, filter, shown, and
  `boardSelected`, which Task details renders from). The move buttons go through `moveTaskTo`, so they
  save and sync like a drop did (`moveTaskTo`, `app/js/app.js:326`). There is no "+ New" on the Board (the real app adds tasks from a
  project's "+ Add task" and the jotter). `board-swipe.js` is no longer called; `project-drag.js` still
  serves Projects.
- **Card colour (#202).** Each card shows one chip and takes its edge colour from it: the first entry
  in the Card colour list that the task has. Entries are `category` (the task's first label),
  `priority`, `due`, and `label:<id>`. A task with none shows "No category" in grey. The edge colour
  Built in `cardKey` (`app/js/card-key.js:22`), shown by `board-view.js`. The list is edited in Settings,
  Comfort, Card colour (`app/settings.html:67`; reorder and add a label at `:539` and `:543`, saved
  through `setColourBy`, `app/js/mutations.js:393`). Every card with a priority or a due date also
  shows one line under its label (#211, design 1A of 2026-10-20): a flag and the priority word in
  `PRIORITY_COLOURS`, then the same `deadlineChip` Projects uses, so a late date reads amber or red as
  Comfort chooses. Each half is left out when the card's label already is that source, and a done task
  shows no date (`glanceLine`, `app/js/board-view.js:52`; `.gl-glance`, `app/css/app.css`). The edge colour
  must be set through `--proj-color`, because `.board-card`'s `border-left` shorthand uses that
  variable and an undefined variable drops the whole border to zero width.
- **Task details (#201).** Selecting a card opens a panel headed "Task details": the title and a status
  menu always show, then five folded rows (Notes, Priority and due date, Labels, Subtasks, Linked
  tasks), one open at a time, each with a one-line summary. Changes save as they are made. The
  selected card again, Escape, or "Close ×" deselects; nothing is selected when the Board opens.
  Built in `renderTaskDetails` (`app/js/task-details.js:44`, markup and the pure row summaries), opened
  by `selectBoardTask` (`app/js/app.js:760`) and wired by `onDetailAction` (`:778`) and
  `onDetailChange` (`:832`) through `updateTaskFields`, `editTask`, `setTaskStatus`, `addTask`, `setFocus`
  and `deleteTask`, so GitHub-linked tasks push as they do from Projects. State: `ui.boardOpen`, `boardAddSub`,
  `boardLink`, `boardPicker`. On phones (below 1100px) the panel is full screen over the list.
- **Settings and Comfort (#203).** Every setting is one folded row showing its current value; one
  row is open at a time. The Comfort group holds Movement (`system`/`off`/`on`), Softer colours
  (on), Card colour (`['category','priority','due']`), Cards at once (5, 7 or 10; 7), and Tasks past
  their date (`amber` "Past its date", or `red` "Overdue"). Each is a stamped setting synced like the
  others in `app/js/state.js` and merged newest-wins in `app/js/merge.js`. `applyComfort`
  (`app/js/comfort.js:58`) sets them on the page; the overdue wording comes from `deadlineChip`
  (`app/js/state.js:373`).

## Invariants

- Nothing the app could do before is lost: drag between columns is replaced by the move buttons and
  the status menu, and GitHub-linked tasks still push their changes from Task details.
- One folded row open at a time, on both Settings and Task details.
- Phones (below 1100px) keep their existing frame.

## Traps

- `--proj-color` (above).
- CI's churn guard (`scripts/guard-file-churn.mjs`) fails a commit that deletes 40% or more of a file's
  lines unless the message carries `File-Rewrite-Ack: <path>`.
