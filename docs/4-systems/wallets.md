# Wallets

## What it owns

The focus picker's two wallets (#120, part of #116): a sideways strip of **manila folders** for
projects and a strip of **ruled index cards** for categories. Cards turn away from you like CD
sleeves; the one facing you is in the middle. Also the "Choosing a card" setting that governs how a
card is picked. The agreed look is the "Your pick" section of `docs/plans/redesign-directions.html`
(screenshots in `docs/generated/redesign-mockup/`); the Unsorted in-tray's wallets are #121.

## How it works

- **Markup (`js/render.js`).** `renderFocusPicker` writes `.wallet-root` holding two `.wallet`s
  (`#project-wallet`, `#category-wallet`), one shared `.flip-hint` and an `aria-live` region
  (`#wallet-live`). Each strip is `.flip-track[data-wallet][data-mode][data-facing]` with a
  `.sleeve[data-key][data-speak]` per card. The facing card is in the markup as `data-facing`, so a
  repaint puts the same card back in the middle.
- **Decisions (`js/wallet.js`, top half).** Pure functions, tested in `js/wallet.test.mjs`: which card
  faces you, how far each tilts, what a tap does per mode (`tapOutcome`), what an upward drag does
  (`swipeOutcome`), what the keys do. The DOM half (`mountWallets`) only measures, listens and calls
  them. Window listeners are installed once; instances whose track left the page are dropped on each
  mount.
- **What a flip and a choice do (`js/app.js`, `walletHooks`).** Flipping the project wallet saves the
  facing folder to `focusdeck-focus-filter` (`projectId`, the key the old project pills used, so it is
  remembered per device) and re-renders **only** `#category-wallet`
  (`renderCategoryWalletInner`), so the project wallet's scroll animation is not cut off by a whole
  repaint. The facing category is kept in `ui.focusCategory` across that. Choosing a category card
  draws from it within the facing folder (`M.pickFocus`); choosing a folder draws from that folder.
  Keys: `all` is All projects, `any` is Surprise me, `__none__` (`UNLABELLED`) is Unlabelled.
- **Card text.** "3 open · top: High · 2 projects": the count, the highest priority present, and how
  many projects when not narrowed to one. Every project and category is in its wallet however many
  there are; the wallet scrolls.

## The "Choosing a card" setting

`state.choosingMode = { mode, updatedAt }`, mode `swipe` (Swipe up), `tap` (Tap) or `twice` (Tap
twice, the default). Stored, defaulted and merged exactly like `state.dueDefaults`
(`js/state.js`, `js/merge.js`: newest `updatedAt` wins, a side with none keeps the other;
`setChoosingMode` in `js/mutations.js` stamps it). Tested in `js/choosing-mode.test.mjs`. It is
shown on the Settings page (`app/settings.html`, "Choosing a card") and is read from the markup's
`data-mode`, so **every** wallet follows it. Arrow keys flip and Enter draws in every mode.

## Invariants and traps

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
- The real-Chromium check is `scripts/check-wallets-browser.mjs` (needs a static server on port 8123).
