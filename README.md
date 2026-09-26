# Focus Deck

Focus Deck is a small, installable web app for people who have too many tasks and not enough
executive function to pick one. Instead of showing you a giant list and hoping you'll choose
wisely, it asks "what's your focus right now?" and hands you exactly one task, picked at random
from a label and/or project you choose — with the rest deliberately out of sight.

It's a personal ADHD-management tool first and a GitHub productivity tool second: it works fine
with nothing but tasks you type in by hand, and it gets more useful if you also link it to a
GitHub repo.

## Why this exists

Task list apps are built on an assumption that doesn't hold for a lot of ADHD brains: that
seeing everything you have to do helps you decide what to do next. In practice a long list is
just a wall of undifferentiated obligation, and the more of it you can see at once, the harder
it is to start any single item. Focus Deck is built around the opposite bet — **reduce the
decision to almost nothing**:

- **One task at a time.** The main screen doesn't show your backlog. It shows a single focused
  task (or nothing), and a label/project picker for getting one.
- **Pick the kind of work, not the task.** Choose "a chore", "an art task" or "anything in this
  repo", and Focus Deck picks one at random, so the choosing itself costs nothing. (It used to pick
  by Low / Medium / High energy; that is switched off for now, see `docs/Decisions.md`.)
- **A capture inbox**, so a stray thought doesn't have to be filed, categorized, or prioritized
  in the moment it occurs to you — just dropped somewhere it won't be forgotten, to be sorted
  later when you have the executive function for that instead.
- **It's a PWA, so it installs like an app** (Add to Home Screen / Install) and works offline —
  no App Store account, no build step for you to run, no server beyond GitHub Pages serving
  static files.

If you write code, the GitHub sync exists so that the task you're avoiding in Focus Deck and the
issue you're avoiding on GitHub are the same task, tracked in one place, instead of two lists
that quietly drift out of sync with each other.

## Features

**Focus picker** — a big card for each task type (labels like art, chore, bug), showing how many
tasks are open and the most pressing priority among them. Tap a card, or **Surprise me** below them, to get one
open task at random. Project pills above narrow it to one repo (the busiest few show, "+N more"
reveals the rest), and the choice is remembered on each device. Tasks with no label get an
**Unlabelled** card, and **Sort N unlabelled** steps through them one at a time: tap Reminder,
Build or Fix (or any other label), then Next.
"Not this one" rerolls within the same pool.

**Priority** — each task can be Urgent, High, Medium or Low. Tap a task's priority chip to change
it. On a linked issue it syncs both ways as a `priority: …` label, and common labels like `P1` or
`critical` are read as priority too.

**Projects, categories, and colors** — tasks live inside projects; both projects and tasks can
carry a color-coded category (set up and customized in Settings), so a glance at a chip tells
you what kind of work something is without reading it.

**Inbox capture** — a single always-visible input at the top of the page for getting a thought
out of your head. File it into a project (or a new one) whenever you're ready, not before.

**GitHub issue sync**, once a token is added in Settings:
- Pull issues from a repo in as tasks, and push local category changes back to GitHub as
  labels (and vice versa) — every label on the issue shows on the task, and adding or removing
  one on either side follows on the other. A label seen for the first time becomes a category in
  its GitHub colour.
- Link or unlink any individual task to any individual issue, even outside your normally-synced
  repos. A task added to (or filed from Unsorted into) a GitHub project becomes an issue
  automatically, and any other task can become one from its edit form — its steps become a
  checklist in the issue body, its labels and priority go with it, and an open issue with the same
  title is linked instead of duplicated. Linking and unlinking live in the edit form too.
- Deleting a linked task closes its issue as "not planned" (it can be reopened on GitHub) and
  keeps it from coming back on the next sync.
- Completion sync runs both ways: check off a task here and its linked issue closes on GitHub;
  reopen the issue there and the task comes back here.

**Cross-device sync** — an optional private GitHub Gist acts as a small sync target so your
state follows you between devices (see [Syncing across devices](#syncing-across-devices-github-gist)
below).

**Auto complexity estimate** — a lightweight, fully local heuristic (step count, description
length, a couple of keyword scans, and label count for GitHub-sourced tasks) sorts tasks into a
rough low/medium/high complexity tier, purely for at-a-glance triage — no network call, no AI,
just arithmetic.

**Installable PWA** — a manifest and service worker make it installable and usable offline;
icons are generated at deploy time rather than committed, to keep the repo small.

## How it's built

Focus Deck is intentionally low-tech: **vanilla JavaScript ES modules, no framework, no bundler,
no build step.** Any static file server can run it, and a browser can run it by loading
`index.html` directly. That's a deliberate trade-off — it means slightly more manual DOM/string
work in `render.js` than a framework would give you for free, in exchange for a repo anyone can
clone and immediately understand without learning a build toolchain first.

```
index.html            entry point — loads js/app.js as a module, registers the service worker
settings.html          GitHub token, cross-device sync, and category-color settings
js/
  state.js             the single in-memory state object + localStorage persistence and backups
  merge.js             mergeStates(): pure local/remote state merge
  mutations.js         every way state is allowed to change (adding/editing/completing tasks, etc.)
  render.js             pure functions: state -> HTML strings
  app.js                wires DOM events to mutations, and mutations back to a repaint
  github.js             thin GitHub REST API client (issues, labels, gists)
  github-sync.js         issue <-> task linking, category <-> label sync, completion sync
  sync.js                cross-device sync via a GitHub Gist
  complexity.js          the local low/medium/high complexity heuristic
  project-filter.js      project search/sort/filter logic
  *.test.mjs             plain node:test files alongside the modules they test
css/app.css             all styling
service-worker.js       offline caching for the installed PWA
manifest.webmanifest    PWA metadata (name, icons, theme color)
generate_icons.py       generates the PWA icons at deploy time (not committed to the repo)
scripts/
  guard-file-churn.mjs   blocks a commit that silently deletes most of an existing file
.githooks/               optional local hooks (commit-msg runs the guard above); see below
docs/systems/           deep-dive docs for the trickier subsystems (currently: GitHub sync,
                         PWA shell, GitHub-Issues provenance, Gist sync, styling)
docs/Decisions.md       dated log of non-obvious decisions and why they were made
```

The render pattern is simple on purpose: every state change re-renders the whole `#app` element
from a string template (`paint()` in `app.js`), rather than diffing or patching. For an app this
size that's faster to reason about than it is slow to run.

## Running it locally

No install, no build. From the project root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser. Any other static file server works the same way
(`npx serve`, VS Code's Live Server, etc.) — the app has no server-side logic at all.

## Installing it as an app

The deployed site (`https://ajw2003.github.io/focus-deck-app/`) is a PWA, so most browsers can
install it as a standalone app instead of leaving it as a tab. Installing vs. using it in a tab
makes no functional difference — it's the same app either way — it's just a more app-like way to
open it.

**Phone (Android, Chrome):** open the site, tap the ⋮ menu, then **Add to Home screen** /
**Install app**.

**Phone (iOS, Safari):** open the site, tap the Share icon, then **Add to Home Screen**.

**Computer (Chrome or Edge):** open the site and click the install icon at the right end of the
address bar (a monitor with a ↓), or use the ⋮ menu → **Install Focus Deck…**. It then opens in
its own window with a normal taskbar/dock icon.

**Computer (Opera):** Opera's desktop browser doesn't support installing PWAs — there's no
install button in the address bar, unlike other Chromium browsers. Opera's own "Create desktop
shortcut" option just opens the site in a regular Opera tab, not a standalone app window. To get
the real installed-app experience on Windows/macOS/Linux while using Opera day to day, open the
site in Edge (built into Windows) or Chrome instead and install it from there — Opera itself has
no workaround for this. (Opera on Android is unaffected — Add to Home screen works normally
there.)

## Setting up GitHub sync (optional)

Everything above works with zero setup, entirely offline, storing data in your browser's
`localStorage`. To link tasks to GitHub issues, open **Settings** (the ⚙️ in the top bar) and
follow the walkthrough there to generate a fine-grained GitHub personal access token — it needs
"Issues: Read and write" on whichever repos you want to link, and optionally "Gists: Read and
write" if you also want cross-device sync. The token is stored only in your browser and is only
ever sent to `api.github.com`.

## Syncing across devices (GitHub Gist)

"Cross-device sync" doesn't use `git` directly — it uses a **GitHub Gist** as a small JSON
storage bucket for your whole Focus Deck state (every project, task, category, and the inbox).
A Gist is a lighter-weight GitHub object than a repo, but it's still backed by git underneath;
Focus Deck just talks to it over GitHub's REST API (`js/sync.js`) rather than running git
commands, so there's nothing to clone or push by hand.

How it works:

1. **On your first device**, open Settings and click **Create sync Gist**. This creates a new
   private Gist under your GitHub account containing a snapshot of your current state, and shows
   you its Gist ID.
2. **On each additional device**, open Settings there and save the same GitHub token. Focus Deck
   finds your existing sync Gist by itself and pulls its data in. (Pasting the Gist ID into the
   "Connect" field also works.) The same happens if a browser ever loses its Gist ID.
3. From then on, every device with that Gist ID connected both **pushes** its own changes to the
   Gist (debounced, shortly after you make a change) and **pulls** the Gist's latest contents on
   load — so editing a task on your phone shows up on your laptop the next time it syncs.

**Merging, not overwriting:** if two devices both made changes while offline, Focus Deck doesn't
just let whichever one syncs last win outright. `mergeStates()` in `js/merge.js` merges record by
record: every task, project, category and Unsorted item carries an `updatedAt` timestamp, stamped
automatically whenever it changes, and the newer edit wins for that specific record, not for your
whole state. Something added on one device while the other was offline shows up rather than
getting wiped, and a deletion is a timestamped tombstone, so deleted things stay deleted unless
they were edited somewhere after the deletion.

**This is per-person, not per-team.** The Gist holds one person's entire state — it's meant to
connect *your own* devices, not to be shared between different people. Pointing two different
people's Focus Decks at the same Gist ID would work mechanically (both would push/pull against
it), but their tasks, projects, and categories would all merge into one combined state rather
than staying separate — not what you'd want for two people's independent work. For sharing
progress between multiple people, the GitHub issue sync above (which lives in the repo itself,
not in a personal Gist) is the layer that's actually built for that.

## Running the tests

Each module with non-trivial logic (`complexity.js`, `project-filter.js`, `sync.js`'s state
merge, `github-sync.js`) has a plain `node:test`-based `*.test.mjs` file next to it, with no
test framework beyond Node's own `node:test` and `node:assert` — including `css/app.css` itself,
via `js/style-contract.test.mjs` (see [Styling](docs/systems/styling.md)):

```bash
node --test js/*.test.mjs
```

There's also a guard against a commit silently deleting most of an existing file while its
message describes something much smaller (`scripts/guard-file-churn.mjs`, see
[Decisions](docs/Decisions.md)). It always runs in CI; to also get it locally as a commit-msg
hook, once per clone:

```bash
git config core.hooksPath .githooks
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`: a `test` job runs the full test suite
and the file-churn guard first, and `deploy` (which generates the PWA icons and publishes the
whole directory to GitHub Pages) only runs if `test` passes — there's nothing to build, so the
deployed site is just this repo's static files plus the generated icons.

## Further reading

`docs/systems/` documents the parts of the codebase that are trickier than they look — currently
[GitHub sync](docs/systems/github-sync.md), which covers issue/label/completion syncing,
its invariants, and the ways it can go wrong, and the
[Claude integration contract](docs/systems/claude-integration.md), which governs how Claude
may act on issues (create/comment/close/reopen only, never delete).
