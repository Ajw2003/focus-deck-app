// focus-deck-app/js/in-tray-view.js
// The Unsorted in-tray's markup: torn-off jotter slips on a small stack in a tray. The top slip
// shows the folder it is going in and the category flags stuck on its edge; below it a folder wallet
// (a thought only; a task is already in its project) and an index-card wallet of flags, then
// "File it". The wallets are js/wallet.js's, so they follow the "Choosing a card" setting. What each
// action does is in js/in-tray.js and js/app.js. See docs/4-systems/in-tray.md
import { esc, relTime } from './state.js';
import { CHOOSING_MODE_INFO, wording } from './wallet.js';
import { orderTray, flagCards, folderCards, pickedSlips, bulkBlocker } from './in-tray.js';
import { canWaitOn, subtasksOf } from './task-links.js';
import { sleeve, walletInner, mutedChip, focusChoosingMode, unsortedQueue } from './render.js';

function slipFlags(cards, selected) {
  return selected.map((token) => cards.find((c) => c.token === token)).filter(Boolean)
    .map((c) => '<span class="slip-flag" title="' + esc(c.name) + '" style="--c:' + mutedChip(c.color) + '">' + esc(c.name) + '</span>').join('');
}

// Part 3 (see docs/4-systems/task-links.md): the ties as small folder-coloured tags, "+ Add" opens a task search.
const allTasks = (st) => st.projects.flatMap((p) => p.tasks.map((t) => ({ t, p })));
function linkStep(st, u, project, tid) {
  const f = (k) => u[k] || [];
  const find = (id) => allTasks(st).find((x) => x.t.id === id);
  const tag = (id, field) => {
    const x = find(id);
    return x ? '<span class="link-tag" style="--c:' + x.p.color + '">' + esc(x.t.title) + (x.p.id !== project.id ? ' <small>· ' + esc(x.p.name) + '</small>' : '')
      + '<button type="button" data-action="tie-remove" data-field="' + field + '" data-id="' + id + '" aria-label="Untie">×</button></span>' : '';
  };
  const newTag = (title, i) => '<span class="link-tag" style="--c:' + project.color + '">' + esc(title) + ' <small>· new</small>'
    + '<button type="button" data-action="tie-remove" data-field="newSubtasks" data-id="' + i + '" aria-label="Remove">×</button></span>';
  const taskFind = (field) => {
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
    const hits = allTasks(st).filter(ok).filter(({ t, p }) => !q || t.title.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)).slice(0, 6);
    return '<div class="task-find"><input class="sort-find" data-tie-find value="' + esc(u.pickQuery || '') + '" placeholder="Find a task ' + (inFolder ? 'in ' + esc(project.name) : 'in any project') + '…" aria-label="Find a task">'
      + hits.map(({ t, p }) => '<button type="button" class="task-hit" data-action="tie-add" data-field="' + field + '" data-id="' + t.id + '"><span class="dot" style="--c:' + p.color + '"></span>' + esc(t.title) + '<span class="muted small">' + esc(p.name) + '</span></button>').join('')
      + (!hits.length ? '<p class="muted small">No task matches.</p>' : '')
      + (field === 'subtasks' && (u.pickQuery || '').trim() ? '<button type="button" class="task-hit" data-action="tie-new-sub"><b>+ New subtask</b>&nbsp;“' + esc(u.pickQuery.trim()) + '”</button>' : '')
      + '</div>';
  };
  const row = (label, field) => {
    const tags = field === 'parent' ? (u.parent ? [tag(u.parent, 'parent')] : []) : f(field).map((id) => tag(id, field));
    if (field === 'subtasks') (u.newSubtasks || []).forEach((s, i) => tags.push(newTag(s, i)));
    return '<div class="link-row"><span class="muted small">' + label + '</span>' + tags.join('')
      + (field !== 'parent' || !u.parent ? '<button type="button" class="link-add" data-action="tie-open" data-field="' + field + '">+ Add</button>' : '') + '</div>'
      + (u.picking === field ? taskFind(field) : '');
  };
  return '<div class="links-step"><h4>Inside ' + esc(project.name) + '</h4>' + row('Part of', 'parent') + row('Subtasks', 'subtasks')
    + '<h4>Across all projects</h4>' + row('Waits on', 'waitsOn') + row('Holds up', 'holdsUp') + '</div>';
}

const has = (name, q) => !q || name.toLowerCase().includes(q.toLowerCase());

// The step bar: three tabs, the finished ones can be tapped to go back, later ones are off.
// Every tab can be tapped while its step is allowed; with no folder yet, steps 2 and 3 stay locked
// (aria-disabled, not disabled, so a tap can say why).
export const STEP_LOCKED_WHY = 'Choose a project first. Labels and links open once the thought has a project.';
function stepBar(step, folder, flagNames, why) {
  const tab = (n, label, summary) => '<button type="button" class="step-tab' + (n === step ? ' now' : n < step ? ' done' : '') + (n > 1 && !folder ? ' locked' : '') + '" data-action="sort-step" data-step="' + n + '"' + (n > 1 && !folder ? ' aria-disabled="true"' : '') + '><b>' + n + '. ' + label + '</b><small>' + (n <= step ? esc(summary) : '') + '</small></button>';
  return '<div class="step-bar">' + tab(1, 'Choose a project', folder ? folder.name : '') + tab(2, 'Add labels', flagNames.join(', ')) + tab(3, 'Link to other tasks', 'optional') + '</div>' + (why ? '<p class="step-why" role="status">' + esc(why) + '</p>' : '');
}

function trayWallets(st, u, project, step, allCards, mode, tid) {
  const hint = wording(CHOOSING_MODE_INFO[mode].hint, 'use');
  const q = u.find || '';
  let html = '';
  if (step === 1) {
    const folders = folderCards(st).filter((f) => has(f.name, q));
    if (!st.projects.length) {
      html += '<p class="muted small">Add a project below to file this thought into.</p>';
    } else {
      html += '<input type="text" class="sort-find" value="' + esc(q) + '" placeholder="Find a project…" aria-label="Find a project">';
      if (folders.length) {
        const items = folders.map((f) => {
          const picked = !!project && f.id === project.id;
          const detail = picked ? 'chosen' : f.open + ' open';
          return sleeve({ key: f.id, name: f.name, color: f.color, kind: 'project', picked, detail, speak: f.name + ', ' + (picked ? 'chosen. Choose it again to clear.' : detail) });
        });
        const facing = folders.some((f) => f.id === u.facingFolder) ? u.facingFolder : (project && folders.some((f) => f.id === project.id) ? project.id : folders[0].id);
        html += '<div class="wallet" id="tray-folder-wallet">' + walletInner({ wallet: 'tray-folders', label: '', aria: 'Projects. Arrow keys flip, Enter chooses or clears.', items, facing, mode, verb: 'use' }) + '</div>';
      } else {
        html += '<p class="muted small find-empty">No project matches “' + esc(q) + '”.</p>';
      }
    }
  } else if (step === 2) {
    const cards = flagCards(st, project, { selected: u.selected, showAll: !!u.showAllFlags || !!q }).filter((c) => q ? !c.more && has(c.name, q) : true);
    const exact = st.categories.some((c) => c.name.toLowerCase() === q.trim().toLowerCase());
    html += '<input type="text" class="sort-find" value="' + esc(q) + '" placeholder="Find a label, or type a new one…" aria-label="Find a label">';
    if (q.trim() && !exact) html += '<button type="button" class="new-flag" data-action="sort-new-flag">+ New label “' + esc(q.trim()) + '”</button>';
    if (cards.length) {
      const items = cards.map((c) => {
        if (c.more) return sleeve({ key: c.token, name: c.name, color: c.color, detail: c.more + ' more', speak: c.more + ' more categories. Choose to show them all.' });
        const picked = u.selected.includes(c.token);
        const detail = picked ? 'label on the slip' : 'no label yet';
        return sleeve({ key: c.token, name: c.name, color: mutedChip(c.color), picked, detail, speak: c.name + ', ' + detail });
      });
      const facing = cards.some((c) => c.token === u.facingFlag) ? u.facingFlag : cards[0].token;
      html += '<div class="wallet" id="tray-flag-wallet">' + walletInner({ wallet: 'tray-flags', label: '', aria: 'Category labels. Arrow keys flip, Enter adds or removes.', items, facing, mode, verb: 'use' }) + '</div>';
    }
  } else {
    html += linkStep(st, u, project, tid);
  }
  return '<div class="wallet-root tray-wallets">' + stepBar(step, project, u.selected.map((t) => (allCards.find((c) => c.token === t) || {}).name).filter(Boolean), u.why) + html + (html.includes('flip-track') ? '<div class="flip-hint">' + hint + '</div>' : '') + '<div class="sr-only" id="tray-live" aria-live="polite"></div></div>';
}

function renderTray(st, u, ordered, mode, head = '') {
  const lip = '<div class="tray-lip"><span>To sort</span></div>';
  const cur = ordered[0];
  if (!cur) {
    return '<p class="tray-count muted small">0 to sort</p>'
      + '<div class="tray"><div class="tray-stack"><div class="tray-empty"><p>Nothing left to sort. Everything has a project.</p><p class="muted small">Jot a thought above and it lands here.</p></div></div>' + lip + '</div>';
  }
  const isThought = cur.kind === 'thought';
  const step = u.step || 1;
  // a task slip's folder is its own project until another is chosen
  const project = u.projectId ? st.projects.find((p) => p.id === u.projectId) : (isThought ? null : cur.project);
  const allCards = flagCards(st, project, { selected: u.selected, showAll: true });
  const editable = isThought || cur.task.issueNumber == null;
  const text = u.title != null ? u.title : (isThought ? cur.item.text : cur.task.title);
  const notes = u.notes != null ? u.notes : (isThought ? '' : cur.task.notes || '');
  const chip = (p) => '<span class="folder-chip" style="--c:' + p.color + '">' + esc(p.name) + '</span>';
  const dest = (project ? (isThought ? 'Going in ' : 'In ') + chip(project) : 'No project yet')
    + (!isThought && cur.task.issueNumber != null ? ' <span class="slip-issue">#' + cur.task.issueNumber + '</span>' : '');
  const when = isThought ? '<div class="slip-when">Thought · ' + relTime(cur.item.createdAt) + '</div>' : '';
  const noteBox = u.notesOpen || notes
    ? '<textarea class="slip-notes" name="slipNotes" placeholder="Notes…">' + esc(notes) + '</textarea>'
    : '<button type="button" class="slip-notes-link" data-action="sort-add-notes">+ Add notes</button>';
  const n = ordered.length;
  const ids = isThought ? 'data-inbox="' + cur.item.id + '"' : 'data-task="' + cur.task.id + '" data-project="' + cur.project.id + '"';
  const main = step === 1
    ? (project ? '<button type="button" class="file-btn" data-action="sort-next">Next: labels →</button>' : '<button type="button" class="file-btn" disabled>Choose a project first</button>')
    : step === 2 ? '<button type="button" class="file-btn" data-action="sort-next">Next: link to other tasks →</button>'
    : isThought
      ? '<button type="button" class="file-btn" data-action="unsorted-file" data-inbox="' + cur.item.id + '">File it in ' + esc(project.name) + ' →</button>'
      : '<button type="button" class="file-btn" data-action="unsorted-save" ' + ids + '>Save in ' + esc(project.name) + ' →</button>';
  // .tray-side holds the slip and its buttons: on a wide Sort screen it stays in view beside the
  // choices; on a phone it dissolves (display:contents) so the buttons come after the choices
  return '<div class="tray-side"><div class="tray-head"><p class="tray-count muted small">' + (n === 1 ? '1 to sort' : n + ' to sort') + '</p>' + head + '</div>'
    + '<div class="tray"><div class="tray-stack">'
    + (n >= 2 ? '<div class="slip-behind"></div>' : '') + (n >= 3 ? '<div class="slip-behind two"></div>' : '')
    + '<div class="jot-slip"><div class="slip-flags">' + slipFlags(allCards, u.selected) + '</div>'
    + '<p class="slip-text"' + (editable ? ' contenteditable="true" spellcheck="false" data-slip-title' : '') + '>' + esc(text) + '</p><div class="slip-dest">' + dest + '</div>' + when + noteBox + '</div>'
    + '</div>' + lip + '</div>'
    + '<div class="sort-acts">' + main
    + '<div class="sort-small">' + (step > 1 ? '<button type="button" data-action="sort-back">← Back</button>' : '')
    + '<button type="button" data-action="unsorted-complete" ' + ids + '>Done already</button>'
    + '<button type="button" data-action="unsorted-skip">Later</button>'
    + '<button type="button" data-action="unsorted-delete" ' + ids + '>Delete</button></div></div></div>'
    + trayWallets(st, u, project, step, allCards, mode, isThought ? null : cur.task.id);
}

// The top slip: the queue in tray order (slips sent to the back by "Later" come last), or null
// when the tray is empty. app.js uses its key to reset the per-slip scratch.
export function unsortedCurrent(st, u) {
  return orderTray(unsortedQueue(st), u.later)[0] || null;
}

// "Select many": every slip as a row with a tick box, then one project, labels and an optional group
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
    + folderCards(st).map((f) => '<option value="' + esc(f.id) + '"' + (f.id === b.projectId ? ' selected' : '') + '>' + esc(f.name) + '</option>').join('');
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
    + '<label class="bulk-field"><b>3. Group them under one task <span class="muted small">(optional)</span></b>'
    + '<input type="text" data-bulk-group value="' + esc(b.groupTitle || '') + '" placeholder="Name of the task to group them under…"></label>'
    + (why || b.why ? '<p class="step-why" role="status">' + esc(b.why || why) + '</p>' : '')
    + '<button type="button" class="file-btn" data-action="bulk-apply"' + (n && !why ? '' : ' disabled') + '>' + (n ? 'Sort ' + (n === 1 ? '1 item' : n + ' items') + ' →' : 'Tick items to sort') + '</button></div>'
    + '</div>';
}

// The whole Unsorted card (the replacement for render.js's renderInbox). `ui.unsorted.later` is the
// list of slips sent to the back; `ui.bulk.on` swaps the one-slip tray for the "Select many" list.
export function renderInTrayCard(st, ui) {
  const u = ui.unsorted;
  const queue = unsortedQueue(st);
  const bulkOn = !!(ui.bulk && ui.bulk.on);
  const ordered = orderTray(queue, u.later);
  const toggle = queue.length > 1 ? '<button type="button" class="bulk-switch" data-action="bulk-toggle">Select many</button>' : '';
  const body = !ui.inboxOpen ? '' : (bulkOn ? renderBulk(st, ui.bulk, ordered) : renderTray(st, u, ordered, focusChoosingMode(st), toggle));
  return '<section class="card inbox-card">'
    + '<button type="button" class="section-toggle" data-action="toggle-inbox">Sort <span class="count">' + queue.length + '</span><span class="chev">' + (ui.inboxOpen ? '−' : '+') + '</span></button>'
    + (ui.inboxOpen ? '<div class="unsorted-body">' + body + '</div>' : '')
    + '</section>';
}
