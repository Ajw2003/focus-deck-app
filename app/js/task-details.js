// focus-deck-app/js/task-details.js
// Task details (#269): a clipboard with × to close, the task's title, a status rubber stamp (tap: the Status drawer)
// and a till receipt with one line per detail (🚩 priority, 📅 due, 🗂 labels, 🪜 smaller steps, ⏳ waits on, 📝 notes,
// 🐙 GitHub issue), each with a pencil. A pencil opens the SAME step screen Sort uses (renderSortFlow in its edit
// mode, Save instead of Next); smaller steps and GitHub have screens of their own. The ⋯ tag opens the card-index
// drawer (Rename, Move, Part of, Holds up, Delete) and the ◎ Focus stamp sits beside it. Every control carries a
// data-action that app.js turns into an existing mutation. The summaries are pure and exported for tests.
// Spec: docs/generated/friction-steps/prototype.html d0..d4; see docs/4-systems/task-details.md
import { esc, formatLabelName, PRIORITY, state } from './state.js';
import { effectivePriority } from './areas.js';
import { dueKey } from './card-key.js';
import { subtasksOf, holdsUp } from './task-links.js';
import { SIZE_POINTS } from './roadmap.js';
import { focusChoosingMode } from './render.js';
import { renderSortFlow, stamp, foot, back, choice } from './sort-flow-view.js';

export const STATUSES = [['next', 'Up next', '#4A6FB5'], ['doing', 'Doing', '#B7791F'], ['review', 'Review', '#7B4BB5'], ['done', 'Done', '#2F7A4B']];
const NONE = '—';

export function notesSummary(notes) {
  return notes && notes.trim() ? notes.trim().replace(/\s+/g, ' ') : NONE;
}
export function labelsSummary(t, cats) {
  return (t.categoryIds || []).map((id) => (cats.find((c) => c.id === id) || {}).name).filter(Boolean).map(formatLabelName).join(', ') || NONE;
}
export function subtasksSummary(subs) {
  return subs.length ? subs.filter((s) => s.status === 'done').length + ' of ' + subs.length : NONE;
}

const stampBtn = (name, color, on, action, extra = '') => '<button type="button" class="rm-stamp' + (on ? ' on' : '') + '" style="--s:' + color + '" data-action="' + action + '"' + extra + ' aria-pressed="' + !!on + '">' + name + '</button>';
const drawer = (title, body, action) => '<div class="vs-backdrop" data-action="' + action + '"></div><div class="vs-pop dk-sheet sort-drawer" role="dialog" aria-modal="true" aria-label="' + esc(title) + '" tabindex="-1">'
  + '<div class="vs-pop-head"><b>' + esc(title) + '</b><button type="button" class="vs-x" data-action="' + action + '" aria-label="Close">×</button></div><div class="vs-pop-body">' + body + '</div></div>';
const board = (q, inner, extra) => '<div class="dk-board sort-board"><div class="dk-paper sort-paper">' + (extra || '') + (q ? '<h2 class="sort-q">' + esc(q) + '</h2>' : '') + '<div class="sort-body">' + inner + '</div></div></div>';
const backTo = () => back().replace('sort-back', 'detail-back');

// The whole <aside> for the selected task `id` (which must exist in st). ui.edit (a step open), ui.boardScreen
// ('subs', 'github' or 'rename') and ui.boardDrawer ('status' or 'more') say which screen it is.
export function renderTaskDetails(st, ui, id, now = Date.now()) {
  const all = (st.projects || []).flatMap((p) => (p.tasks || []).map((t) => ({ t, p })));
  const x = all.find((y) => y.t.id === id);
  const t = x.t;
  const panel = (inner) => '<aside class="cw-detail td-panel" aria-label="Task details" data-selected="' + esc(id) + '" data-project="' + esc(x.p.id) + '"><section class="sortflow"><div class="unsorted-body">' + inner + '</div></section></aside>';
  const ids = ' data-task="' + esc(id) + '" data-project="' + esc(x.p.id) + '"';

  if (ui.edit && ui.edit.taskId === id) return panel(renderSortFlow(st, ui.edit, [{ kind: 'task', key: 'task:' + id, task: t, project: x.p }], { mode: focusChoosingMode(st), now: new Date(now), edit: true }));
  if (ui.boardScreen === 'rename') {
    return panel(board('Rename', '<input type="text" class="sort-find sort-type" data-detail-rename value="' + esc(t.title) + '" maxlength="200" aria-label="Task title">') + foot([backTo(), stamp('Save', { action: 'detail-rename-save' })]));
  }
  if (ui.boardScreen === 'subs') {
    const subs = subtasksOf(st.projects, id);
    const rows = t.parentId ? '<p class="muted">This is part of another task, so it can’t have smaller steps of its own.</p>'
      : subs.map((s) => '<label class="dk-choice td-tick"><input type="checkbox" data-action="toggle-task" data-task="' + esc(s.id) + '" data-project="' + esc(x.p.id) + '"' + (s.status === 'done' ? ' checked' : '') + '><span>' + esc(s.title) + '</span></label><button type="button" class="td-go" data-action="detail-goto" data-task-id="' + esc(s.id) + '" aria-label="Open ' + esc(s.title) + '">↗</button>').join('')
        + '<div class="td-add"><input type="text" class="sort-find" data-detail-newsub placeholder="+ Add" aria-label="New smaller step" maxlength="200">' + stamp('Add', { action: 'detail-add-sub' }) + '</div>';
    return panel(board('Smaller steps', rows) + foot([backTo(), stamp('Done', { action: 'detail-back' })]));
  }
  if (ui.boardScreen === 'size') { // not on the design's receipt, but the Roadmap's "Task size" measure reads it and nothing else sets it
    const pick = (k, label) => choice(label, { action: 'detail-size', attrs: ' data-size="' + k + '"', on: (t.size || '') === k, toggle: true });
    return panel(board('How big is it?', Object.keys(SIZE_POINTS).map((k) => pick(k, k.charAt(0).toUpperCase() + k.slice(1) + ' (' + SIZE_POINTS[k] + ')')).join('') + pick('', 'Not set (counts as small)')) + foot([backTo(), stamp('Done', { action: 'detail-back' })]));
  }
  if (ui.boardScreen === 'github') {
    const linked = t.source === 'github' && t.issueNumber != null;
    const body = linked
      ? (t.url ? '<a class="dk-choice" href="' + esc(t.url) + '" target="_blank" rel="noopener"><span>↗ Open on GitHub</span></a>' : '') + choice('Unlink', { action: 'unlink-github-issue', attrs: ids, cls: ' danger' })
      : choice('+ Create issue', { action: 'create-github-issue', attrs: ids }) + choice('Link to an existing issue', { action: 'link-github-issue', attrs: ids });
    return panel(board(linked ? 'GitHub #' + t.issueNumber : 'GitHub', body) + foot([backTo()]));
  }

  const lvl = effectivePriority(t, state);
  const due = dueKey(t, st.comfort && st.comfort.overdue && st.comfort.overdue.value, now);
  const go = (list) => ({ html: list.map((w) => '<button type="button" class="td-go" data-action="detail-goto" data-task-id="' + esc(w.id) + '">' + esc(w.title) + '</button>').join(', ') });
  const waits = (t.waitsOn || []).map((w) => (all.find((y) => y.t.id === w) || {}).t).filter(Boolean);
  const holds = holdsUp(st.projects, id), parent = t.parentId ? (all.find((y) => y.t.id === t.parentId) || {}).t : null;
  const lines = [
    ['🚩', 'Priority', lvl ? PRIORITY[lvl].label : NONE, 'detail-edit', '2'],
    ['📅', 'Due', due ? due.name : NONE, 'detail-edit', '4'],
    ['🗂', 'Labels', labelsSummary(t, st.categories || []), 'detail-edit', '3'],
    ['🪜', 'Smaller steps', subtasksSummary(subtasksOf(st.projects, id)), 'detail-subs', ''],
    ['⏳', 'Waits on', waits.length ? go(waits) : NONE, 'detail-edit', '7'],
    ...(holds.length ? [['🚧', 'Holds up', go(holds), 'detail-edit', '8']] : []),
    ...(parent ? [['🧩', 'Part of', go([parent]), 'detail-edit', '5']] : []),
    ['📝', 'Notes', notesSummary(t.notes), 'detail-edit', 'notes'],
    ['📏', 'Size', t.size ? t.size.charAt(0).toUpperCase() + t.size.slice(1) : NONE, 'detail-size-open', ''],
    ['🐙', 'GitHub issue', t.source === 'github' && t.issueNumber != null ? '#' + t.issueNumber : NONE, 'detail-github', ''],
  ];
  const receipt = '<div class="dk-summary sort-receipt">' + lines.map(([icon, label, val, action, step]) => '<div><span aria-hidden="true">' + icon + '</span><b class="sr-only">' + label + ': </b><em>' + (typeof val === 'object' ? val.html : esc(val)) + '</em>'
    + '<button type="button" class="dk-pencil" data-action="' + action + '"' + (step ? ' data-step="' + step + '"' : '') + ' aria-label="Change ' + label.toLowerCase() + '">✎</button></div>').join('') + '</div>';
  const cur = STATUSES.find((s) => s[0] === t.status) || STATUSES[0];
  const stampRow = '<div class="td-stamp-row">' + stampBtn(cur[1], cur[2], true, 'detail-status-open', ' aria-label="Status: ' + cur[1] + '. Change it"') + '<span class="folder-chip" style="--c:' + esc(x.p.color) + '">' + esc(x.p.name) + '</span></div>';
  const drawers = ui.boardDrawer === 'status'
    ? drawer('Status', '<div class="rm-stamps">' + STATUSES.map(([k, n, c]) => stampBtn(n, c, t.status === k, 'detail-status', ' data-status="' + k + '"')).join('') + '</div>', 'detail-status-open')
    : ui.boardDrawer === 'more'
      ? drawer(t.title, choice('✏️ Rename', { action: 'detail-rename' }) + choice('📁 Move to another project', { action: 'detail-edit', attrs: ' data-step="1"' })
        + choice('🧩 Part of…', { action: 'detail-edit', attrs: ' data-step="5"' }) + choice('🚧 Holds up…', { action: 'detail-edit', attrs: ' data-step="8"' }) + choice('Delete', { action: 'detail-delete', cls: ' danger' }), 'detail-more')
      : '';
  return panel(board(t.title, stampRow + receipt, '<button type="button" class="td-x" data-action="detail-close" aria-label="Close task details">×</button>')
    + foot([stamp('⋯', { action: 'detail-more', attrs: ' aria-label="More about this task"', cls: ' td-more' }), stamp('◎ Focus', { action: 'detail-focus' })]) + drawers);
}
