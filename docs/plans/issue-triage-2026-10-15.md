# Issue triage, 2026-10-15

Asked for in #162: group the open issues into sensible bursts of work, close the ones that are
already done or duplicated, and record the process so it can become a reusable house-rules skill
(the draft skill is `docs/plans/issue-triage-skill/SKILL.md`).

**Status:** proposal. Nothing has been closed or relabelled yet. Closing an issue needs aj's
go-ahead after testing (house rule "A plan over three steps becomes issues").

## What was checked

- All 47 open issues on `Ajw2003/focus-deck-app`, plus the titles of all 77 closed ones (to spot
  repeats).
- Every commit on `main` (238) for a `#N` mention of an open issue:
  `git log origin/main --format='%h %s' --grep='#N\b' -E`.
- Every merged pull request into `main` for `#N` in its title or body.
- For older issues the redesigns may have overtaken, the current code under `app/` (named per row
  below).

## 1. Done on main: close after a test

Each of these has a merged pull request that says `Refs #N` and the commits to match. They stay
open only because the house rules forbid closing words in pull requests.

| Issue | Done by | What to test before closing |
|---|---|---|
| #140 Board screen: Up next, In progress and Done across projects | PR #148 (merged 2026-10-10) | The Board opens from the rail and shows three columns |
| #142 Board screen in the rail, between Sort and Projects | PR #148, commit `353bd9f` | The rail has a Board entry between Sort and Projects |
| #143 Board columns worked out and tested | PR #148, commit `ddf5eba` | Done shows only this week's tasks |
| #144 Board look: project pills, paper cards, folder frame, phone switch | PR #148, commit `aa7325e` | On a phone, one column at a time behind a switch |
| #145 Board actions: tick to finish, move cards between columns | PR #148, commit `c5a3acd` | Tick, drag (wide screen) and swipe (phone) all move a card |
| #146 "Mark in progress" under the sticky note on Focus | PR #148, commit `df3abe7` (`app/js/render.js:195`) | The button moves the focused task to In progress |
| #147 Board browser check and docs | PR #148, commit `0e3c52f` | Nothing to use; the docs and screenshots are on main |
| #107 Due dates: colour stages from percentage cut-offs (PR 1 of 6) | PR #113 (merged 2026-09-30) | A task due soon turns yellow then red |
| #114 Fix due dates not quite working, especially one-day due dates | PR #149 (merged 2026-10-11), commit `466bd97` | A task due tomorrow is yellow, not white |

#140 is the parent of #142–#147, so it closes with them.

## 2. Duplicate or folded in: close as duplicate

| Issue | Same as | Why |
|---|---|---|
| #69 Make reminder tasks schedulable | #111 (due dates PR 5 of 6) | #111's body says it "also delivers #69"; the roadmap folded it in on 2026-09-30 |

No other open issue repeats a closed one. Several old titles appear twice (for example #22/#36,
#21/#35, #30/#44, #41/#27); in each pair the older copy is already closed and the open one is the
survivor, so nothing further to do.

## 3. The bursts

Each burst is one branch and one pull request unless it says otherwise. Ordered by what hurts
most first: losing data, then broken sync, then things that look or feel wrong, then new features.

### Burst A — Never lose what I'm writing (bugs, do first)

- #155 Syncing must not overwrite a thought or task mid-write
- #157 Clicking off a task being created, with steps written, discards it

Both are "in-progress text is lost". One fix shape: treat an open editor as a draft that is saved
before anything (a sync, a click away) can replace it. Touches `app/js/app.js`, `app/js/merge.js`.

### Burst B — GitHub sync reliability (bugs)

- #93 GitHub issues not pulled in properly, and new tasks not reaching GitHub
- #94 A task and an issue with the same number: the issue is silently ignored
- #102 Moving a task says it moves the issue between repos, but nothing happens and no error shows

All in `app/js/github-sync.js` / `app/js/github.js`. #102 also breaks "nothing fails silently".
Probably two pull requests: #93 + #94 (pulling in), then #102 (moving).

### Burst C — Phone layout and touch fixes

- #160 Scrolling up and down is hard because swipe-up overrides it
- #152 Category names sometimes cut off on a phone
- #153 Unsorted item with a project but no category has its label cut off
- #154 Focus Deck icon on a phone

Small, visual, each needs a phone-width screenshot before and after.

### Burst D — Adding and editing tasks

- #158 Steps in a project: "3 of 5 done" at a glance, and a less cluttered task editor
- #156 Make Cancel smaller (in the same editor)
- #161 Assigning several categories quickly again, alongside the scrolling picker
- #103 "Add a task" as one field, like the jotter at the top, instead of a button and several fields

All in the task editor and the add-task row. #158 is the big one; the others ride with it or
follow straight after.

### Burst E — Focus and Sort flow polish

- #74 Focus card: **Back** instead of **Clear**, and auto-clear on close behind a setting
  (still "Clear" today, `app/js/render.js:204`)
- #76 Sort flow: a more deliberate **Done**, and easier switching between Sort and Focus
  (the side rail from PR #134 may already cover the switching half; check)
- #96 "What's your focus right now?" follows the open project in one-project mode
- #89 Pick several projects for Surprise me (one project already works through the project wallet,
  `app/js/render.js:118`; several do not)
- #151 The "Filed to X" message disappears after 5 seconds
- #159 Notes in the tray editable after filing

### Burst F — Due dates, the rest of the plan (already ordered)

#106 is the parent; its plan `docs/plans/due-dates-and-repeats.md` already sets the order:
#108 red rises → #109 time of day → #110 repeating tasks → #111 in-app reminders (and #69) →
#112 phone notifications. One pull request each.

### Burst G — Look and feel (needs aj first)

- #150 "Fix focus deck UI not being proper": no description. **Needs aj to say what is wrong**
  before it can be built.
- #90 Make the completion bar a little more distinct
- #87 Warmer, like a leather-edged notebook: the desk redesign (PR #127, #116) was built around
  real stationery and may have answered this. **aj to say if it is done.**

### Later — ideas and research, not ready for a burst

| Issue | Kind |
|---|---|
| #27 Audit the usability and accessibility | Review |
| #36 Sync pull requests too | Feature |
| #35 Commits and commit frequency visual | Feature |
| #48 Time-of-day suggestions | Feature (builds on labels; the energy system it once relied on is deleted) |
| #51 Two people link the same issue from separate decks | Review |
| #4 ClickUp tasks to GitHub issues | Feature |
| #115 Safe note-taking while driving | Research |
| #44 School pilot, then public release | Chore |

## 4. Docs that are out of date

- `docs/2-roadmap/Roadmap.md` milestone 9 still lists #46 as open; it is closed.
- The roadmap has no milestone for the Board (#140) or for issues #150–#161.

These get fixed once aj agrees the grouping, so the roadmap follows the bursts above.

## 5. What happens next, once agreed

1. Close section 1 and section 2 issues, each with a comment linking the merged pull request and
   the `Claude completed this` label.
2. Create one parent issue per burst (A to G), labelled `AjsAgent created this` plus a category,
   and attach its issues as sub-issues.
3. Update the roadmap to match.
4. Start Burst A.
