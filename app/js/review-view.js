// focus-deck-app/js/review-view.js -- the Review screen's markup (#254): "Waiting for your review" beside
// "Done this week", both narrowed by the All | Area | Project switch (shown above by app.js). Lists come from
// reviewLists in js/board.js. Tapping a title opens Task details (js/task-details.js).
// See docs/4-systems/review-tab.md and docs/4-systems/styling.md
import { esc } from './state.js';
import { reviewLists } from './board.js';
import { renderTaskDetails } from './task-details.js';

function row(t, p, buttons) {
  const issue = t.issueNumber != null
    ? ' · ' + (t.url ? '<a href="' + esc(t.url) + '" target="_blank" rel="noopener">#' + esc(t.issueNumber) + '</a>' : '#' + esc(t.issueNumber))
    : '';
  return '<article class="board-card calm-card rv-card" data-task-id="' + esc(t.id) + '" data-status="' + esc(t.status) + '" style="--proj-color:' + esc(p.color || 'var(--accent)') + '">'
    + '<div class="board-card-body"><button type="button" class="rv-title board-card-title" data-action="review-open" data-task="' + esc(t.id) + '">' + esc(t.title) + '</button>'
    + '<span class="board-card-meta"><span class="board-card-proj">' + esc(p.name) + '</span>' + issue + '</span></div>'
    + '<div class="rv-btns">' + buttons + '</div></article>';
}

export function renderReview(st, ui, now = Date.now()) {
  const { waiting, done, owner } = reviewLists(st, ui.view, now);
  const btn = (action, cls, label, t) => '<button type="button" class="' + cls + '" data-action="' + action + '" data-task="' + esc(t.id) + '" aria-label="' + label + ': ' + esc(t.title) + '">' + label + '</button>';
  const w = waiting.map((t) => row(t, owner.get(t.id), btn('review-done', 'btn primary', 'Looks good · Done', t) + btn('review-more', 'btn ghost', 'Needs more work', t))).join('');
  const d = done.map((t) => row(t, owner.get(t.id), btn('review-undo', 'btn ghost', 'Undo', t))).join('');
  const selected = ui.boardSelected && owner.has(ui.boardSelected) ? ui.boardSelected : null;
  return '<h2 class="board-title">Review</h2><div class="rv-cols">'
    + '<section class="rv-col" aria-labelledby="rv-h1"><h3 class="calm-h" id="rv-h1">Waiting for your review <b>' + waiting.length + '</b></h3>'
    + '<div class="calm-cards" data-list="waiting">' + (w || '<p class="calm-empty">Nothing is waiting for you. Enjoy the quiet.</p>') + '</div></section>'
    + '<section class="rv-col" aria-labelledby="rv-h2"><h3 class="calm-h" id="rv-h2">Done this week <b>' + done.length + '</b></h3>'
    + '<div class="calm-cards" data-list="done">' + (d || '<p class="calm-empty">Nothing finished yet this week.</p>') + '</div></section></div>'
    + (selected ? renderTaskDetails(st, ui, selected, now) : '');
}
