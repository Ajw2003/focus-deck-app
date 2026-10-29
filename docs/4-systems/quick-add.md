# Quick add

## What it owns

Related requests: #103 (the add form as one field like the jotter) and #235 (adding straight to a
project without the tray, and typed text lost on sync).

Adding a task to a project from any screen, approved on 2026-10-29 in round 2 of
`docs/plans/quick-add.html` ("Design approved: add a task anywhere", keep "More"). Three entry
points share one submit path, the existing `data-action="add-task"` form handler in `js/app.js`,
which calls `M.addTask` (`js/mutations.js`) and `createIssueIfGithubProject`, so a task added any
way gets the same fields, sort order and GitHub issue.

## Status

**#240 (project-card row) built; #241 (Board row) and #242 (jotter stamp) still planned.** Tracked by #239.
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
