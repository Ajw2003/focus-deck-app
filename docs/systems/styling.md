# Styling

## What it owns

`css/app.css` — the app's single, global, unscoped stylesheet — and the implicit contract it has
with every file that emits HTML: `js/render.js`, `js/app.js`, `index.html`, `settings.html`. There
is no CSS-modules/scoping/build step (see `README.md`'s "How it's built"), so a class name in a
template string and a selector in `css/app.css` are connected by nothing but both spelling the
same string correctly. Nothing enforces that connection except `js/style-contract.test.mjs`.

## How it works

Every visual property (light/dark theme colors, spacing, radius, shadow) is a CSS custom property
on `:root`, redefined under `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`
(css/app.css:1-60). Component styling below that is a flat list of class selectors — no nesting,
no BEM discipline, just one rule block per class, in the same order the sections of the app
appear (topbar, focus card, chips, inbox, project cards, forms).

`js/render.js` and friends build HTML as plain string concatenation (see `README.md`'s render
pattern), with class names as literal text inside the strings — e.g.
`'<button type="button" class="energy-btn" ...'` (js/render.js:5). There is no compiler step that
would catch a typo or a deleted rule; a class with no matching CSS rule fails completely silently
in the browser and just renders with default/no styling.

## Invariants

- Every class referenced in `js/render.js`, `js/app.js`, `index.html`, or `settings.html` must
  either have a matching selector somewhere in `css/app.css`, or be listed in
  `ALLOWED_WITHOUT_RULE` in `js/style-contract.test.mjs` with a reason. Enforced by
  `js/style-contract.test.mjs`.

  <!-- ref:f152 -->
  `ALLOWED_WITHOUT_RULE` exists for two legitimate cases: a class that's a pure JS hook, matched
  with `.matches()`/`querySelector` and never meant to be styled (`cat-add-form`,
  `cat-remove-btn`); or a modifier class that only ever appears stacked onto another class that
  carries the actual rule — e.g. `class="card focus-card focus-active"`, where `.card` supplies
  the border/shadow/padding and `focus-active` is a pure state marker `js/app.js` reads back, never
  a CSS target (`focus-card`, `focus-active`, `claude-created-chip`, `claude-completed-chip`, the
  latter two stacking onto `.claude-chip` the same way). Keep this list short and comment every
  entry — each one is a class the contract test can no longer protect, and the test itself asserts
  the list never grows an entry for a class that isn't actually used anywhere, so it can't
  silently accumulate dead exceptions either.

- A hand-picked set of the most visually load-bearing rules must keep specific properties, not
  just keep existing — a selector surviving with gutted properties is exactly how the issue #17
  regression shipped (see Traps below). Enforced by the second half of
  `js/style-contract.test.mjs`: headings stay on the `'Fraunces'` display font, `.wrap` stays at
  `max-width:760px`, `.energy-btn` keeps its `border-top:3px solid var(--chip-color)` (the thing
  that makes Low/Medium/High visibly color-coded), `.card` keeps an actual `border`, `.stat-pill`
  keeps `border-radius:999px`.

- A commit that deletes 40% or more of an existing file's lines must say so explicitly in its
  message (`File-Rewrite-Ack: <path>`), or it's blocked. This isn't CSS-specific — it's a general
  guard (`scripts/guard-file-churn.mjs`) against any commit whose diff silently does far more than
  its stated intent, which is the actual mechanism behind the incident below. See
  `docs/Decisions.md` for why this shape of guard was chosen.

## Traps

**2026-09-21 — a one-line intended fix replaced the entire stylesheet, and nothing noticed for
about a day.** Commit `af88e6d` ("fix: give the New Project category select a solid background
(#14)") was meant to make exactly one change: add `background:var(--surface)` to
`.add-project-form select` (the only `<select>` in the file still using
`background:transparent`, see the trap in `docs/systems/pwa-shell.md`). Its actual diff replaced
essentially all of `css/app.css` — 129 of the file's 290 lines deleted, 55 different lines added
— with a different, smaller draft stylesheet that used different class names than the app's real
markup:

- `.energy-btn`/`.energy-grid`/`.energy-label`/`.energy-desc` (the large, color-bordered
  Low/Medium/High focus-picker buttons) didn't exist at all in the replacement, so they silently
  fell back to bare, unstyled `<button>` elements
- `h1`–`h4` lost `font-family:'Fraunces', Georgia, serif;`, replaced with `'IBM Plex Sans'`
- `.wrap` — the page's centering/max-width container, still the class `index.html:16` actually
  uses — was renamed to `.container` in the replacement, which nothing in the app references, so
  the whole layout lost its constrained width
- `.card` kept a rule, but lost its `border`; `.stats-row`/`.stat-pill` (the project progress
  pills) lost their rules entirely

Nothing caught this at the time because:

1. `css/app.css` had zero test coverage of any kind — every other module (`complexity.js`,
   `project-filter.js`, `sync.js`, `render.js`'s chip logic) has a `*.test.mjs`, but the
   stylesheet, despite being exactly as load-bearing, had none.
2. Even the tests that *did* exist were never wired into CI — `.github/workflows/deploy.yml` ran
   `generate_icons.py` and deployed straight to GitHub Pages on every push to `main`, with no test
   job in between. A broken commit and a clean one deployed identically.
3. The app kept working functionally — data still saved, synced, and rendered correctly — so
   nothing about the visible failure mode (still-alive, just plain-looking) tripped an error,
   console warning, or failed request. It was caught only because the person using the app
   happened to notice, two commits later, that it "wasn't pretty anymore," and asked why.

Fixed by commit `0c1657d`: restored the pre-`af88e6d` stylesheet and reapplied only that commit's
actual intended one-line change on top of it. `js/style-contract.test.mjs` and
`scripts/guard-file-churn.mjs`, both added afterward, exist specifically to make each of the three
gaps above unable to repeat silently: a class losing its rule now fails a test, a large unexplained
deletion now blocks the commit, and both now run in CI before every deploy
(`.github/workflows/deploy.yml`).
