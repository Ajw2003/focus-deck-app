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

## Still open

- How the work is split into pull requests.
