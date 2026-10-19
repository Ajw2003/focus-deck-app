// focus-deck-app/js/board-view.js
// The Board screen's markup (#200, calm): one toolbar (Find, Project, Filter), one tab at a time (Up next,
// In progress, Done this week, each with its count) and the tab's cards in groups of the "Cards at once"
// setting. Up next cards carry "In progress", In progress cards "Up next" (data-action="board-move").
// A card shows its project's name only on "Project: All"; subtasks show inside their parent as "1/2 done".
// The right-hand column is the empty-panel hint, or Task details (js/task-details.js, #201) for ui.boardSelected. The list comes from js/board.js. Ticking a card is the same `toggle-task` checkbox
// the task rows use. See docs/4-systems/calm-board.md and docs/4-systems/styling.md#the-board-144
import { esc, deadlineChip } from './state.js';
import { boardList } from './board.js';
import { getChunk, getColourBy } from './comfort.js';
import { cardKey, NO_CATEGORY } from './card-key.js';
import { renderTaskDetails } from './task-details.js';
import { tieSummary, tieLineHtml, subtasksOf } from './task-links.js';

export const BOARD_COLS = ['next', 'doing', 'done'];
const COL_INFO = {
  next: { title: 'Up next', empty: 'Nothing up next.' },
  doing: { title: 'In progress', empty: 'Nothing in progress. Press “In progress” on an Up next card to start one.' },
  done: { title: 'Done this week', empty: 'Nothing finished yet this week.' },
};
const SHOW_INFO = [['all', 'Everything'], ['subs', 'Has subtasks'], ['waits', 'Waiting on something'], ['holds', 'Holding others up']];
const ARROW_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 7l5 5-5 5"/></svg>';
const ARROW_LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H7M11 7l-5 5 5 5"/></svg>';
export const EMPTY_PANEL = 'No task selected. Choose a task on the left to see its notes, every label and its links here. Click it again, or press Escape, to put it back.';
export function normalizeBoardCol(v) { return BOARD_COLS.includes(v) ? v : 'next'; }

function moveButton(t) {
  if (t.status === 'next') return '<button type="button" class="calm-move" data-action="board-move" data-task="' + esc(t.id) + '" data-to="doing" aria-label="Move to In progress: ' + esc(t.title) + '">' + ARROW_RIGHT + 'In progress</button>';
  if (t.status === 'doing') return '<button type="button" class="calm-move" data-action="board-move" data-task="' + esc(t.id) + '" data-to="next" aria-label="Move back to Up next: ' + esc(t.title) + '">' + ARROW_LEFT + 'Up next</button>';
  return '';
}

function subsLine(subs) {
  const done = subs.filter((s) => s.status === 'done').length;
  const segs = subs.slice().sort((a, z) => (z.status === 'done') - (a.status === 'done'))
    .map((s) => '<i' + (s.status === 'done' ? ' class="on"' : '') + '></i>').join('');
  return '<span class="board-subs" title="' + done + ' of ' + subs.length + ' subtasks done"><b>' + done + '/' + subs.length + '</b> done<span class="board-segs">' + segs + '</span></span>';
}

function chip(on, action, attr, val, label, color) {
  return '<button type="button" class="bm-chip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-action="' + action + '" ' + attr + '="' + esc(val) + '">'
    + (color ? '<span class="sw" style="--c:' + esc(color) + '"></span>' : '') + esc(label) + '</button>';
}

// The card's one chip (#202); the other labels are in Task details.
function keyChip(key) {
  return key.source ? '<span class="cchip" style="--c:' + esc(key.color) + '"><i></i>' + esc(key.name) + '</span>' : '<span class="cchip none">' + esc(NO_CATEGORY.name) + '</span>';
}

// A task past its date says so on its card, amber or red as Settings > Comfort chooses, unless its
// one chip already shows the due date (#203).
function pastDateChip(t, key, now) {
  if (!t.deadline || t.status === 'done' || key.source === 'due') return '';
  return new Date(t.deadline + 'T23:59') < new Date(now) ? '<span class="board-card-due">' + deadlineChip(t.deadline, t) + '</span>' : '';
}

function card(t, p, st, narrowed, selected, now) {
  const done = t.status === 'done';
  const key = cardKey(t, st, getColourBy(st), now);
  const meta = keyChip(key) + (narrowed ? '' : '<span class="board-card-proj">' + esc(p.name) + '</span>');
  const ties = tieSummary(st.projects, t.id);
  const subs = subtasksOf(st.projects, t.id);
  return '<article class="board-card calm-card' + (selected ? ' on' : '') + (done ? ' is-done' : '') + (ties.isWaiting ? ' is-waiting' : '') + '" data-action="board-select" data-task-id="' + esc(t.id) + '" data-project="' + esc(p.id) + '" data-status="' + esc(t.status) + '" style="--proj-color:' + esc(key.color) + '">'
    + '<input type="checkbox" data-action="toggle-task" data-task="' + esc(t.id) + '" data-project="' + esc(p.id) + '"' + (done ? ' checked' : '') + ' aria-label="' + esc(t.title) + '">'
    + '<div class="board-card-body"><span class="board-card-title">' + esc(t.title) + '</span>'
    + '<span class="board-card-meta">' + meta + '</span>'
    + (subs.length ? subsLine(subs) : '') + tieLineHtml(Object.assign({}, ties, { subs: null })) + pastDateChip(t, key, now) + '</div>'
    + moveButton(t) + '</article>';
}

export function renderBoard(st, ui, now = Date.now()) {
  const projects = st.projects || [];
  const narrowedTo = ui.boardProject ? projects.find((p) => p.id === ui.boardProject) : null;
  const tab = normalizeBoardCol(ui.boardCol);
  const show = SHOW_INFO.some((s) => s[0] === ui.boardShow) ? ui.boardShow : 'all';
  const pcat = (st.projectCategories || []).some((c) => c.id === ui.boardPcat) ? ui.boardPcat : '';
  const find = ui.boardFind || '';
  const { tasks, counts } = boardList(st, { tab, find, project: narrowedTo ? narrowedTo.id : null, pcat, show }, now);
  const chunk = getChunk(st);
  const limit = Math.max(chunk, ui.boardShown || 0);
  const owner = new Map();
  projects.forEach((p) => (p.tasks || []).forEach((t) => owner.set(t.id, p)));
  const active = (pcat ? 1 : 0) + (show !== 'all' ? 1 : 0);
  const open = !!ui.boardFilterOpen;
  const drawer = open
    ? '<div class="calm-drawer"><p class="calm-h">Category</p><div class="bm-row">' + chip(!pcat, 'board-pcat', 'data-pcat', '', 'All')
      + (st.projectCategories || []).map((c) => chip(pcat === c.id, 'board-pcat', 'data-pcat', c.id, c.name, c.color)).join('') + '</div>'
      + '<p class="calm-h">Show</p><div class="bm-row">' + SHOW_INFO.map(([k, l]) => chip(show === k, 'board-show', 'data-show', k, l)).join('') + '</div>'
      + '<button type="button" class="btn primary" data-action="board-filter">Show ' + tasks.length + ' task' + (tasks.length === 1 ? '' : 's') + '</button></div>'
    : '';
  const tabs = BOARD_COLS.map((k) => '<button type="button" role="tab" aria-selected="' + (k === tab) + '" class="calm-tab' + (k === tab ? ' on' : '') + '" data-action="board-col" data-col="' + k + '">'
    + COL_INFO[k].title + ' <b>' + counts[k] + '</b></button>').join('');
  const selected = ui.boardSelected && owner.has(ui.boardSelected) ? ui.boardSelected : null;
  const cards = tasks.slice(0, limit).map((t) => card(t, owner.get(t.id), st, !!narrowedTo, t.id === selected, now)).join('');
  const empty = '<p class="calm-empty">' + (find || active || narrowedTo ? 'Nothing matches. Clear the search or filters to see more.' : COL_INFO[tab].empty) + '</p>';
  const left = tasks.length - limit;
  return '<h2 class="board-title">Board</h2><div class="cw"><section class="cw-list">'
    + '<div class="calm-tools"><input type="search" class="bm-find board-find" data-board-find value="' + esc(find) + '" placeholder="Find…" aria-label="Find a task, project or label">'
    + '<select data-action="board-project-select" aria-label="Project"><option value="">Project: All</option>'
    + projects.map((p) => '<option value="' + esc(p.id) + '"' + (narrowedTo && narrowedTo.id === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select>'
    + '<button type="button" class="btn ghost calm-btn' + (open ? ' on' : '') + '" data-action="board-filter" aria-expanded="' + open + '">Filter' + (active ? ' (' + active + ')' : '') + '</button></div>'
    + drawer + '<div class="calm-tabs" role="tablist">' + tabs + '</div>'
    + '<div class="calm-cards">' + (cards || empty) + '</div>'
    + (left > 0 ? '<button type="button" class="btn-text calm-more" data-action="board-more">Show ' + Math.min(chunk, left) + ' more (' + left + ' left)</button>' : '')
    + '</section>' + (selected ? renderTaskDetails(st, ui, selected, now) : '<aside class="cw-detail"><p class="calm-meta">' + EMPTY_PANEL + '</p></aside>') + '</div>';
}
