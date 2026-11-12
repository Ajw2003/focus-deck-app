# The six tabs and the header (#262, step 11 of "step by step"; before that #259, five tabs)

Approval: Eden typed "Design approved: step by step 11 2*". Design: `docs/generated/friction-steps/prototype.html`.

The app has six tabs, no numbers, in the order of the flow: **📥 Sort**, **🧹 Organize** (Tidy up and Triage inside), **📁 Projects**,
**🗺 Roadmap**, **◎ Focus**, **✓ Review**. They are ring-binder divider tabs (`.dk-tabs`, the desk-object kit at the end of
`css/app.css`): a bar along the bottom on a phone, a column down the left on a wide screen (>= 1100px) with Tidy up / Triage
sub-items under Organize (`renderRail`, `app/js/render.js`). Only Sort (items to sort) and Review (items waiting) carry a badge.
Tidy up and Triage show Tidy up | Triage buttons at the top of both screens.

- **Header** (`app/index.html`): the app name, the jot box, a **+ Jot** sticky note (`jot-open`; for now it focuses the jot box, #263
  replaces it), the **sync light** (a green dot; amber while syncing, red after an error; `renderSyncButton`) and the **settings dial**
  (link to `settings.html`). Tapping the light opens a small drawer (`ui.syncOpen`) with **Sync now** (`sync-github`) and **Sync settings**
  (`settings.html#sync-section`). The old header sync button, the settings icon and the rail's foot (sync + Settings) are gone.
- **Projects** shows the project list on a clipboard (Find a project, a card and ruler per project, the Sort by drawer, My order, a + New project stamp that starts the four steps of New project: see `projects-tab.md`); tapping a project opens it on the
  **Roadmap** tab, which shows one project. The Roadmap opens the last project picked (localStorage `focusdeck-last-project`, else the
  first); a view that is not one project is turned into it on this tab (`renderApp`). Later issues redesign the insides of both.
- Screen ids: `sort`, `tidy`, `triage`, `projects`, `roadmap`, `focus`, `review` (`SCREENS`). A saved `board` screen (localStorage
  `focusdeck-screen`) opens Projects; anything unknown (an old Start here) opens Focus (`normalizeScreen`). First screen is Focus.
- The jot box is in the topbar, so it is on every tab. On a wide screen (>= 1100px) **J** from anywhere focuses it, except while
  typing in a field or a wallet; **Escape** leaves it (`app/js/app.js`, the document keydown in `init`).
- Task details opens from a task on every tab: a "Details" button on a Sort task slip, a Tidy up row, a Triage row and the Focus note;
  a task title on the Roadmap and Review. Sort, Tidy up, Triage and Focus draw the panel under the screen (`renderApp`).
- The Roadmap took what the Board and Projects screens did; since #267 the project list, its sort and + New project are the Projects tab again, and the project view has "Find a task" across its milestones,
  Edit project, Sync now, the four columns per milestone, adding and ticking tasks. See `roadmap.md`.
- Removed: the Board and Projects screens, the topbar Projects button and drawer, project cards, the sidebar. The code is kept in
  `_to_delete/app/js/` (`board-view.js`, `board-swipe.js`, `render-projects-screen.removed.js`).

Check: `scripts/check-tabs-browser.mjs` (one assertion per row of the inventory table, named after the row).
Left for later: `app/js/project-drag.js`, `moveTaskTo` in `app.js`, `renderTaskRow` / `renderTaskEditForm` in `render.js` and
`boardList` in `board.js` have no screen left to serve; they stay in place with their tests.

Browser checks that drove the removed screens now drive the Roadmap: `check-desk-screens`, `check-review-status`, `check-priority`,
`check-add-row`, `check-category-filter` (Task details owns the label picker; its "Show all" folds back if the title box is blurred
first, since that repaints the panel). The task editor's due-date step (`renderTaskEditForm`) has no screen, so no browser check reaches it.
