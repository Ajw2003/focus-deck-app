// focus-deck-app/js/sort-flow-view.js
// The Sort tab's markup (#264): one thought on a jotter slip, then one question per screen on a
// clipboard (project, priority, labels, due date, part of, smaller steps, waits on, holds up), then
// the receipt. What a tap does is in js/app.js; which screen comes next is js/sort-flow.js. The kit
// classes (dk-*) are in css/app.css. See docs/4-systems/in-tray.md
import { esc, relTime, PRIORITY, PRIORITY_ORDER } from './state.js';
import { viewState } from './view-switch.js';
import { flagCards, folderCards } from './in-tray.js';
import { canWaitOn, subtasksOf } from './task-links.js';
import { dueDates } from './pick-bits.js';
import { sleeve, walletInner, mutedChip } from './render.js';
import { LAST_STEP, STEP_TITLES, canSkip, monthGrid, shiftMonth, formatDue, warnPlan } from './sort-flow.js';

const has = (name, q) => !q || name.toLowerCase().includes(q.toLowerCase());
const allTasks = (st) => st.projects.flatMap((p) => p.tasks.map((t) => ({ t, p })));
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---- the pieces every screen shares ---------------------------------------------------------------
const stamp = (label, { action = 'sort-next', disabled = false, attrs = '', cls = '' } = {}) =>
  '<button type="button" class="dk-btn file-btn' + (disabled ? ' off' : '') + cls + '" data-action="' + action + '"' + attrs + (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
const foot = (parts) => '<div class="sort-foot">' + parts.join('') + '</div>';
const back = () => '<button type="button" class="dk-back" data-action="sort-back">‹ Back</button>';
const skip = () => '<button type="button" class="dk-skip" data-action="sort-skip">Skip</button>';
const choice = (label, { action, attrs = '', on = false, small = '', cls = '', toggle = false } = {}) =>
  '<button type="button" class="dk-choice' + (on ? ' on' : '') + cls + '" data-action="' + action + '"' + attrs + (toggle ? ' aria-pressed="' + on + '"' : '') + '><span>' + label + '</span>' + (small ? '<small>' + small + '</small>' : '') + '</button>';
const why = (text) => text ? '<p class="step-why" role="status">' + esc(text) + '</p>' : '';
const dots = (step) => '<div class="dk-prog sort-dots" role="img" aria-label="Step ' + step + ' of ' + LAST_STEP + '">'
  + Array.from({ length: LAST_STEP }, (_, i) => '<i' + (i < step ? ' class="on"' : '') + '></i>').join('') + '</div>';

// the slip: the thought (or task) in handwriting, the project it is going in, and the ⋯ drawer pull
function slipHtml(c, full) {
  const { u, cur, isThought, project, text, allCards } = c;
  const editable = full && (isThought || cur.task.issueNumber == null);
  const chip = (p) => '<span class="folder-chip" style="--c:' + p.color + '">' + esc(p.name) + '</span>';
  const dest = (project ? (isThought ? 'Going in ' : 'In ') + chip(project) : 'No project yet')
    + (!isThought && cur.task.issueNumber != null ? ' <span class="slip-issue">#' + cur.task.issueNumber + '</span>' : '');
  const flags = u.selected.map((token) => allCards.find((x) => x.token === token)).filter(Boolean)
    .map((x) => '<span class="slip-flag" title="' + esc(x.name) + '" style="--c:' + mutedChip(x.color) + '">' + esc(x.name) + '</span>').join('');
  return '<div class="jot-slip' + (full ? '' : ' compact') + '"><button type="button" class="slip-more" data-action="sort-menu" aria-haspopup="dialog" aria-expanded="' + !!u.menu + '" aria-label="More: add notes, done already, later, delete">⋯</button>'
    + '<p class="slip-text"' + (editable ? ' contenteditable="true" spellcheck="false" data-slip-title' : '') + '>' + esc(text) + '</p>'
    + '<div class="slip-dest">' + dest + '</div>' + (flags ? '<div class="slip-flags">' + flags + '</div>' : '')
    + (full && isThought ? '<div class="slip-when">Thought · ' + relTime(cur.item.createdAt) + '</div>' : '')
    + (full && !isThought ? '<button type="button" class="btn-text task-open" data-action="task-open" data-task="' + esc(cur.task.id) + '" aria-label="Task details: ' + esc(cur.task.title) + '">Details</button>' : '')
    + '</div>';
}

// the ⋯ drawer: Add notes, Done already, Later, Delete (the same four actions the old buttons did)
function menuDrawer(c) {
  const { cur, isThought, ids } = c;
  const card = (label, action, extra = '', cls = '') => '<button type="button" class="dk-choice' + cls + '" data-action="' + action + '" ' + extra + '>' + label + '</button>';
  return '<div class="vs-backdrop" data-action="sort-menu"></div><div class="vs-pop dk-sheet sort-drawer" role="dialog" aria-modal="true" aria-label="This ' + (isThought ? 'thought' : 'task') + '" tabindex="-1">'
    + '<div class="vs-pop-head"><b>This ' + (isThought ? 'thought' : 'task') + '</b><button type="button" class="vs-x" data-action="sort-menu" aria-label="Close">×</button></div>'
    + '<div class="vs-pop-body">' + card('📝 Add notes', 'sort-add-notes') + card('✓ Done already', 'unsorted-complete', ids) + card('⏭ Later', 'unsorted-skip') + card('Delete', 'unsorted-delete', ids, ' danger') + '</div></div>';
}

// ---- links to other tasks (steps 5 to 8) -----------------------------------------------------------
function tieStep(c, field) {
  const { st, u, project, tid } = c;
  const f = (k) => u[k] || [];
  const find = (id) => allTasks(st).find((x) => x.t.id === id);
  const inFolder = field === 'parent' || field === 'subtasks';
  const taken = [u.parent].concat(f('subtasks'), f('waitsOn'), f('holdsUp'));
  const q = (u.pickQuery || '').toLowerCase();
  const ok = ({ t, p }) => {
    if (t.status === 'done' || t.id === tid || taken.includes(t.id)) return false;
    if (inFolder && p.id !== project.id) return false;
    const live = !!t.parentId && !!find(t.parentId);
    if (field === 'parent') return !live && !f('subtasks').length && !(u.newSubtasks || []).length;
    if (field === 'subtasks') return !live && !u.parent && !subtasksOf(st.projects, t.id).length;
    if (!tid) return true; // a thought has no id yet, so nothing can loop back to it
    return field === 'waitsOn' ? canWaitOn(st.projects, tid, t.id) : canWaitOn(st.projects, t.id, tid);
  };
  const chosen = (field === 'parent' ? (u.parent ? [u.parent] : []) : f(field)).map((id) => {
    const x = find(id);
    return x ? choice(esc(x.t.title), { action: 'tie-remove', attrs: ' data-field="' + field + '" data-id="' + esc(id) + '"', on: true, small: x.p.id !== project.id ? esc(x.p.name) : '' }) : '';
  });
  if (field === 'subtasks') (u.newSubtasks || []).forEach((s, i) => chosen.push(choice(esc(s), { action: 'tie-remove', attrs: ' data-field="newSubtasks" data-id="' + i + '"', on: true, small: 'new' })));
  const hits = allTasks(st).filter(ok).filter(({ t, p }) => !q || t.title.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)).slice(0, 4);
  const typed = (u.pickQuery || '').trim();
  const rows = (field === 'subtasks' && typed ? [choice('+ Add “' + esc(typed) + '”', { action: 'tie-new-sub' })] : [])
    .concat(hits.map(({ t, p }) => choice(esc(t.title), { action: 'tie-add', attrs: ' data-field="' + field + '" data-id="' + esc(t.id) + '"', small: esc(p.name) })));
  const hint = { parent: 'in ' + esc(project.name), subtasks: 'or type a new step', waitsOn: 'in any project', holdsUp: 'in any project' }[field];
  return '<input type="text" class="sort-find" data-tie-find value="' + esc(u.pickQuery || '') + '" placeholder="Find a task ' + hint + '…" aria-label="Find a task">'
    + chosen.join('') + rows.join('') + (!rows.length && !chosen.length ? '<p class="muted small">No task matches.</p>' : '');
}

// ---- the due date: tear-off calendar pages -----------------------------------------------------------
const calPage = (top, big, small, { value, on }) => '<button type="button" class="sort-cal-page' + (on ? ' on' : '') + '" data-action="pick-set" data-scope="sort" data-field="due" data-value="' + value + '" aria-pressed="' + !!on + '">'
  + '<i>' + esc(top) + '</i><b>' + esc(big) + '</b><small>' + esc(small) + '</small></button>';
function dueStep(c, now) {
  const { u } = c;
  const dd = dueDates(now), due = u.due || '';
  const day = (iso) => new Date(iso + 'T12:00:00');
  const mon = (iso) => day(iso).toLocaleDateString('en-GB', { month: 'short' });
  const presets = [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['friday', 'Friday'], ['nextweek', 'Next week']];
  const custom = due && !presets.some(([k]) => dd[k] === due);
  const pages = (custom ? [calPage(day(due).toLocaleDateString('en-GB', { weekday: 'long' }), day(due).getDate(), mon(due), { value: due, on: true })] : [])
    .concat(presets.map(([k, label]) => calPage(label, day(dd[k]).getDate(), mon(dd[k]), { value: k, on: due === dd[k] })))
    .concat(calPage('No date', '–', '', { value: 'none', on: !due }));
  return '<div class="sort-cal" role="group" aria-label="Due date">' + pages.join('') + '</div>'
    + choice('📅 Another date', { action: 'pick-set', attrs: ' data-scope="sort" data-field="due" data-value="date"' });
}
function monthStep(c, now) {
  const { u } = c;
  const ym = u.month || (u.due || dueDates(now).today).slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const today = dueDates(now).today;
  const cell = (iso) => iso ? '<button type="button" class="sort-day' + (iso === u.due ? ' on' : '') + (iso === today ? ' today' : '') + '" data-action="pick-set" data-scope="sort" data-field="due" data-value="' + iso + '" aria-pressed="' + (iso === u.due) + '" aria-label="' + esc(formatDue(iso)) + '">' + +iso.slice(8) + '</button>' : '<span></span>';
  return '<div class="sort-month"><div class="sort-month-head"><button type="button" class="sort-nav" data-action="sort-month" data-dir="-1" aria-label="Previous month">‹</button><b>' + MONTH_NAMES[m - 1] + ' ' + y + '</b><button type="button" class="sort-nav" data-action="sort-month" data-dir="1" aria-label="Next month">›</button></div>'
    + '<div class="sort-days">' + 'MTWTFSS'.split('').map((d) => '<em>' + d + '</em>').join('') + monthGrid(ym).flat().map(cell).join('') + '</div></div>'
    + '<input type="text" class="sort-find sort-type" data-pick-type data-scope="sort" placeholder="or type: fri, 15 dec" aria-label="Type a date">';
}
function warnStep(c, now, defaults) {
  const { u } = c;
  const plan = warnPlan(u.due, now, defaults, u.dueStages ? { yellow: u.dueStages.yellow.leadHours, red: u.dueStages.red.leadHours } : null);
  const opts = (list, pick) => list.map((x) => '<option value="' + x.hours + '"' + (pick && pick.hours === x.hours ? ' selected' : '') + '>' + x.label + ' left</option>').join('');
  return '<div class="sort-warn"><label class="dk-choice"><span>🟡 Turn yellow at</span><select data-warn="yellow" aria-label="Turn yellow when this much time is left">' + opts(plan.yellowChoices, plan.yellow) + '</select></label>'
    + '<label class="dk-choice"><span>🔴 Turn red at</span><select data-warn="red" aria-label="Turn red when this much time is left">' + opts(plan.redChoices, plan.red) + '</select></label></div>';
}

// ---- labels ------------------------------------------------------------------------------------------
function labelsStep(c) {
  const { st, u, project, allCards, mode } = c;
  const q = u.find || '';
  const cards = flagCards(st, project, { selected: u.selected, showAll: !!u.showAllFlags || !!q }).filter((x) => q ? !x.more && has(x.name, q) : true);
  let html = '<input type="text" class="sort-find" value="' + esc(q) + '" placeholder="Find a kind of work…" aria-label="Find a label">';
  if (cards.length) {
    const items = cards.map((x) => {
      if (x.more) return sleeve({ key: x.token, name: x.name, color: x.color, detail: x.more + ' more', speak: x.more + ' more categories. Choose to show them all.' });
      const picked = u.selected.includes(x.token);
      const detail = picked ? 'label on the slip' : 'no label yet';
      return sleeve({ key: x.token, name: x.name, color: mutedChip(x.color), picked, detail, speak: x.name + ', ' + detail });
    });
    const facing = cards.some((x) => x.token === u.facingFlag) ? u.facingFlag : cards[0].token;
    html += '<div class="wallet" id="tray-flag-wallet">' + walletInner({ wallet: 'tray-flags', label: '', aria: 'Kinds of work. Arrow keys flip, Enter adds or removes.', items, facing, mode, verb: 'use' }) + '</div>';
  } else html += '<p class="muted small find-empty">No label matches “' + esc(q) + '”.</p>';
  const picked = u.selected.map((t) => allCards.find((x) => x.token === t)).filter(Boolean);
  html += '<div class="sort-picked">' + (picked.length ? '📎 ' + picked.map((x) => '<button type="button" class="dk-tag" data-action="sort-flag" data-token="' + esc(x.token) + '" aria-label="Take off ' + esc(x.name) + '">' + esc(x.name) + ' ×</button>').join('') : '<span class="muted small">Nothing picked yet.</span>') + '</div>'
    + '<div class="sort-row2"><button type="button" class="dk-link" data-action="sort-azl">A–Z</button><button type="button" class="dk-link" data-action="sort-new-label">+ New label</button></div>';
  return html;
}
function azlStep(c) {
  const { u, allCards } = c;
  const q = u.find || '';
  const all = allCards.filter((x) => !x.more).sort((a, b) => a.name.localeCompare(b.name));
  const letters = [...new Set(all.map((x) => x.name[0].toUpperCase()))];
  const letter = letters.includes(u.letter) ? u.letter : letters[0];
  const shown = all.filter((x) => q ? has(x.name, q) : x.name[0].toUpperCase() === letter);
  return '<input type="text" class="sort-find" value="' + esc(q) + '" placeholder="Find a kind of work…" aria-label="Find a label">'
    + '<div class="dk-drawer"><div class="dk-tabrow" role="group" aria-label="Letters">' + letters.map((l) => '<button type="button" class="dk-letter' + (l === letter && !q ? ' on' : '') + '" data-action="sort-letter" data-letter="' + l + '" aria-pressed="' + (l === letter && !q) + '">' + l + '</button>').join('') + '</div>'
    + shown.map((x) => choice(esc(x.name), { action: 'sort-flag', attrs: ' data-token="' + esc(x.token) + '"', on: u.selected.includes(x.token), toggle: true })).join('') + '</div>';
}

// ---- the receipt --------------------------------------------------------------------------------------
function receipt(c) {
  const { st, u, cur, project } = c;
  const title = (id) => { const x = allTasks(st).find((y) => y.t.id === id); return x ? x.t.title : ''; };
  const names = (u.selected.map((t) => (c.allCards.find((x) => x.token === t) || {}).name).filter(Boolean));
  const list = (arr) => arr.filter(Boolean).join(', ') || '—';
  const note = (c.notes || '').trim();
  const rows = [
    ['📁', 'Project', project ? project.name : '—', 1],
    ['🚩', 'Priority', u.priority ? PRIORITY[u.priority].label : '—', 2],
    ['🗂', 'Labels', list(names), 3],
    ['📅', 'Due', u.due ? formatDue(u.due) + (u.dueStages ? ' · warns' : '') : '—', 4],
    ['🧩', 'Part of', u.parent ? title(u.parent) : '—', 5],
    ['🪜', 'Smaller steps', list((u.subtasks || []).map(title).concat(u.newSubtasks || [])), 6],
    ['⏳', 'Waits on', list((u.waitsOn || []).map(title)), 7],
    ['🚧', 'Holds up', list((u.holdsUp || []).map(title)), 8],
    ['📝', 'Notes', note ? note.replace(/\s+/g, ' ') : '—', 'notes'],
  ];
  return '<div class="dk-summary sort-receipt">' + rows.map(([icon, label, val, step]) => '<div><span aria-hidden="true">' + icon + '</span><b class="sr-only">' + label + ': </b><em>' + esc(val) + '</em>'
    + '<button type="button" class="dk-pencil" data-action="sort-step" data-step="' + step + '" aria-label="Change ' + label.toLowerCase() + '">✎</button></div>').join('') + '</div>'
    + (cur.kind === 'task' && !u.selected.length ? '<p class="muted small">No label yet, so this task stays in Sort.</p>' : '');
}

// ---- the whole tab -------------------------------------------------------------------------------------
// `head` is "N to sort"; `many` the Sort several flag (only with more than one slip).
export function renderSortFlow(st, u, ordered, { mode, now = new Date(), many = false } = {}) {
  const cur = ordered[0];
  if (!cur) {
    return '<h2 class="tray-count sort-title">All sorted ✓</h2><div class="dk-board sort-board"><div class="dk-paper sort-paper sort-done"><div class="jot-slip ghost" aria-hidden="true">&nbsp;</div><p class="muted">Jot a thought and it lands here.</p></div></div>'
      + foot([stamp('Organize', { action: 'set-screen', attrs: ' data-screen="tidy"' })]);
  }
  const isThought = cur.kind === 'thought';
  const project = u.projectId ? st.projects.find((p) => p.id === u.projectId) : (isThought ? null : cur.project); // a task slip is in its own project until another is chosen
  const c = {
    st, u, cur, isThought, project, mode, tid: isThought ? null : cur.task.id,
    allCards: flagCards(st, project, { selected: u.selected, showAll: true }),
    text: u.title != null ? u.title : (isThought ? cur.item.text : cur.task.title),
    notes: u.notes != null ? u.notes : (isThought ? '' : cur.task.notes || ''),
    ids: isThought ? 'data-inbox="' + cur.item.id + '"' : 'data-task="' + cur.task.id + '" data-project="' + cur.project.id + '"',
  };
  const step = u.step || 0;
  const sub = u.sub || (step === 4 && u.dateOpen ? 'month' : null);
  const drawer = u.menu ? menuDrawer(c) : '';
  const n = ordered.length;
  const board = (inner, slip = true, q = '') => '<div class="dk-board sort-board"><div class="dk-paper sort-paper">' + (slip ? slipHtml(c, false) : '') + (q ? '<h2 class="sort-q">' + q + '</h2>' : '') + '<div class="sort-body">' + inner + '</div></div></div>';

  if (step === 0 && sub !== 'notes') {
    return '<h2 class="tray-count sort-title">' + (n === 1 ? '1 to sort' : n + ' to sort') + '</h2>'
      + '<div class="dk-board sort-board"><div class="dk-paper sort-paper">' + slipHtml(c, true)
      + (many ? '<button type="button" class="dk-link sort-several" data-action="bulk-toggle">Sort several</button>' : '') + '</div></div>'
      + foot([stamp('Sort this one')]) + drawer;
  }
  const bar = dots(Math.max(step, 1));
  if (sub === 'notes') {
    const body = '<textarea class="slip-notes" name="slipNotes" placeholder="Type it here…" aria-label="Notes">' + esc(c.notes) + '</textarea>';
    return bar + board(body, true, 'Notes') + foot([back(), stamp('Save notes', { action: 'sort-notes-done' })]) + drawer;
  }
  if (sub === 'newlabel' || sub === 'newproject') {
    const label = sub === 'newlabel' ? 'New label' : 'New project';
    const body = '<input type="text" class="sort-find sort-type" value="' + esc(u.find || '') + '" placeholder="' + (sub === 'newlabel' ? 'Name the label…' : 'Name the project…') + '" aria-label="' + label + '">';
    return bar + board(body, true, label) + foot([back(), stamp('Add', { action: sub === 'newlabel' ? 'sort-new-flag' : 'sort-add-project', disabled: !(u.find || '').trim() })]) + drawer;
  }
  if (sub === 'azl') return bar + board(azlStep(c), true, 'A–Z') + foot([back(), skip(), stamp('Done', { action: 'sort-back' })]) + drawer;
  if (sub === 'month') return bar + board(monthStep(c, now), true, 'Pick a date') + foot([back(), stamp(u.due ? 'Use ' + formatDue(u.due) : 'Pick a day', { action: 'sort-use-date', disabled: !u.due })]) + drawer;
  if (sub === 'warn') return bar + board(warnStep(c, now, st.dueDefaults), true, 'When should it warn you?') + foot([back(), skip(), stamp('Next')]) + drawer;

  let body = '', next = stamp('Next'), blocked = '';
  if (step === 1) {
    const q = u.find || '';
    const folders = folderCards(viewState(st)).filter((f) => has(f.name, q));
    if (!st.projects.length) body = '<p class="muted small">Add a project to file this thought into.</p>';
    else {
      body = '<input type="text" class="sort-find" value="' + esc(q) + '" placeholder="Find a project…" aria-label="Find a project">';
      if (folders.length) {
        const items = folders.map((f) => {
          const picked = !!project && f.id === project.id;
          const detail = picked ? 'chosen' : f.open + ' open';
          return sleeve({ key: f.id, name: f.name, color: f.color, kind: 'project', picked, detail, speak: f.name + ', ' + (picked ? 'chosen. Choose it again to clear.' : detail) });
        });
        const facing = folders.some((f) => f.id === u.facingFolder) ? u.facingFolder : (project && folders.some((f) => f.id === project.id) ? project.id : folders[0].id);
        body += '<div class="wallet" id="tray-folder-wallet">' + walletInner({ wallet: 'tray-folders', label: '', aria: 'Projects. Arrow keys flip, Enter chooses or clears.', items, facing, mode, verb: 'use' }) + '</div>';
      } else body += '<p class="muted small find-empty">No project matches “' + esc(q) + '”.</p>';
    }
    body += '<div class="sort-row2"><button type="button" class="dk-link" data-action="sort-new-project">+ New project</button></div>';
    if (!project) { next = stamp('Next', { disabled: true }); blocked = 'Choose a project first.'; }
  } else if (step === 2) {
    const flag = (l) => '<button type="button" class="sort-flag' + (u.priority === l ? ' on' : '') + '" data-level="' + l + '" data-action="pick-set" data-scope="sort" data-field="priority" data-value="' + l + '" aria-pressed="' + (u.priority === l) + '">' + esc(PRIORITY[l].label) + '</button>';
    body = '<div class="sort-picks sort-flags" role="group" aria-label="Priority">' + PRIORITY_ORDER.map(flag).join('')
      + (isThought ? '' : '<button type="button" class="sort-flag none' + (!u.priority ? ' on' : '') + '" data-action="pick-set" data-scope="sort" data-field="priority" data-value="none" aria-pressed="' + !u.priority + '">None</button>') + '</div>';
    if (isThought && !u.priority) { next = stamp('Next', { disabled: true }); blocked = 'Pick a priority to go on.'; }
  } else if (step === 3) body = labelsStep(c);
  else if (step === 4) body = dueStep(c, now);
  else if (step >= 5 && step <= 8) body = tieStep(c, ['parent', 'subtasks', 'waitsOn', 'holdsUp'][step - 5]);
  else if (step === LAST_STEP) {
    const ready = !isThought || (project && u.priority);
    const label = 'Save to ' + (project ? project.name : '…');
    const save = isThought
      ? stamp(label, { action: 'unsorted-file', attrs: ' data-inbox="' + cur.item.id + '"', disabled: !ready })
      : stamp(label, { action: 'unsorted-save', attrs: ' ' + c.ids, disabled: !ready });
    return bar + board(receipt(c) + (ready ? '' : why(!project ? 'Choose a project first.' : 'Pick a priority first.')), false, STEP_TITLES[9]) + foot([back(), save]) + drawer;
  }
  return bar + board(body + why(u.why || blocked) + '<div class="sr-only" id="tray-live" aria-live="polite"></div>', true, STEP_TITLES[step]) + foot([back()].concat(canSkip(step) ? [skip()] : [], [next])) + drawer;
}
