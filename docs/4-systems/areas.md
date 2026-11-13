# Areas and kinds of work

> **2026-11-12 (#259):** the Board and Projects screens were removed in the five-tab change; the Roadmap took over their jobs. Where this file describes them as current it is history. See [tabs.md](./tabs.md).

## What it owns

`js/areas.js` (pure, no imports), the Settings rows "Areas" and "Kinds of work" (`settings.html`), and the
mutations in `js/mutations.js` (`renameProjectCategory`, `removeProjectCategory`, `setProjectCategory`,
`setKindOfWork`, `setLabelPriority`). Tests: `js/areas.test.mjs`; browser check: `scripts/check-areas-browser.mjs`.

## Areas

An **area** is what the code still calls a project category: the stored key is `state.projectCategories` and
the ids (`pcat_*`) are unchanged, so sync and merge are untouched. Only names and UI say "Area" (Settings, a
project's Edit panel, the Board's filter drawer, the Projects filter pills).

- Defaults for a new user (`DEFAULT_AREAS`): Personal, Lists, Home, Apps, Games, Work, School, Unsorted, each
  with its own colour. Ids are fixed (`pcat_home`, ...), not `uid()`, so two devices that each add a missing
  default produce the same record and the id merge keeps one.
- **Unsorted** (`pcat_unsorted`) cannot be renamed or deleted (the mutations refuse). A project with no area,
  or whose area no longer exists, counts as Unsorted (`areaIdOf`). Moving a project to Unsorted stores
  `categoryId: null`. Unsorted may be recoloured.
- Each project is in exactly one area (`project.categoryId`). Deleting an area (confirm in Settings) sets its
  projects' `categoryId` to null, i.e. Unsorted.
- **One-time migration** (`migrateAreas`, run from `withDefaults` in `state.js` for saved data without
  `areasMigrated`): keeps every existing area, adds each missing default matched by name (case-insensitive) or
  id, then sets `state.areasMigrated = true`. A user who later deletes a default is not given it back.
  `mergeStates` ORs the flag (`js/merge.js`), so it never goes back to false. Existing users keep pcat_work,
  pcat_personal, pcat_learning and custom areas.

## Kinds of work

The user's labels are `state.categories`. Two optional fields on each label record (stamped and merged like
any category edit, no new state key):

- `kind` (boolean): ticked = a kind of work, offered on Focus's kinds row (`renderCategoryWalletInner` uses
  `kindsOfWork`). Absent means ticked unless `isWorkflowLabel(name)` (needs review, duplicate, AjsAgent created
  this, in progress, wip, asap, and the priority labels). Unticked labels stay on tasks and GitHub; they are
  only not offered. A task with only unticked labels is still reachable by "Surprise me".
- `priority` (urgent/high/medium/low): the label counts as that priority. `effectivePriority(task, st)` returns
  the task's own priority, else the most urgent mapped label's. Used by the priority chip (`pick-bits.js`),
  done-task chip and focus note (`render.js`), Board glance line (`board-view.js`), card colour
  (`card-key.js`) and the task details summary. The stored `task.priority` and what is pushed to GitHub are
  never changed by a mapping.

There is no priority-based sort in the app today, so no sort needed changing.

See also [local-storage.md](./local-storage.md), [gist-sync.md](./gist-sync.md), [styling.md](./styling.md).
