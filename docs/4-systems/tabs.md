# The five tabs (#259, step 11 of "tabs that follow the flow")

Approval: Eden typed "Build plan approved: tabs that follow the flow"; removing the Board was Eden's own answer.
Design: `docs/generated/friction-audit/p3-flow5.png` and `p3-inventory5.png`.

The app has five numbered tabs, in the order of the flow: **1 Sort**, **2 Organize** (Tidy up and Triage inside), **3 Roadmap**,
**4 Focus**, **5 Review**. Wide screen: a column down the left (`renderRail`, `app/js/render.js`) with Tidy up / Triage
sub-items under Organize and Settings and the sync button at the foot. Phone: a bar along the bottom. Only Sort (items to sort)
and Review (items waiting) carry a badge. Tidy up and Triage show Tidy up | Triage buttons at the top of both screens.

- Screen ids: `sort`, `tidy`, `triage`, `roadmap`, `focus`, `review` (`SCREENS`). A saved `board` or `projects` screen (localStorage
  `focusdeck-screen`) opens the Roadmap; anything unknown (an old Start here) opens Focus (`normalizeScreen`). First screen is Focus.
- The jot box is in the topbar, so it is on every tab. On a wide screen (>= 1100px) **J** from anywhere focuses it, except while
  typing in a field or a wallet; **Escape** leaves it (`app/js/app.js`, the document keydown in `init`).
- Task details opens from a task on every tab: a "Details" button on a Sort task slip, a Tidy up row, a Triage row and the Focus note;
  a task title on the Roadmap and Review. Sort, Tidy up, Triage and Focus draw the panel under the screen (`renderApp`).
- The Roadmap took what the Board and Projects screens did: the group view (All / Area) has a "Find a project" box, the project sort
  control (Custom order gives up/down buttons per row) and + New project; the project view has "Find a task" across its milestones,
  Edit project, Sync now, the four columns per milestone, adding and ticking tasks. See `roadmap.md`.
- Removed: the Board and Projects screens, the topbar Projects button and drawer, project cards, the sidebar. The code is kept in
  `_to_delete/app/js/` (`board-view.js`, `board-swipe.js`, `render-projects-screen.removed.js`).

Check: `scripts/check-tabs-browser.mjs` (one assertion per row of the inventory table, named after the row).
Left for later: `app/js/project-drag.js`, `moveTaskTo` in `app.js`, `renderTaskRow` / `renderTaskEditForm` in `render.js` and
`boardList` in `board.js` have no screen left to serve; they stay in place with their tests.

Browser checks that drove the removed screens now drive the Roadmap: `check-desk-screens`, `check-review-status`, `check-priority`,
`check-add-row`, `check-category-filter` (Task details owns the label picker; its "Show all" folds back if the title box is blurred
first, since that repaints the panel). The task editor's due-date step (`renderTaskEditForm`) has no screen, so no browser check reaches it.
