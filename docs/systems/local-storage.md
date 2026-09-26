# Local Storage

## What it owns

Everything Focus Deck keeps in the browser: loading and saving the app state, the Gist ID, and
the local backups. Lives in `js/state.js` (`loadState`, `saveStateLocal`, `setGistId`,
`disconnectGist`). The token is separate (`js/github.js`, key `focusdeck-github-token`).

## How it works

<!-- ref:7f3a -->
Six localStorage keys:

| Key | Holds | Written by |
|---|---|---|
| `focusdeck-state-v1` | the whole app state as JSON | `saveStateLocal` only |
| `focusdeck-gist-id` | the sync Gist ID, on its own | `setGistId` / `disconnectGist` only |
| `focusdeck-state-backups` | up to 5 earlier raw copies, newest first | `backupRaw` |
| `focusdeck-push-pending` | `1` while a local change hasn't reached the Gist | `js/sync.js` |
| `focusdeck-collapsed-projects` | which projects are minimised, as `{ projectId: true }`; per device, never synced | `saveCollapsedProjects` in `js/app.js` |
| `focusdeck-focus-filter` | the focus pick's mode and chosen pills, as `{ mode: 'type' \| 'project', projectId, categoryId }`; per device, never synced | `saveFocusFilter` in `js/app.js` |

**Loading.** `loadState` parses the main key. If the value is there but unreadable, it is copied
into the backups (never discarded), the newest backup that has content is used instead, and
`storageProblem` is set so the app shows a banner. Every successful load also snapshots the
copy it read into the backups. Shapes older builds saved by mistake are repaired on load
(`repairLoaded`).

**Saving.** `saveStateLocal`:
1. throws unless it was handed the state object (the 2026-09-22 bug wrote `"undefined"`);
1. timestamps every record that changed since this page last loaded or saved
   (`stampChanges`, see [gist-sync.md](./gist-sync.md#change-stamping));
2. restores a missing `gistId` from `focusdeck-gist-id` rather than saving the gap;
3. if storage holds a `saveId` this page didn't write, another tab or a back-forward-cache
   restore saved in between, so it merges that copy in (`mergeStates`) before writing;
4. backs up the stored copy first if the new one has less content;
5. drops `_`-prefixed runtime fields (`_ui`) from what it writes.

**Other tabs.** A `storage` event for the main key reloads the in-memory state and repaints; a
`pageshow` with `persisted` does the same for a page restored from the back-forward cache.

**Eviction.** `requestPersistentStorage()` asks the browser not to evict the site's storage.
If the data is evicted anyway, the Gist is the durable copy: with a token saved,
`findSyncGist()` finds it by its file name and reconnects (on app load, and in Settings when a
token is saved or "Create sync Gist" is pressed).

## Invariants

- No code path writes defaults over saved data it could not read. Unreadable data is backed up
  first.
- The Gist ID is cleared only by `disconnectGist()`. Nothing in the UI calls it today; any
  future "Disconnect" button must confirm and say the other devices will stop syncing.
- Every page uses the shared `state` singleton. `loadState()` returns a disconnected copy;
  saving a copy taken earlier reverts whatever was saved since.
- The key names above are user data. Renaming one needs a migration that reads the old key.

## Traps

- **Stale copies.** `settings.html`'s "Connect" handler used to `loadState()` a private copy,
  set the Gist ID on it, and save. The page's shared singleton still had `gistId: null`, so the
  next category edit on the same page saved that and erased the ID. The same thing happened
  with an app tab left open while Settings was used in another tab.
- **Functions in state.** `JSON.stringify` silently drops functions. Callers passed `nextHue`
  (a function) as a category color, so new categories lost their color on every reload.
- **Objects where ids belong.** `M.addCategory()` returns the category object; inline
  "New category…" stored that object as `categoryId`, which matched nothing after reload.
- **Old code in installed apps.** The service worker was cache-first, so a fix to
  `js/mutations.js` never reached an installed copy. See `pwa-shell.md`.
