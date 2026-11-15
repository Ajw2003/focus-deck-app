# Desk layout: the next step is the biggest thing (#281)

> **Status: built 2026-11-15, waiting on Eden's test.** Approved the same day (see `docs/6-decisions/Decisions.md`).
> Steps #282 to #286. Each section says what was planned; "As built" at the end says where it is in the code.

## What it owns

The layout of Focus, Roadmap, Sort, Review and Organize (Tidy up, Triage) on a phone and a computer, and the four
shapes below. It owns no data: nothing new is stored. Drawings: `docs/generated/design-audit/mockups.html`
(shot by `shoot-mockups.mjs`); the audit screenshots of the app before the change are `now-*.png` beside it.

## The four shapes

| Shape | Means | Rule |
|---|---|---|
| Yellow sticky note | A task | The biggest one on a screen is the one to do next |
| Small coloured note | The next step of one area or project | The colour is the area's colour |
| Rubber stamp | The main action of a screen | One per screen |
| Plain button | Everything else | Always carries a word; no bare handle or "⋯" |

## The clipboard (#282)

The clipboard stays (Eden's answer to choice 4). Today each of these screens is capped at 560px
(`app/css/app.css:1391`, `:1408`, `:1425`; Sort at `:803` and `:908`). After the build it fills the height left by the
header and tabs, is as wide as its column allows, and the note or slip on it stretches to fill it.

## The next step of a project or an area (#282)

One pure function beside the existing pick order (`app/js/pick-order.js`) returns the first open task of a project in
the order "Pick for me" uses; the next step of an area is the first of its projects' next steps in that same order.
Focus and Roadmap both read it, so the two screens never disagree.

## Focus (#283)

Focus opens on a task without asking anything (`M.pickForMe` when there is no focus). The two questions
(`renderPicker`, `app/js/focus-view.js:56`) open from "Choose…". "Not now" is today's Another (`M.reroll`); "More" is
today's ⋯ drawer. Under the clipboard on a phone: one small note per area; tapping it shows that area's projects.
Beside the clipboard on a computer (>= 1100px): one small note per project in a column per area. Tapping a small note
is `M.setFocus` on that task.

## Roadmap (#284)

On a computer the four lists (Up next, Doing, Review, Done) are columns. The first Up next task is a yellow note
marked "Next step" at both sizes. A list longer than its cap shows a "Show more" line. On a phone the lists stay tabs.

## Sort, Review, Organize (#285)

The slip fills the clipboard and the edges of the waiting slips show behind it. On a computer the next few are listed
beside the clipboard under "After this one".

## As built

- **Plain button:** `.dk-plain` (`app/css/app.css`). The 560px caps named above are lifted on a computer by the block
  headed "What sits on the clipboard stretches to fill the paper": the clipboard screens are `min(900px, 100%)` wide.
  A title longer than 48 characters is written smaller (`.focus-title.is-long`) so a phone still fits.
- **Next step:** `nextStepOf(project, st, today)` and `nextStepOfArea(areaId, st, today)` (`app/js/pick-order.js:52`).
  A project with no area counts as Unsorted.
- **Focus:** `paint()` calls `M.pickForMe()` when the Focus tab shows with no focus, no crossed-out note and no
  `ui.focusChoosing` (`app/js/app.js:492`). "Choose…" is `focus-choose`; `renderFocus` then draws the two questions
  (`app/js/focus-view.js:103`). ✕ Clear in the More drawer also leads to the questions. Small notes:
  `renderNextNotes` (`app/js/focus-view.js:130`). A phone shows four area notes at most, then an "All N areas" button
  (`focus-all-areas`); `focus-area` shows an area's projects; `focus-set` makes a project's next step the big note.
  The task that is already the big note stays in the list, faded.
- **Roadmap:** all four lists are drawn (`.rm-lane`, `app/js/roadmap-view.js`); the stylesheet shows the picked one
  under the tab strip on a phone and all four as full-height columns on a computer, with no clipboard there. The
  "Next step" note is `nextNote` (`:37`). A list shows 8 tasks (`CAP`, `:15`), then "Show N more" / "Show fewer"
  (`rm-more`; `ui.rmMore` resets when the project or milestone changes).
- **Sort, Review, Triage:** the first Sort screen, "Finished?" and "Do this first?" have one stamp and a row of plain
  buttons. The pile is `pile` (`app/js/sort-flow-view.js:43`: two edges with three or more waiting, one with two,
  none with one). "After this one" is `split` (`:44`); nothing in that list can be pressed. Tidy up and the later
  Sort steps are unchanged.
- **Checks:** `scripts/check-roadmap-columns-browser.mjs`; `docs/generated/design-audit/shoot.mjs` (every tab fits
  390x844 and 1440x900, no text under 13px), `shoot-focus.mjs` (the Focus walk), `shoot-final.mjs` (light and dark,
  8 and 26 projects).

## Traps

- Every screen must still fit 390x844 with no text under 13px (the standing rule from #270 and #272).
- `.wrap:has(.toast)` shrinks every clipboard screen by 64px while a notice shows (`app/css/app.css`, "A slip
  (toast) must not make a phone page scroll"). A new screen wrapper must be added to that rule, as `.focus-split` was.
- A due chip on a note needs paper colours in both themes (`.note .chip.deadline-chip:is(...)`); the theme's own
  chip colours are unreadable on yellow in dark mode.
- Every button the app can press must be listed in `docs/generated/friction-steps/feature-map.json`, or the
  feature-map check fails.
