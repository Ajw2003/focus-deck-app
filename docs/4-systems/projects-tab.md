# Projects tab (#267)

The Projects tab is the project list and New project. Tapping a project opens it on the Roadmap tab ([roadmap.md](./roadmap.md)),
which shows one project. Design approved by Eden ("step by step 11 2*"); the screens are r0, r0m, r0o, r5 to r9 in
`docs/generated/friction-steps/prototype.html` (`?all=roadmap`, "Projects tab"). Standing rule: no small text, captions or hints;
nothing under 13px; every screen fits 390x844 without scrolling (a long list scrolls inside its own box).

## What owns it

`js/projects-view.js` (markup: `renderProjects`, `noProject`), the Projects-tab block in `js/app.js` (`onProjectsAction`,
`makeNewProject`, `openNewProject`, `fetchNewPanelRepos`), the `.pj-*` rules at the end of `css/app.css`. It reuses the Sort steps'
`stamp`, `foot`, `dots`, `choice` (`js/sort-flow-view.js`) and Organize's clipboard `board` (`js/tidy-view.js`). Memory-only state:
`ui.np` (the open New project flow), `ui.projSortOpen`, `ui.projOrder`; the sort order itself is `focusdeck-project-sort`.
Tests: `render.test.mjs` (the list, drawer, My order and every New project step), `roadmap.test.mjs`, `view-switch.test.mjs`; browser walk
`scripts/shoot-projects-267.mjs` (screenshots in `docs/generated/projects-267/`).

## The screens

- **Projects** (r0): a clipboard titled Projects; Find a project; one card per project (a coloured top edge in the project's colour,
  "📁 name", a ruler showing percent done = `roadmapOf(p).pct`); the brass drawer handle at the top right; a "+ New project" stamp.
  The list is every project of the area on the view tape, or every project; a tape on one project does not shrink it.
- **Sort by** (r0m): the handle opens a card-index drawer: A–Z (`name`), Most tasks (`open-tasks`), Due soonest (`deadline`),
  Last synced (`recent-sync`), My order (`custom`, marked ↑↓). The choice is saved per device. Picking My order opens the next screen.
- **My order** (r0o): a ↑ and a ↓ key on each row (`rm-project-step`, through `moveProject` and `applySortOrders`, so a move changes
  one project's `sortOrder`); a Done stamp goes back to the list. The end keys are off.
- **New project**, four steps with progress dots, a Back corner and a Next stamp (Escape also steps back):
  1. **Name it** (r5): a jotter field. Next is off until there is a name.
  2. **Which area?** (r6): the areas as index cards (not Unsorted, which is "no area"; tap again to clear) and **+ New area** (a name field; the area is made with `addProjectCategory` when the project is).
  3. **Pick a colour** (r7): six swatches. Nothing picked keeps the project's own colour (its area's, else the next hue); a pick is `setProjectColor`.
  4. **On GitHub?** (r8): No, 🔗 My repo, ✨ New repo, 👀 Someone else's, and the **Make it** stamp. Without a GitHub token only No works and a card links to Settings.
     - **Which repo?** (r8a): Find a repo and the repos you own or collaborate on that are not tracked (`listYourRepos`, `untrackedRepos`); **Link it**.
     - **New repo** (r8b): a name (starts as the project name made safe; GitHub's rule, `isValidRepoName`, shows under it when broken), 🔒 Private / 🌍 Public; **Create it** (`createRepo`).
     - **Paste its link** (r8c): `owner/repo` or a github.com link (`parseRepoInput`); **Track it**.
  Make it, Link it, Create it and Track it all end the same way: the project is made (`addProject`), linked to its repo where there is one
  (`linkProjectToRepoOnGithub` / `linkProjectToRepoByInput`, the same functions the Edit panel uses), given its area (`setProjectCategory`)
  and colour, becomes the last-used project, and the Roadmap opens on it with a "Made ✓" slip (r9). If GitHub refuses, the new project is
  taken back out (`removeProject`, `unpinRepo`) and the reason shows on the step; nothing is left behind.
  A project made from a repo keeps the typed name, not the repo's. The Settings checklist's "Link a repo" (`?new=repo`) opens the flow on Which repo?.
- The Roadmap tab with no project yet shows "No projects yet." and the same + New project stamp (`noProject`).

## What the Roadmap lost

"+ New project" is no longer in the Roadmap's menu. Removed with the group view (see roadmap.md): the per-project milestone cards and "Now: <milestone>" line, the
select box for the sort, and the two-tab "+ New" panel (New project / GitHub repo) with its paste, create and Track-from-list forms. The same
mutations remain under the four steps (no new data fields).

## Inventory of the old actions

| Old action | Now |
| --- | --- |
| `rm-open` | kept: a card opens the project on the Roadmap and sets the last-used project |
| `set-project-query` | kept: Find a project |
| `set-project-sort` (a select) | changed: a card in the Sort by drawer (`data-value`) |
| `rm-project-step` | kept: the ↑↓ keys on My order |
| `toggle-new-panel` | changed: the + New project stamp starts the four steps |
| `start-new-project` | kept: starts the four steps |
| `add-new-project` (a form) | changed: the Make it stamp |
| `set-new-panel-tab`, `paste-repo` | dropped: replaced by steps 4 and Paste its link |
| `create-repo` (a form), `track-repo` (a list button) | changed: the Create it and Track it stamps |
| `retry-new-panel-repos`, `set-repo-filter` | kept: Which repo? |
| `link-repo`, `paste-link-repo`, `toggle-link-panel`, `retry-link-panel-repos` | kept: the Edit project panel's link to a repo |
| milestone cards and "Now:" on each project row | dropped from the list (the Roadmap shows them in the project) |
