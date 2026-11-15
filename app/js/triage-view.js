// focus-deck-app/js/triage-view.js -- Organize, second half (#266): the pick (the top three one at a time, "Do this
// first?"), then "Your first three" (the top three as numbered cards with priority flags), the Next and Later lists, and Move (an up and down key per row). The order comes from triageLists
// (js/triage.js); a key or Alt+Arrow saves a new order (app.js, triage-drag.js). See docs/4-systems/triage.md
import { esc } from './state.js';
import { dueDates } from './pick-bits.js';
import { triageLists, NOW_SIZE } from './triage.js';
import { stamp, foot, choice, dots, pile, split } from './sort-flow-view.js';
import { board } from './tidy-view.js';

const flag = (t) => t.priority ? '<i class="pf" data-p="' + esc(t.priority) + '" aria-hidden="true"></i>' : '';
const label = (r) => r.n + ', ' + esc(r.task.title) + ', ' + esc(r.reason);
const card = (r) => '<button type="button" class="dk-choice tr-card" data-action="task-open" data-task="' + esc(r.id) + '" aria-label="Task details: ' + label(r) + '"><span>' + r.n + ' · ' + esc(r.task.title) + '</span>' + flag(r.task) + '</button>';
const key = (r, dir, text, off) => '<button type="button" class="tr-move" data-action="triage-move" data-task="' + esc(r.id) + '" data-dir="' + dir + '" aria-label="Move ' + (dir < 0 ? 'up' : 'down') + ': ' + esc(r.task.title) + '"' + (off ? ' disabled' : '') + '>' + text + '</button>';
const moveRow = (r, last) => '<div class="dk-choice tr-row" tabindex="0" data-task-id="' + esc(r.id) + '" data-n="' + r.n + '" aria-label="' + label(r) + '. Alt plus up or down arrow moves it."><span class="tr-grip" aria-hidden="true">⠿</span><span class="tr-t">' + r.n + ' · ' + esc(r.task.title) + '</span>'
  + '<span class="tr-moves">' + key(r, -1, '↑', r.n === 1) + key(r, 1, '↓', last) + '</span></div>';
const toBtn = (action, to, text, extra = '') => '<button type="button" class="dk-link" data-action="' + action + '" data-to="' + to + '"' + extra + '>' + text + '</button>';
const back = () => '<button type="button" class="dk-back" data-action="triage-go" data-to="top">‹ Back</button>';
const move = (from) => stamp('Move', { action: 'triage-go', attrs: ' data-to="move" data-from="' + from + '"' });

// The pick (#276): the top three one at a time, each a slip with one question, "Do this first?". Yes keeps it; Not now
// sends it to the end of Next and the next in line takes its place; Check it walks its priority, due date and waits on.
// after Tidy up's Confirm: "Closed N ✓" and Undo
const closedSlip = (ui) => (ui.tidyClosed || []).length ? '<div class="org-slip" role="status"><span>Closed ' + ui.tidyClosed.length + ' ✓</span><button type="button" class="dk-link" data-action="tidy-undo">Undo</button></div>' : '';

function renderPick(l, place, ui) {
  const r = l.now[place - 1];
  const chip = '<span class="folder-chip" style="--c:' + esc(r.project.color || '#8F5C2F') + '">' + esc(r.project.name) + '</span>';
  const slip = '<div class="jot-slip tr-slip"><p class="slip-text">' + esc(r.task.title) + '</p><div class="slip-dest">' + chip + '<span class="tr-why">' + esc(r.reason) + '</span>' + flag(r.task) + '</div></div>';
  const ids = ' data-task="' + esc(r.id) + '"';
  const prev = place > 1 ? '<button type="button" class="dk-plain dk-back" data-action="triage-pick" data-place="' + (place - 1) + '">Back</button>'
    : '<button type="button" class="dk-plain dk-back" data-action="set-screen" data-screen="tidy">Back</button>';
  const body = pile(l.now.length - place + 1, slip) + '<div class="one-stamp">' + stamp('✓ Yes, do it first', { action: 'triage-yes', cls: ' tr-yes' }) + '</div>'
    + '<div class="dk-plain-row"><button type="button" class="dk-plain" data-action="triage-notnow"' + ids + (l.total > NOW_SIZE ? '' : ' disabled') + '>Not now</button>'
    + '<button type="button" class="dk-plain" data-action="triage-check"' + ids + '>Check it</button>'
    + '<button type="button" class="dk-plain dk-skip" data-action="triage-go" data-to="top">Skip</button>' + prev + '</div>' + closedSlip(ui);
  return '<div class="org">' + dots(place, l.now.length) + split(board('Do this first?', body), l.now.slice(place).map((x) => x.task.title)) + '</div>';
}

export function renderTriage(st, ui, today = dueDates().today) {
  const l = triageLists(st, ui.view, today), step = ui.triageStep || 'pick';
  const all = l.now.concat(l.next, l.later);
  const none = '<p class="muted">Nothing open to rank here ✓</p>';
  if (step === 'pick' && (ui.triagePlace || 1) <= l.now.length) return renderPick(l, ui.triagePlace || 1, ui);
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
  const slip = closedSlip(ui);
  const body = '<div class="org-list">' + (l.now.map(card).join('') || none) + '</div>'
    + '<div class="sort-row2">' + toBtn('triage-go', 'next', 'Next ' + l.next.length, l.next.length ? '' : ' disabled') + toBtn('triage-later', 'later', 'Later ' + l.later.length, l.later.length ? '' : ' disabled') + '</div>' + slip;
  return '<div class="org">' + board('Your first three', body) + foot([move('top')]) + '</div>';
}
