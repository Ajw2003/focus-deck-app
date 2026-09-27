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

---

# Today (continued) — PR 4, 2026-09-27

## What today was

PR 4 of the handcrafted redesign: the control moves, plus one project at a time on wide screens
(#82, #83).

## What was done

- Task rows (`renderTaskRow`, js/render.js): stripped to checkbox/title/labels/deadline/priority.
  A linked task's title is no longer an `<a>` to its issue — every title now opens the editor, the
  same `role="button"` span/role, Enter/Space included.
- Editor (`renderTaskEditForm`): added `renderTaskEditActions` — Focus on this (closes the form),
  Open issue ↗ `owner/repo#N` for linked tasks (a real link), Delete (`confirmDeleteTask`, shared
  with the old row's ×).
- Collapsed "+ Add task": each project card ends with a `.link-btn` line
  (`open-add-task`/`cancel-add-task`, `ui.addingTask`, not persisted) instead of an always-open
  form; adding a task re-renders a fresh, still-open, empty form.
- Project header: restructured into two always-present lines (name+controls, then badges) so a
  long name can never push the controls to a second line (#83); added `renderProjectEditPanel`
  (category select + Remove project, both moved off the header) behind a new Edit link.
- Add project/repo: replaced the two bottom-of-page forms with one field,
  `renderAddProjectField`, at the bottom of the project list; `add-project-field` in js/app.js
  picks the track-repo vs. add-project path with the existing `parseRepoInput`.
- One project at a time on wide screens (#82): `resolveSelectedProject` (js/project-filter.js,
  pure, tested) plus `ui.selectedProjectId` persisted per device
  (`focusdeck-selected-project`); CSS at >=1100px shows only `.is-selected` and drops the grid to
  one column; `scrollToProject` and the new `afterProjectAdded` branch on
  `matchMedia('(min-width:1100px)')` to select instead of scroll.
- Updated `js/render.test.mjs`, `js/project-filter.test.mjs`, `js/github-sync.test.mjs` for all of
  the above; added CSS for the new classes and ran `js/style-contract.test.mjs` clean.
- Updated `docs/4-systems/styling.md` (task rows/editor, project header/Edit panel, collapsed
  add-task, the sidebar/add-field/one-project-at-a-time sections), `docs/4-systems/github-sync.md`
  ("where the GitHub controls live"), `docs/3-state/ProjectState.md` and
  `docs/2-roadmap/Roadmap.md` (milestone 6 to ~100%, pending merge).

## What was deliberately not done

Verification against a real Chromium build (screenshots, the numeric #83 measurements, the
add-field's live repo-tracking behaviour) is reported separately in the PR's own report, not
duplicated here.

## Next, in order

1. Merge PR 4 (`claude/laughing-einstein-wtt7t6`) once reviewed.
2. Milestone 7 onward, per `docs/2-roadmap/Roadmap.md`.
