// focus-deck-app/js/task-details.js
// The Board's Task details panel (#201, calm): "Task details" with Close, the title (edited in place) and a
// status menu, then five folded rows (Notes, Priority and due date, Labels, Subtasks, Linked tasks), one open
// at a time, each with a one-line summary. The rows use the same markup and classes as Settings (.set,
// .set-head, .set-body). Every control carries a data attribute that app.js turns into an existing mutation,
// so changes save as they are made. The summaries are pure and exported for tests. Spec: the test site's
// detail(); see docs/4-systems/calm-board.md
import { esc, formatLabelName, PRIORITY, PRIORITY_ORDER } from './state.js';
import { renderLabelPicker, mutedChip } from './render.js';
import { dueKey } from './card-key.js';
import { subtasksOf, holdsUp, isBlocked, canSetParent, canWaitOn } from './task-links.js';

export const DETAIL_ROWS = ['notes', 'when', 'labels', 'subtasks', 'links'];
const STATUSES = [['next', 'Up next'], ['doing', 'In progress'], ['done', 'Done']];
export const LINK_FIELDS = { parent: 'Part of', waitsOn: 'Waits on', holdsUp: 'Holds up' };

export function notesSummary(notes) {
  if (!notes || !notes.trim()) return 'None';
  const text = notes.trim(), first = text.split('\n')[0];
  return first.slice(0, 40) + (first.length > 40 || text.includes('\n') ? '…' : '');
}
export function whenSummary(t, overdue, now = Date.now()) {
  const due = dueKey(t, overdue, now);
  return [t.priority && PRIORITY[t.priority] ? PRIORITY[t.priority].label + ' priority' : '', due ? due.name : ''].filter(Boolean).join(' · ') || 'None set';
}
export function labelsSummary(t, cats) {
  return (t.categoryIds || []).map((id) => (cats.find((c) => c.id === id) || {}).name).filter(Boolean).map(formatLabelName).join(', ') || 'None';
}
export function subtasksSummary(subs) {
  return subs.length ? subs.filter((s) => s.status === 'done').length + ' of ' + subs.length + ' done' : 'None';
}
export function linksSummary(hasParent, waits, holds) {
  const s = [hasParent ? 'part of 1' : '', waits ? 'waits on ' + waits : '', holds ? 'holds up ' + holds : ''].filter(Boolean).join(', ');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'None';
}

function foldRow(open, key, title, value, body) {
  return '<section class="set' + (open ? ' open' : '') + '"><button type="button" class="set-head" data-action="detail-fold" data-key="' + key + '" aria-expanded="' + open + '" aria-controls="fold-task-' + key + '">'
    + '<span class="set-title">' + title + '</span><span class="set-value" data-summary="' + key + '">' + esc(value) + '</span><span class="set-arrow" aria-hidden="true">' + (open ? '⌃' : '⌄') + '</span></button>'
    + (open ? '<div class="set-body" id="fold-task-' + key + '">' + body + '</div>' : '') + '</section>';
}

// The whole <aside> for the selected task `id` (which must exist in st).
export function renderTaskDetails(st, ui, id, now = Date.now()) {
  const all = (st.projects || []).flatMap((p) => (p.tasks || []).map((t) => ({ t, p })));
  const byId = (i) => all.find((x) => x.t.id === i);
  const x = byId(id);
  const t = x.t;
  const cats = st.categories || [];
  const catOf = (cid) => cats.find((c) => c.id === cid);
  const open = DETAIL_ROWS.includes(ui.boardOpen) ? ui.boardOpen : null;
  const tag = (y) => '<button type="button" class="bm-tag" data-action="detail-goto" data-task-id="' + esc(y.t.id) + '" style="--c:' + esc(y.p.color) + '">' + esc(y.t.title) + (y.p.id !== x.p.id ? ' <small>· ' + esc(y.p.name) + '</small>' : '') + '</button>';
  const tied = (field, y) => '<span class="bm-tied">' + tag(y) + '<button type="button" class="bm-add" data-action="detail-unlink" data-field="' + field + '" data-id="' + esc(y.t.id) + '" aria-label="Remove link to ' + esc(y.t.title) + '">×</button></span>';
  const parent = t.parentId ? byId(t.parentId) : null;
  const subs = subtasksOf(st.projects, id);
  const waits = (t.waitsOn || []).map(byId).filter(Boolean);
  const holds = holdsUp(st.projects, id).map((h) => byId(h.id)).filter(Boolean);
  const labelIds = (t.categoryIds || []).filter(catOf);

  const subRows = subs.map((s) => '<div class="bm-sub"><input type="checkbox" data-action="toggle-task" data-task="' + esc(s.id) + '" data-project="' + esc(x.p.id) + '"' + (s.status === 'done' ? ' checked' : '') + ' aria-label="Done: ' + esc(s.title) + '">'
    + '<button type="button" class="bm-add bm-sub-name" data-action="detail-goto" data-task-id="' + esc(s.id) + '">' + esc(s.title) + '</button>'
    + (s.status !== 'done' && isBlocked(st.projects, s.id) ? '<span class="st">waiting</span>' : '') + '</div>').join('');
  const addSub = ui.boardAddSub
    ? '<div class="bm-addrow"><input type="text" data-detail-newsub placeholder="Subtask title…" aria-label="New subtask title" maxlength="200"><button type="button" class="btn primary" data-action="detail-add-sub">Add</button></div>'
    : '<button type="button" class="bm-add" data-action="detail-add-sub-open">+ Add a subtask</button>';

  const labelRows = labelIds.map((cid, i) => '<div class="lb-row"><span class="chip cat-chip small" style="--chip-color:' + mutedChip(catOf(cid).color) + '">' + esc(formatLabelName(catOf(cid).name)) + '</span>'
    + (i === 0 ? '<span class="st">Category</span>' : '<button type="button" class="bm-add" data-action="detail-make-cat" data-cat="' + esc(cid) + '" aria-label="Make ' + esc(formatLabelName(catOf(cid).name)) + ' the category">Make category</button>') + '</div>').join('');
  const picker = renderLabelPicker(cats, labelIds, x.p).replace(/<summary>.*?<\/summary>/, '<summary>Add or remove labels</summary>')
    .replace('<details class="label-picker"', '<details class="label-picker"' + (ui.boardPicker ? ' open' : ''));

  const linkSec = (title, body) => '<div class="bm-sec"><h4>' + title + '</h4>' + body + '</div>';
  const links = (parent ? linkSec(LINK_FIELDS.parent, '<div class="bm-tags">' + tied('parent', parent) + '</div>') : '')
    + (waits.length ? linkSec(LINK_FIELDS.waitsOn, '<div class="bm-tags">' + waits.map((w) => tied('waitsOn', w)).join('') + '</div>') : '')
    + (holds.length ? linkSec(LINK_FIELDS.holdsUp, '<div class="bm-tags">' + holds.map((h) => tied('holdsUp', h)).join('') + '</div>') : '');
  const field = ui.boardLink && ui.boardLink.field;
  const q = ((ui.boardLink && ui.boardLink.query) || '').toLowerCase();
  const taken = [t.parentId].concat(subs.map((s) => s.id), t.waitsOn || [], holds.map((h) => h.t.id));
  const ok = ({ t: o, p }) => {
    if (o.status === 'done' || o.id === id || taken.includes(o.id)) return false;
    if (field === 'parent') return p.id === x.p.id && canSetParent(st.projects, id, o.id);
    return field === 'waitsOn' ? canWaitOn(st.projects, id, o.id) : canWaitOn(st.projects, o.id, id);
  };
  const hits = field ? all.filter(ok).filter(({ t: o, p }) => !q || o.title.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)).slice(0, 6) : [];
  const finder = field ? '<div class="task-find"><input class="sort-find" data-detail-find value="' + esc((ui.boardLink && ui.boardLink.query) || '') + '" placeholder="Find a task…" aria-label="Find a task to link">'
    + hits.map(({ t: o, p }) => '<button type="button" class="task-hit" data-action="detail-link-add" data-field="' + field + '" data-id="' + esc(o.id) + '"><span class="dot" style="--c:' + esc(p.color) + '"></span>' + esc(o.title) + '<span class="muted small">' + esc(p.name) + '</span></button>').join('')
    + (!hits.length ? '<p class="calm-meta">No task matches.</p>' : '') + '</div>' : '';
  const linkBtns = Object.keys(LINK_FIELDS).filter((f) => f !== 'parent' || (!parent && !subs.length))
    .map((f) => '<button type="button" class="bm-chip' + (field === f ? ' on' : '') + '" data-action="detail-link-open" data-field="' + f + '">+ ' + LINK_FIELDS[f] + '</button>').join('');

  const status = '<select class="cw-status" data-detail-status aria-label="Status">' + STATUSES.map(([k, l]) => '<option value="' + k + '"' + (t.status === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>';
  const row = (key, title, value, body) => foldRow(open === key, key, title, value, body);
  return '<aside class="cw-detail phone-open" aria-labelledby="cw-name" data-selected="' + esc(id) + '" data-project="' + esc(x.p.id) + '">'
    + '<div class="top"><span class="cw-name" id="cw-name">Task details</span><button type="button" class="x" data-action="detail-close" aria-label="Close task details">Close ×</button></div>'
    + '<h3 contenteditable="true" role="textbox" aria-label="Task title" data-detail-title>' + esc(t.title) + '</h3>'
    + '<div class="cw-where">' + status + '<span>in ' + esc(x.p.name) + '</span></div>'
    + '<div class="cw-rows">'
    + row('notes', 'Notes', notesSummary(t.notes), '<textarea data-detail-notes placeholder="Notes…" aria-label="Notes">' + esc(t.notes || '') + '</textarea>')
    + row('when', 'Priority and due date', whenSummary(t, st.comfort && st.comfort.overdue && st.comfort.overdue.value, now),
      '<div class="grid"><select aria-label="Priority" data-detail-priority><option value="">No priority</option>' + PRIORITY_ORDER.slice().reverse().map((k) => '<option value="' + k + '"' + (t.priority === k ? ' selected' : '') + '>' + PRIORITY[k].label + '</option>').join('')
      + '</select><input type="date" aria-label="Due date" data-detail-due value="' + esc(t.deadline || '') + '"></div>')
    + row('labels', 'Labels', labelsSummary(t, cats), labelRows + '<div class="detail-labels">' + picker + '</div>')
    + row('subtasks', 'Subtasks', subtasksSummary(subs), (subRows || '<p class="calm-meta">No subtasks yet.</p>') + (parent ? '' : addSub))
    + row('links', 'Linked tasks', linksSummary(!!parent, waits.length, holds.length), (links || '<p class="calm-meta">Not linked to any task.</p>') + '<div class="bm-row">' + linkBtns + '</div>' + finder)
    + '</div>'
    + '<div class="cw-foot"><span class="saved">Changes save as you make them.</span><span class="sp"></span>'
    + '<button type="button" class="btn-text" data-action="detail-focus">Focus on this</button><button type="button" class="btn-text" data-action="detail-delete">Delete</button></div></aside>';
}
