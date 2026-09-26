# Today — 2026-09-26

## What today was

A documentation day, not a code day: a design Q&A session for the handcrafted redesign (decisions
recorded in `docs/plans/handcrafted-redesign.md`), followed by this docs restructure — moving
`docs/` from its ad hoc `docs/systems/` + `docs/superpowers/` layout into the six-tier layout
(`docs/plans/handcrafted-redesign.md`, "Docs" section and PR 1 of "Pull requests (Q21a)").

## What was done

- Ran the redesign Q&A and recorded every decision in `docs/plans/handcrafted-redesign.md`,
  including the "Pull requests (Q21a)" section added mid-session.
- Moved `docs/Decisions.md` -> `docs/6-decisions/Decisions.md`, `docs/systems/*` ->
  `docs/4-systems/*`, unchanged in content except pointer fixes.
- Sorted `docs/superpowers/plans/` and `docs/superpowers/specs/` into `docs/archive/` (executed)
  or `docs/plans/` (still live) — see `docs/archive/README.md` for which and why.
- Fixed every `docs/systems/`, `docs/Decisions.md`, and `docs/superpowers/` pointer across the
  codebase and between the docs themselves; confirmed clean with
  `grep -rn "docs/systems\|docs/Decisions\|docs/superpowers" .` and the `house-rules:docref`
  check.
- Wrote the previously-missing tiers from reading the code: `docs/2-roadmap/Roadmap.md`,
  `docs/3-state/ProjectState.md`, `docs/1-landing/README.md`, `docs/README.md`.
- Added a dated entry to `docs/6-decisions/Decisions.md` for the redesign direction.

## What was deliberately not done

No app code changed beyond doc-path strings in comments and tests. PR 2 (the cuts), PR 3 (the
visual system), and PR 4 (the control moves) are next, not today — today is PR 1 only.

## What got surfaced that isn't today's job

The autonomous Claude check-in's Gist-read step was never verified (see
`docs/3-state/ProjectState.md`, "the one thing that is not what it looks like"). That is a
follow-up on milestone 5, not part of the redesign work.

## Next, in order

1. PR 2 — the cuts (energy system UI, Recently done strip, Claude chips, "+ Priority" chip,
   `migrate-from-artifact.html`, the sync row and project-pills-row/filter-bar, per
   `docs/plans/handcrafted-redesign.md`).
2. PR 3 — the visual system (type scale, radii, colour, headings, SVG icons, label-name
   formatting).
3. PR 4 — the control moves (task rows open the editor, collapsed "+ Add task", Remove/Add
   project relocated).
