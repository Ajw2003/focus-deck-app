# Due dates

## What it owns

How a task's deadline chip turns white, yellow or red (PR 1 of #106, `docs/plans/due-dates-and-repeats.md`):
the pure stage function, the moment a due date was set (`task.dueSetAt`), the per-task lead times
(`task.dueStages`), the global percentage defaults (`state.dueDefaults`), the skippable step under
the date field, and the Settings section. Red rising, time of day, repeats and reminders are later
PRs and are not here.

## How it works

- **The stage is computed, never stored.** `dueStage(task, now, defaults)` (`js/due-stage.js:59`)
  returns `'white' | 'yellow' | 'red' | 'done'`. It is pure (no DOM, no clock of its own), so it is
  unit-tested in `js/due-stage.test.mjs`.
- **Span and left.** Span runs from `task.dueSetAt` (else `createdAt`, else now) to the due moment, the
  end of the due day in local time (`dueMoment`, `js/due-stage.js:38`). Left runs from now to the
  due moment. Overdue is always the last stage (`'red'`); otherwise red when left/span is at or under the red cut-off,
  yellow at or under the yellow cut-off. Defaults 33% and 10% (`DEFAULT_DUE_DEFAULTS`).
- **How an overdue task shows (Comfort, #203).** The stage stays `'red'`, but `deadlineChip` (`js/state.js`)
  words and colours it by the Comfort setting "Tasks past their date": by default amber "Nd past its date"
  (class `due-amber`), or red "Nd overdue" (`due-red`) when chosen. The flame icon stays either way. See
  `docs/6-decisions/Decisions.md` (the 2026-10-19 calm-by-default entries).
- **Due today is always red (#214, #215, built 2026-10-20, design C on `docs/plans/due-colours.html`).**
  From the midnight that starts the due day, the stage is `'red'` whatever the span or lead times
  (`app/js/due-stage.js:74`), so a date set on the day itself never shows yellow. The Board's
  "Due today" key label is red too (`app/js/card-key.js:16`). In light mode the yellow chip has a
  34% olive fill and a solid olive border, set by `--due-soon-fill` and `--due-soon-edge`
  (`app/css/app.css:26`, used at `app/css/app.css:342`). Its words use the darker `--due-soon-ink`
  (`#3A4200`), because the approved olive `#4F5A00` on that fill reached only 3.65:1, under the
  4.5:1 that `scripts/check-due-contrast.mjs` requires; `#3A4200` reaches 5.21:1 or better. Dark mode
  keeps the 18% fill and 60% border (`app/css/app.css:92`, `:123`). Board cards are paper in both
  themes, so they take the light set (`app/css/app.css:1174`); before this they took the dark
  yellow, which was nearly invisible on a cream card.
- **The day-before floor (#114).** Whatever the percentage says, a task is yellow from the midnight
  that starts the day before its due day (`dayBeforeStart`), so "due tomorrow" is never white. A
  yellow lead time chosen in the step for that task wins over the floor. Red is unchanged.
  `stageMoments` takes the same floor, so the Settings preview cannot drift.
- **Per-task lead times.** `task.dueStages = { yellow, red }`, each `{ pct }` or `{ leadHours }`; a
  missing stage uses the defaults. The skippable step only ever writes `{ leadHours }`.
- **Stamping.** `addTask` and `updateTaskFields` (`js/mutations.js:74`, `:101`) set `dueSetAt` when a
  deadline is set or changes, and never when it is unchanged (the edit form sends the deadline on
  every save). A changed or cleared deadline drops old `dueStages` unless the caller brings new ones:
  lead times chosen for one span do not fit another.
- **The chip.** `deadlineChip(iso, task)` (`js/state.js:342`) adds `due-white|due-yellow|due-red` for a
  task; a project deadline calls it without a task and stays neutral; a done task adds no class. Red
  adds `ICON_DUE_RED`. The words are unchanged.
- **The step.** `renderDueStageStep` (`js/render.js:327`) is inserted after the date input by
  `syncDueStageStep` (`js/app.js:643`) when a date is set or changed. It offers only lead times
  shorter than the span (`leadChoices`), red always shorter than yellow. Nothing is stored until a
  select is touched (hidden `dueStepChosen`); Skip, Escape, or saving untouched store nothing.
- **Settings.** `settings.html` "Due dates": two percentage inputs saved through `setDueDefaults`
  (`js/mutations.js:318`), a preview built by `stageMoments` (the same arithmetic as `dueStage`), and
  Reset. Invalid pairs (red not lower than yellow, outside 1-99) are refused with a message.
- **Sync.** `state.dueDefaults = { yellowPct, redPct, updatedAt }` has its own rule in `mergeStates`
  (`js/merge.js:112`): newest `updatedAt` wins, a side without it keeps the other. `dueSetAt` and
  `dueStages` ride the task's ordinary `updatedAt` merge.

## Invariants

- No deadline is white; a done task is `'done'`; overdue is the red stage whatever the span or lead times (shown amber by default, see above).
- `dueSetAt` is clamped to now inside `dueStage`, so clock skew cannot make left exceed span.
- The due moment is built from the date parts, so a daylight-saving day is 23 or 25 hours and the
  stage still follows (tested with America/New_York).
- Colour is never the only signal: words carry the state, red adds an icon, and the stage chips have
  a border the borderless priority chips do not.
- `scripts/check-due-contrast.mjs` must pass: chip text at least 4.5:1 on its tint in light and dark.

## Traps

- **Old tasks have no `dueSetAt`** and no `createdAt`. `ensureDueSetAt` (`js/state.js`, called from
  `repairLoaded`) stamps them with now on load, so a task due in 2 days turns yellow and red on the
  2-day schedule from that moment. Without it they would stay white until overdue. Two devices may
  stamp different "now"s; the newer task record wins the merge, which only shifts the span start.
- The stage tokens are close in use to priority chips: `--due-soon` (olive-lime) is 22 degrees from
  the gold `--prio-medium`, `--due-now` (crimson) 25 degrees from `--prio-urgent`. The border, words
  and icon are what tell them apart; do not drop them.
- A 5-minute or 2-year span makes the percentages feel odd; the plain-term step is the escape hatch.
- `mergeStates` starts from the local copy for any top-level field it does not name; a new top-level
  field needs its own merge rule.
- Test files that run the full suite must run from outside `C:\Users\aj` (a stray `package.json`
  there makes Node read `.mjs` files as CommonJS).
