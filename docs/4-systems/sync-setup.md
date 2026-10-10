# Guided sync setup

## What it owns

The guided GitHub sync setup (#125, part of #116). It is one step per screen on `app/setup.html`,
and it replaces the wall of instructions as the way new people turn on sync.

- `app/js/key-check.js` holds `looksLikeKey` and `checkKey(token, request, now)`. It has no DOM, and
  the network goes through `request`. Tested in `app/js/key-check.test.mjs`.
- `app/js/sync-setup.js` is the page script: the steps, the drawing of GitHub's settings, saving the
  key, and turning sync on.
- `app/js/sync.js` has `createSyncGist()`, which Settings now uses too.
- `app/css/app.css` has the styles, in the "Guided sync setup (#125)" section. The page reuses the
  onboarding card.

Ways in: onboarding's last step ("Set up sync"), and Settings > GitHub token > "Set up sync step by
step".

## How it works

| Step | What it does |
|---|---|
| why | What sync gives you; free; your data stays in a private file in your own account |
| account | Links out to GitHub's sign-up and sign-in pages (new tab) |
| key | "Open GitHub's key page" (`TOKEN_PAGE`), plus a drawing of exactly what to choose |
| paste | A password field; surrounding spaces from a copy are trimmed |
| check | `checkKey` runs at once and lists each finding, ✓ / ! / ✗, in plain words |
| on | Already syncing: just the key is updated. A Gist found (`findSyncGist`): connect and pull, a second device. None: `createSyncGist`, a first device |

- **The key is saved only after it passes**, so a mistyped key never replaces a working one.
- **It only ever goes to `api.github.com`.** The links to github.com carry no key.

### What the check looks at

- **Format first**, with no request: `github_pat_…` or `gh?_…`.
- `GET /user`: 401 means rejected (expired, deleted or mangled; GitHub doesn't say which). Then
  account ok.
- **Classic key:** its `X-OAuth-Scopes` header decides Gists (`gist`) and issues (`repo` /
  `public_repo`), with no extra requests.
- **Fine-grained key:** `GET /gists?per_page=1`; anything but 200 means Gists is missing, which blocks
  sync, with the exact place to turn it on. Then `GET /user/repos?per_page=1` and that repo's
  `/issues?per_page=1`; no repo or no issues gives a warning, because issue sync is optional.
- **Expiry:** a warning when it is 14 days or less away, from `github-authentication-token-expiration`.

## Traps and unknowns

- **The pre-fill link is unconfirmed.** GitHub can pre-fill a new fine-grained key's form from URL
  parameters (changelog 2025-08-26), but the names used (`name`, `description`, `gists=write`,
  `issues=write`) were never checked against GitHub, because the build sandbox can't open
  github.com. So the key step always lists what to choose, and the link is only a head start.
  **To confirm:** open `TOKEN_PAGE` while signed in and see which fields fill in.
- **The test fixtures were not captured from GitHub.** They follow GitHub's documented responses,
  and their file header says so. The check has not run against a real key.
- **The expiry warning may never show in a browser.** GitHub's CORS `Access-Control-Expose-Headers`
  may not include `github-authentication-token-expiration`; the page then reads `null` and skips
  the warning. `X-OAuth-Scopes` is exposed.
- **Issue permission is checked for reading only.** Write access can't be proven without writing.

## Checks

- `app/js/key-check.test.mjs` covers a good key, missing Gists, missing Issues, no repositories, an
  expired key, the wrong thing pasted, expiring soon, a classic key, and GitHub unreachable.
- `scripts/check-sync-setup-browser.mjs` runs 22 checks at 390px in Chromium, with
  `api.github.com` simulated. It covers a first device, missing Gists fixed and re-checked, a
  second device pulling in its data, an expired key, a wrong paste, the key going only to
  `api.github.com`, and the Settings link. Screenshots are in `docs/generated/pr125/`.
