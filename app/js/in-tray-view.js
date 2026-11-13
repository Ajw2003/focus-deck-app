// focus-deck-app/js/in-tray-view.js
// The Sort tab's markup. One thought at a time (js/sort-flow-view.js: a slip, then one question per
// screen, then the receipt); "Sort several" is five screens in js/sort-many-view.js. What each action does
// is in js/in-tray.js and js/app.js. See docs/4-systems/in-tray.md
import { orderTray } from './in-tray.js';
import { focusChoosingMode, unsortedQueue } from './render.js';
import { renderSortFlow } from './sort-flow-view.js';
import { renderSortMany } from './sort-many-view.js';

// The top slip: the queue in tray order (slips sent to the back by "Later" come last), or null
// when the tray is empty. app.js uses its key to reset the per-slip scratch.
export function unsortedCurrent(st, u) {
  return orderTray(unsortedQueue(st), u.later)[0] || null;
}

// The whole Sort card (the replacement for render.js's renderInbox). `ui.unsorted.later` is the
// list of slips sent to the back; `ui.bulk.on` swaps the one-thought flow for the "Sort several" list.
export function renderInTrayCard(st, ui) {
  const u = ui.unsorted;
  const queue = unsortedQueue(st);
  const ordered = orderTray(queue, u.later);
  const body = !ui.inboxOpen ? '' : (ui.bulk && ui.bulk.on ? renderSortMany(st, ui.bulk, ordered, { mode: focusChoosingMode(st) }) : renderSortFlow(st, u, ordered, { mode: focusChoosingMode(st), many: queue.length > 1 }));
  return '<section class="card inbox-card sortflow">'
    + (ui.inboxOpen ? '<div class="unsorted-body">' + body + '</div>' : '')
    + '</section>';
}
