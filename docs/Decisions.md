# Decisions

A running, append-mostly log of what was decided, when, why, and what it replaced. Newest entry
at the top. Entries are never rewritten or deleted; the one allowed edit is flipping a `Status`
line to `Superseded` when a later entry replaces it.

## 2026-09-22 — Guard against silent full-file overwrites and CSS regressions

**Context.** GitHub issue #17: commit `af88e6d`, made the previous day and titled as a one-line
fix ("give the New Project category select a solid background"), actually replaced almost all of
`css/app.css` (129 of 290 lines) with a different, unrelated draft stylesheet. Most of the app's
real styling — the colored Low/Medium/High focus buttons, the serif heading font, the page's
max-width layout, card borders — silently stopped applying. The app kept working functionally
(data still saved and synced correctly), so nothing about the failure mode raised an error or
warning; it shipped to production and stayed live for about a day until the person using the app
noticed it "wasn't pretty anymore" and asked why. Full root-cause writeup:
`docs/systems/styling.md#traps`.

Two structural gaps let this happen and stay unnoticed: (1) `css/app.css` had zero test coverage
of any kind, even though every JS module with real logic did; (2) even the tests that existed for
other modules were never wired into CI — `.github/workflows/deploy.yml` deployed straight to
GitHub Pages on every push with no test gate at all, so a broken commit and a clean one deployed
identically.

**Decision.** Added two automated guards, both now run in CI before every deploy
(`.github/workflows/deploy.yml`), and the first is also available as an opt-in local git hook:

1. `scripts/guard-file-churn.mjs` — flags any commit that deletes ≥40% of an existing file's
   prior lines, and blocks it unless the commit message explicitly acknowledges the rewrite with
   a `File-Rewrite-Ack: <path>` line. General-purpose, not CSS-specific: it targets the actual
   mechanism of the incident (a diff far larger than its stated intent), not just its symptom.
   Verified against the historical repo: it blocks the real `af88e6d` diff retroactively, and
   does not false-positive on the restorative fix commit (`0c1657d`) that legitimately rewrote
   most of the same file back.
2. `js/style-contract.test.mjs` — a plain `node:test` file (no new dependency, matching every
   other test in the repo) with two checks: every class name used in `js/render.js`/`js/app.js`/
   `index.html`/`settings.html` must have a matching `css/app.css` rule (or be explicitly
   allowlisted as a JS-only hook — see `docs/systems/styling.md#invariants`); and a hand-picked
   set of the most visually load-bearing rules must keep specific properties, not just keep
   existing, since a selector surviving with its properties gutted (`.card` losing its `border`
   while the rule itself stayed) is exactly what happened and a plain existence check would have
   missed it.
3. `.github/workflows/deploy.yml` gained a `test` job (`node --test js/*.test.mjs` plus the churn
   guard against the push's prior SHA) that `deploy` now depends on — closing gap (2) above
   directly. This is arguably the more important half of the fix: without it, guards 1 and 2
   only protect a contributor who runs them locally and doesn't skip the hook.

**Why.** Considered and rejected:

- *Playwright/headless-browser screenshot diffing in CI.* Would catch a broader class of visual
  regression, but adds a new dependency and a slower, flakier CI step to a repo whose stated
  design goal is "no framework, no build step" (`README.md`). The static property-level checks in
  `js/style-contract.test.mjs` were shaped specifically around what actually broke here (missing
  selectors, gutted properties) and catch that class of bug with zero new infrastructure. Not
  ruled out permanently — if a future regression slips past the static checks, revisit this.
- *A blanket "no file may shrink by more than X%" rule with no escape hatch.* Rejected because a
  genuine full-file rewrite is sometimes the right call, and a hard block just invites `--no-verify`
  or force-pushing around it. The `File-Rewrite-Ack:` acknowledgment line keeps the guard but
  makes bypassing it a deliberate, auditable, one-line statement of intent instead of a silent
  accident.
- *Requiring every markup class to have a CSS rule, with no allowlist.* Rejected once it produced
  false positives on real JS-hook-only classes (`cat-remove-btn`, etc.) — a check that cries wolf
  gets disabled. The allowlist is short, commented per entry, and the test itself asserts it never
  accumulates an entry for a class that stops being used.

**Status.** Standing.
---
## 2026-09-22 — Fix silent state-wiping bug in `persist()` and add a regression test

**Context.** A user reported losing all local data and their sync Gist ID ("the changes made
deleted all of my credentials from my local copy and the web version got cleared too... with a
gist Id that is simply gone now"). The user attributed what they *saw* to Chrome's "Desktop
site" mode, but that only explains a rendering/viewport issue and cannot explain actual data
loss, since toggling a browser display mode does not touch localStorage. Auditing every
`saveStateLocal()` call site in the app (`docs/systems/gist-sync.md`) turned up a real, severe,
currently-live bug that fit the reported symptoms exactly: `js/mutations.js`'s `persist()`
called `saveStateLocal()` with no arguments, so `state.js`'s `saveStateLocal(state)` received
`undefined` for its `state` parameter instead of picking up the module's `state` singleton.
`JSON.stringify(undefined)` stringifies to the literal text `"undefined"`, which
`localStorage.setItem` happily wrote on every mutation. The app looked fine in the moment
(the in-memory `state` singleton was still correct), but the next `loadState()` — a reload, or
a new tab — called `JSON.parse("undefined")`, threw, was silently swallowed, and fell back to
`defaultState()`, wiping every project, category, and the gistId.

**Decision.** Changed `persist()` in `js/mutations.js` to call `saveStateLocal(state)`,
matching every other call site (`js/sync.js`, `settings.html`). Added
`js/persist-storage.test.mjs`, a regression test that exercises the real module (mocked
localStorage with the same `String()`-coercion `setItem()` behavior as the real API) rather
than a text-pattern check, calling a real mutation and inspecting both what lands in
localStorage and what `loadState()` reads back afterward — reproducing the reload where the
user actually saw their data disappear. Recorded the invariant ("every `saveStateLocal()` call
site must pass `state` explicitly") and this incident in `docs/systems/gist-sync.md`
(see `#invariants` and `#traps`, doc-ref `2425`).

**Why.** A static/text-pattern check (like `style-contract.test.mjs`'s class-name matching)
would not have caught this: the defect is a runtime data-flow bug, not a shape mismatch — the
call site is syntactically valid, it just silently drops its argument. Only a test that
actually calls the mutation and inspects the real serialized/deserialized round-trip surfaces
it, so that's the form the regression test takes.

**Status.** Fixed and standing; regression test is green (`js/persist-storage.test.mjs`).
