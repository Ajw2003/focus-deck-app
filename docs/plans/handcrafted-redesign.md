# Handcrafted redesign and feature cuts — Design

## Goal

Make Focus Deck look like something made by a person rather than a template, and cut the
features and duplicated controls that crowd the page. Decided in a question-and-answer session
on 2026-09-26; each decision below keeps its question number from that session.

## Direction

- **The page's one job is focus (Q1a).** The focus card leads; everything below it is a quieter
  reference area.
- **Phone and desktop count equally (Q2c).**
- **"Handcrafted" means warm editorial with a touch of notebook (Q5b + a).** Big Fraunces moments
  (the focus question and the focus task title), generous whitespace, and one raised card: the
  focus card. Every other section is flat, separated by thin rules, with almost no shadows.

## Visual system

- **Type (Q17a, Q20a).** Fraunces for headings, IBM Plex Sans for everything else. Five sizes:
  small .8rem, body .95rem, section heading 1.15rem, focus question 1.5rem, focus task title
  2.1rem.
- **Corners (Q17a).** Three radii: pill (999px) for chips and pills, 10px for buttons and
  inputs, 18px for the focus card.
- **Section headings (Q18a).** Fraunces italic with a thin rule above each section. The
  uppercase, letter-spaced micro-labels ("IN PROGRESS", "UP NEXT") go.
- **Icons (Q19a).** No emoji. Words wherever there is room; a small set of hand-drawn-style
  inline SVG line icons only where there is not: sync, settings, the projects drawer, and the
  brand mark.
- **Colour (Q4b).** Label colours keep their GitHub hue, muted toward the app's palette. One
  accent colour for every action button. A project's colour is identity only: its dot and its
  card edge.
- **Label names (Q7b).** Shown auto-formatted: title case, known acronyms in capitals ("ui" →
  "UI", "bug" → "Bug"). The stored and GitHub-side name is unchanged.

## Layout and controls

- **Sync (Q6b, Q13a).** The sync row goes. A small sync icon sits in the top bar, spins while
  syncing, and syncs when tapped. The last-synced time shows on hover and in the toast after a
  manual sync. "Pull latest" goes with the row (Q10).
- **Projects (Q9a).** One project list: the sticky sidebar on wide screens, a drawer on phones
  (opened from the top bar). The project pills row under the focus card and the filter bar are
  deleted; their search, category pills, sort and Collapse all live in the list only.
- **Focus picker project pills (Q16a).** Stay where they are, above the label cards.
- **Task rows (Q14a).** A row shows the checkbox, title, labels, deadline, and priority when one
  is set. Tapping the title always opens the editor, which holds Focus on this, Delete, and Open
  issue ↗ for linked tasks (Q12f).
- **Adding tasks (Q3b).** Each project card ends with a collapsed "+ Add task" line that opens
  the full form when tapped.
- **Projects: add and remove (Q15a, Q12d).** Remove moves into a project's header menu (an Edit
  link). Add project sits at the bottom of the project list, as one field that takes a project
  name or an `owner/repo` / GitHub URL.
- **Wide screens: 2x2 tiles (Q26a, 2026-09-27, #82).** From 1100px, projects sit in two columns of
  equal tiles, each half the screen tall, so four show at once; a tile with more tasks than fit
  scrolls inside itself, and further projects continue below in rows of two. Equal heights mean
  no gaps under short projects (#82). Clicking a project in the sidebar scrolls to its tile.
  (Until 2026-09-27 this said one project at a time on wide screens (Q22b, built in PR 4). The
  user reversed it the same day to see several projects at once and to drag them into order; see
  the Decisions entry "Wide screens get 2x2 tiles; one project at a time moves to phones".)
- **Phones: one project at a time (Q28, 2026-09-27).** Below 1100px the main column shows the
  focus card, Unsorted, then one project; the drawer's project list picks which. It opens on the
  one last opened on this device, or the first time the project with the most open tasks (Q23a).
- **Dragging projects into order (Q27a, #73).** Its own PR straight after the 2x2 tiles: a saved,
  synced project order and a "Custom" sort option.
- **Project headers never shift the card (#83).** A header whose name and badges don't fit wrapped
  its controls onto a second line, pushing the progress bar lower than its neighbours'. The
  header keeps its controls on the first line whatever the name's length.

## Removed

- The energy system (Low/Medium/High), already switched off by `ENERGY_UI_ENABLED` (Q8a).
- The "+ Priority" placeholder chip on open task rows (Q12a).
- The Recently done strip (Q12b).
- The "Claude created" and "Claude completed" chips (Q12c).
- `migrate-from-artifact.html` (Q12e).

## Kept

- Project categories alongside task labels (Q11b).

## Docs

- `docs/` moves to the six-tier layout as its own commit (answered yes).

## Pull requests (Q21a)

Four, in order, each checked on a phone before the next starts:

1. The docs move to the six-tier layout.
2. The cuts: energy system, Recently done, Claude chips, "+ Priority", the migrate page, the sync
   row (replaced by the top-bar icon), and the project pills row and filter bar (replaced by the
   one project list with a phone drawer).
3. The visual system: type scale, radii, colour, headings, SVG icons, label-name formatting.
4. The control moves: task rows open the editor, collapsed "+ Add task", Remove and Add project
   moved, plus one project at a time on wide screens and steady project headers (#82, #83;
   Q25a, 2026-09-27).
5. Wide screens get 2x2 tiles; one project at a time moves to phones (Q26a, Q28, 2026-09-27).
6. Drag projects into order (Q27a, the project half of #73).
