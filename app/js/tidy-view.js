// focus-deck-app/js/tidy-view.js -- the Tidy up screen's markup (#255). Groups come from tidyGroups (js/tidy.js);
// marks (ui.tidyMarks) are only drawn here, and Confirm (app.js) is the one thing that closes anything.
// See docs/4-systems/tidy-up.md and docs/4-systems/styling.md
import { esc, relTime } from './state.js';
import { tidyGroups, confirmIds } from './tidy.js';
import { viewLabel } from './view-switch.js';

function row(item, group, marks) {
  const t = item.task, mark = marks[item.id], p = item.project || { name: '' };
  const same = group.key === 'same';
  const btn = (m, label, cls) => '<button type="button" class="btn ' + cls + ' td-btn' + (mark === m ? ' is-marked' : '') + '" data-action="tidy-mark" data-task="' + esc(item.id) + '" data-mark="' + m + '" aria-pressed="' + (mark === m) + '" aria-label="' + label + ': ' + esc(t.title) + '">' + label + '</button>';
  const when = t.updatedAt || t.createdAt;
  return '<li class="td-row" data-task-id="' + esc(item.id) + '" data-mark="' + esc(mark || '') + '">'
    + '<div class="td-row-text"><span class="td-row-title">' + esc(t.title) + (same ? ' <span class="td-sep">·</span> ' + esc(item.other.title) : '') + '</span>'
    + '<span class="td-row-meta">' + esc(p.name) + (when ? ' · ' + (t.updatedAt ? 'touched ' : 'added ') + esc(relTime(when)) : '') + '</span></div>'
    + '<div class="td-btns">' + btn('keep', 'Keep', 'ghost') + (same ? btn('merge', 'Merge', 'ghost') : btn('close', 'Close', 'ghost')) + '</div></li>';
}

export function renderTidy(st, ui, now = Date.now()) {
  const marks = ui.tidyMarks || {}, closed = ui.tidyClosed || [];
  const { groups, open } = tidyGroups(st, ui.view, now);
  const n = confirmIds(st, ui.view, marks, now).length;
  const name = ui.view.mode === 'all' ? 'All' : viewLabel(st, ui.view);
  const cards = groups.map((g) => '<section class="td-group" data-group="' + g.key + '" aria-labelledby="td-h-' + g.key + '"><h3 class="calm-h" id="td-h-' + g.key + '">' + esc(g.title) + ' <b>' + g.items.length + '</b></h3>'
    + '<p class="td-reason">' + esc(g.reason) + '</p><ul class="td-list">' + g.items.map((i) => row(i, g, marks)).join('') + '</ul></section>').join('');
  const side = '<aside class="td-side" aria-label="Confirm"><p class="td-count">Open in ' + esc(name) + '</p><p class="td-nums" data-open>' + open + ' <span aria-hidden="true">→</span><span class="sr-only"> becomes </span> ' + (open - n) + '</p>'
    + '<button type="button" class="btn primary td-confirm" data-action="tidy-confirm"' + (n ? '' : ' disabled') + '>Confirm ' + n + ', then Triage</button></aside>';
  const closedList = closed.length
    ? '<details class="td-closed" open><summary>Closed <b>' + closed.length + '</b></summary><ul class="td-list">' + closed.map((c) => '<li class="td-row" data-closed-id="' + esc(c.id) + '"><div class="td-row-text"><span class="td-row-title">' + esc(c.title) + '</span></div>'
      + '<div class="td-btns"><button type="button" class="btn ghost td-btn" data-action="tidy-undo" data-task="' + esc(c.id) + '" aria-label="Undo: ' + esc(c.title) + '">Undo</button></div></li>').join('') + '</ul></details>' : '';
  return '<h2 class="board-title">Tidy up: ' + esc(name) + '</h2><p class="td-sub">Keep or close each one. Nothing closes until you press Confirm.</p>'
    + '<div class="td-layout"><div class="td-main">' + (cards || '<p class="calm-empty">Nothing looks finished, repeated or forgotten here.</p>') + closedList + '</div>' + side + '</div>';
}
