# Consumer product: the desk redesign, a landing page, and onboarding

## Goal

Turn Focus Deck into something a stranger can find, install and start using without help. Three
parts, decided with the user on 2026-10-09:

1. **A new look across the app**: a desk of real stationery people already use to keep track.
2. **A landing page** at the site root that serves the install, the instructions and the pitch.
3. **Onboarding and setup for new users**, including a guided walk through GitHub sync, which
   stays required for syncing between devices rather than being hidden.

The agreed design is the interactive mockup in `docs/plans/redesign-directions.html` ("Your pick"
section), published at https://claude.ai/artifact/36tRd7dM7TCLomFTY3pomc. Screenshots of the agreed
states are in `docs/generated/redesign-mockup/`. Where this plan and the mockup disagree, the
mockup is the design and this plan is the scope.

## Decisions (2026-10-09, in conversation)

- **Site layout.** The landing page goes at the site root (`/focus-deck-app/`). The app moves to
  `/focus-deck-app/app/`. Existing installs and returning visitors are forwarded to the app. Their
  tasks survive the move because `localStorage` belongs to the whole `ajw2003.github.io` origin,
  not to a path.
- **"Download" means installing the web app.** An Install button that triggers the browser's own
  prompt where one exists, plus step-by-step instructions for iPhone, Android and desktop. No
  native builds, no app stores.
- **GitHub sync is a dependency, so new users are walked through it.** It is not hidden behind an
  "advanced" section.
- **Look: "Low light", a desk under a lamp.** Dark-first, with a matching light mode (the same desk
  by day). Every object is stationery:
  - the task in focus is a **sticky note** in the lamp's light;
  - **categories are index cards** and **projects are manila folders**, each in a sideways
    **wallet** flipped through like CD sleeves (the middle card faces you, the others turn away);
  - the folder facing you narrows the index cards below to that project;
  - capturing a thought is a **jotter pad**;
  - **"I've done it"** is a paper checkbox: tapping ticks it in biro and crosses the task out,
    then the note peels away (the rubber stamp was tried and dropped);
  - **"Not this one"** is a paper ticket stub that slips the note back into the deck;
  - **Unsorted is an in-tray** of torn-off jotter slips, filed by choosing a folder and sticking on
    category flags (Post-it page markers), with Already done, Later and Bin it as quiet options.
- **The pills go.** Both the project pills and the category cards of today's focus picker are
  replaced by the two wallets.
- **Three ways of choosing a card all stay, as a setting:** swipe the card up, a single tap, or
  tap once to highlight and again to choose. The same setting governs every wallet.
- **Writing on notes is a setting:** Handwriting (Kalam), Print (Atkinson Hyperlegible), or
  OpenDyslexic. It applies to the sticky note, the jotter and the in-tray slips.

## Steps (one issue each)

Parent issue: #116, "Consumer product: desk redesign, landing page and onboarding". Each step below
is a child issue (#117 to #126, in order), built and checked on its own.

1. (#117) **Move the app to `/app/` and forward existing installs.** Every app file moves under `app/`;
   a placeholder page at the root forwards installed and returning users; the old root service
   worker is retired cleanly; CI, icons and docs follow the move.
2. (#118) **Landing page at the site root.** The desk design, the pitch, how it works in three steps,
   install instructions for the visitor's own device (others one tap away), and a plain "Do I need
   GitHub?" answer.
3. (#119) **Desk look for the focus area.** Colour tokens for dark and light, the type faces, the lamp
   light, the sticky note, the paper checkbox with the biro cross-out, the "Not this one" slip,
   and the jotter replacing the capture bar.
4. (#120) **Card wallets for projects and categories.** Replace the focus picker's pills and label cards
   with the folder and index-card wallets, plus the "Choosing a card" setting with all three ways.
5. (#121) **Unsorted as an in-tray.** Restyle the Unsorted flow as the tray of slips: choose a folder,
   stick on category flags, file it; Already done, Later, Bin it.
6. (#122) **Note-writing setting.** Handwriting, Print or OpenDyslexic, with OpenDyslexic self-hosted.
7. (#123) **Desk look for the rest of the app.** Project tiles and the project list, task rows, the task
   editor, dialogs, and the Settings page, so nothing still wears the old look.
8. (#124) **First-run onboarding.** Welcome, make a first project, add a few tasks, get a first pick, then
   the offer to set up sync. No screen is a dead end.
9. (#125) **Guided GitHub sync setup.** One step per screen: a GitHub account, the access key (token),
   pasting it, turning on sync; a check that names exactly what the key is missing; a second
   device just pastes the same key and its data is found. Whether GitHub lets a link pre-fill the
   token settings is checked against GitHub before it is relied on.
10. (#126) **Settings reorganised, with a setup checklist.** Settings grouped by what people recognise,
    the token instructions moved into the guided setup, and a checklist of what is done and what
    is left, so skipping a step never loses it.

Order: 1 first (everything else lives under `app/`), then 2 alongside 3, then 4, 5, 6, 7, then 8,
9, 10.

## Not in scope

- Native desktop or mobile builds, app-store packaging.
- Changing how sync, merging or the GitHub issue sync work underneath.
- The open issues already filed for other milestones (due dates, repeats, driving mode, and so on).
