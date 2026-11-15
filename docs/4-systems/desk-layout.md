# Desk layout: the next step is the biggest thing (#281)

> **Status: planned, not built.** Approved 2026-11-15 (see `docs/6-decisions/Decisions.md`). This file says what the
> build must do; each section is rewritten to cite `file:line` as its step lands. Steps: #282 to #286.

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

## Traps

- Every screen must still fit 390x844 with no text under 13px (the standing rule from #270 and #272).
- The drawings are light mode with 8 projects. Dark mode and 26 projects are checked in the real app in #286.
