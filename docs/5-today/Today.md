# Today — 2026-09-27

## What today was

PR 3 of the handcrafted redesign: the visual system. A prior run of this PR was interrupted
mid-way by a session restart, with `css/app.css`, `js/render.js`, `js/state.js` modified and
`js/icons.js` plus two test files added but nothing committed; today's work picked that up,
fixed the one failing test it had left behind, finished the parts of the plan it hadn't reached
yet, and committed it in logical steps.

## What was done

- Fixed `js/render.test.mjs`: two assertions still expected the old tinted-pill/proj-chip markup
  (`--chip-color` style, `.tint-pill` class) for project identity, while `js/render.js` had
  already moved to neutral pills/chips with a `.proj-dot` — updated the assertions to match the
  code, per the "project colour is identity only" decision, rather than reverting the code.
- Replaced the last emoji in the UI with hand-drawn SVG line icons from `js/icons.js`'s paths:
  the brand-mark compass (`index.html`, `settings.html`, and the favicon `data:` URI), the
  settings gear, and the Projects drawer button (now an `.icon-btn` with `aria-label="Projects"`,
  keeping its id/aria-expanded/aria-controls/data-action); removed the 📥 before "Unsorted".
  Confirmed with a full emoji grep over every `.html` and `js/*.js`/`*.mjs` file: no matches.
- Updated both HTML files' Google Fonts `<link>` to also load Fraunces italic weights.
- Finished the `--r-control` migration the interrupted run had left partway done: `.btn`, the
  capture input/button, and `.project-cat-edit select` were still on `--r-pill`; `.toast-close`'s
  leftover literal `1.25rem` font-size is now `--text-h`; `.group-label`'s heading (rendered as
  `h4`) was on `--text-sm` instead of the plan's `--text-body`.
- Wrote `docs/4-systems/styling.md`'s "Visual system" section (five sizes, three radii, one
  raised card, heading style, icons, colour rules, label names) and fixed passages it made wrong
  (tinted project pills, the ⚙️/📥 emoji references).
- Updated `docs/3-state/ProjectState.md` (milestone 6: PR 3 built) and added a dated
  `docs/6-decisions/Decisions.md` entry for the interpretation calls PR 3's brief left open.

## What was deliberately not done

`generate_icons.py`'s PNG app icons were not regenerated — a separate asset pipeline this pass
didn't touch. PR 4 (task rows open the editor, collapsed "+ Add task", Remove/Add project
relocated) is not started; PR 3 changes nothing about controls or interaction, only appearance.

## What got surfaced that isn't today's job

- The interrupted run's own test/code mismatch (fixed today) is worth noting as a pattern: when
  resuming interrupted redesign work, re-run the full suite before assuming "29/30 passing" means
  the code is wrong rather than the test being stale.

## Next, in order

1. PR 4 — the control moves (task rows open the editor, collapsed "+ Add task", Remove/Add
   project relocated), per `docs/plans/handcrafted-redesign.md`.
