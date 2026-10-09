# Handoff: consumer product (#116), paused 2026-10-09

Where the desk redesign, landing page and onboarding work stands, and exactly how to pick it up.
The plan is `docs/plans/consumer-product.md`; the agreed design is the "Your pick" section of
`docs/plans/redesign-directions.html` (published at
https://claude.ai/artifact/36tRd7dM7TCLomFTY3pomc), with screenshots in
`docs/generated/redesign-mockup/`.

## Why it paused

Builder subagents work in git worktrees on their own `AjsAgent/` branches. The house-rules
plugin's `guard` hook decided branch ownership from the MAIN checkout (`CLAUDE_PROJECT_DIR`), which
sits on the cloud session branch `ccr-a03de58c-0j19tb`, not an `AjsAgent/` branch, so every
builder commit asked for permission. With nobody there, each prompt timed out after 5 minutes and
was refused, and the builders stopped. The fix is being made in the plugin repo
(Ajw2003/AjsClaudeCodeTools, branch `AjsAgent/guard-branch-ownership-cwd`, see "The plugin fix"
below). Resume once it is merged and the installed plugin has updated.

## Where the code is

- **Branch:** `ccr-a03de58c-0j19tb` on GitHub. Everything finished is merged there and pushed.
  Nothing is merged to `main`, so nothing is deployed yet (GitHub Pages publishes `main`).
- **Tests on that branch:** `node --test app/js/*.test.mjs` passed 102 of 102 after the #118 merge;
  `node scripts/check-due-contrast.mjs` and `node scripts/guard-file-churn.mjs` passed.

## Status by step

| Step | Issue | State |
|---|---|---|
| 1 | #117 Move the app to `/app/` | Built, checked, merged |
| 2 | #118 Landing page | Built, checked, merged |
| 3 | #119 Desk look for the focus area | Built, checked, merged |
| 4 | #120 Card wallets | Step 1 of 3 written, on branch `AjsAgent/issue-120-wallets` (see below) |
| 5 | #121 Unsorted as an in-tray | Not started |
| 6 | #122 Note-writing setting | Not started |
| 7 | #123 Desk look for the rest of the app | Not started |
| 8 | #124 First-run onboarding | Not started |
| 9 | #125 Guided GitHub sync setup | Not started |
| 10 | #126 Settings with a setup checklist | Not started |

None of #117-#126 is closed: the user closes issues after testing.

### What the finished steps did (details in their docs)

- **#117:** the app lives in `app/`; the root keeps the manifest (`id "./"`, `start_url "app/"`,
  `scope "./"`) so existing installs stay the same app; `forward.js` sends installed and returning
  users to `app/`; `app/service-worker.js` uses cache prefix `focus-deck-app-shell-`; the root
  `service-worker.js` is a retirement worker that deletes the old `focus-deck-shell-*` caches and
  unregisters. `docs/4-systems/pwa-shell.md`.
- **#118:** the landing page (`index.html`, `site.css`, `site.js`). `?about` skips forwarding.
  Light-mode amber is `#8F5A0A` (the mockup's `#B9760F` fails AA with white text).
- **#119:** Low light tokens and faces, the jotter, the sticky-note focus card, the paper checkbox
  and biro cross-out (`app/js/focus-complete.js`, phases kept in `ui.completing` so a repaint
  redraws them), the ticket-stub "Not this one". Due-now and light-mode High/Medium priority
  colours were darkened for contrast. `docs/4-systems/styling.md`.

### #120 in progress

On branch `AjsAgent/issue-120-wallets` on GitHub, commit `52edef0` (based on the #118 merge, `be8d462`):
- `app/js/wallet.js`: the pure choosing decisions plus `mountWallets` (window listeners installed
  once; instances whose track left the page are pruned on each mount).
- `app/js/wallet.test.mjs`: 13 tests, 13 passing when written.
- `app/service-worker.js`: cache `v3`, lists `./js/wallet.js`.

Left to do, as the builder planned it:
- Step 2: replace the focus picker's pills and label cards with the folder wallet and the
  index-card wallet. A project flip re-renders only the category wallet slot, so the project
  wallet's scroll animation isn't cut off. The facing card goes in the markup as `data-facing`;
  the facing folder reuses the existing `focusdeck-focus-filter` projectId so it is remembered per
  device.
- Step 3: the "Choosing a card" setting (Swipe up / Tap / Tap twice, default Tap twice) stored and
  merged like `dueDefaults`, with a merge test, on the Settings page.
- Docs (a Wallets section in `docs/4-systems/styling.md` or a new `docs/4-systems/wallets.md`),
  the full test suite, the contrast check, Chromium checks, screenshots in `docs/generated/pr120/`.
- Planned drops, to confirm with the user: the old picker's "+N more" and "Show all N labels"
  reveals (the wallets scroll through everything); priority text changes from "1 urgent" to
  "top: <highest priority>".

## Things learned that the next steps need

- **Service worker cache version:** bump `CACHE_NAME` in `app/service-worker.js` and add any new
  module to `SHELL_ASSETS` in every step that adds a file. It is `v2` on the branch, `v3` in #120.
- **Rewriting a file trips the churn guard.** A deliberate rewrite needs a
  `File-Rewrite-Ack: <path>` line in a commit message in the same push
  (`scripts/guard-file-churn.mjs:16`).
- **The install prompt:** Chromium did not fire `beforeinstallprompt` on the landing page, which
  registers no service worker, so Install scrolls to the instructions. One-tap install from the
  landing page would need a service worker at root scope. Not decided; ask the user.
- **#122 needs OpenDyslexic self-hosted:** npm package `@fontsource/opendyslexic` 5.3.0, file
  `files/opendyslexic-latin-700-normal.woff2` (120 KB), SIL Open Font Licence (ship the licence
  alongside). The mockup embeds it as a data URI; the app should serve it as a file and cache it.
- **#125, pre-filling GitHub's token form:** GitHub supports template links for fine-grained
  tokens (changelog 2025-08-26), but the exact parameter names were not confirmed. Test a real
  link before relying on it (comment on #125).
- **Issue labels:** issues Claude opens here get `Claude created this` (the repo's contract,
  `docs/4-systems/claude-integration.md:21`) and `AjsAgent created this` (the house rules).
- **Builder briefs that worked:** one issue per builder, `isolation: "worktree"`, at most two at a
  time, commit messages ending `Refs #N` then `Committed by AJ's agent`, real-Chromium checks with
  quoted output, and the parent re-running tests, the guard and the browser checks before merging.
- **A refused prompt must not stop a builder (the user, 2026-10-09).** The briefs used to say "if
  an action is refused, stop and report", and that stalled every builder. Instead: save the work
  another permitted way that does not have the refused action's effect, move on to the next part
  that does not depend on it, and list every refusal in the final report. Never repeat a refused
  action or get its effect another way.

## The plugin fix

Repo Ajw2003/AjsClaudeCodeTools, branch `AjsAgent/guard-branch-ownership-cwd`, no PR opened.
Intended change: the guard judges ownership from the hook payload's `cwd` (the folder the command
really runs in) before `CLAUDE_PROJECT_DIR`; `ccr-` cloud-session branches count as owned like
`claude/`; an optional `HOUSE_RULES_OWNED_BRANCHES` setting adds more prefixes. Force pushes,
deletions, resets, merges and the other destructive rules keep asking. Check the branch's own
commits and `verify.py` result for what actually landed before relying on this summary.

Merges still always ask (a house rule, not this bug), so expect one prompt per finished issue.

## Waiting on the user

1. Review and merge the plugin fix (open a PR from `AjsAgent/guard-branch-ownership-cwd` when
   ready), then let the plugin update (`tools/bootstrap.sh` / `tools\update.bat` in that repo, or
   the plugin's auto-update at session start).
2. Ignore builder worktrees: add `.claude/worktrees/` to `.gitignore` (asked, not yet answered).
3. Try #117-#119 and close them when happy.
4. When ready to publish: merge `ccr-a03de58c-0j19tb` into `main` (that deploys the landing page
   and moves the app to `/app/`).
5. Decide on the one-tap install (a root-scope service worker) or keep the instructions.

## To resume

Start a session on this repo and paste:

```text
Continue the consumer product work (#116). Read docs/plans/consumer-product-handoff.md first,
then check out branch ccr-a03de58c-0j19tb. Confirm the house-rules plugin fix is installed (a
builder commit on an AjsAgent/ branch in a worktree must run without a prompt). Then finish #120
from branch AjsAgent/issue-120-wallets, verify it and merge it, then carry on with #121 to #126
in the plan's order, two builders at a time.
```
