# Quick add

> **2026-11-12 (#259):** the Board and Projects screens were removed in the five-tab change; the Roadmap took over their jobs. Where this file describes them as current it is history. See [tabs.md](./tabs.md).

## What it owns

Related requests: #103 (the add form as one field like the jotter) and #235 (adding straight to a
project without the tray, and typed text lost on sync).

Adding a task to a project from any screen, approved on 2026-10-29 in round 2 of
`docs/plans/quick-add.html` ("Design approved: add a task anywhere", keep "More"). Three entry
points share one submit path, the existing `data-action="add-task"` form handler in `js/app.js`,
which calls `M.addTask` (`js/mutations.js`) and `createIssueIfGithubProject`, so a task added any
way gets the same fields, sort order and GitHub issue.

## Status

**#240 (project-card row), #241 (Board row) and #242 (jotter stamp) built.** Tracked by #239.
#242: `#capture-to` in `index.html`, `.to-stamp` in `css/app.css`, `jotTarget` and `renderToast`'s optional action in `js/render.js`, stamp painting in `paintHeaderControls`, submit, `open-added-task` and `ui.jotTo`/`ui.noticeAction` in `js/app.js`. Tests: `js/render.test.mjs` (target resolution, toast action) and the jotter steps in `scripts/check-add-row-browser.mjs`; screenshots `docs/generated/quick-add/built-jotter-*.png` (native select open is not capturable, so shown chosen with the notice).
#241: `renderBoard` in `js/board-view.js` puts `renderAddTaskRow` above Up next when one project is
chosen (tests in `js/board-view.test.mjs`; Board steps in the browser check below; screenshots
`docs/generated/quick-add/built-board-*.png`).
Built in `js/render.js` (`renderAddTaskRow`, `renderProjectCard`), `js/app.js` (`toggle-add-more`,
`ui.addDraft`, `focusAddTitle`, focus restore in `paint()`) and `css/app.css` (`.add-row`). Tests:
`js/add-row.test.mjs`, `js/render.test.mjs`, and `scripts/check-add-row-browser.mjs` (real Chromium,
phone and desktop, light and dark). Screenshots: `docs/generated/quick-add/built-row-*.png`.

## The three entry points

1. **The jotter's "To:" stamp** (`index.html`, `js/app.js`, `css/app.css`). A native `<select>`
   styled as a dashed paper stamp beside Add: first option "Unsorted" (the stamp reads "To: Unsorted ▾"; aj chose that word over "Tray" because it names where to find the thought, the Sort screen), then every project. A native
   select is used instead of the mocked pop-up list because the phone's own picker is accessible
   and needs no extra code; the closed stamp looks the same as the mock.
   - On "Unsorted" the jotter calls `M.addCapture` exactly as before.
   - On a project, Add reads "Add task" and the text becomes a task in that project's Up next. A
     notice says `Added "<title>" to <project>` with an Open button, which goes to the Board
     narrowed to that project with the new task selected.
   - On a phone (the 699px breakpoint where the jotter goes full width) the writing takes the whole
     first line and the stamp and Add sit on a second line, stamp left, Add right (#244, approved
     2026-10-29 as option A of `docs/plans/jotter-room.html`; built in `css/app.css`, checked by
     `scripts/check-add-row-browser.mjs`): on one line the writing got 119 of the jotter's 358px.
   - Until you change it, the stamp follows what you are looking at: the Board's chosen project,
     or the selected project in the Projects screen's "One project" view, else Unsorted. Your own
     choice holds until you change screen (`ui.jotTo`; `undefined` means "follow").
2. **The Board's add row** (`js/board-view.js`). Shown only when the Board's project filter has
   one project chosen, and only on the Up next tab, since that is where a new task lands. Reads
   "Add a task to <project>…"; there is no picker.
3. **The project card's add row** (`js/render.js`, `renderProjectCard`). Replaces the "+ Add task"
   link and its five-box form. Always visible at the foot of the card.

Rows 2 and 3 are one function, `renderAddTaskRow(project, categories, isMoreOpen)` in
`js/render.js`: a one-line dashed row with the title box, a "More" button and Add. "More" opens
the old boxes underneath (steps, priority, due date and its stage step, labels), so no field is
lost. `ui.addingTask[projectId]` now means "More is open" rather than "form is open". Escape
closes More. After Add, the title box empties and keeps focus so you can add the next one.

## Priority and due date on every add (#249)

Rows 2 and 3 (the project and Board add rows) ask for a priority. Once the title box has text a
**Priority · needed** block (Urgent, High, Medium, Low) and a **Due** block (Today, Tomorrow, Friday,
Next week, Pick a date…, None; None is the default) appear under the line. The Add button is
disabled until a priority is picked; the reason ("Pick a priority to add") is a hint line in the priority block, so the button stays short and the title box keeps its room on a phone.
`M.addTaskPicked` (`js/mutations.js`) is what the submit calls and refuses (no task made) without a
valid priority even if the disabled state is bypassed; `M.addTask` itself is unchanged, so the
jotter stamp (exempt, like jotting into Unsorted) and subtasks still add without one. The More panel
keeps steps and labels; its old priority select and plain date box are gone (the blocks are not
shown twice).
- Keys 1-4 pick Urgent/High/Medium/Low while focus is on a button in the row (in the title box a
  digit is just typing).
- "Pick a date…" shows the date box plus a text box that reads "fri", "tomorrow", "15 dec" through
  `parseDue` in `js/pick-bits.js` (pure, tested in `js/pick-bits.test.mjs`). Friday and Next week are
  the coming Friday and Monday, never today.
- Picked priority and due live in `ui.addPick[projectId]` beside `ui.addDraft`, so a repaint while
  typing keeps them; they reach the form as hidden `priority` and `deadline` inputs.
- On task rows and Board cards the priority chip reads "High ▾" ("Priority ▾", quiet, when none) and
  the due chip carries a ▾; each opens a small picker (`pickChip`, one component for rows and cards,
  state in `pickState`): one tap sets it, Escape or a click away closes. The old `cycle-priority`
  chip is gone. A task with no date shows a quiet "Due ▾" chip that opens the same due picker; Board cards with nothing set show both quiet chips. Done Board cards keep their priority (static) and show no date, as calm-board.md says.
- Checks: `scripts/check-priority-browser.mjs`; screenshots `docs/generated/build-checks/step1/`.

## Traps

- A repaint (a sync arriving, a toggle elsewhere) rebuilds `#app`, which would wipe a half-typed
  title in an add row; issue #235 reports exactly this on the old form. Each row's title is kept in
  `ui.addDraft[projectId]` on every keystroke and written back on render, and focus and caret are
  restored after `paint()`. The jotter is outside `#app`, so it is already safe.
- The jotter sits in `index.html`, outside `#app`, so `paint()` must update the stamp's options and
  value itself; a project renamed or deleted must not leave a stale option selected (fall back to
  Unsorted).
- Title-only submits must still pass an empty deadline, labels and steps to `M.addTask`, exactly as
  the old form did when its boxes were left blank.
- The style contract test (`js/style-contract.test.mjs`) checks that every class the markup uses
  exists in `css/app.css`.
