// focus-deck-app/js/triage-view.js -- Organize, second half (#266): "Do these first" (the top three as numbered cards with
// priority flags), the Next and Later lists, and Move (an up and down key per row). The order comes from triageLists
// (js/triage.js); a key or Alt+Arrow saves a new order (app.js, triage-drag.js). See docs/4-systems/triage.md
import { esc } from './state.js';
import { dueDates } from './pick-bits.js';
import { triageLists } from './triage.js';
import { stamp, foot, choice } from './sort-flow-view.js';
import { board } from './tidy-view.js';

const flag = (t) => t.priority ? '<i class="pf" data-p="' + esc(t.priority) + '" aria-hidden="true"></i>' : '';
const label = (r) => r.n + ', ' + esc(r.task.title) + ', ' + esc(r.reason);
const card = (r) => '<button type="button" class="dk-choice tr-card" data-action="task-open" data-task="' + esc(r.id) + '" aria-label="Task details: ' + label(r) + '"><span>' + r.n + ' · ' + esc(r.task.title) + '</span>' + flag(r.task) + '</button>';
const key = (r, dir, text, off) => '<button type="button" class="tr-move" data-action="triage-move" data-task="' + esc(r.id) + '" data-dir="' + dir + '" aria-label="Move ' + (dir < 0 ? 'up' : 'down') + ': ' + esc(r.task.title) + '"' + (off ? ' disabled' : '') + '>' + text + '</button>';
const moveRow = (r, last) => '<div class="dk-choice tr-row" tabindex="0" data-task-id="' + esc(r.id) + '" data-n="' + r.n + '" aria-label="' + label(r) + '. Alt plus up or down arrow moves it."><span>' + r.n + ' · ' + esc(r.task.title) + '</span>'
  + '<span class="tr-moves">' + key(r, -1, '↑', r.n === 1) + key(r, 1, '↓', last) + '</span></div>';
const toBtn = (action, to, text, extra = '') => '<button type="button" class="dk-link" data-action="' + action + '" data-to="' + to + '"' + extra + '>' + text + '</button>';
const back = () => '<button type="button" class="dk-back" data-action="triage-go" data-to="top">‹ Back</button>';
const move = (from) => stamp('Move', { action: 'triage-go', attrs: ' data-to="move" data-from="' + from + '"' });

export function renderTriage(st, ui, today = dueDates().today) {
  const l = triageLists(st, ui.view, today), step = ui.triageStep || 'top';
  const all = l.now.concat(l.next, l.later);
  const none = '<p class="muted">Nothing open to rank here ✓</p>';
  if (step === 'move') {
    const win = (ui.triageMoveIds || []).map((id) => all.find((r) => r.id === id)).filter(Boolean).sort((a, b) => a.n - b.n);
    const reset = choice('↺ Reset', { action: 'triage-reset', attrs: l.saved ? '' : ' disabled', cls: ' tr-reset' });
    return '<div class="org">' + board('Move', '<div class="org-list">' + win.map((r) => moveRow(r, r.n === l.total)).join('') + '</div>') + foot([reset, stamp('Done', { action: 'triage-go', attrs: ' data-to="top"' })]) + '</div>';
  }
  if (step === 'next') return '<div class="org">' + board('Next', '<div class="org-list">' + (l.next.map(card).join('') || none) + '</div>') + foot([back(), move('next')]) + '</div>';
  if (step === 'later') {
    const q = (ui.triageFind || '').toLowerCase(), rows = l.later.filter((r) => !q || r.task.title.toLowerCase().includes(q));
    const find = '<input type="text" class="sort-find" data-triage-find value="' + esc(ui.triageFind || '') + '" placeholder="Find a task…" aria-label="Find a task">';
    return '<div class="org">' + board('Later', find + '<div class="org-list">' + (rows.map(card).join('') || none) + '</div>') + foot([back(), move('later')]) + '</div>';
  }
  const slip = (ui.tidyClosed || []).length ? '<div class="org-slip" role="status"><span>Closed ' + ui.tidyClosed.length + ' ✓</span><button type="button" class="dk-link" data-action="tidy-undo">Undo</button></div>' : '';
  const body = '<div class="org-list">' + (l.now.map(card).join('') || none) + '</div>'
    + '<div class="sort-row2">' + toBtn('triage-go', 'next', 'Next ' + l.next.length, l.next.length ? '' : ' disabled') + toBtn('triage-later', 'later', 'Later ' + l.later.length, l.later.length ? '' : ' disabled') + '</div>' + slip;
  return '<div class="org">' + board('Do these first', body) + foot([move('top')]) + '</div>';
}
