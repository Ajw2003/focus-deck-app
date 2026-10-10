// focus-deck-app/js/onboarding.js
// First-run onboarding's decisions, with no DOM: whether to show it, the order of its steps, and
// the category chips offered while adding the first tasks. js/onboarding-view.js draws it and
// js/app.js wires it. Tested in onboarding.test.mjs. See docs/4-systems/onboarding.md

// Per device, like the minimised projects: a device that has seen (or skipped) the welcome never
// shows it again unless asked to (Settings > Replay the welcome, which opens the app with ?welcome).
export const ONBOARDING_KEY = 'focusdeck-onboarding';

export const STEPS = ['welcome', 'folder', 'tasks', 'pick', 'sync'];

export const FOLDER_SUGGESTIONS = ['Home', 'School', 'Work'];

// Offered alongside the labels that already exist, made on first use (same colours as their
// wallet cards would get from labelIdByName: none given, so the next hue).
export const CATEGORY_SUGGESTIONS = ['Chore', 'Study', 'Art', 'Errand'];

// Show the welcome only to someone with nothing here yet, once per device:
// - `forced` (?welcome) always shows it;
// - `seen` (this device finished or skipped it) never does;
// - any data (a project or a jotted thought) means they already know the app;
// - a saved GitHub key or sync Gist means this is a second device, whose data comes from sync.
export function shouldShowOnboarding({ st, seen, hasToken, hasGist, forced }) {
  if (forced) return true;
  if (seen) return false;
  if (hasToken || hasGist) return false;
  return !(st.projects.length || st.inbox.length);
}

// The step after `step`, or null after the last.
export function nextStep(step) {
  const i = STEPS.indexOf(step);
  return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : null;
}

// The category chips for the tasks step: every existing label, then the suggestions not already
// there (matched ignoring case). Each is { name, id } where id is null for one not made yet.
export function categoryChips(categories) {
  const have = categories.map((c) => ({ name: c.name, id: c.id }));
  const names = new Set(categories.map((c) => c.name.toLowerCase()));
  return have.concat(CATEGORY_SUGGESTIONS.filter((n) => !names.has(n.toLowerCase())).map((name) => ({ name, id: null })));
}
