# PWA Shell

## What it owns

The installable PWA shell: `manifest.webmanifest`, the offline caching behavior in
`service-worker.js`, and the registration call in `index.html` (`index.html:31`) that
wires the service worker into the page.

## How it works

`SHELL_ASSETS` (service-worker.js:9) lists the app's core files; on `install`, the
service worker opens a cache and pre-caches all of them in one `cache.addAll()` call
(service-worker.js:27-32). The `fetch` handler (service-worker.js:43-63) is cache-first
with a same-origin-only guard — cross-origin requests (including the Google Fonts CDN,
excluded on purpose so it isn't fought over its own cache headers) are never intercepted
— and it opportunistically caches any new same-origin GET response it sees, so future
asset additions are picked up without bumping `CACHE_NAME`.

### Select backgrounds must stay opaque — `.add-project-form select` (css/app.css:280-282)

<!-- ref:63c4 -->
Unlike the sibling text input, this can't stay `background:transparent` — a `<select>`'s
box and its native popup fall back to the OS/browser's own widget background when nothing
opaque is set, so `color:var(--ink)` (light in dark mode) was landing on a native-white
background. Every other `<select>` in this file sets an explicit solid background for the
same reason; this one has to match. (Fixes GitHub issue #14: category selector dropdown
rendering white-on-white in the downloaded/installed version — `.add-project-form select`
was the only `<select>` in the stylesheet using `background:transparent`, copied from its
sibling ghost-styled text input, instead of `background:var(--surface)` like
`.task-edit-form select`, `.add-task-form select`, `.project-sort-select`, and
`.project-cat-edit select`.)

## Invariants

All paths in `SHELL_ASSETS`, plus `start_url` and `scope` in `manifest.webmanifest`, and
the `register()` call in `index.html`, must be relative (no leading `/`). This app is
deployed as a GitHub Pages *project* page under `/focus-deck-app/`, not a domain root — a
root-absolute path resolves against the bare domain instead of the actual subpath and
404s there. Paths must resolve against wherever the script's own URL actually is, whether
that's a GitHub Pages subpath or a local dev server's root.
- Every `<select>` in css/app.css must set an explicit opaque `background` (never
  `transparent`) — there's no `appearance:none` anywhere in the codebase, so nothing
  guarantees CSS fully controls the native widget's rendering; without an opaque
  background, the OS/browser's own popup background can show through instead.

## Traps

**2026-09-21 — root-absolute paths broke the deployed offline shell silently.** Before
this date, `SHELL_ASSETS` used root-absolute paths (`/index.html`, etc.). The site still
deployed and installed fine as a PWA — the manifest and icons fetched OK — but two things
were actually broken on the deployed (GitHub Pages project page) site:

- The installed app's `start_url` resolved to the bare domain root, which is a real 404
  since GitHub Pages project pages don't serve anything at the root.
- Separately, `cache.addAll()` during install was rejecting entirely, because every asset
  in `SHELL_ASSETS` was being requested against the (nonexistent) domain root instead of
  the actual `/focus-deck-app/` subpath — `cache.addAll()` fails the whole call on any
  single non-OK response. So the offline shell cache never populated on the deployed
  site.

Neither failure was visible locally, because local dev serves from the root, where
root-absolute and relative paths happen to resolve to the same place — the bug only
showed up once deployed to a subpath.
