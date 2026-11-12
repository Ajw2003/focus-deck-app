# The Focus tab (#270)

> Replaces the old "What's your focus right now?" card with two wallets on one page. The carousel, the "Choosing a card"
> setting and the wide-screen strip are still in [wallets.md](./wallets.md); the pick order is in
> [task-links.md](./task-links.md) and [triage.md](./triage.md).

## What it owns

`js/focus-view.js` (all of Focus's markup), the `focus-*` / `pick-for-me` / `reroll` / `complete-focus` / `clear-focus`
actions in `js/app.js`, the `.focusflow` rules in `css/app.css`. The state changes are the old mutations in
`js/mutations.js` (`pickFocus`, `pickForMe`, `reroll`, `completeFocus`, `setFocus`, `clearFocus`), unchanged. Tests:
`js/render.test.mjs`, `js/focus-pick.test.mjs`, `js/focus-complete.test.mjs`, `js/pick-order.test.mjs`,
`js/choosing-mode.test.mjs`. Browser checks: `scripts/shoot-focus-270.mjs` (390x844 walk with fit and 13px asserts,
screenshots in `docs/generated/focus-270/`), `check-focus-doing-browser.mjs`, `check-note-faces-browser.mjs`,
`check-carousel-browser.mjs`. Prototype screens f1 to f5 in `docs/generated/friction-steps/prototype.html`; the action to
screen map is `docs/generated/friction-steps/feature-map.json`.

## How it works

Nothing on this tab is under 13px, there are no captions or hints, and every screen fits a 390x844 phone.

- **Step 1, "Which project?" (f1).** Find, a manila-folder carousel (All projects first, then busiest first), a
  🎲 Pick for me tag and a Next stamp. The facing folder is saved to `focusdeck-focus-filter` as before. Choosing a folder
  card (second tap in Tap twice) is the same as Next (`ui.focusQ = 2`).
- **Step 2, "What kind of work?" (f2).** Find, an index-card carousel for the chosen project (busiest first, Unlabelled,
  Surprise me last), Back, Skip (any kind) and a Show me one stamp. Show me one, Skip and choosing a kind card all call
  `M.pickFocus({ categoryId, projectId })`; Surprise me and Skip pass no kind. With nothing to draw, a notice says so.
- **Pick for me.** `M.pickForMe` (the top of Triage's Now for the view; "Another" walks down that order).
- **One task (f3).** The task on its sticky note (note faces still apply) and two rubber stamps. ✓ Done runs the old
  tick, cross-out and peel sequence (`js/focus-complete.js`, `completeFocusWithNote`) then `M.completeFocus`. ↻ Another
  is `M.reroll` (off when the pool has one task). A ⋯ tag opens the drawer (`ui.focusMenu` holds the task id it is open
  for, so it closes itself when the focus changes).
- **The ⋯ drawer (f4).** ▶ Start it (`focus-doing`, only for a task in "next"; same move as a board drop), 🪜 Smaller steps
  (only with open steps), Details › (`task-open`, Task details), 📁 project › (`rm-open`, the Roadmap) and ✕ Clear
  (`M.clearFocus`, back to step 1). Any choice closes the drawer; Escape does too.
- **Smaller steps (f4s).** A tick list of the open steps (`ui.focusSteps` is the task id, `ui.focusTick` the ticked step,
  one at a time). ◎ Focus on one (`focus-subtask`) is `M.setFocus` on the ticked step.
- **Done (f5).** `ui.focusDone = { title, filter, ordered }` is set just before `M.completeFocus`; with no focus it draws
  the crossed-out note and a Next one stamp, which picks again the way the last pick was made (`M.pickForMe` or
  `M.pickFocus` with the same filter) and falls back to step 1 when nothing is left.
- **Empty desk.** "Your desk is clear" and a Go to Roadmap stamp.

## Blockers first (#191)

Unchanged and still the only pick rule: `rankFocusPool` (`js/pick-order.js`) puts tasks that are not waiting on anything,
and that free the most others, first, inside `M.pickFocus`; `M.reroll` prefers a task that can be started. What was dropped
is only its caption on the note ("Unblocks N tasks", "Random pick", "Everything here is waiting on something").

## What was dropped from the old screen

The "N open · top: High · 2 projects" line on the cards and the card corner text ("Tap to use", shared by Sort and Sort
several), the hint line under the carousels, the "Or let me pick for you" link (now the 🎲 tag), the note's meta line
(project, labels, priority, deadline chip: the project is in the drawer, the rest in Details), the "Next step: ..." line
(now Smaller steps) and the "In progress" marker. The `focus-task`, `detail-focus` and `rm-focus` actions still call
`M.setFocus`.
