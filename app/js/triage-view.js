// focus-deck-app/js/triage-view.js -- the Triage screen's markup (#256). The order comes from triageLists
// (js/triage.js); a drag, Alt+Arrow or the phone's up/down buttons saves a new order (app.js, triage-drag.js).
// See docs/4-systems/triage.md and docs/4-systems/styling.md
import { esc } from './state.js';
import { dueDates } from './pick-bits.js';
import { triageLists, NOW_SIZE, NEXT_SIZE } from './triage.js';
import { viewLabel } from './view-switch.js';

export const RULES = ['Needs review', 'In progress', 'Past its date, or due today', 'Priority: Urgent, High, Medium, Low', 'Holds up other tasks', 'Due soonest', 'Oldest first'];

const row = (r, last) => '<li class="tr-row" tabindex="0" data-task-id="' + esc(r.id) + '" data-n="' + r.n + '" aria-label="' + r.n + ', ' + esc(r.task.title) + ', ' + esc(r.reason) + '. Alt plus up or down arrow moves it.">'
  + '<span class="tr-grip" aria-hidden="true">⋮⋮</span><span class="tr-num">' + r.n + '</span>'
  + '<span class="tr-text"><span class="tr-title">' + esc(r.task.title) + '</span><span class="tr-meta">' + esc(r.project.name) + '</span></span>'
  + '<button type="button" class="btn-text task-open" data-action="task-open" data-task="' + esc(r.id) + '" aria-label="Task details: ' + esc(r.task.title) + '">Details</button>'
  + '<span class="tr-chip">' + esc(r.reason) + '</span>'
  + '<span class="tr-moves"><button type="button" class="btn ghost tr-move" data-action="triage-move" data-task="' + esc(r.id) + '" data-dir="-1" aria-label="Move up: ' + esc(r.task.title) + '"' + (r.n === 1 ? ' disabled' : '') + '>↑</button>'
  + '<button type="button" class="btn ghost tr-move" data-action="triage-move" data-task="' + esc(r.id) + '" data-dir="1" aria-label="Move down: ' + esc(r.task.title) + '"' + (last ? ' disabled' : '') + '>↓</button></span></li>';

// Tidy up | Triage: on a phone the two share the Organize tab, so each screen starts with these two buttons.
export const orgTabs = (screen) => '<div class="org-tabs" role="group" aria-label="Organize">'
  + [['tidy', 'Tidy up'], ['triage', 'Triage']].map(([k, n]) => '<button type="button" class="org-tab' + (k === screen ? ' on' : '') + '" data-action="set-screen" data-screen="' + k + '" aria-pressed="' + (k === screen) + '">' + n + '</button>').join('') + '</div>';

export function renderTriage(st, ui, today = dueDates().today) {
  const l = triageLists(st, ui.view, today);
  const name = ui.view.mode === 'all' ? 'All' : viewLabel(st, ui.view);
  const card = (key, title, rows, start, extra) => '<section class="tr-card tr-' + key + '" data-list="' + key + '" data-start="' + start + '" aria-labelledby="tr-h-' + key + '">'
    + (extra ? '<h3 class="calm-h tr-h" id="tr-h-' + key + '"><button type="button" class="tr-fold" data-action="triage-later" aria-expanded="' + !!ui.triageLaterOpen + '">' + title + ' <b>' + rows.length + '</b><span class="tr-caret" aria-hidden="true">' + (ui.triageLaterOpen ? '▾' : '▸') + '</span></button></h3>'
      : '<h3 class="calm-h tr-h" id="tr-h-' + key + '">' + title + ' <b>' + rows.length + '</b></h3>')
    + '<ul class="tr-list"' + (extra && !ui.triageLaterOpen ? ' hidden' : '') + '>' + rows.map((r) => row(r, r.n === l.total)).join('') + '</ul></section>';
  const lists = l.total
    ? card('now', 'Now', l.now, 0) + card('next', 'Next', l.next, NOW_SIZE) + card('later', 'Later', l.later, NOW_SIZE + NEXT_SIZE, true)
    : '<p class="calm-empty">Nothing open to rank here.</p>';
  const reset = (cls) => '<button type="button" class="btn ghost ' + cls + '" data-action="triage-reset"' + (l.saved ? '' : ' disabled') + '>Reset to the rules</button>';
  const side = '<aside class="tr-side" aria-label="How the order is worked out"><h3 class="tr-side-h">HOW THE ORDER IS WORKED OUT</h3><ol class="tr-rules">'
    + RULES.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ol><p class="tr-side-note">Your own order wins over these.</p>' + reset('tr-reset') + '</aside>';
  return orgTabs('triage') + '<h2 class="board-title">Triage: ' + esc(name) + '</h2>'
    + '<p class="tr-sub">' + l.total + ' ' + esc(ui.view.mode === 'all' ? 'open' : name) + ' tasks, ranked. <span class="tr-hint">Drag one to change the order.</span> ' + reset('tr-reset-phone') + '</p>'
    + '<div class="tr-layout"><div class="tr-main">' + lists + '</div>' + side + '</div>';
}
