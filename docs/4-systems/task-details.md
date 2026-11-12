# Task details as a stamp and a receipt (#269)

Approved design: `docs/generated/friction-steps/prototype.html` screens d0 to d4 ("Design approved: step by step 11 2*").
Standing rule: no small text, nothing under 13px, every screen fits 390x844 without scrolling.

## What it is

A clipboard over the screen (a side panel, 480px, on a computer) with an **×** to close. On it: the task's title, a
**status rubber stamp** (tap: the Status drawer with Up next / Doing / Review / Done stamps) and a **till receipt**, one
line per detail, each with an icon, its value and a pencil: 🚩 priority, 📅 due, 🗂 labels, 🪜 smaller steps (n of m),
⏳ waits on, 📝 notes, 📏 size, 🐙 GitHub issue. At the foot a **⋯** tag (the card-index drawer: ✏️ Rename, 📁 Move to
another project, 🧩 Part of…, 🚧 Holds up…, Delete in red) and a **◎ Focus** stamp.

Built in `renderTaskDetails` (`app/js/task-details.js`); the taps are `onDetailAction` and `saveEdit` in `app/js/app.js`;
the CSS is the `.td-*` block at the end of `app/css/app.css`. Tests: `app/js/task-details.test.mjs`; browser walk
`scripts/shoot-details-269.mjs` (screenshots in `docs/generated/details-269/`).

## Pencils reuse the Sort steps

A pencil (`detail-edit`, `data-step`) opens **the same step screen Sort uses**: `renderSortFlow` in its `edit` mode
(`app/js/sort-flow-view.js`: no dots, no slip menu, no Skip, **Save** (`edit-save`) where Next was). The step writes to
`ui.edit`, a scratch with the Sort scratch's shape seeded from the task, so every Sort handler (`onSortAction`,
`onPickSet`, the wallets, the find boxes) works unchanged through `sortScratch()`. Save is `saveTaskEdit`
(`app/js/in-tray.js`): only what changed is written, on `updateTaskFields` / `applyTaskMove` and the shared tie rules
(`applyTies`), so a GitHub-linked task still pushes. Back leaves the step without saving.

| Line / drawer card | Opens |
|---|---|
| 🚩 priority | Sort step 2, "How important?" |
| 🗂 labels | step 3 (with A–Z and + New label) |
| 📅 due | step 4 (calendar pages, Another date) |
| ⏳ waits on | step 7 |
| 📝 notes | the notes page |
| 📁 Move to another project | step 1, "Which project?" |
| 🧩 Part of… / 🚧 Holds up… | steps 5 / 8 |
| ✏️ Rename | a one-field screen (Save writes `editTask({ title })`) |
| 🪜 smaller steps | its own screen: tick list (`toggle-task`), an Add field (`detail-add-sub`), Done |
| 🐙 GitHub | its own screen: ↗ Open on GitHub and Unlink (`unlink-github-issue`); for an unlinked task + Create issue and Link to an existing issue |
| 📏 size | its own screen (Small / Medium / Large / Not set): **not in the design**, kept because the Roadmap's "Task size" measure reads `task.size` and nothing else sets it |

Delete asks first (`confirmDeleteTask`). The status stamp calls `setTaskStatus`; ◎ Focus calls `setFocus`.

## Where it opens

Sort (the "Details" button on a task slip), Organize (a Tidy up title), Triage (a card), Focus, Roadmap (the task drawer's
Details card) and Review (a title). All set `ui.boardSelected`; Sort, Tidy up, Triage and Focus draw the panel in
`renderApp`, Roadmap and Review draw it themselves. Escape closes it. State (memory only): `ui.boardSelected`, `ui.edit`,
`ui.boardScreen` (`subs` / `github` / `rename` / `size`), `ui.boardDrawer` (`status` / `more`).

## What happened to the old actions

| Old action | Now |
|---|---|
| `detail-close`, `detail-add-sub`, `detail-focus`, `detail-delete` | kept (the ×, Add, ◎ Focus, Delete) |
| status `<select>` | the status stamp and drawer (`detail-status-open`, `detail-status`), same `setTaskStatus` |
| title edited in place | ✏️ Rename (`detail-rename`, `detail-rename-save`), same `editTask` |
| notes, priority, due date, labels (checkbox picker and typed new labels) | their Sort steps, Save |
| size select | the 📏 screen (`detail-size-open`, `detail-size`) |
| Subtasks row | the 🪜 screen; `detail-add-sub-open` is gone (the Add field is always there) |
| Linked tasks row (`detail-link-open`, `detail-link-add`, `detail-unlink`) | Sort steps 5, 7, 8 (tap a task to add, tap a chosen one to remove) |
| `detail-fold` (folded rows) | gone: there are no folds |
| `detail-goto` (jump to a linked or sub task) | **dropped**: the lines name tasks but do not open them |
| `detail-make-cat` ("Make category": first label is the category) | **dropped**: the order labels are picked in is the order saved, so take one off and put it back |
| the Roadmap's Milestone select and "Make this a milestone" inside the panel | removed from the panel: the task drawer's "Other milestone" and "Make it a milestone" cards do both |
| "Changes save as you make them" | gone: Save writes each step (the drawer's status stamp and the 🪜 / 📏 screens still save at once) |

The "Another date" warn-lead page (yellow / red lead times) is not offered when editing a task: the old panel never
had it either. A new due date drops the old stage choices (`updateTaskFields`).
