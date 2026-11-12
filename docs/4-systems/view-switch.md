# The All | Area | Project switch (#252)

> **2026-11-12 (#259):** the Board and Projects screens were removed in the five-tab change; the Roadmap took over their jobs. Where this file describes them as current it is history. See [tabs.md](./tabs.md).

## What it owns

`js/view-switch.js` (pure: filters and markup), the state `ui.view` and its persistence in `js/app.js`, the
`.vs-*` rules at the end of `css/app.css`, and `inView` in `js/areas.js`. Tests: `js/view-switch.test.mjs`;
browser check: `scripts/check-view-switch-browser.mjs` (360, 390 and 1440 wide; screenshots in
`docs/generated/build-checks/step4/`).

## How it works

- One control at the top of every screen (Focus, Sort, Board, Projects): a segmented switch All | Area | Project
  (real buttons, `aria-pressed`), then one button naming the pick ("Home ▾"), hidden on All.
- `ui.view = { mode: 'all' | 'area' | 'project', id }` is one piece of state for all screens. It is stored in
  localStorage under `focusdeck-view` (per device, never in synced state), so it survives a tab change and a
  reload. `normalizeView` turns a gone area or project, or junk, into All.
- Area = one area, including the fixed Unsorted (a project with no area, or whose area is gone, is in it).
  All shows everything, Unsorted too. Tapping Area or Project the first time picks something real
  (`defaultFor`) and opens the list.
- The list is one element: a dropdown under the button on desktop, a bottom sheet with a dimmed backdrop below
  600px (CSS media query, `.vs-pop`). Areas show their colour dot; projects are grouped by area, with a search
  box when there are more than 8. The list takes focus, keeps Tab inside, and closes on Escape or the backdrop
  (focus returns to the button).
- Nothing is cut off at 360px: the row is the switch plus one button that shrinks (`min-width:0`, ellipsis on
  `.vs-pick-name`).

## What each screen does with it

- Focus: `renderFocusPicker` and the category wallet draw from `viewState(st)` (the state with only the view's
  projects), so the cards, counts and "Surprise me" only count those tasks; `pickFocus` passes the view to
  `openTasksMatching`. A task already in focus stays shown.
- Sort: the project choices (`folderCards`, the one-at-a-time wallet and "Select many") are limited to the view.
  Thoughts and the queue are not filtered.
- Board: `boardList` takes `view` and keeps a task only if its project is `inView`. The Board's own Project
  menu and Area filter are gone; Find and Show remain. One Project gives the "one project" heading and add row.
- Projects: the list is `viewProjects`; Project mode is the "One" layout showing that project's card, anything
  else is the list. The old All/One toggle is gone (`renderApp` sets `ui.projectView` from the switch).
  Linking to a project the switch hides (a new project, a Focus card's project chip) goes back to All.
- The jotter's "To:" follows a Project pick on the Board and Projects screens (`jotTarget`).

## Traps

- `viewState` reads `st._ui.view`, set in `renderApp`; the view is never stored in `state.focus.filter`.
- `inView` lives in `js/areas.js` (not `view-switch.js`) so `state.js` can use it without a circular import.
- The view's list is closed by repainting; the project search hides rows in the DOM and is not kept over a repaint.

See also [areas.md](./areas.md), [calm-board.md](./calm-board.md), [styling.md](./styling.md).
