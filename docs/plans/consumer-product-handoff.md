# Handoff: consumer product (#116), paused 2026-10-09 (updated the same evening)

## Read this first: no subagents until the refusal problem is fixed (the user, 2026-10-09)

Do **not** use builder (or any) subagents for this work for now. The user's instruction, after
a second session where builders kept stopping. Why: when a permission prompt is shown and nobody
answers within 5 minutes, the house-rules hook refuses it, and a refused action can't be retried
for the rest of the session. A builder can't ask the user anything itself, so each refusal left it
half-done. In the evening session that cut short #120's browser check, #121's wiring and #122's
browser check, and refused the #120 merge. Do the work on the main thread, and ping the user just
before any step that will prompt (merges, deleting or replacing a block of code, background
processes) so they can answer in time.

The plugin side: house-rules 2.59.1 (installed 2026-10-09) fixes the branch-ownership bug (it now
judges ownership from the folder a command runs in, and treats `ccr-` branches as owned). It only
loads in a session started after 20:39:53 on 2026-10-09. Verify it with a real probe (a commit and
push from a worktree on an `AjsAgent/` branch, through the hook) before relying on it. That fix does
not stop prompts for merges, deletions or background processes from timing out.

## Evening session, 2026-10-09: what changed

- The main checkout is now on `AjsAgent/consumer-product-continuation-sk1mqt` (same commit as
  `ccr-a03de58c-0j19tb`, `add42bf`, plus this doc). Under 2.59.0 that made builder commits pass
  without a prompt; it does not help with merges.
- **#120 is finished and checked but NOT merged.** Branch `AjsAgent/issue-120-wallets`, head `580718a`.
  The user approved merging it, drops included ("Merge with the drops"), but the git merge prompt
  then went unanswered and was refused. Next step: merge it into `ccr-a03de58c-0j19tb`
  (`git merge --no-ff origin/AjsAgent/issue-120-wallets`), with the user ready to approve.
- **#121 and #122** were built on top of #120's branch, not on `ccr-`. Merge #120 first.

## What needs fixing next, in order

1. **Service worker install fails: missing icons (pre-existing, probably since #117). Confirmed in Chromium.**
   `app/service-worker.js:11-12` lists `./icons/icon-192.png` and `./icons/icon-512.png`, and the root
   `manifest.webmanifest:13-14` points at `app/icons/...`, but no icon PNG exists anywhere in the repo
   (`git ls-tree -r ccr-a03de58c-0j19tb | grep icon-` finds nothing; not gitignored). The install
   uses `cache.addAll` (`app/service-worker.js:34`), which rejects if any file 404s, so the worker
   never installs and the app does not work offline. **Confirmed 2026-10-09** on this branch's code
   (same as `ccr-a03de58c-0j19tb`): served `/app/` in Chromium, the install requested
   `/app/icons/icon-192.png` and `/app/icons/icon-512.png`, both 404, and after 6 s
   `navigator.serviceWorker.getRegistrations()` returned `[]`. It is also almost certainly why #122's offline check hangs at
   `await navigator.serviceWorker.ready` (`scripts/check-note-faces-browser.mjs:142`). Restore or generate the icons
   (check git history for where they went in the #117 move) and re-run.
2. **Merge #120** into `ccr-a03de58c-0j19tb` (see above).
3. **#122: finish the browser check.** Branch `AjsAgent/issue-122-note-writing`, head `a07271e`.
   Feature built; unit tests passed for the builder (121/121), contrast and churn guard passed.
   With the reload fix (`a07271e`), the real-Chromium check passes every face check: all three faces
   on the sticky note and jotter in dark and light, the right font family, OpenDyslexic reported
   loaded by `document.fonts`, a long title fits, stored and applied after reload, no sideways scroll.
   Screenshots in `docs/generated/pr122/` (8 PNGs). Looked at `dark-dyslexic.png` and `light-settings.png`:
   OpenDyslexic fits the note in four lines with interface text unchanged; Settings shows the "Note
   writing" previews. This sandbox blocks Google Fonts, so Handwriting rendered in its fallback, not
   Kalam: check Kalam on a real network. The pinned Settings header appears mid-page in the full-page
   capture; that is the screenshot, not the layout. It then hangs at the
   service-worker/offline section (item 1). Also: the scale values (.95 Print, .78 OpenDyslexic) were
   untuned guesses; the run shows titles of 3, 3 and 4 lines at 24, 22.8 and 18.72px, so check by eye.
   Before merging, reconcile `CACHE_NAME`: #121 set `v4`, #122 `v5`; the merged result needs one value
   above both and every new file in `SHELL_ASSETS`.
4. **#121: wire the in-tray in.** Branch `AjsAgent/issue-121-in-tray`, head `a9298c6`. Built but not
   connected: `app/js/in-tray.js` (decisions), `app/js/in-tray-view.js` (`renderInTrayCard`),
   `app/js/in-tray.test.mjs` (11 tests), CSS "In-tray (#121)" section using the `--note-font` /
   `--note-scale` hook from #122, `docs/4-systems/in-tray.md` (keep/change/drop inventory and a
   "To wire it" list). Unit tests on that head: 130/130 (re-run by the parent). What's
   left: replace the old Unsorted block in `app/js/render.js` (lines 207-325 on that branch) with the
   new one (kept in `scripts/.tmp-block.js`, committed only so it isn't lost: delete it once used),
   wire `app/js/app.js`, rewrite the Unsorted tests in `app/js/render.test.mjs`, write and run a
   browser check (`scripts/check-in-tray-browser.mjs`, modelled on `scripts/check-wallets-browser.mjs`,
   which serves the repo inside its own process, so no background server), screenshots in
   `docs/generated/pr121/`. The replacement deletes a block of code: tell the user first.
   Named drops to confirm with the user: the "+N more"/"Show fewer" reveals, "N skipped for now" with
   "Go through them again", and the "· change" project chip.
5. Then #123 to #126 in the plan's order, on the main thread.

## Browser checks: how they run here

`scripts/check-wallets-browser.mjs` (on the #120 branch) starts its own static server inside the Node
process and closes it at the end, so no background process and no prompt. Run with
`CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-wallets-browser.mjs`.
Result on `580718a`: 44 passed, 0 failed. Unit tests on the #120 head: 119/119; contrast check passed;
`node scripts/guard-file-churn.mjs --base origin/ccr-a03de58c-0j19tb` OK (the guard needs `--base`).
The one console 404 in that run is the browser's automatic `/favicon.ico`. Seen in the #120
screenshots: in swipe mode the card does not visibly follow the finger in the first 25px of a drag
(the swipe still draws). Worth a look.

## Waiting on the user (evening session)

- Merge #120 (approved in principle; the git prompt was refused).
- Approve deleting the old Unsorted block when wiring #121.
- `.git/house-rules/waiting-on-you.json` still lists the refused #120 merge and #121's refused `sed`
  splice and `rm`. Clear them once handled.

---

The sections below are from the first pause, earlier on 2026-10-09; the status table is updated.


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
| 4 | #120 Card wallets | Built and checked (44/44 in Chromium), NOT merged: merge prompt refused |
| 5 | #121 Unsorted as an in-tray | Logic, view and tests built; not wired in, no browser check |
| 6 | #122 Note-writing setting | Built; browser check passes faces, hangs at offline (missing icons?) |
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

### #120 in progress (superseded: see the top of this doc)

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
especially the top sections. Do not use subagents. Work on branch
AjsAgent/consumer-product-continuation-sk1mqt. Follow "What needs fixing next, in order":
confirm and fix the service worker's missing icons, merge #120 into ccr-a03de58c-0j19tb (tell
me just before so I can approve the prompt), finish #122's browser check, wire #121, then
#123 to #126 in the plan's order.
```
