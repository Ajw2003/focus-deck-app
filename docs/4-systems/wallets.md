# Wallets

> **2026-11-12 (#270):** Focus is now two screens (project, then kind of work) and one task; see [focus.md](./focus.md). The cards no longer carry the "N open" line or the "Tap to use" corner text anywhere (Sort and Sort several share them), and the hint line under the carousels is gone. Where this file describes those it is history.

> **2026-11-15:** projects are no longer a wallet anywhere. Focus ("Which project?"), Sort and Sort several
> ("Which project?", `tray-folders`) and the Projects tab list (`projects-tab`) use the filing cabinet below.
> The flip wallet is left only for kinds of work (Focus step 2, Sort's labels). Where this file describes a
> project wallet or strip it is history.

## The filing cabinet

`js/cabinet.js`, styled by the "Filing cabinet" block at the end of `css/app.css`. The approved design is
`docs/generated/filing-cabinet.html`.

- **Drawers.** Each area is an oak drawer and the cabinet swipes sideways a whole drawer at a time. Everything
  comes first, then the areas in `areaList` order; an area with no projects has no drawer. The labels under
  the cabinet (`.cab-label`, a tablist) jump to a drawer. The row snaps one drawer at a time and has no
  animation of its own; a scroll that settles (80 ms) only updates which label is lit, and tapping the label
  of the drawer already showing does nothing (the old version reloaded it). The files inside do not snap and
  nothing re-centres them. The drawer open last is remembered for the visit (`rememberedDrawer`), so a repaint reopens it.
- **Files.** Every project is a file with its tab on the left, A to Z (the Projects tab passes
  `sort: () => 0` to keep its own Sort by order). Everything also carries the lead file, All projects, on
  Focus. A file may show `detail` ("12 to do", "3 open", "chosen") and `pct`, which draws a progress bar on
  the tab and the face (Projects tab only).
- **Flicking.** Scrolling a drawer tips the files you pass back and leans the ones ahead (`flick`, transform
  and a `--shade` only, once per frame). It never moves the scroll, so it cannot fight a finger.
- **Choosing.** A tap opens a file (`.is-centre`, in every drawer it hangs in) and calls `onFacing`; a tap on
  the open file calls `onChoose`. Keys: Up and Down open the next file, Left and Right change drawer, Enter
  chooses, and typing a name opens the first file it starts (or appears in) within 700 ms of key presses,
  as the old strip did. The hooks are the wallets' (`walletHooks` in `js/app.js`): `projects` moves Focus to the kind of
  work, `tray-folders` puts the project on the slip or takes it off (`.is-picked`), and `projects-tab` opens
  that project's Roadmap. `facingKey` reads the open file as well as a facing sleeve.
- **Phones** (max-width 480px) drop the cabinet's outer frame, and the drawer is `clamp(220px, 40dvh, 400px)`
  tall. A resize only re-aligns the row when the width changed, because a phone's address bar fires resize
  as the page scrolls. Sort's drawer is shorter (`clamp(120px, 100dvh - 688px, 400px)`) so Back and Next stay
  above the tab bar on a 390x844 phone; a 360x780 phone scrolls about 20px to reach them. Wide screens (min-width 1100px) lay every drawer out side by side and hide the labels.
- Decisions are `cabinetDrawers` and `startDrawer`, tested in `js/cabinet.test.mjs`. The browser check is
  `scripts/check-cabinet-browser.mjs`; run it with `FOCUS_DATA=<a saved copy .json>` to use real data.

## The wide-screen strip (#253)

On a wide screen (>= 1100px, `SPREAD_QUERY`) the project and kind-of-work wallets on Focus and Sort's
project wallet (`tray-folders`, "Which project?") are **a strip of five cards** instead of every card laid
flat. It is the same wallet (`js/wallet.js` `spreadOut`, `STRIP_WALLETS`); a phone keeps the flip wallet
exactly as before (flip, Tap / Tap twice, push up to draw, the hint line).

- Added by `spreadOut` only (nothing in the phone markup changes): ‹ › `.wallet-arrow` buttons either side
  of the track, a "3 of 27" count in `.wallet-count`, and the track scrolls (`.is-strip`, CSS "Wallet strip")
  so `windowStart` keeps the picked card inside the five showing.
- Keys on the focused track: Left/Right/Home/End move the pick, Enter draws (or, on Sort, picks the project
  again to clear), typing letters jumps to the first name starting with them (else containing them,
  `jumpTo`), a wheel or sideways trackpad scroll moves one card per 40px (`wheelStep`). Pure helpers
  (`windowStart`, `countText`, `findFilter`, `jumpTo`, `wheelStep`) are tested in `js/wallet.test.mjs`.
- A click on a card other than the pick picks it (the other row narrows); a click on the picked card draws,
  as in the spread-out layout. Sort's label wallet (`tray-flags`) still lies flat as a grid.
- The strip's own scrolling must not re-pick the middle card, so the track's scroll listener only runs the
  tilt when the wallet is not spread.
- **Find a project** (`[data-car-find="projects"]`, `ui.focusFind`, `renderProjectWalletInner` in `js/focus-view.js`) narrows the folders live on
  Focus; Sort's existing `.sort-find` does the same for its wallet. Both respect the All / Area / Project
  switch (`viewState`).
- **Or let me pick for you** (`data-action="pick-for-me"`, `M.pickForMe`): takes **Now** from Triage for the
  view (`triageLists`, `js/triage.js`: the seven rules of `pickOrder` in `js/pick-order.js`, then your saved
  Triage order on top; Now is the top 3) and opens the first as if picked by hand. The Now ids are the pool, so
  "Not this one" (`M.reroll`) offers the next of those three (wrapping); the rest of the view is not offered.
  See [triage.md](./triage.md). shortcut: tasks have no created time, so "oldest" is the order they sit in.
- Focus shows only kinds of work (the step 3 ticks, `kindsOfWork`).
- Checked by `scripts/check-carousel-browser.mjs` (screenshots in `docs/generated/build-checks/step5/`),
  `check-desktop-browser.mjs`, `check-wallets-browser.mjs` and `check-wallet-touch-browser.mjs`.

## What it owns

The focus picker's two wallets (#120, part of #116): a sideways strip of **manila folders** for
projects and a strip of **ruled index cards** for categories. Cards turn away from you like CD
sleeves; the one facing you is in the middle. Also the "Choosing a card" setting that governs how a
card is picked. The agreed look is the "Your pick" section of `docs/plans/redesign-directions.html`
(screenshots in `docs/generated/redesign-mockup/`); the Unsorted in-tray's wallets are #121.

## How it works

- **Markup (`js/render.js` for `sleeve` and `walletInner`, `js/focus-view.js` for Focus).** Focus draws `#project-wallet` on
  step 1 and `#category-wallet` on step 2, with an `aria-live` region (`#wallet-live`). Each strip is `.flip-track[data-wallet][data-mode][data-facing]` with a
  `.sleeve[data-key][data-speak]` per card. The facing card is in the markup as `data-facing`, so a
  repaint puts the same card back in the middle.
- **Decisions (`js/wallet.js`, top half).** Pure functions, tested in `js/wallet.test.mjs`: which card
  faces you, how far each tilts, what a tap does per mode (`tapOutcome`), what an upward drag does
  (`swipeOutcome`), what the keys do. The DOM half (`mountWallets`) only measures, listens and calls
  them. Window listeners are installed once; instances whose track left the page are dropped on each
  mount.
- **What a flip and a choice do (`js/app.js`, `walletHooks`).** Flipping the project wallet saves the
  facing folder to `focusdeck-focus-filter` (`projectId`, the key the old project pills used, so it is
  remembered per device); the facing category is kept in `ui.focusCategory`. Choosing a folder card goes to
  the kind question; choosing a category card draws within the facing folder (`M.pickFocus`).
  Keys: `all` is All projects, `any` is Surprise me, `__none__` (`UNLABELLED`) is Unlabelled.
- **Card text.** The name only (#270). Every project and category is in its wallet however many
  there are; the wallet scrolls.

## The "Choosing a card" setting

`state.choosingMode = { mode, updatedAt }`, mode `tap` (Tap) or `twice` (Tap twice, the default).
Every mode takes every gesture (#132): a tap (once or twice by mode), and pushing the facing card up
past `SWIPE_DRAW_PX` (`swipeOutcome`). A third mode, `swipe` (Swipe up, where a tap only nudged), was
retired on 2026-10-10; a save that still says `swipe` reads as `tap` (`normalizeChoosingMode`). Stored, defaulted and merged exactly like `state.dueDefaults`
(`js/state.js`, `js/merge.js`: newest `updatedAt` wins, a side with none keeps the other;
`setChoosingMode` in `js/mutations.js` stamps it). Tested in `js/choosing-mode.test.mjs`. It is
shown on the Settings page (`app/settings.html`, "Choosing a card") and is read from the markup's
`data-mode`, so **every** wallet follows it. Arrow keys flip and Enter draws in every mode.

## Spread out

On a wide screen (`SPREAD_QUERY`, `(min-width: 1100px)`, #128), `mountWallets` lays a wallet flat
instead of making it flip (`spreadOut` in `js/wallet.js`; `.is-spread` in `css/app.css`). Every card
shows at once, with no scrolling and no tilt.

- **An even grid** (`repeat(auto-fill, minmax(196px, 1fr))`): every card the same width, filling the row; long names end in an ellipsis. Cards are full-size (128px index cards, 96px folders). Fixed-width cards went ragged with real data (19 projects, 45 categories).
- **One click acts** (`spreadClick`). In the folder wallet, a click picks a folder (`onFacing`, which
  narrows the category cards) and a click on the picked folder draws from it. In every other
  wallet, a click chooses at once. The arrow keys move the pick and Enter chooses.
- **Only the folder wallet outlines its picked card.** The in-tray marks its choices with
  `.is-picked`.
- **Superseded for Focus and Sort's project wallet by the strip above (#253)**; the flat grid remains for Sort's label wallet.
- **Which layout a wallet gets is decided when it mounts.** `onSpreadChange` repaints when the window
  crosses the width, so a resize swaps the layout.
- Tap and tap-twice (the setting) apply only to the flip-through wallets on a narrow screen.
- Checked by `scripts/check-desktop-browser.mjs`.

## Invariants and traps

- **Touch and page scrolling (#131).** The track is `touch-action: pan-x pan-y`, so a vertical drag
  on the wallets scrolls the page. Only the facing card's `.icard` is `pan-x pan-up`: there a finger
  moving up is the draw gesture, and a finger moving down still scrolls. Checked under a real finger
  (DevTools touch events, `scripts/lib/touch.mjs`) by `scripts/check-wallet-touch-browser.mjs`.

- A project flip must not repaint `#app`; only the category slot is replaced and re-mounted.
- A repaint mid-press is safe: `mountWallets` prunes disconnected instances and the global pointer
  handlers check `track.isConnected`.
- `prefers-reduced-motion` turns the tilt and the nudge off (`css/app.css`, end of file).
- `js/style-contract.test.mjs` needs a `css/app.css` rule for every class the markup uses.
- Dropped from the old picker (planned, to confirm with the user): the "+N more" and "Show all N
  labels" reveals, and priority text "1 urgent" (now "top: Urgent").
- The Unsorted flow still uses pills (`render.js` `renderInbox`); that moves to wallets in #121.
- The service worker (`app/service-worker.js`) is at `v3` and lists `./js/wallet.js`; a new module
  needs adding there and a version bump.
- The real-Chromium check is `scripts/check-wallets-browser.mjs`. It serves the repo itself on port 8123 for the length of the run: `CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-wallets-browser.mjs`. Screenshots land in `docs/generated/pr120/`.
