// focus-deck-app/js/in-tray-view.js
// The Sort tab's markup. One thought at a time (js/sort-flow-view.js: a slip, then one question per
// screen, then the receipt); "Sort several" is the list with tick boxes below. What each action does
// is in js/in-tray.js and js/app.js. See docs/4-systems/in-tray.md
import { esc, relTime } from './state.js';
import { viewState } from './view-switch.js';
import { orderTray, flagCards, folderCards, pickedSlips, bulkBlocker } from './in-tray.js';
import { renderPickBlocks } from './pick-bits.js';
import { mutedChip, focusChoosingMode, unsortedQueue } from './render.js';
import { renderSortFlow } from './sort-flow-view.js';

// The top slip: the queue in tray order (slips sent to the back by "Later" come last), or null
// when the tray is empty. app.js uses its key to reset the per-slip scratch.
export function unsortedCurrent(st, u) {
  return orderTray(unsortedQueue(st), u.later)[0] || null;
}

// "Sort several": every slip as a row with a tick box, then one project, labels and an optional group
// for all the ticked ones. `b` is ui.bulk ({ picked, projectId, selected, groupTitle, newLabel, why }).
// What Apply does is bulkSort in js/in-tray.js. See docs/4-systems/in-tray.md#sort-many-at-once
function renderBulk(st, b, ordered) {
  const picked = pickedSlips(ordered, b.picked);
  const n = picked.length;
  const rows = ordered.map((x) => {
    const on = picked.includes(x);
    const text = x.kind === 'thought' ? x.item.text : x.task.title;
    // the whole text, never cut short, with a small line under it: when a thought was jotted, or
    // which project a task is in
    const where = x.kind === 'thought'
      ? '<span class="bulk-meta">' + relTime(x.item.createdAt) + '</span>'
      : '<span class="bulk-meta"><span class="folder-chip" style="--c:' + x.project.color + '">' + esc(x.project.name) + '</span></span>';
    return '<label class="bulk-row' + (on ? ' on' : '') + '"><input type="checkbox" data-bulk-key="' + esc(x.key) + '"' + (on ? ' checked' : '') + '>'
      + '<span class="bulk-body"><span class="bulk-text">' + esc(text) + '</span>' + where + '</span></label>';
  }).join('');
  const thoughts = picked.some((x) => x.kind === 'thought');
  const project = b.projectId ? st.projects.find((p) => p.id === b.projectId) : null;
  const options = '<option value="">' + (thoughts || !n ? 'Choose a project…' : 'Keep each task in its project') + '</option>'
    + folderCards(viewState(st)).map((f) => '<option value="' + esc(f.id) + '"' + (f.id === b.projectId ? ' selected' : '') + '>' + esc(f.name) + '</option>').join('');
  const flags = flagCards(st, project, { selected: b.selected, showAll: true }).map((c) => {
    const on = b.selected.includes(c.token);
    return '<button type="button" class="bulk-flag' + (on ? ' on' : '') + '" data-action="bulk-flag" data-token="' + esc(c.token) + '" aria-pressed="' + on + '" style="--c:' + mutedChip(c.color) + '">' + esc(c.name) + '</button>';
  }).join('');
  const why = n ? bulkBlocker(picked, b) : '';
  return '<div class="bulk">'
    + '<div class="bulk-head"><p class="tray-count muted small" role="status">' + n + ' of ' + ordered.length + ' ticked</p>'
    + '<button type="button" data-action="bulk-all">Tick all</button><button type="button" data-action="bulk-none"' + (n ? '' : ' disabled') + '>Clear ticks</button>'
    + '<button type="button" data-action="bulk-toggle">One at a time</button></div>'
    + (ordered.length ? '<div class="bulk-list">' + rows + '</div>' : '<p class="muted small">Nothing left to sort.</p>')
    + '<div class="bulk-panel"><label class="bulk-field"><b>1. Project</b><select data-bulk-project aria-label="Project for the ticked items">' + options + '</select></label>'
    + '<div class="bulk-field"><b>2. Labels</b><div class="bulk-flags">' + flags + '</div>'
    + '<div class="bulk-addrow"><input type="text" data-bulk-newlabel value="' + esc(b.newLabel || '') + '" placeholder="New label…" aria-label="New label"><button type="button" data-action="bulk-new-flag">Add</button></div></div>'
    + (thoughts ? '<div class="bulk-field"><b>Priority for the thoughts</b><div class="sort-picks">' + renderPickBlocks(b, 'bulk') + '</div></div>' : '')
    + '<label class="bulk-field"><b>3. Group them under one task <span class="muted small">(optional)</span></b>'
    + '<input type="text" data-bulk-group value="' + esc(b.groupTitle || '') + '" placeholder="Name of the task to group them under…"></label>'
    + (why || b.why ? '<p class="step-why" role="status">' + esc(b.why || why) + '</p>' : '')
    + '<button type="button" class="file-btn" data-action="bulk-apply"' + (n && !why ? '' : ' disabled') + '>' + (n ? 'Sort ' + (n === 1 ? '1 item' : n + ' items') + ' →' : 'Tick items to sort') + '</button></div>'
    + '</div>';
}

// The whole Sort card (the replacement for render.js's renderInbox). `ui.unsorted.later` is the
// list of slips sent to the back; `ui.bulk.on` swaps the one-thought flow for the "Sort several" list.
export function renderInTrayCard(st, ui) {
  const u = ui.unsorted;
  const queue = unsortedQueue(st);
  const ordered = orderTray(queue, u.later);
  const body = !ui.inboxOpen ? '' : (ui.bulk && ui.bulk.on ? renderBulk(st, ui.bulk, ordered) : renderSortFlow(st, u, ordered, { mode: focusChoosingMode(st), many: queue.length > 1 }));
  return '<section class="card inbox-card sortflow">'
    + (ui.inboxOpen ? '<div class="unsorted-body">' + body + '</div>' : '')
    + '</section>';
}
