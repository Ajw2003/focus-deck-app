# Onboarding

## What it owns

First-run onboarding (#124, part of #116): one screen per step for someone with nothing here yet,
and the empty states that keep a new user from hitting a dead end.

- `app/js/onboarding.js` holds the decisions, with no DOM: `shouldShowOnboarding`, `nextStep`,
  `categoryChips`, and the `focusdeck-onboarding` device flag. Tested in
  `app/js/onboarding.test.mjs`.
- `app/js/onboarding-view.js` holds the markup: `renderOnboarding(st, ob, renderFocus)`.
- `app/js/app.js` holds the wiring: `loadOnboarding`, `finishOnboarding`, `onOnboardingClick`, the
  `ob-folder` / `ob-task` submits, and `openFirstProjectPanel`.
- `app/css/app.css` has the styles, in the "First-run onboarding (#124)" section.

## How it works

`ui.onboarding` is `{ step, projectId, category, forced }`, or `null` when the app shows. While it is
set, `renderApp` draws only the onboarding in the main column (the topbar and jotter stay).

| Step | What it does |
|---|---|
| welcome | What Focus Deck does; "Let's start" |
| folder | Name a project (suggestions Home / School / Work fill the field); `M.addProject` |
| tasks | Quick-add tasks; one category chip can be on at a time, and it applies to each task added while on. A suggested category (Study, Art, Errand) is made on first use through `labelIdByName` |
| pick | `M.pickFocus({ projectId })` and the real sticky note (`R.renderFocus`), so ticking it off and "Not this one" work |
| sync | "Set up sync" goes to `settings.html#sync-section` (#125 replaces this with the guided setup); "Not now" ends it |

Every step has "Skip, I'll look around". Skipping or finishing sets `focusdeck-onboarding` to `done` on
this device. Leaving another way (closing the tab half-way) keeps what was made. On the next load
there is data, so the app shows.

### When it shows (`shouldShowOnboarding`)

- `?welcome` in the address always shows it. Settings > Help > "Replay the welcome" links there, and
  finishing a replay drops `?welcome` from the address.
- A device that finished or skipped it never shows it again.
- A saved GitHub key or a sync Gist ID means this is a second device, so it doesn't show, even before
  the first sync brings the data in.
- Otherwise it shows only with no projects and no jotted thoughts.
- If a sync brings projects in while the welcome is still on its first screen, it steps aside
  (unless it was replayed on purpose).

### Empty states

- No projects: the main column says what a folder is and offers "+ New project". That opens the
  "+ New" panel in place, because the sidebar that normally holds it isn't drawn until a project
  exists. The topbar's Projects button does the same with no projects, instead of nothing.
- The focus area with no projects says to make a folder below, not to use a list that isn't there.

## Checks

`scripts/check-onboarding-browser.mjs`: 48 checks at 390px in a real Chromium. It covers the full
flow in dark and light; skip, then a first project from the empty state; leaving half-way; no
welcome for existing data, a second device with a key, one with a Gist, or a device that finished
it; the replay from Settings; and "Set up sync". Screenshots are in `docs/generated/pr124/`.
