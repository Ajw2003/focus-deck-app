# Triage (#256)

## What it owns

`js/triage.js` (pure: `triageLists`, `triageOrder`, `moveId`, `NOW_SIZE`, `NEXT_SIZE`), `js/triage-view.js`
(markup), `js/triage-drag.js` (mouse drag and Alt+Arrow), `saveTriageOrder` / `resetTriageOrder` in
`js/mutations.js`, `moveTriage` and the `triage-*` actions in `js/app.js`, the `.tr-*` rules at the end of
`css/app.css`. The ranking itself is `pickOrder` and `reasonOf` in `js/pick-order.js`. Tests:
`js/triage.test.mjs`, `js/pick-order.test.mjs`; browser check `scripts/check-triage-browser.mjs` (390, 360 and
1440 wide; screenshots in `docs/generated/build-checks/step8/`).

## How it works

- A seventh screen "Triage" after Tidy up in the rail and the phone bar. Title "Triage: <view name>"; it
  follows the All | Area | Project switch. The phone bar fits seven tabs at 360 wide (checked: no label clipped),
  so there is no "Organize" tab yet; step 11 regroups.
- Three cards with a numbered row each (numbers continue across cards): **Now** = the top 3, **Next** = the
  following 8, **Later** = the rest, folded until you open it (`ui.triageLaterOpen`, memory only). Each row has
  the chip of the first rule that applies to it.
- The seven rules, in order (`pickOrder`; Focus's "Or let me pick for you" uses the same): 1 Needs review
  (status `review`), 2 In progress, 3 past its date or due today, 4 priority (Urgent, High, Medium or none, Low),
  5 holds up other open tasks (most first; counted from `waitsOn`, the same data as `holdsUp` in
  `js/task-links.js`), 6 due soonest, 7 oldest first. shortcut: tasks have no created time, so "oldest" is the
  order they sit in.
- Chips: Needs review, In progress, Overdue / Due today, Urgent, High, "Holds up N", "Due Fri", Low, else
  "Oldest first".
- Your order wins. Moving a row saves at once (no preview): every task in the view gets `triageRank` 1..n
  (a per-task field stamped with `updatedAt`, so it syncs and merges like any task field). In `triageOrder` the
  saved tasks, in rank order, fill the places the saved tasks hold in the rules order; a task with no rank (a
  new one) keeps its place by the rules. "Reset to the rules" (side column on a wide screen, beside the subline
  on a phone) deletes the ranks of the tasks in the view. Chosen instead of a "Save order" button because a
  phone has no side column to hold one.
- Moving: mouse drag by the grip (`triage-drag.js`; drop on a row takes its place, on a card's heading puts the
  task first in that card); Alt+Up / Alt+Down on a focused row; on a phone, up / down buttons on every row (no
  touch drag, no grip). The order is one list, so moving across the Now / Next / Later boundary pushes the
  neighbour over it; a move into Later opens it.
- Tidy up's Confirm reads "Confirm N, then Triage" and goes to Triage after closing.
- Focus: "Or let me pick for you" picks from Now (`M.pickForMe`), see [wallets.md](./wallets.md).

## Invariants

- Done tasks never appear. Nothing changes the order except a move, Reset, or the tasks themselves.
- Focus and Triage can't disagree: both call `pickOrder`.

## Traps

- shortcut: `triageRank` is compared across the whole list, so ranks saved in two different views interleave by
  number; upgrade if people save in several views.
- A new task slots in where the rules put it among the saved ones (it can land between two saved tasks).
- shortcut: the mouse drag has no auto-scroll, so a far drop is easier with the keyboard.

See also [tidy-up.md](./tidy-up.md), [view-switch.md](./view-switch.md), [wallets.md](./wallets.md).
