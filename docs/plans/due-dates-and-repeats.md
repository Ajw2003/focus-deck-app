# Due-date stages, repeating tasks and reminders — Plan

Issue: [#106](https://github.com/Ajw2003/focus-deck-app/issues/106). Folds in #69 (make reminder tasks
schedulable). Written 2026-09-30, revised the same day after the user answered the open questions.
Status: **decided, nothing built**.

## Goal

Help a forgetful person stay organised without being overwhelmed. A task with a due date shows how
worried to be at a glance, the urgent ones rise to the top without being hunted for, some tasks come
back on a schedule, and Focus Deck nudges at a time the user chooses. **Maintained flow is the test
for every choice below:** nothing asks a question the user cannot skip, and every skipped question
has a sensible default.

- **Three stages.** White: you have time (also every task with no due date). Yellow: get cooking.
  Red: light a fire under it.
- **Cut-offs are percentages of the time left**, so a task due in 3 months and a task due in 3 days
  both turn yellow and red at a fitting moment (see Stages).
- **Red rises.** A red task moves to the top of its list and is picked first by the focus picker.
- **Repeating tasks** come back after completion instead of staying done. Local-only.
- **Reminders** fire at a configurable time, and when a task crosses into yellow or red.

## Decided (2026-09-30, by the user)

1. **Cut-offs are percentages of the time between "due date set" and "due".** Three bands (white,
   yellow, red) from two cut-offs. Example: due in 3 months turns yellow with about a month left; due in
   3 days turns yellow with about a day left.
2. **Ask in plain terms first, never in percentages.** When a due date is set, a one-line skippable
   step offers concrete choices ("turn yellow at 1 month left"). Dismiss it, or ignore it and save, and
   the percentage defaults apply. The step never blocks saving.
3. **Repeating tasks are local-only**, not linked to a GitHub issue.
4. **The notification route is chosen by a spike**, not assumed.
5. **Red jumps the queue**: first in the focus picker, and first in its list in the project.

One reading is still an assumption, cheap to change: "3 different percentage cut-offs" is taken as
three bands from two cut-offs. If a third cut-off is wanted (for example a fourth stage), it changes
`dueStage` and the settings page only.

## What exists today (checked against the code, 2026-09-30)

- `task.deadline` is a `YYYY-MM-DD` string with no time of day (`js/mutations.js`, `addTask` and
  `updateTask`). Projects have a `deadline` too.
- `deadlineChip(iso)` (`js/state.js`) renders a neutral `.chip.deadline-chip`: "due in Nd", "due today",
  "Nd overdue". Day maths is local midnight, rounded, so a daylight-saving change cannot shift it.
- The deadline is not synced to GitHub (issues have no due date). It travels between devices in the
  sync Gist under the normal per-record `updatedAt` merge.
- Tasks in a project are ordered by `sortOrder` within the Up next and In progress groups
  (`sortTasks`, `js/task-move.js`), set by dragging. The focus picker chooses randomly from the open
  tasks of a label (`pick-focus`).
- No code repeats a task, and no code sends a notification. `service-worker.js` only caches the shell.
- The Claude daily check-in (Roadmap milestone 5) pushed notifications from a Claude scheduled
  session; it is shelved and is not a mechanism to build on.
- Red and orange are already taken by priority chips (`--prio-urgent`, `--prio-high`), so the stage
  colours have to be told apart from those.

## Design

### 1. Stages (PR 1)

A pure function `dueStage(task, now, defaults)` in a new `js/due-stage.js` returns `'white' | 'yellow'
| 'red'` (and `'done'` for a done task, which shows no stage colour). No DOM, so it is unit-tested like
`js/project-filter.js`.

- **Span.** The time from when the due date was set (`task.dueSetAt`, stamped whenever `deadline`
  changes) to the due moment. **Left** is the time from now to the due moment.
- **Stage.** Overdue is always red. Otherwise red when `left / span` is at or under the red cut-off,
  yellow when at or under the yellow cut-off, else white.
- **Percentage defaults:** yellow at 33% of the span left, red at 10%. A 90-day task turns yellow
  with 30 days left and red with 9 days left. A 3-day task turns yellow with 1 day left and red with
  about 7 hours left. A 1-day task turns yellow with 8 hours left and red with about 2.
- **Old tasks** with a deadline but no `dueSetAt` use `createdAt`, then the time the app first saw
  them. A task whose due date is later moved earlier restarts its span.
- **Computed, never stored.** The stage is worked out from the clock each render, so it cannot get
  stuck. Moving a due date later can take a task back from red to white, which is correct.
- **Repeating tasks** use one period as the span (previous occurrence to next), so the same
  percentages fit a daily and a monthly task alike.
- **Per task:** `task.dueStages = { yellow, red }`, each either `{ pct }` or `{ leadHours }`; absent
  means "use the defaults".
- **The skippable step.** When a due date is first set in the add-task form or the editor, one inline
  line appears under the date field: "Turn yellow at **1 week left** and red at **1 day left**
  &nbsp; Skip". The choices are concrete lead times that are shorter than the span (a task due in
  three days is never offered "1 month"). Picking stores `{ leadHours }`. Skip, Escape, or simply
  saving stores nothing, so the percentage defaults apply. It is one line, not a dialog.
- **Settings.** A "Due dates" section in `settings.html` with the two percentage defaults, a plain
  preview ("a task due in 3 months turns yellow on ... and red on ..."), and a reset. Stored in a new
  top-level `state.dueDefaults`. There is no settings object today, and `mergeStates`
  (`js/merge.js`) starts from the local copy for any top-level field it does not name, so this field
  needs its own merge rule (newest stamp wins, like `listStamps`) or it will not sync.

**Visual.** Stage colours paint the deadline chip (tinted background, text colour, same sizing as
the other chips) and nothing else in the row, so the chips column and `chipsMaxPct` are untouched.
New tokens `--due-soon` and `--due-now` in both themes, chosen to be distinguishable from
`--prio-high` and `--prio-urgent` and checked for contrast with a script, not by eye. Colour is never
the only signal: the chip words carry it ("due today", "2d overdue"), and red adds a small icon from
`js/icons.js` (no emoji, per the styling doc).

### 2. Red rises (PR 2)

- **In a project list:** red tasks sort to the top of their group (Up next, In progress), by soonest
  due first, then by the user's own order among equals. This is a display rule layered over
  `sortOrder`, never a rewrite of it, so a task that leaves red returns to exactly where the user
  dragged it. Yellow and white keep the user's order.
- **In the focus picker:** when any open task in the current scope (label card, project pill or
  Surprise me) is red, the pick is made from the red ones only, soonest due first; otherwise the
  current random pick stands. The focus card says why ("Red: due today").
- **Not overwhelming.** The reds are a short ordered list, not a wall: the project list shows them
  first in the normal rows, and the focus card still shows exactly one task. If more than five are red
  at once, a quiet line says so ("7 are red") rather than anything louder.
- **Dragging:** a red task can still be dragged, but it snaps back above the non-red tasks of its
  group in the display, so the drop zone cannot place a white task above a red one. The drag code
  (`js/project-drag.js`) must ignore the red/non-red boundary when computing the stored position.

### 3. Time of day (PR 3)

- `task.dueTime` (`HH:MM`, optional) next to `task.deadline`. No time means end of the due day.
- Chip wording below one day: "due in 5h", "due in 40m".
- Stages are already computed from moments, not dates, so `dueStage` needs no change; its clock input does.
- The chip text must refresh while the page is open (one timer per minute, re-render only when a
  stage or label actually changes).

### 4. Repeating tasks, local-only (PR 4)

Model: `task.repeat = { unit: 'day' | 'week' | 'month', every: 1, weekdays: [1,3,5], time: '09:00',
from: 'due' | 'completion' }`. `weekdays` only applies to `week`. `from: 'due'` keeps the rhythm
(every Monday); `from: 'completion'` counts from the day you finish ("3 days after I last did it").

- **Completing** a repeating task does not leave it done. It logs the completion (`completedLog`
  already exists), moves `deadline` to the next occurrence after now, restarts the span, and keeps
  the task open.
- **Catching up:** if the app was closed for five days, a daily task advances to the next *future*
  occurrence once. It never spawns five overdue copies.
- **Two devices:** completing an occurrence is recorded as `task.lastCompletedFor = '<the due date
  that was completed>'`. A second device completing the same occurrence after it syncs sees the date
  already recorded and does nothing, so the task cannot advance twice. This is the main trap.
- **Local-only (decided):** the editor hides "Create issue" and "Link to an existing issue" for a
  repeating task, and giving a linked task a repeat asks once to unlink it (kept here, dropped from
  GitHub sync, as Unlink does today).
- **Editor:** a "Repeats" select (Never, Daily, Weekly, Monthly, Custom) that reveals only the fields
  it needs.

### 5. In-app reminders (PR 5)

Makes the stages useful without any notification mechanism, and delivers #69.

- A reminder-labelled task (or any task) with a "come back on" date stays out of the way until that
  date, then surfaces at the top of its project and in the focus card's reasons ("Reminder: due").
- A small banner under the top bar on open: "2 tasks are red, 4 are yellow", tapping it scrolls to
  the first. It is the same data the later notifications will send.

### 6. Phone notifications (PR 6), route chosen by a spike

A notification at an exact time while the app is closed needs something that can wake the phone. A
static GitHub Pages site cannot do that alone. Options, with what is and is not verified:

| Option | Works with app closed | Exact time | Cost and catches |
|---|---|---|---|
| A. In-app only (PR 5) | No | n/a | Free. Not a notification. Ships anyway. |
| B. Service worker Periodic Background Sync | Only in an installed Chromium PWA | No, the browser picks the interval | Free. Not supported on iOS. Unverified on this device. |
| C. Web Push from a small server (for example a Cloudflare Worker with a cron trigger and VAPID keys) | Yes | Close | Needs a server, stored subscriptions and keys. iOS needs the PWA installed to the home screen (verify the iOS version). |
| D. A push relay such as ntfy (open source, self-hostable), fed by a scheduled job (GitHub Actions cron) that reads the sync Gist | Yes, through the ntfy app | Within the cron's delay, often several minutes | Free. Needs the Gist readable by the job, a secret, and the ntfy app on the phone. |
| E. A Claude scheduled session | Yes | Daily-ish | Shelved before as less useful than expected. |

Notification Triggers (a browser API for scheduling local notifications) was an origin trial that
did not ship; **verify before relying on any browser-only route**.

**The spike decides (user's call).** A half-day test on the user's real phone of B and D, and C if
those fail, answering: does it fire with the app closed, how late is it, what does the user have to
install or keep running. Its result is written into `docs/6-decisions/Decisions.md` before PR 6
starts. Until then the working lean is D (open source first, no server of our own), which is a lean,
not a decision. Settings ("notify at" time; notify on yellow, red and due) are designed in PR 6,
because how they reach the phone depends on the route. To stay in flow, notifications default to
**one** morning nudge at the set time listing what is red and yellow, plus one when a task turns red,
not a ping per task.

## Data model summary

| Field | On | Added in | Notes |
|---|---|---|---|
| `dueSetAt` | task | PR 1 | stamped when `deadline` changes; the span's start |
| `dueStages {yellow, red}` | task | PR 1 | each `{pct}` or `{leadHours}`; absent = defaults |
| `dueDefaults {yellowPct, redPct}` | state (top level) | PR 1 | needs a new merge rule to reach other devices |
| `dueTime` | task | PR 3 | `HH:MM`, optional |
| `repeat {unit, every, weekdays, time, from}` | task | PR 4 | local-only tasks |
| `lastCompletedFor` | task | PR 4 | the double-advance guard |
| `remindOn` | task | PR 5 | date a reminder returns |

Every new field rides the existing per-record `updatedAt` merge (`js/merge.js`). Each PR adds a
`js/merge` test for its field, because the last silent data-loss bug in this app was a sync bug.

## Pull requests

Each PR: one logical change, tests in the same PR, phone and desktop screenshots (light and dark)
under `docs/generated/prNNN/`, and the docs tier that changed updated in the same PR.

1. **Stages.** `js/due-stage.js` and its test, tokens, stage-coloured deadline chip, `dueSetAt`, the
   skippable step, Settings section, `state.dueDefaults` and its merge rule, `docs/4-systems/styling.md`
   and a new `docs/4-systems/due-dates.md`.
2. **Red rises.** Project-list ordering, focus-picker preference, drag boundary, the "7 are red" line.
3. **Time of day.** `dueTime`, sub-day chip wording, the minute timer.
4. **Repeating tasks.** Model, editor, complete-advances, catch-up, the two-device guard, local-only
   rule. Tests cover month ends (31st), weekdays, daylight-saving change days, and a synced double
   completion.
5. **In-app reminders.** `remindOn`, the banner, the focus-card reason. Closes #69.
6. **Phone notifications.** The spike result first, then the chosen route.

## Traps to keep in mind

- A stage colour that matches a priority colour makes two different meanings look alike.
- Percentages of a span can feel wrong on very short or very long spans (a 5-minute span, a 2-year
  span). The plain-term choices in the skippable step are the escape hatch; PR 1 tests both extremes
  and the user judges the defaults on their real deck before PR 2.
- If everything is red, nothing is: the "N are red" line and one-task focus card are the guard; watch
  it with the user's real deck.
- Red rising is a display rule. Writing it into `sortOrder` would destroy the user's hand ordering
  and sync that loss to other devices.
- A repeating task synced across two devices can advance twice without the guard.
- "Overdue" for a task with a repeat must mean "past its current occurrence", not "older than its
  first ever date".
- The chip's text must update while the page stays open or "due in 1h" lies after an hour.
- Notification permission can be denied or unavailable (iOS outside a home-screen install); the
  settings page has to say so in words, never silently do nothing.

## Out of scope

Calendar (ICS) export, per-project default stages, snooze, and due dates on GitHub issues themselves.
