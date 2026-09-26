# Systems

Tier-4 documents: what each system owns, how it works, its invariants, and its traps.

- [github-sync.md](./github-sync.md) — syncing local tasks/projects with GitHub issues
  (`js/github-sync.js`).
- [pwa-shell.md](./pwa-shell.md) — the installable PWA shell and offline caching
  (`service-worker.js`, `manifest.webmanifest`).
- [claude-integration.md](./claude-integration.md) — the contract for Claude acting on Focus Deck via
  GitHub Issues (create/comment/close/reopen only, never delete) and the provenance labels
  (`js/github-sync.js`, `js/render.js`).
- [local-storage.md](./local-storage.md) — saving/loading state in the browser, the Gist ID,
  local backups, and multi-tab safety (`js/state.js`).
- [gist-sync.md](./gist-sync.md) — merging local state with the remote Gist copy, including
  deletion tombstones (`js/sync.js`).
- [styling.md](./styling.md) — the stylesheet and its contract with the markup that references it
  (`css/app.css`, `js/render.js`), plus the guardrails against it silently breaking
  (`js/style-contract.test.mjs`, `scripts/guard-file-churn.mjs`).
