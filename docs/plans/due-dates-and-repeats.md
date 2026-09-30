# Due-date stages, repeating tasks and reminders — Plan

Issue: [#106](https://github.com/Ajw2003/focus-deck-app/issues/106). Folds in #69 (make reminder tasks
schedulable). Written 2026-09-30. Status: **proposed, nothing built, several decisions open**.

## Goal

A task with a due date shows how worried to be at a glance. Some tasks come back on a schedule.
Focus Deck nudges you at a time you choose, including when a task changes stage.

- **Three stages.** White: you have time (also every task with no due date). Yellow: get cooking.
  Red: light a fire under it.
- **Two thresholds** decide when a task turns yellow and red. Defaults live in Settings; any one task
  can override them.
- **Repeating tasks** come back after completion instead of staying done.
- **Reminders** fire at a configurable time, and when a task crosses into yellow or red.

## What exists today (checked against the code, 2026-09-30)

- `task.deadline` is a `YYYY-MM-DD` string with no time of day (`js/mutations.js`, `addTask` and
  `updateTask`). Projects have a `deadline` too.
- `deadlineChip(iso)` (`js/state.js`) renders a neutral `.chip.deadline-chip`: "due in Nd", "due today",
  "Nd overdue". Day maths is local midnight, rounded, so a daylight-saving change cannot shift it.
- The deadline is not synced to GitHub (issues have no due date). It travels between devices in the
  sync Gist under the normal per-record `updatedAt` merge.
- No code repeats a task, and no code sends a notification. `service-worker.js` only caches the shell.
- The Claude daily check-in (Roadmap milestone 5) pushed notifications from a Claude scheduled
  session; it is shelved and is not a mechanism to build on.
- Red and orange are already taken by priority chips (`--prio-urgent`, `--prio-high`), so the stage
  colours have to be told apart from those.

## Design

### 1. Stages (PR 1)

A pure function `dueStage(task, now, settings)` in a new `js/due-stage.js` returns `'none' | 'white' |
'yellow' | 'red'`. No DOM, so it is unit-tested like `js/project-filter.js`.

- No deadline, or task done: `white` (done tasks show no stage colour at all).
- Otherwise compare the time left to the task's two thresholds: `red` at or under the red threshold
  (including overdue), `yellow` at or under the yellow threshold, else `white`.
- **Proposed defaults:** yellow at 3 days before the due date, red at 1 day before (so red is
  tomorrow, today and overdue). Stored in hours so PR 2 can use times of day without a rewrite:
  72 and 24.
- **Repeating tasks cap the defaults** at 50% and 20% of their period, so a daily task is not
  yellow the moment it comes back.
- **Per-task override:** the editor gets a collapsed "Colours and reminders" group with two number
  fields (yellow at, red at, in days). Blank means "use the default". Stored as
  `task.dueStages = { yellowBeforeHours, redBeforeHours }`, absent when unset.
- **Settings:** a new "Due dates" section in `settings.html` with the two defaults and a preview row.
  Stored in a new top-level `state.dueDefaults`. There is no settings object today, and
  `mergeStates` (`js/merge.js`) starts from the local copy for any top-level field it does not name,
  so this field needs its own merge rule (newest stamp wins, like `listStamps`) or it will not sync.

**Visual.** Stage colours paint the deadline chip (tinted background, text colour, same sizing as
the other chips) and nothing else, so the chips column and `chipsMaxPct` are untouched. New tokens
`--due-soon` and `--due-now` in both themes, chosen to be distinguishable from `--prio-high` and
`--prio-urgent` and checked for contrast with a script, not by eye. Colour is never the only signal:
the chip words carry it ("due today", "2d overdue"), and red adds a small icon from `js/icons.js`
(no emoji, per the styling doc).

### 2. Time of day (PR 2)

- `task.dueTime` (`HH:MM`, optional) next to `task.deadline`. No time means end of the due day.
- Chip wording below one day: "due in 5h", "due in 40m".
- Thresholds are already in hours, so `dueStage` needs no change; its clock input does.
- The chip text must refresh while the page is open (one timer per minute, re-render only when a
  stage or label actually changes).

### 3. Repeating tasks (PR 3)

Model: `task.repeat = { unit: 'day' | 'week' | 'month', every: 1, weekdays: [1,3,5], time: '09:00',
from: 'due' | 'completion' }`. `weekdays` only applies to `week`. `from: 'due'` keeps the rhythm
(every Monday); `from: 'completion'` counts from the day you finish ("3 days after I last did it").

- **Completing** a repeating task does not leave it done. It logs the completion (`completedLog`
  already exists), moves `deadline` to the next occurrence after now, and keeps the task open.
- **Catching up:** if the app was closed for five days, a daily task advances to the next *future*
  occurrence once. It never spawns five overdue copies.
- **Two devices:** completing an occurrence is recorded as `task.lastCompletedFor = '<the due date
  that was completed>'`. A second device completing the same occurrence after it syncs sees the date
  already recorded and does nothing, so the task cannot advance twice. This is the main trap.
- **GitHub:** a repeating task is **local-only in v1** (proposed): the editor hides "Create issue"
  and "Link to an existing issue" for it, because a GitHub issue has one open/closed state and no
  notion of "again". Open question 3.
- **Editor:** a "Repeats" select (Never, Daily, Weekly, Monthly, Custom) that reveals only the fields
  it needs.

### 4. In-app reminders (PR 4)

Makes the stages useful without any notification mechanism, and delivers #69.

- A reminder-labelled task (or any task) with a "come back on" date stays out of the way until that
  date, then surfaces at the top of its project and in the focus card's reasons ("Reminder: due").
- A small banner under the top bar on open: "2 tasks are red, 4 are yellow", tapping it scrolls to
  the first. It is the same data the later notifications will send.
- Open question 5: does a red task also get priority in the focus picker's random pick?

### 5. Phone notifications (PR 5)

A notification at an exact time while the app is closed needs something that can wake the phone. A
static GitHub Pages site cannot do that alone. Options, with what is and is not verified:

| Option | Works with app closed | Exact time | Cost and catches |
|---|---|---|---|
| A. In-app only (PR 4) | No | n/a | Free. Not a notification. Ships anyway. |
| B. Service worker Periodic Background Sync | Only in an installed Chromium PWA | No, the browser picks the interval | Free. Not supported on iOS. Unverified on this device. |
| C. Web Push from a small server (for example a Cloudflare Worker with a cron trigger and VAPID keys) | Yes | Close | Needs a server, stored subscriptions and keys. iOS needs the PWA installed to the home screen (verify the iOS version). |
| D. A push relay such as ntfy (open source, self-hostable), fed by a scheduled job (GitHub Actions cron) that reads the sync Gist | Yes, through the ntfy app | Within the cron's delay, often several minutes | Free. Needs the Gist readable by the job, a secret, and the ntfy app on the phone. |
| E. A Claude scheduled session | Yes | Daily-ish | Shelved before as less useful than expected. |

Notification Triggers (a browser API for scheduling local notifications) was an origin trial that
did not ship; **verify before relying on any browser-only route**.

**Recommendation:** ship A in PR 4, run a half-day spike on B and D on the user's real phone before
choosing, and default to D (open source first, no server of our own) unless the spike shows exact
times matter more than running a server. The "notify at" time, and whether to notify on yellow, red
and due, are settings; how they reach the phone depends on that choice, so they are designed in PR 5,
not before.

## Data model summary

| Field | On | Added in | Notes |
|---|---|---|---|
| `dueStages {yellowBeforeHours, redBeforeHours}` | task | PR 1 | absent = defaults |
| `dueDefaults` | state (top level) | PR 1 | needs a new merge rule to reach other devices |
| `dueTime` | task | PR 2 | `HH:MM`, optional |
| `repeat {unit, every, weekdays, time, from}` | task | PR 3 | local-only tasks |
| `lastCompletedFor` | task | PR 3 | the double-advance guard |
| `remindOn` | task | PR 4 | date a reminder returns |

Every new field rides the existing per-record `updatedAt` merge (`js/merge.js`). Each PR adds a
`js/merge` test for its field, because the last silent data-loss bug in this app was a sync bug.

## Pull requests

Each PR: one logical change, tests in the same PR, phone and desktop screenshots (light and dark)
under `docs/generated/prNNN/`, and the docs tier that changed updated in the same PR.

1. **Stages.** `js/due-stage.js` and its test, tokens, stage-coloured deadline chip, Settings
   section, per-task override, `docs/4-systems/styling.md` and a new `docs/4-systems/due-dates.md`.
2. **Time of day.** `dueTime`, sub-day chip wording, the minute timer.
3. **Repeating tasks.** Model, editor, complete-advances, catch-up, the two-device guard, local-only
   rule. Tests cover month ends (31st), weekdays, daylight-saving change days, and a synced double
   completion.
4. **In-app reminders.** `remindOn`, the banner, the focus-card reason. Closes #69.
5. **Phone notifications.** The spike result first (written into `docs/6-decisions/Decisions.md`),
   then the chosen route.

## Decisions needed from the user

1. **"3 intervals".** Read here as the two switch-over points that make three colour stages. If it
   means three notification moments (yellow, red, due), that is PR 5's settings and does not change PR 1.
2. **Defaults.** Yellow 3 days out, red 1 day out. Change either before PR 1 if it feels wrong.
3. **Repeating tasks local-only?** The alternative is one GitHub issue per occurrence, which needs
   issue creation on every repeat and a rule for the old issue. More moving parts, more ways to spam
   a repo.
4. **Notification route.** Recommendation above; the spike can decide.
5. **Does red change the focus pick?** Default here: no, red only colours and notifies.

## Traps to keep in mind

- A stage colour that matches a priority colour makes two different meanings look alike.
- A repeating task synced across two devices can advance twice without the guard.
- "Overdue" for a task with a repeat must mean "past its current occurrence", not "older than its
  first ever date".
- The chip's text must update while the page stays open or "due in 1h" lies after an hour.
- Notification permission can be denied or unavailable (iOS outside a home-screen install); the
  settings page has to say so in words, never silently do nothing.

## Out of scope

Calendar (ICS) export, per-project default stages, snooze, and due dates on GitHub issues themselves.
