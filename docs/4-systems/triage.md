# Triage (#256)

## What it owns

`js/triage.js` (pure: `triageLists`, `triageOrder`, `moveId`, `NOW_SIZE`, `NEXT_SIZE`), `js/triage-view.js` (markup), `js/triage-drag.js`
(Alt+Arrow only), `saveTriageOrder` / `resetTriageOrder` in `js/mutations.js`, `moveTriage` and the `triage-*` actions in `js/app.js`, the
`.tr-*` / `.org-*` rules in `css/app.css`. The ranking itself is `pickOrder` and `reasonOf` in `js/pick-order.js`. Tests:
`js/triage.test.mjs`, `js/pick-order.test.mjs`; checks `scripts/check-triage-browser.mjs` (390, 360, 1440 wide) and
`scripts/shoot-organize-266.mjs` (390x844, screenshots in `docs/generated/organize-266/`).

## How it works (#266: cards; was three cards of numbered rows, #256)

- Triage is the 📌 card on Organize's first screen (or the Confirm stamp's next stop). `ui.triageStep`: `top`, `next`, `later`, `move`.
- "Do these first": the top three (`NOW_SIZE`) as index cards numbered 1 to 3, each with a flag in its priority colour; tapping a card opens
  Task details. Two flags, "Next N" (the following 8) and "Later N" (the rest), open their own lists (Back returns); Later has Find. After
  Tidy up's Confirm a "Closed N ✓ / Undo" slip sits on this screen.
- The seven rules, in order (`pickOrder`; Focus's "Or let me pick for you" uses the same): 1 Needs review (status `review`), 2 In progress,
  3 past its date or due today, 4 priority (Urgent, High, Medium or none, Low), 5 holds up other open tasks (most first; counted from
  `waitsOn`, the same data as `holdsUp` in `js/task-links.js`), 6 due soonest, 7 oldest first. shortcut: tasks have no created time, so
  "oldest" is the order they sit in. The reason ("Needs review", "Due Fri") is no longer drawn (small text) but is in each card's aria-label.
- The Move stamp (on all three lists) opens Move: the rows of the list it came from, each with an up and a down key. A key saves at once
  (no preview): every task in the view gets `triageRank` 1..n (stamped with `updatedAt`, so it syncs and merges like any task field). In
  `triageOrder` the saved tasks, in rank order, fill the places the saved tasks hold in the rules order; a task with no rank keeps its place
  by the rules. The row set is fixed when Move opens, so a row moved over the Next boundary stays on screen. Alt+Up / Alt+Down on a focused
  row does the same. A ↺ Reset card deletes the ranks of the tasks in the view (and returns to the top); Done returns to the top.
- Focus: "Or let me pick for you" picks from the top three (`M.pickForMe`), see [wallets.md](./wallets.md).

### Inventory of what was kept (#266)

Kept (same mutations): move a task (`triage-move`, `saveTriageOrder`, plus Alt+Arrow), Later (`triage-later`), Reset (`triage-reset`,
`resetTriageOrder`), Task details (`task-open`), the seven rules and `triageRank`. Changed: Now/Next/Later cards became top three + two
flags; Later's fold became its own list with Find; the Reset button moved onto Move. Dropped: the mouse drag by a grip (every row has keys),
the rules column, the "ranked" subline and hint, the reason chips, the project name on each row (all small text). New actions: `triage-go`.

## Invariants

- Done tasks never appear. Nothing changes the order except a move, Reset, or the tasks themselves.
- Focus and Triage can't disagree: both call `pickOrder`.

## Traps

- shortcut: `triageRank` is compared across the whole list, so ranks saved in two different views interleave by
  number; upgrade if people save in several views.
- A new task slots in where the rules put it among the saved ones (it can land between two saved tasks).

See also [tidy-up.md](./tidy-up.md), [view-switch.md](./view-switch.md), [wallets.md](./wallets.md).
