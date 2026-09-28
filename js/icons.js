// focus-deck-app/js/icons.js
//
// The single source of truth for the app's hand-drawn-style inline SVG line icons (Q19a — no
// emoji anywhere in the UI). Every icon: stroke="currentColor", fill="none", ~1.75 stroke, round
// caps/joins, viewBox 24 (the sync icon predates this file and keeps its own viewBox 20, unchanged,
// per docs/4-systems/styling.md#sync-button), and a slightly irregular hand-drawn path rather than
// a perfect geometric primitive.
//
// js/render.js uses these directly (the sync button). index.html/settings.html are static markup
// with no render step, so they inline the same paths by hand — see the "Icons" section of
// docs/4-systems/styling.md for where each one is duplicated and why.

export const ICON_SYNC =
  '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M15.5 6.5A6 6 0 0 0 5 8.5M4.5 13.5A6 6 0 0 0 15 11.5"/>'
  + '<path d="M15.5 3v3.5H12"/>'
  + '<path d="M4.5 17v-3.5H8"/>'
  + '</svg>';

export const ICON_SETTINGS =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M4 6.5h9.4"/><circle cx="16.3" cy="6.4" r="1.8"/>'
  + '<path d="M20 12.3H10.7"/><circle cx="7.6" cy="12.4" r="1.8"/>'
  + '<path d="M4 18.2h9.5"/><circle cx="16.6" cy="18.1" r="1.8"/>'
  + '</svg>';

export const ICON_PROJECTS =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M4 6.6h13.6"/>'
  + '<path d="M4 12.2h16.4"/>'
  + '<path d="M4 17.6h10.2"/>'
  + '</svg>';

export const ICON_COMPASS =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M12.3 3.4a8.6 8.6 0 1 1-.4 17.2 8.6 8.6 0 0 1 .4-17.2Z"/>'
  + '<g transform="rotate(25 12 12)"><path d="M12 5.2 14.3 12H9.7Z" fill="currentColor"/><path d="M9.7 12 12 18.8 14.3 12"/></g>'
  + '</svg>';

// The drag grip on a project header (PR 9): two columns of three short strokes, drawn slightly off
// true so they read as dots made by hand. Smaller than the toolbar icons (16px).
export const ICON_GRIP =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M8.6 5.6v1.6"/><path d="M8.4 11.2v1.7"/><path d="M8.7 16.8v1.5"/>'
  + '<path d="M15.4 5.5v1.7"/><path d="M15.6 11.3v1.5"/><path d="M15.3 16.9v1.5"/>'
  + '</svg>';
