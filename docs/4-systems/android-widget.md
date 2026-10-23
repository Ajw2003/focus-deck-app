# Android Widget

Status: design approved by Aj on 2026-10-23 ("Design approved: Android widget 1* 2A", plan page
`docs/plans/android-widget.html`). Not built yet. Parent issue #225; steps are listed under Issues below.

## What it owns

An optional Android app that wraps the live Focus Deck web app and adds a home-screen widget showing
one project's Board. The web app, GitHub Pages, and the installs from Safari (iPhone), Chrome
(Android) and desktop browsers do not change; nobody has to use the Android app.

Also owned here: Settings' "Save a copy" and "Load a copy", which move tasks into the Android app for
anyone not using Gist sync. They work on every device.

## Why an Android app at all

Chrome gives installed web apps no way to put a widget on the Android home screen (Chromium issue
40744630, still open). The web app's tasks live in the browser's storage for the site, which nothing
outside the browser can read, and Chrome's own wrapper (a Trusted Web Activity) keeps them there too.
So the widget needs an app whose web view and widget share the phone's app storage.

## How it works (planned)

- **The shell.** Capacitor 8 (`@capacitor/android`, MIT licence) in `android/`, with
  `server.url` set to the GitHub Pages app (`https://ajw2003.github.io/focus-deck-app/app/`), so every
  merge to `main` reaches the Android app with no new APK (design choice 2A). The service worker keeps
  it working offline after the first open. Capacitor documents `server.url` as a development feature,
  so the shell also bundles a small offline page for a first open without a connection.
- **Detecting the shell.** The web app calls the native bridge only when
  `window.Capacitor?.isNativePlatform?.()` is true. In every browser that check is false and nothing
  new runs.
- **Sharing the Board.** After each save, the web app writes a widget snapshot through a small local
  Capacitor plugin (`WidgetBridge`) into Android's SharedPreferences: per project, the three Board
  lists already ordered by `boardList` (`app/js/board.js:46`), with title, status and colour, subtasks
  left out as on the Board. The widget never sorts; it only reads these lists.
- **Widget changes.** A tick, Undo or move in the widget updates the widget's copy of the snapshot at
  once and appends an entry (`taskId`, `op`, `status`, `at`) to a queue in SharedPreferences. When
  the app next opens or comes to the front, it takes the queue and applies each entry through the
  existing `setTaskStatus` (`app/js/mutations.js:157`), so the change is stamped, saved and synced to
  the Gist like a tap in the app. A queued change older than the task's own last change (`task.updatedAt`) is skipped,
  so an edit made later on another device wins, matching `mergeStates` (`app/js/merge.js:62`). A tick applied later keeps the widget's `at` as the
  task's `completedAt`, so "Done this week" counts it on the day it was ticked.
- **The widget.** Jetpack Glance. Picking the project happens in a configuration screen when the
  widget is added, and again on long-press. Tabs Up next, In progress, Done this week with counts; a
  tick box and a one-column move button per task (`→ In progress`, `← Up next`); a ticked task stays
  crossed out with Undo for a few seconds; "Open" starts the app on that project's Board.
- **Moving tasks in (design choice 1, Aj's answer).** Anyone already using Gist sync signs in once in
  the Android app and their tasks arrive. Anyone not using it saves a copy file in the old install and
  loads it in the Android app; loading merges with `mergeStates`, so nothing already there is lost.
- **Building.** A GitHub Actions workflow builds the signed APK and attaches it to a GitHub Release.
  The signing key lives only in the repo's Actions secrets. Losing it means later APKs cannot install
  over the old one.

## Traps

- This sandbox cannot reach Google's Maven or SDK downloads, so the Android code is compiled only in
  GitHub Actions; its log is the compile evidence. Behaviour on a phone is checked only by Aj's QA.
- Widget changes reach the Gist only when the app is next opened. Until then other devices don't see
  them.

## Issues

Parent #225 "Add an Android home-screen widget for a project's Board", with steps:
- #226 Save a copy and Load a copy of your tasks in Settings
- #227 Wrap Focus Deck in an Android app that opens the live site
- #228 Build the Android app on GitHub and publish the APK (after #227)
- #229 Share the Board with the widget inside the Android app (after #227)
- #230 Show a project's Board in an Android home-screen widget (after #228 and #229)
