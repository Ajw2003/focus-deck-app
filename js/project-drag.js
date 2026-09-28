// focus-deck-app/js/project-drag.js
// Dragging projects into order (PR 9). Pointer events only (mouse, touch and pen through one code
// path, no drag library), plus the keyboard equivalents. This file owns the gesture and the
// on-screen feedback (ghost, dashed placeholder, drop indicator, auto-scroll); it decides nothing
// about the order itself -- on a drop or an arrow key it calls `move(id, toIndex, orderedIds)`,
// which app.js wires to project-filter.js's moveProject + a save + a repaint.
// See docs/4-systems/styling.md#dragging-projects and docs/6-decisions/Decisions.md
// ("How dragging projects works (PR 9)").

const MOUSE_SLOP = 4;       // px the mouse moves with the button down before a drag starts
const TOUCH_SLOP = 8;       // px a finger may drift during the hold before it counts as a scroll
const TOUCH_HOLD_MS = 350;  // press-and-hold before a touch drag starts
const EDGE = 70;            // px from an edge where auto-scroll kicks in
const MAX_SCROLL = 22;      // px per frame at the very edge

let drag = null;     // the drag in progress, once it has started
let pending = null;  // a press that may still become a drag
let suppressClick = false;

export function isDragging() { return !!drag; }

// What a handle belongs to: the card (grip) or the sidebar row, the sibling items it can be
// reordered among, and their project ids in displayed order.
function groupFor(handle) {
  if (handle.classList.contains('task-grip')) {
    // a task row (PR 11): what it can be dropped on is worked out from the pointer, not from a fixed
    // list of siblings (taskTargetAt), so the group only names the row itself
    const item = handle.closest('.task-row');
    return item ? { kind: 'task', item } : null;
  }
  if (handle.classList.contains('drag-grip')) {
    const item = handle.closest('.project-card');
    if (!item) return null;
    const items = Array.from(item.parentElement.children).filter((el) => el.classList.contains('project-card'));
    return { kind: 'card', item, items, ids: items.map((el) => el.id.replace(/^proj-/, '')), gap: 16 };
  }
  const item = handle.closest('li');
  const list = item && item.parentElement;
  if (!list) return null;
  const items = Array.from(list.children).filter((li) => li.querySelector('.sidebar-project'));
  return { kind: 'row', item, items, ids: items.map((li) => li.querySelector('.sidebar-project').getAttribute('data-project')), gap: 2 };
}

const nameOf = (group, i) => {
  const el = group.items[i].querySelector(group.kind === 'card' ? 'h3' : '.sidebar-name');
  return el ? el.textContent.trim() : 'Project';
};

function scrollParent(el) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

// Where a dragged task would land, from the pointer alone (PR 11). The card under the pointer is
// the project; a minimised card takes the task at the top of its "Up next"; on an open card the
// task group under the pointer (or the nearest one) is the target, and the slot is the number of the
// group's other rows whose middle is above the pointer. `orderedIds` are those other rows, in order.
function taskTargetAt(d) {
  const none = { none: true, noop: true, box: null, hilite: null };
  const el = document.elementFromPoint(d.px, d.py);
  const card = el && el.closest ? el.closest('.project-card') : null;
  if (!card) return none;
  const projectId = card.id.replace(/^proj-/, '');
  if (card.classList.contains('is-collapsed')) {
    return { projectId, status: 'next', toIndex: 0, orderedIds: [], noop: false, box: null, hilite: card };
  }
  const groups = Array.from(card.querySelectorAll('.task-group[data-group]'));
  if (!groups.length) return none;
  let group = el.closest('.task-group[data-group]');
  if (!group || !card.contains(group)) {
    let best = Infinity;
    groups.forEach((g) => {
      const r = g.getBoundingClientRect();
      const dist = d.py < r.top ? r.top - d.py : (d.py > r.bottom ? d.py - r.bottom : 0);
      if (dist < best) { best = dist; group = g; }
    });
  }
  const all = Array.from(group.querySelectorAll('.task-row'));
  const rows = all.filter((r) => r !== d.group.item);
  const slot = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2 < d.py; }).length;
  const status = group.getAttribute('data-group');
  const sameSpot = card.id === 'proj-' + d.fromProjectId && all.includes(d.group.item) && all.indexOf(d.group.item) === slot;
  let box = null;
  if (rows.length) {
    const g = group.getBoundingClientRect();
    const y = slot < rows.length ? rows[slot].getBoundingClientRect().top : rows[rows.length - 1].getBoundingClientRect().bottom;
    box = { left: g.left, top: y - 1.5, width: g.width, height: 3 };
  }
  return {
    projectId, status, toIndex: slot, orderedIds: rows.map((r) => r.getAttribute('data-task')), noop: sameSpot,
    box: sameSpot ? null : box, hilite: (rows.length || sameSpot) ? null : group,
  };
}

// Which slot (0..n) the pointer is over, among the group's items, and where to draw the indicator.
function targetAt(group, px, py) {
  const rects = group.items.map((el) => el.getBoundingClientRect());
  let near = 0;
  let best = Infinity;
  rects.forEach((r, i) => {
    const dx = px < r.left ? r.left - px : (px > r.right ? px - r.right : 0);
    const dy = py < r.top ? r.top - py : (py > r.bottom ? py - r.bottom : 0);
    const d = dx * dx + dy * dy;
    if (d < best) { best = d; near = i; }
  });
  const r = rects[near];
  // side by side (the tile grid) -> compare left/right; stacked (list, phone) -> above/below
  const sideBySide = rects.some((o, i) => i !== near && Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) > Math.min(o.height, r.height) / 2);
  const after = sideBySide ? px > r.left + r.width / 2 : py > r.top + r.height / 2;
  const slot = near + (after ? 1 : 0);
  const from = group.items.indexOf(group.item);
  const toIndex = slot > from ? slot - 1 : slot;
  const half = group.gap / 2;
  const box = sideBySide
    ? { left: (after ? r.right + half : r.left - half) - 1.5, top: r.top, width: 3, height: r.height }
    : { left: r.left, top: (after ? r.bottom + half : r.top - half) - 1.5, width: r.width, height: 3 };
  return { toIndex, from, box, noop: toIndex === from };
}

function makeGhost(group, rect) {
  const src = group.kind === 'row' ? group.item.querySelector('.sidebar-project') : group.item;
  const ghost = src.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  ghost.querySelectorAll('[data-action]').forEach((n) => n.removeAttribute('data-action'));
  ghost.classList.add('drag-ghost', 'is-' + group.kind);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('tabindex', '-1');
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  // a card ghost lives inside the main column so the "All" view's tile rules still style it; a
  // row ghost goes on <body> because the drawer is transformed, which would re-anchor a fixed child
  // (as does a task ghost: it is styled by its own classes, not by the tile rules)
  (group.kind === 'card' ? (group.item.closest('.main-col') || document.body) : document.body).appendChild(ghost);
  return ghost;
}

function beginDrag(opts) {
  const p = pending;
  if (!p) return;
  const group = groupFor(p.handle);
  if (!group) { endPending(); return; }
  const rect = group.item.getBoundingClientRect();
  drag = {
    group, id: p.id, fromProjectId: p.handle.getAttribute('data-project'), pointerId: p.pointerId, handle: p.handle, px: p.px, py: p.py,
    offX: p.px - rect.left, offY: p.py - rect.top, ghost: makeGhost(group, rect),
    indicator: document.createElement('div'), raf: 0, scroller: group.kind === 'row' ? scrollParent(group.item) : null,
  };
  drag.indicator.className = 'drop-indicator';
  drag.indicator.hidden = true;
  document.body.appendChild(drag.indicator);
  group.item.classList.add('drag-placeholder');
  document.body.classList.add('is-dragging');
  if (group.kind === 'task') document.body.classList.add('is-dragging-task'); // shows the empty groups' "Drop here"
  try { p.handle.setPointerCapture(p.pointerId); } catch (e) { /* the window listeners still see the pointer */ }
  if (navigator.vibrate && p.pointerType === 'touch') { try { navigator.vibrate(12); } catch (e) { /* not available */ } }
  clearTimeout(p.timer);
  pending = null;
  frame(opts);
}

function updateVisuals() {
  const d = drag;
  d.ghost.style.transform = 'translate(' + (d.px - d.offX) + 'px,' + (d.py - d.offY) + 'px) rotate(-.6deg)';
  const t = d.group.kind === 'task' ? taskTargetAt(d) : targetAt(d.group, d.px, d.py);
  d.target = t;
  if (d.hilite !== t.hilite) {
    if (d.hilite) d.hilite.classList.remove('drop-target');
    if (t.hilite) t.hilite.classList.add('drop-target');
    d.hilite = t.hilite || null;
  }
  d.indicator.hidden = t.noop || !t.box;
  if (!t.noop && t.box) {
    d.indicator.style.left = t.box.left + 'px';
    d.indicator.style.top = t.box.top + 'px';
    d.indicator.style.width = t.box.width + 'px';
    d.indicator.style.height = t.box.height + 'px';
  }
}

// One animation frame while dragging: auto-scroll near an edge, then redraw ghost + indicator.
function frame(opts) {
  if (!drag) return;
  const d = drag;
  const speed = (dist) => Math.round(MAX_SCROLL * Math.min(1, Math.max(0, (EDGE - dist) / EDGE)));
  let top = 0;
  let bottom = window.innerHeight;
  if (d.scroller) { const r = d.scroller.getBoundingClientRect(); top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); }
  const topbar = document.querySelector('.topbar');
  if (!d.scroller && topbar) top = topbar.getBoundingClientRect().bottom;
  // A dragged task over a tile's own scroll area (.project-body) scrolls that first, when it is near
  // its top or bottom edge and has room to move that way; otherwise the page scrolls as usual.
  if (d.group.kind === 'task') {
    const under = document.elementFromPoint(d.px, d.py);
    const body = under && under.closest ? under.closest('.project-body') : null;
    if (body && body.scrollHeight > body.clientHeight + 1) {
      const r = body.getBoundingClientRect();
      let by = 0;
      if (d.py < r.top + EDGE) by = -speed(d.py - r.top);
      else if (d.py > r.bottom - EDGE) by = speed(r.bottom - d.py);
      const room = by < 0 ? body.scrollTop > 0 : body.scrollTop + body.clientHeight < body.scrollHeight - 1;
      if (by && room) { body.scrollTop += by; updateVisuals(); d.raf = requestAnimationFrame(() => frame(opts)); return; }
    }
  }
  let dy = 0;
  if (d.py < top + EDGE) dy = -speed(d.py - top);
  else if (d.py > bottom - EDGE) dy = speed(bottom - d.py);
  if (dy) {
    if (d.scroller) d.scroller.scrollTop += dy;
    else window.scrollBy(0, dy);
  }
  updateVisuals();
  d.raf = requestAnimationFrame(() => frame(opts));
}

function teardown() {
  const d = drag;
  drag = null;
  if (!d) return;
  cancelAnimationFrame(d.raf);
  d.ghost.remove();
  d.indicator.remove();
  d.group.item.classList.remove('drag-placeholder');
  if (d.hilite) d.hilite.classList.remove('drop-target');
  document.body.classList.remove('is-dragging', 'is-dragging-task');
  try { d.handle.releasePointerCapture(d.pointerId); } catch (e) { /* already released */ }
}

function endPending() {
  if (pending) clearTimeout(pending.timer);
  pending = null;
}

const GROUP_LABEL = { doing: 'In progress', next: 'Up next' };

// ArrowUp/ArrowDown on a task's grip (PR 11): one place within its group, crossing into the
// neighbouring group at the ends (Up next's top -> In progress's bottom, and back). Moving to
// another project is drag only.
function keyboardTaskMove(e, grip, opts) {
  const delta = e.altKey || e.ctrlKey || e.metaKey ? 0 : ({ ArrowUp: -1, ArrowDown: 1 }[e.key] || 0);
  if (!delta) return;
  e.preventDefault();
  const card = grip.closest('.project-card');
  const row = grip.closest('.task-row');
  if (!card || !row) return;
  const taskId = grip.getAttribute('data-task');
  const projectId = grip.getAttribute('data-project');
  const ids = { doing: [], next: [] };
  card.querySelectorAll('.task-group[data-group]').forEach((g) => {
    ids[g.getAttribute('data-group')] = Array.from(g.querySelectorAll('.task-row')).map((r) => r.getAttribute('data-task'));
  });
  const from = ['doing', 'next'].find((g) => ids[g].includes(taskId));
  if (!from) return;
  const i = ids[from].indexOf(taskId);
  const titleEl = row.querySelector('.task-title');
  const title = titleEl ? titleEl.textContent.trim() : 'Task';
  let status = from;
  let toIndex = i + delta;
  if (toIndex < 0) {
    if (from === 'next') { status = 'doing'; toIndex = ids.doing.length; }
    else { opts.announce(title + ' is already first'); return; }
  } else if (toIndex >= ids[from].length) {
    if (from === 'doing') { status = 'next'; toIndex = 0; }
    else { opts.announce(title + ' is already last'); return; }
  }
  const others = ids[status].filter((id) => id !== taskId);
  if (!opts.moveTask({ taskId, fromProjectId: projectId, toProjectId: projectId, status, toIndex, orderedIds: others })) return;
  const again = document.querySelector('.task-grip[data-task="' + taskId + '"]');
  if (again) again.focus();
  opts.announce(title + ' moved to ' + GROUP_LABEL[status] + ', position ' + (toIndex + 1) + ' of ' + (others.length + 1));
}

export function initProjectDrag(app, opts) {
  // opts.move(id, toIndex, orderedIds) -> true when the order changed (and was saved + repainted)
  // opts.announce(text) speaks to screen readers; opts.onEnd() runs after every drag, moved or not
  const finish = (commit) => {
    const d = drag;
    if (!d) return;
    const isTask = d.group.kind === 'task';
    const t = isTask ? taskTargetAt(d) : (d.target || targetAt(d.group, d.px, d.py));
    const ids = d.group.ids;
    const id = d.id;
    const fromProjectId = d.fromProjectId;
    teardown();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (isTask) {
      // moveTask(...) may open a confirmation first (a move that touches GitHub), so onEnd -- which
      // repaints anything that arrived mid-drag -- runs either way
      if (commit && !t.noop && !t.none) opts.moveTask({ taskId: id, fromProjectId, toProjectId: t.projectId, status: t.status, toIndex: t.toIndex, orderedIds: t.orderedIds });
    } else if (commit && !t.noop) opts.move(id, t.toIndex, ids);
    opts.onEnd();
  };

  app.addEventListener('pointerdown', (e) => {
    if (drag || pending) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const handle = e.target.closest && e.target.closest('.drag-grip, .task-grip, .sidebar-project');
    if (!handle || !handle.getAttribute('data-project')) return;
    const isTaskGrip = handle.classList.contains('task-grip');
    pending = { handle, id: isTaskGrip ? handle.getAttribute('data-task') : handle.getAttribute('data-project'), pointerId: e.pointerId, pointerType: e.pointerType, px: e.clientX, py: e.clientY, x0: e.clientX, y0: e.clientY, timer: 0 };
    if (e.pointerType === 'touch') pending.timer = setTimeout(() => beginDrag(opts), TOUCH_HOLD_MS);
  });

  window.addEventListener('pointermove', (e) => {
    if (drag) {
      if (e.pointerId !== drag.pointerId) return;
      drag.px = e.clientX; drag.py = e.clientY;
      e.preventDefault();
      return;
    }
    if (!pending || e.pointerId !== pending.pointerId) return;
    pending.px = e.clientX; pending.py = e.clientY;
    const moved = Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0);
    if (pending.pointerType === 'touch') { if (moved > TOUCH_SLOP) endPending(); } // a scroll, not a drag
    else if (moved > MOUSE_SLOP) beginDrag(opts);
  });

  window.addEventListener('pointerup', (e) => {
    if (drag && e.pointerId === drag.pointerId) { drag.px = e.clientX; drag.py = e.clientY; drag.target = null; finish(true); return; }
    if (pending && e.pointerId === pending.pointerId) endPending(); // a plain click or tap: leave it alone
  });
  window.addEventListener('pointercancel', (e) => {
    if (drag && e.pointerId === drag.pointerId) finish(false);
    else if (pending && e.pointerId === pending.pointerId) endPending();
  });

  // Escape aborts, and is swallowed so it doesn't also close the phone drawer
  document.addEventListener('keydown', (e) => {
    if (drag && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
  }, true);

  // once a touch drag has started the page must not scroll under the finger (touch-action can't be
  // changed mid-gesture, so this listener has to be non-passive)
  document.addEventListener('touchmove', (e) => { if (drag && e.cancelable) e.preventDefault(); }, { passive: false });
  // a long press shouldn't raise the browser's context menu on the row being held
  document.addEventListener('contextmenu', (e) => { if (drag || (pending && pending.pointerType === 'touch')) e.preventDefault(); });
  // the click that follows a drag's pointerup must not also select/scroll to the row
  document.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);

  // Keyboard: on a grip, the arrow keys; on a sidebar row, Alt + Up/Down.
  app.addEventListener('keydown', (e) => {
    const taskGrip = e.target.closest && e.target.closest('.task-grip');
    if (taskGrip) { keyboardTaskMove(e, taskGrip, opts); return; }
    const grip = e.target.closest && e.target.closest('.drag-grip');
    const row = e.target.closest && e.target.closest('.sidebar-project');
    let handle = null;
    let delta = 0;
    if (grip && !e.altKey && !e.ctrlKey && !e.metaKey) {
      delta = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key] || 0;
      handle = grip;
    } else if (row && e.altKey && !e.ctrlKey && !e.metaKey) {
      delta = { ArrowUp: -1, ArrowDown: 1 }[e.key] || 0;
      handle = row;
    }
    if (!handle || !delta) return;
    e.preventDefault();
    const group = groupFor(handle);
    if (!group) return;
    const id = handle.getAttribute('data-project');
    const from = group.ids.indexOf(id);
    const to = from + delta;
    if (from === -1) return;
    if (to < 0 || to >= group.ids.length) { opts.announce(nameOf(group, from) + ' is already ' + (to < 0 ? 'first' : 'last')); return; }
    const name = nameOf(group, from);
    const kind = group.kind;
    if (!opts.move(id, to, group.ids)) return;
    const again = document.querySelector(kind === 'card' ? '.drag-grip[data-project="' + id + '"]' : '.project-sidebar .sidebar-project[data-project="' + id + '"]');
    if (again) again.focus();
    opts.announce(name + ' moved to position ' + (to + 1) + ' of ' + group.ids.length);
  });
}
