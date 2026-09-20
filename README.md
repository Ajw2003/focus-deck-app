# Focus Deck

Focus Deck is a small, installable web app for people who have too many tasks and not enough
executive function to pick one. Instead of showing you a giant list and hoping you'll choose
wisely, it asks "how much energy do you have right now?" and hands you exactly one task that
fits — with the rest deliberately out of sight.

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
  task (or nothing), and a "Surprise me" / energy-level picker for getting one.
- **Energy-based, not priority-based.** You say Low / Medium / High energy, and Focus Deck picks
  from tasks tagged at that level — because "what's most important" and "what I can actually do
  right now" are frequently different questions, and only one of them is useful at 11pm.
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

**Focus picker** — pick an energy level (or hit "Surprise me") and get one task pulled from
whatever's in progress or next at that level, soonest deadline first. "Not this one" rerolls
within the same pool without changing your energy level.

**Projects, categories, and colors** — tasks live inside projects; both projects and tasks can
carry a color-coded category (set up and customized in Settings), so a glance at a chip tells
you what kind of work something is without reading it.

**Inbox capture** — a single always-visible input at the top of the page for getting a thought
out of your head. File it into a project (or a new one) whenever you're ready, not before.

**GitHub issue sync**, once a token is added in Settings:
- Pull issues from a repo in as tasks, and push local category changes back to GitHub as
  labels (and vice versa) — a label on the issue and a category on the task are kept in sync
  in both directions, auto-creating a local category the first time a new label shows up.
- Link or unlink any individual task to any individual issue, even outside your normally-synced
  repos, and turn any existing manually-created task into a brand-new GitHub issue with one
  click — its steps become a checklist in the issue body, its category becomes a label.
- Completion sync runs both ways: check off a task here and its linked issue closes on GitHub;
  reopen the issue there and the task comes back here.

**Cross-device sync** — an optional private GitHub Gist acts as a small sync target so your
state follows you between devices, with a last-write-wins merge per task and union merges for
lists (nothing is silently deleted just because one device was offline when a change happened
elsewhere).

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
  state.js             the single in-memory state object + localStorage persistence
  mutations.js         every way state is allowed to change (adding/editing/completing tasks, etc.)
  render.js             pure functions: state -> HTML strings
  app.js                wires DOM events to mutations, and mutations back to a repaint
  github.js             thin GitHub REST API client (issues, labels, gists)
  github-sync.js         issue <-> task linking, category <-> label sync, completion sync
  sync.js                cross-device sync via a GitHub Gist, and state merging
  complexity.js          the local low/medium/high complexity heuristic
  project-filter.js      project search/sort/filter logic
  *.test.mjs             plain node:test files alongside the modules they test
css/app.css             all styling
service-worker.js       offline caching for the installed PWA
manifest.webmanifest    PWA metadata (name, icons, theme color)
generate_icons.py       generates the PWA icons at deploy time (not committed to the repo)
docs/systems/           deep-dive docs for the trickier subsystems (currently: GitHub sync)
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

## Setting up GitHub sync (optional)

Everything above works with zero setup, entirely offline, storing data in your browser's
`localStorage`. To link tasks to GitHub issues, open **Settings** (the ⚙️ in the top bar) and
follow the walkthrough there to generate a fine-grained GitHub personal access token — it needs
"Issues: Read and write" on whichever repos you want to link, and optionally "Gists: Read and
write" if you also want cross-device sync. The token is stored only in your browser and is only
ever sent to `api.github.com`.

## Running the tests

Each module with non-trivial logic (`complexity.js`, `project-filter.js`, `sync.js`'s state
merge, `github-sync.js`) has a plain `node:test`-based `*.test.mjs` file next to it, with no
test framework beyond Node's own `node:test` and `node:assert`:

```bash
node --test js/*.test.mjs
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which generates the PWA icons and
publishes the whole directory to GitHub Pages — there's nothing to build, so the deployed site
is just this repo's static files plus the generated icons.

## Further reading

`docs/systems/` documents the parts of the codebase that are trickier than they look — currently
just [GitHub sync](docs/systems/github-sync.md), which covers issue/label/completion syncing,
its invariants, and the ways it can go wrong.
