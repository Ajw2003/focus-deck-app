# Archive

Plans and specs that were correct when written and are now inert — their work already landed in
the code, or the record itself is what's left. Nothing here describes current behaviour; for
that, see `docs/4-systems/`, `docs/2-roadmap/Roadmap.md`, and `docs/3-state/ProjectState.md`.

- **`2026-09-20-project-categories-and-auto-focus-tier.md`** — plan for project categories and
  the auto complexity/focus tier. Its checkboxes were never ticked, but the code it specifies is
  fully present: `state.projectCategories` (`js/state.js:41`), `js/complexity.js`,
  `js/project-filter.js`, and their coverage in `README.md`'s file map. Inert: executed.

- **`2026-09-21-claude-issues-provenance.md`** — plan for the Claude on-demand provenance
  labels/chips. All steps checked, and the code matches: `task.claudeCreated` /
  `task.claudeCompleted` (`js/github-sync.js:69-71`), the chips (`js/render.js:379-380`), and the
  contract doc it added, now `docs/4-systems/claude-integration.md`. Inert: executed.

- **`2026-09-21-claude-focus-deck-integration-design.md`** — the design spec both Claude plans
  above implement (Part 1: on-demand issues contract; Part 2: autonomous check-in). Part 1 is
  fully executed (see above). Inert: superseded by the executed plans and the roadmap/state docs
  that now track this work directly.

- **`2026-09-21-claude-daily-checkin.md`** — plan for the autonomous daily check-in (Part 2 of
  the spec above). The trigger itself was created (`trig_01DrH7KqRxHMEzANb9kgbYKe`), but its own
  execution notes record that a real Gist read from a fired session was not yet confirmed. The
  user confirmed on 2026-09-26 that it works, after tweaks to this plan and its prompt that are
  not reflected here, so this file is the pre-tweak version. Archived because the check-in was
  shelved as less useful than expected.
