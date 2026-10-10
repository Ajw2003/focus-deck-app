# Handoff: the Board screen (#140), not started

Written 2026-10-10, at the end of a session, so the next one can build it without re-deriving
anything. Read this first, then `docs/4-systems/styling.md#one-screen-at-a-time`.

## What the user asked for

"Bring the board to life, I want it after all." It means the Board from the mockups: the artboard
"1 · Board, three columns" (`docs/generated/one-thing-mockup/track-board.dc.html`) and "3 · Both:
board narrowed to a project" (`track-both.dc.html`), on the canvas
https://claude.ai/artifact/QG5DouXXbDKAR2bXfjgjBX.

- Three columns: **Up next · In progress · Done**. Done means done this week, newest first.
- All projects by default. A row of project pills narrows it to one, drawn inside that project's
  folder frame, with "← Back to all projects".
- Each card is a paper strip: a checkbox, the title, then the project and category underneath, a
  priority chip, and a left edge in the project's colour.
- Ticking a card's box marks it done. Dragging a card to another column changes its status.
- On a phone, one column at a time behind a three-way switch (Up next / Doing / Done, with counts).
  A swipe moves a card: left toward Up next, right toward Done.

## Where it stands

All on branch `ccr-1569909b-xe23b7`, in PR #134, which is open and not merged.

- The app has one screen at a time from a rail: Focus, Sort and Projects (#135). The rail is
  `renderRail` / `SCREENS` / `normalizeScreen` in `app/js/render.js`, and `renderApp` in
  `app/js/app.js` draws only `ui.screen`. The screen is remembered in `localStorage`
  `focusdeck-screen`.
- **Task statuses already exist:** `'next' | 'doing' | 'done'`. `M.setTaskStatus(taskId, status)` is in
  `app/js/mutations.js:140`. Project folders already group "In progress" (`'doing'`) and "Up next"
  (`render.js`, `taskGroup(p, 'doing', 'In progress', …)` around line 643). GitHub sync maps the
  labels `inprogress` / `wip` / `doing` to `'doing'` (`app/js/github-sync.js:378`), so check whether
  setting `'doing'` should write that label back.
- Dragging between the doing and next groups already exists inside a project folder
  (`app/js/project-drag.js:256-267`). Reuse its keyboard moves and announcements; don't write a
  second drag system.
- Done tasks carry `completedAt`. `state.completedLog` holds the last 12.

## Steps

1. **Add the screen.** Add `'board'` to `SCREENS` with a columns icon, between Sort and Projects. Give
   it a `.screen-board` wide layout, like Focus and Sort, with a max width of about 1320px.
   `renderApp` draws `renderBoard(st, ui)`. Remember `ui.boardProject` (null means all) per device.
2. **The pure part, tested** (`app/js/board.js` + `board.test.mjs`): `boardColumns(st, projectId, now)`
   returns `{ next, doing, done }`. Order next and doing the way `sortTasks` orders a project, done
   newest first and only this week. It also gives each column's count.
3. **The markup** (`renderBoard`): the pills, the three columns of paper cards, and the narrowed
   view's folder frame. The phone switch shows one column at a time.
4. **Wiring:** the checkbox (`toggle-task`, as on rows), the pills, and moving between columns. Use
   drag on a wide screen, reusing project-drag, plus a keyboard move. On a phone, use the switch,
   and the left/right swipe from `scripts/lib/touch.mjs`-style gestures.
5. **Focus:** "Mark in progress" under the sticky note (in the mockup) sets `'doing'`.
6. **Check it:** run `scripts/check-board-browser.mjs` at 1440 and 390 in both themes. It covers
   columns, ticking, moving, narrowing, the phone switch and no sideways scroll. Re-run every other
   check (the list is below); seven of them needed to open the right screen when the rail was
   added, so expect that pattern. Update `docs/4-systems/styling.md`, `docs/3-state/ProjectState.md`
   and a `Decisions.md` entry.

## How to run the checks here

```text
node --test app/js/*.test.mjs
node scripts/check-due-contrast.mjs
python3 generate_icons.py   # once, for the offline check
CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-<name>-browser.mjs
```

Browser checks: desktop, desk-screens, wallet-touch, wallets, in-tray, category-filter, settings,
onboarding, sync-setup, note-faces, service-worker. They all passed on `744a325`.

## Things to know

- **Commits:** credit "AJ's agent" (`Committed by AJ's agent`) per the house rules, with no Claude
  co-author line. PR bodies say `Refs`, never `Closes`.
- **Never pipe a command through `head` or `tail`.** The house-rules hook refuses it. Write to a log
  file and grep it.
- **Look at screenshots, not just pass counts.** Every round so far, looking caught something the
  checks didn't.
- **Use realistic data.** The user has about 19 projects and 45 categories, and layouts that looked
  fine with 5 items went ragged with theirs. The seed in this session's `bigdata.mjs` mirrored their
  project names; use that scale.
