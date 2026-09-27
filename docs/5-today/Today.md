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
- Added milestones 7-13 to the roadmap so every open GitHub issue (19 as of today) sits in one
  milestone.

## What was deliberately not done

No app code changed beyond doc-path strings in comments and tests. PR 2 (the cuts), PR 3 (the
visual system), and PR 4 (the control moves) are next, not today — today is PR 1 only.

## What got surfaced that isn't today's job

- #48 (time-of-day suggestions) pulls against the redesign's decision to delete the energy
  system. Needs a decision before PR 2 lands.
- #72, #75 and #77 may already be covered by PR #78; they need checking against the app.

The autonomous Claude check-in's Gist read was recorded as unverified. The user confirmed it
works (after tweaks not recorded in this repo) and shelved it; milestone 5 is now marked done and
shelved in the roadmap and state.

## Next, in order

1. PR 2 — the cuts (energy system UI, Recently done strip, Claude chips, "+ Priority" chip,
   `migrate-from-artifact.html`, the sync row and project-pills-row/filter-bar, per
   `docs/plans/handcrafted-redesign.md`).
2. PR 3 — the visual system (type scale, radii, colour, headings, SVG icons, label-name
   formatting).
3. PR 4 — the control moves (task rows open the editor, collapsed "+ Add task", Remove/Add
   project relocated).

## PR 2 — the cuts (later on 2026-09-26)

The user decided to delete the energy system fully rather than leave it switched off (see
`docs/6-decisions/Decisions.md`), which settled the #48 open question above. Built:

- Energy deleted outright: `ENERGY`/`ENERGY_UI_ENABLED`, the `energy`/`energyAuto` task fields
  (dropped on load, no migration), the `--energy-*` CSS tokens (replaced by `--danger` for the one
  non-focus-picker use), the `set-energy`/`surprise`/`cycle-energy` actions and mutations, and the
  GitHub label-to-energy sync (`energyFromLabels`/`resolveIssueEnergy`, and `js/complexity.js`
  with it — nothing else called it). The `.energy-btn`/`.energy-grid`/`.energy-label`/
  `.energy-desc` CSS classes stay: they style the focus picker's label cards and the Unsorted
  flow's kind cards now.
- Removed: the Recently done strip (`completedLog` itself is untouched), the "Claude created"/
  "Claude completed" row chips (the underlying flags and label sync are untouched), the
  "+ Priority" placeholder chip, and `migrate-from-artifact.html` (and its service-worker cache
  entry).
- The sync row (status line + "Sync GitHub"/"⬇ Pull latest" buttons) replaced by a top-bar sync
  icon that shows when it last synced, spins while syncing, and toasts on a manual sync's result.
- The project-pills row and filter bar folded into the one project list (search, category pills,
  sort, Collapse all), which is the wide-screen sidebar unchanged and a phone/narrow-screen
  drawer opened from a topbar "Projects" button.

See `docs/6-decisions/Decisions.md`, `docs/4-systems/styling.md`, and
`docs/4-systems/github-sync.md` for the details.
