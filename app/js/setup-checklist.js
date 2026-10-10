// focus-deck-app/js/setup-checklist.js
// The setup checklist at the top of Settings (#126): what's done and what's left, each unfinished
// item linking to the step that finishes it, so skipping one during onboarding never loses it.
// No DOM. Tested in setup-checklist.test.mjs. See docs/4-systems/onboarding.md#the-setup-checklist

// `st` is the app state; `hasToken` whether this device has a GitHub key saved. Each item is
// { id, label, done, optional, href, cta }.
export function checklistItems({ st, hasToken }) {
  const hasProject = st.projects.length > 0;
  const hasTask = st.projects.some((p) => p.tasks.length > 0);
  const syncing = !!st.gistId && hasToken;
  const linkedRepo = st.projects.some((p) => p.source === 'github' && p.repoFullName);
  return [
    { id: 'project', label: 'Your first folder', done: hasProject, optional: false, href: './?welcome', cta: 'Make one' },
    // with a folder already there, tasks are added on the desk itself, not by replaying the welcome
    { id: 'tasks', label: 'A few tasks', done: hasTask, optional: false, href: hasProject ? 'index.html' : './?welcome', cta: 'Add some' },
    { id: 'sync', label: 'Sync between your devices', done: syncing, optional: false, href: 'setup.html', cta: 'Set it up' },
    { id: 'issues', label: 'Issue sync with a GitHub repo', done: linkedRepo, optional: true, href: hasToken ? 'index.html?new=repo' : 'setup.html', cta: hasToken ? 'Link a repo' : 'Set up GitHub first' },
  ];
}

// How many of the needed (not optional) items are done, for the heading.
export function checklistProgress(items) {
  const needed = items.filter((i) => !i.optional);
  return { done: needed.filter((i) => i.done).length, of: needed.length };
}
