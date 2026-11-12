// focus-deck-app/js/review-view.js -- the Review tab (#271): one task at a time on a clipboard "Finished?", two rubber
// stamps (LOOKS GOOD, MORE WORK), a jotter slip with Undo after each, and "Done this week" as a second screen, all
// narrowed by the All | Area | Project switch (shown above by app.js). Lists come from reviewLists in js/board.js;
// what a tap does is in js/app.js. Tapping a title opens Task details (js/task-details.js).
// See docs/4-systems/review-tab.md and docs/4-systems/styling.md
import { esc, findTaskWithProject } from './state.js';
import { reviewLists } from './board.js';
import { renderTaskDetails } from './task-details.js';
import { board } from './tidy-view.js';
import { stamp, foot, dots } from './sort-flow-view.js';

const act = (action, id) => ' data-action="' + action + '" data-task="' + esc(id) + '"';

function card(t, p) {
  const issue = t.issueNumber != null
    ? ' · ' + (t.url ? '<a href="' + esc(t.url) + '" target="_blank" rel="noopener">#' + esc(t.issueNumber) + '</a>' : '#' + esc(t.issueNumber))
    : '';
  return '<div class="rv-card" data-task-id="' + esc(t.id) + '" style="--proj-color:' + esc(p.color || 'var(--accent)') + '">'
    + '<button type="button" class="rv-title" data-action="review-open" data-task="' + esc(t.id) + '">' + esc(t.title) + '</button>'
    + '<span class="rv-meta">' + esc(p.name) + issue + '</span></div>';
}

// the slip after a stamp: only while that task is still where the stamp left it
function slip(ui) {
  const l = ui.rvLast, f = l && findTaskWithProject(l.id);
  if (!f || f.task.status !== (l.kind === 'done' ? 'done' : 'doing')) return '';
  return '<div class="org-slip" role="status"><span>' + (l.kind === 'done' ? 'Done ✓' : 'Sent back ✓') + '</span><button type="button" class="dk-link"' + act('review-undo', l.id) + ' data-kind="' + l.kind + '">Undo</button></div>';
}

export function renderReview(st, ui, now = Date.now()) {
  const { waiting, done, owner } = reviewLists(st, ui.view, now);
  const selected = ui.boardSelected && owner.has(ui.boardSelected) ? ui.boardSelected : null;
  const details = selected ? renderTaskDetails(st, ui, selected, now) : '';
  if (ui.rvList) {
    const rows = done.map((t) => '<div class="rv-done"><span class="rv-struck">' + esc(t.title) + '</span><button type="button" class="dk-link"' + act('review-undo', t.id) + ' data-kind="list" aria-label="Undo: ' + esc(t.title) + '">↶ Undo</button></div>').join('');
    return '<div class="org">' + board('Done this week', '<div class="org-list rv-list">' + (rows || '<p class="rv-none">Nothing finished yet</p>') + '</div>')
      + foot(['<button type="button" class="dk-back" data-action="review-back">‹ Back</button>']) + '</div>' + details;
  }
  const t = waiting[0], n = ui.rvDone || 0, total = n + waiting.length;
  const body = t
    ? card(t, owner.get(t.id)) + '<div class="dk-stamps rv-stamps">' + stamp('✓ Looks good', { action: 'review-done', attrs: ' data-task="' + esc(t.id) + '"', cls: ' rv-ok' }) + stamp('✎ More work', { action: 'review-more', attrs: ' data-task="' + esc(t.id) + '"', cls: ' rv-more' }) + '</div>'
    : '<p class="rv-none">All reviewed ✓</p>';
  return '<div class="org">' + board(t ? 'Finished?' : 'Review', body + slip(ui))
    + foot([total ? dots(Math.min(n + 1, total), total) : '', '<button type="button" class="dk-tag rv-tag" data-action="review-list">Done this week</button>']) + '</div>' + details;
}
