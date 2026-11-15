# Changelog

What changed in this repo, newest first. One line per change: plain words first, exact detail after.
Started 2026-11-15; earlier changes are in the git history and in `docs/3-state/ProjectState.md`.

## Unreleased

- Focus opens on one task, with the next step of every area (phone) or project (computer) beside it; "Choose…" opens the two questions (#283, `app/js/focus-view.js`, `app/js/app.js`).
- Roadmap shows four columns on a computer and the next step as a yellow note; a list shows 8 tasks and a "Show more" button (#284, `app/js/roadmap-view.js`).
- On Sort, Review and Triage the slip fills the clipboard with the pile behind it, one stamp and plain buttons; "After this one" is listed beside it on a computer (#285).
- The clipboard is bigger and its note fills it; the brass handle and "⋯" are plain buttons that say "More" (#282, `app/css/app.css`).
- Adds `nextStepOf` and `nextStepOfArea` (`app/js/pick-order.js`), one browser check (`scripts/check-roadmap-columns-browser.mjs`) and three screenshot scripts under `docs/generated/design-audit/`.
- Fixes found by shooting dark mode and 26 projects: Roadmap title and due chip readable in dark; four area notes on a phone; shorter phone Roadmap list (#286).
