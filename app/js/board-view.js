// focus-deck-app/js/board-view.js
// The Board screen's markup (#144, part of #140): a row of project pills, then Up next / In progress /
// Done this week as columns of paper cards. Narrowed to one project, the columns sit inside that
// project's folder frame. On a phone a three-way switch shows one column at a time (CSS; the choice
// is ui.boardCol, in memory only). The columns come from js/board.js. Ticking a card is the same
// `toggle-task` checkbox the task rows use. See docs/4-systems/styling.md#the-board-144
import { esc, formatLabelName, PRIORITY } from './state.js';
import { boardColumns } from './board.js';

export const BOARD_COLS = ['next', 'doing', 'done'];
const COL_INFO = {
  next: { title: 'Up next', short: 'Up next', empty: 'Nothing waiting.' },
  doing: { title: 'In progress', short: 'Doing', empty: 'Nothing in progress.' },
  done: { title: 'Done this week', short: 'Done', empty: 'Nothing finished yet this week.' },
};
export function normalizeBoardCol(v) { return BOARD_COLS.includes(v) ? v : 'next'; }

function pills(st, current) {
  const one = (id, label, color) => {
    const on = (id || null) === (current || null);
    return '<button type="button" class="board-pill' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-action="board-project" data-project-id="' + esc(id) + '"'
      + (color ? ' style="--proj-color:' + esc(color) + '"' : '') + '>'
      + (color ? '<span class="board-pill-dot"></span>' : '') + '<span class="board-pill-name">' + esc(label) + '</span></button>';
  };
  return '<div class="board-pills" role="group" aria-label="Project">' + one('', 'All projects', '')
    + st.projects.map((p) => one(p.id, p.name, p.color)).join('') + '</div>';
}

function card(t, p, st, narrowed) {
  const cats = (t.categoryIds || []).map((id) => (st.categories || []).find((c) => c.id === id)).filter(Boolean).map((c) => formatLabelName(c.name));
  const done = t.status === 'done';
  const meta = (narrowed ? '' : '<span class="board-card-proj">' + esc(p.name) + '</span>')
    + (cats.length ? '<span class="board-card-cats">' + esc(cats.join(' · ')) + '</span>' : '');
  const prio = t.priority && PRIORITY[t.priority]
    ? '<span class="chip priority-chip small board-prio" style="--chip-color:var(--prio-' + t.priority + ')">' + esc(PRIORITY[t.priority].label) + '</span>' : '';
  return '<article class="board-card' + (done ? ' is-done' : '') + '" data-task-id="' + esc(t.id) + '" data-status="' + esc(t.status) + '" style="--proj-color:' + esc(p.color) + '">'
    + '<input type="checkbox" data-action="toggle-task" data-task="' + esc(t.id) + '" data-project="' + esc(p.id) + '"' + (done ? ' checked' : '') + ' aria-label="' + esc(t.title) + '">'
    + '<div class="board-card-body"><span class="board-card-title">' + esc(t.title) + '</span>'
    + (meta ? '<span class="board-card-meta">' + meta + '</span>' : '') + '</div>'
    + prio + '</article>';
}

function column(key, tasks, owner, st, narrowed, current) {
  const info = COL_INFO[key];
  return '<section class="board-col' + (key === current ? ' is-current' : '') + '" data-col="' + key + '" aria-labelledby="board-h-' + key + '">'
    + '<h3 class="board-col-head" id="board-h-' + key + '"><span>' + info.title + '</span><b class="board-count">' + tasks.length + '</b></h3>'
    + '<div class="board-cards">'
    + (tasks.length ? tasks.map((t) => card(t, owner.get(t.id), st, narrowed)).join('') : '<p class="board-empty">' + info.empty + '</p>')
    + '</div></section>';
}

export function renderBoard(st, ui, now = Date.now()) {
  const projects = st.projects || [];
  const narrowedTo = ui.boardProject ? projects.find((p) => p.id === ui.boardProject) : null;
  const cols = boardColumns(st, narrowedTo ? narrowedTo.id : null, now);
  const current = normalizeBoardCol(ui.boardCol);
  const owner = new Map();
  projects.forEach((p) => (p.tasks || []).forEach((t) => owner.set(t.id, p)));
  const body = BOARD_COLS.map((k) => column(k, cols[k], owner, st, !!narrowedTo, current)).join('');
  const sw = '<div class="board-switch" role="group" aria-label="Column">' + BOARD_COLS.map((k) => {
    const on = k === current;
    return '<button type="button" class="board-switch-btn' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-action="board-col" data-col="' + k + '">'
      + COL_INFO[k].short + ' <b class="board-count">' + cols.counts[k] + '</b></button>';
  }).join('') + '</div>';
  const columns = '<div class="board-cols">' + body + '</div>';
  return '<h2 class="board-title">Board</h2>' + pills(st, narrowedTo ? narrowedTo.id : null) + sw
    + (narrowedTo
      ? '<div class="board-frame" style="--proj-color:' + esc(narrowedTo.color) + '"><div class="board-frame-head">'
        + '<h3 class="board-frame-name">' + esc(narrowedTo.name) + '</h3>'
        + '<button type="button" class="btn-text board-back" data-action="board-project" data-project-id="">&larr; Back to all projects</button></div>' + columns + '</div>'
      : columns);
}
