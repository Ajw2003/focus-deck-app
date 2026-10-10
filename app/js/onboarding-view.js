// focus-deck-app/js/onboarding-view.js
// First-run onboarding's markup, one step per screen on the desk: a welcome, the first folder, a
// few tasks, the first pick (the real sticky note, so ticking it off works), then the offer to set
// up sync. Every step can be skipped and the app still works. Decisions are in js/onboarding.js;
// js/app.js wires the actions. See docs/4-systems/onboarding.md
import { esc } from './state.js';
import { FOLDER_SUGGESTIONS, categoryChips, STEPS } from './onboarding.js';

const skip = '<button type="button" class="btn-text" data-action="ob-skip">Skip, I&rsquo;ll look around</button>';

function progress(step) {
  const n = STEPS.indexOf(step);
  return '<p class="ob-progress muted small" aria-label="Step ' + (n + 1) + ' of ' + STEPS.length + '">'
    + STEPS.map((s, i) => '<span class="ob-dot' + (i <= n ? ' is-on' : '') + '"></span>').join('') + '</p>';
}

function welcome() {
  return '<h2 class="ob-title">One thing at a time.</h2>'
    + '<p>Focus Deck keeps your tasks in folders, then deals you one to do now, so you never have to choose from the whole list.</p>'
    + '<p class="muted small">It takes about a minute to set up. Everything stays on this device unless you turn on sync.</p>'
    + '<div class="ob-acts"><button type="button" class="file-btn" data-action="ob-next">Let&rsquo;s start</button>' + skip + '</div>';
}

function folder() {
  return '<h2 class="ob-title">Your first folder</h2>'
    + '<p>A folder holds one project&rsquo;s tasks: a subject, a room, a side project.</p>'
    + '<form class="ob-form" data-action="ob-folder">'
      + '<label class="sr-only" for="ob-folder-name">Folder name</label>'
      + '<input type="text" id="ob-folder-name" name="name" maxlength="60" placeholder="Name it…" autocomplete="off" required>'
      + '<div class="ob-chips" role="group" aria-label="Suggestions">'
        + FOLDER_SUGGESTIONS.map((n) => '<button type="button" class="chip chip-btn" data-action="ob-suggest" data-name="' + esc(n) + '">' + esc(n) + '</button>').join('')
      + '</div>'
      + '<div class="ob-acts"><button type="submit" class="file-btn">Make the folder</button>' + skip + '</div>'
    + '</form>';
}

function tasks(st, ob) {
  const project = st.projects.find((p) => p.id === ob.projectId);
  if (!project) return folder(); // the folder was removed meanwhile (another device): make one again
  const chips = categoryChips(st.categories).map((c) => {
    const on = ob.category === c.name;
    return '<button type="button" class="chip chip-btn' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-action="ob-category" data-name="' + esc(c.name) + '">' + esc(c.name) + '</button>';
  }).join('');
  const added = project.tasks.filter((t) => t.status !== 'done');
  const list = added.length
    ? '<ul class="ob-list">' + added.map((t) => '<li>' + esc(t.title) + '</li>').join('') + '</ul>'
    : '<p class="muted small">Nothing yet. Add the first thing you need to do.</p>';
  return '<h2 class="ob-title">A few tasks for ' + esc(project.name) + '</h2>'
    + '<p>Add three or four. Tap a category first if you like: it helps you pick later.</p>'
    + '<form class="ob-form" data-action="ob-task">'
      + '<label class="sr-only" for="ob-task-title">Task</label>'
      + '<div class="ob-row"><input type="text" id="ob-task-title" name="title" maxlength="200" placeholder="Something to do…" autocomplete="off" required>'
      + '<button type="submit" class="btn primary">Add</button></div>'
      + '<div class="ob-chips" role="group" aria-label="Category for the next task">' + chips + '</div>'
    + '</form>'
    + list
    + '<div class="ob-acts">'
      + (added.length ? '<button type="button" class="file-btn" data-action="ob-deal">Deal me one</button>' : '<button type="button" class="file-btn" disabled>Add a task first</button>')
      + skip + '</div>';
}

function pick(st, ob, renderFocus) {
  return '<h2 class="ob-title">Your first pick</h2>'
    + '<p>That&rsquo;s the whole idea: one task, picked for you. Done it? Tick it off. Not this one? Slip it back.</p>'
    + (st.focus ? renderFocus() : '<p class="muted">Ticked off already. Nice.</p>')
    + '<div class="ob-acts"><button type="button" class="file-btn" data-action="ob-next">Next</button>' + skip + '</div>';
}

function sync() {
  return '<h2 class="ob-title">Want this on your phone and laptop too?</h2>'
    + '<p>Focus Deck syncs through your own free GitHub account, and nothing goes anywhere else. It takes about five minutes, and you can do it later from Settings.</p>'
    + '<div class="ob-acts"><button type="button" class="file-btn" data-action="ob-sync">Set up sync</button>'
    + '<button type="button" class="btn-text" data-action="ob-finish">Not now</button></div>';
}

// `ob` is ui.onboarding: { step, projectId, category }. `renderFocus` draws the real focus card.
export function renderOnboarding(st, ob, renderFocus) {
  const body = ob.step === 'welcome' ? welcome()
    : ob.step === 'folder' ? folder()
    : ob.step === 'tasks' ? tasks(st, ob)
    : ob.step === 'pick' ? pick(st, ob, renderFocus)
    : sync();
  return '<section class="onboarding" aria-labelledby="ob-heading" data-step="' + ob.step + '">'
    + progress(ob.step) + body.replace('class="ob-title"', 'class="ob-title" id="ob-heading"') + '</section>';
}
