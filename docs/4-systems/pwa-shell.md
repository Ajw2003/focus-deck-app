# PWA Shell

## What it owns

The installable PWA shell: `manifest.webmanifest`, the offline caching behavior in
`service-worker.js`, and the registration call in `index.html` (`index.html:31`) that
wires the service worker into the page.

## How it works

`SHELL_ASSETS` lists the app's core files; on `install`, the service worker pre-caches all of
them in one `cache.addAll()` call. The `fetch` handler is **network-first** with a
same-origin-only guard: it always tries the network, stores each good response in the cache,
and falls back to the cache only when offline. Cross-origin requests (including the Google
Fonts CDN) are never intercepted. `index.html` registers it with `updateViaCache: 'none'` so the
browser checks for a new `service-worker.js` on every load.

Network-first has to bypass the browser's own HTTP cache too. GitHub Pages serves every file with
`Cache-Control: max-age=600`, so a plain `fetch(req)` inside the worker could be answered from
that cache with a file up to 10 minutes old. Right after a deploy, an installed app loaded a fresh
`index.html` with a stale `js/render.js`: a mix of versions that looked like the new features
weren't working. `fetchFresh` therefore fetches with `cache: 'no-cache'`, which asks the server
every time (a cheap 304 when nothing changed), and `install` pre-caches with `cache: 'reload'`. A
navigate-mode request can't be copied with new options, so navigations are fetched by URL, and any
redirect is passed back as a redirect.

It used to be cache-first. Because `service-worker.js` itself didn't change when
`js/mutations.js` was fixed, installed copies kept serving the old file, which wrote
`"undefined"` over the saved data, indefinitely. Don't go back to cache-first for app code.

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
