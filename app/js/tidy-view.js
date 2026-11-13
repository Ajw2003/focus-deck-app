// focus-deck-app/js/tidy-view.js -- Organize, first half (#266): the two index cards, then Tidy up as four tick lists
// (Finished?, Replaced?, The same?, Still want it?) and "Close these?". Groups come from tidyGroups (js/tidy.js);
// marks (ui.tidyMarks) are only drawn here, and Confirm (app.js) is the one thing that closes anything.
// The sort-flow helpers give it the same stamp / foot / dots / index-card look. See docs/4-systems/tidy-up.md
import { esc } from './state.js';
import { tidyGroups, confirmItems, GROUPS } from './tidy.js';
import { SVG } from './desk-objects.js';
import { stamp, foot, dots, choice } from './sort-flow-view.js';

export const TIDY_STEPS = GROUPS.length; // step 5 is "Close these?"
const back = (step) => '<button type="button" class="dk-back" data-action="tidy-step" data-step="' + step + '">‹ Back</button>';
const skip = (step) => '<button type="button" class="dk-skip" data-action="tidy-skip" data-step="' + step + '">Skip</button>';
export const board = (q, inner) => '<div class="dk-board sort-board"><div class="dk-paper sort-paper"><h2 class="sort-q">' + esc(q) + '</h2><div class="sort-body">' + inner + '</div></div></div>';
const obj = (label, svg, mark, off) => '<button type="button" class="dk-obj" data-action="tidy-mark" data-mark="' + mark + '"' + (off ? ' disabled' : '') + '>' + SVG[svg] + esc(label) + '</button>';

function tickRow(item, group, ticks) {
  const t = item.task, on = !!ticks[item.id];
  const text = esc(t.title) + (group.key === 'same' ? ' = ' + esc(item.other.title) : group.key === 'replaced' && item.to ? ' ➜ ' + esc(item.to) : '');
  return '<div class="org-row' + (on ? ' on' : '') + '" data-task-id="' + esc(item.id) + '"><label class="org-box"><input type="checkbox" data-tidy-tick="' + esc(item.id) + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(t.title) + '"></label>'
    + '<button type="button" class="org-title task-open" data-action="task-open" data-task="' + esc(item.id) + '" aria-label="Task details: ' + esc(t.title) + '">' + text + '</button></div>';
}

export function renderTidy(st, ui, now = Date.now()) {
  const step = ui.tidyStep || 0, marks = ui.tidyMarks || {}, ticks = ui.tidyTicks || {};
  const { groups } = tidyGroups(st, ui.view, now);
  if (step === 0) {
    const count = groups.reduce((n, g) => n + g.items.length, 0);
    return '<div class="org">' + board('Organize', choice('🧹 Tidy up', { action: 'tidy-step', attrs: ' data-step="1"', small: String(count) }) + choice('📌 Triage', { action: 'triage-go', attrs: ' data-to="top"' }))
      + foot([stamp('Start', { action: 'tidy-step', attrs: ' data-step="1"' })]) + '</div>';
  }
  if (step > TIDY_STEPS) {
    const items = confirmItems(st, ui.view, marks, now);
    const list = '<div class="org-list">' + items.map((i) => '<div class="dk-choice org-plain"><span>' + (i.merge ? '📎 ' : '') + esc(i.task.title) + '</span></div>').join('') + '</div>';
    return '<div class="org">' + board('Close these?', list) + foot([back(TIDY_STEPS), stamp('Confirm', { action: 'tidy-confirm', disabled: !items.length })]) + '</div>';
  }
  const g = groups.find((x) => x.key === GROUPS[step - 1].key) || Object.assign({ items: [] }, GROUPS[step - 1]);
  const none = !g.items.some((i) => ticks[i.id]);
  const rows = '<div class="org-list">' + (g.items.length ? g.items.map((i) => tickRow(i, g, ticks)).join('') : '<p class="muted">Nothing here ✓</p>') + '</div>'
    + '<div class="sort-row2"><button type="button" class="dk-link" data-action="tidy-all"' + (g.items.length ? '' : ' disabled') + '>✓ All</button><button type="button" class="dk-link" data-action="tidy-none"' + (none ? ' disabled' : '') + '>Clear</button></div>'
    + '<div class="org-objs">' + (g.key === 'same' ? obj('Keep both', 'both', 'keep', none) + obj('Merge', 'staple', 'merge', none) : obj('Keep', 'tray', 'keep', none) + obj('Close', 'bin', 'close', none)) + '</div>';
  return '<div class="org">' + dots(step, TIDY_STEPS) + board(g.title, rows) + foot([back(step - 1), skip(step + 1)]) + '</div>';
}
