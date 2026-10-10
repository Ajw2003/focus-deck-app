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
| sync | "Set up sync" opens the guided setup (`setup.html`, #125, `docs/4-systems/sync-setup.md`); "Not now" ends it |

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

## The setup checklist

Settings opens with a checklist (#126), from `app/js/setup-checklist.js` (`checklistItems`,
`checklistProgress`; tested in `app/js/setup-checklist.test.mjs`). It shows what's done and what's
left, so skipping a step in the welcome never loses it.

| Item | Done when | Its link |
|---|---|---|
| Your first folder | any project | `./?welcome` |
| A few tasks | any task | `./?welcome` with no folder, else the desk |
| Sync between your devices | a key and a sync Gist on this device | `setup.html` |
| Issue sync (optional) | a project linked to a repo | `index.html?new=repo` with a key (opens "+ New" on its repo tab), else `setup.html` |

The heading counts the needed items ("Getting set up: 1 of 3 done", then "All set up"). The list
redraws when another tab or a sync changes the state, when the page regains focus, and when this
page's own key or Gist controls change the sync status line or show a toast.

### Settings groups (#126)

Settings is grouped by what people recognise:

- **How it looks:** note writing, category colours. Light or dark follows the device; there is no
  theme setting.
- **How it works:** choosing a card, due dates.
- **Sync and GitHub:** the status, the guided setup, a line on issue sync, and the key and Gist
  controls under "Paste a key or a sync Gist ID directly". Every control kept its id, so the page
  scripts are unchanged.
- **Help:** replay the welcome, and a link to the install steps on the landing page.

The six-step token instructions left Settings for the guided setup, which gained their one extra
item (Administration, optional, for making repos).

## Checks

`scripts/check-settings-browser.mjs`: 26 checks (the groups and checklist, every setting keeping and saving its value, the direct key and Gist controls, the repo link) at 390px and 1280px in both themes; screenshots are in `docs/generated/pr126/`.

`scripts/check-onboarding-browser.mjs`: 48 checks at 390px in a real Chromium. It covers the full
flow in dark and light; skip, then a first project from the empty state; leaving half-way; no
welcome for existing data, a second device with a key, one with a Gist, or a device that finished
it; the replay from Settings; and "Set up sync". Screenshots are in `docs/generated/pr124/`.
