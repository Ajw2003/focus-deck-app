// focus-deck-app/js/task-links.js
// The rules for a task's ties to other tasks (parentId, waitsOn), with no DOM and no state: every
// function takes the projects array. Links to ids that no longer exist are ignored when read.
// See docs/4-systems/task-links.md
import { esc } from './state.js';
const all = (projects) => projects.flatMap((p) => p.tasks.map((t) => ({ t, p })));
const find = (projects, id) => all(projects).find((x) => x.t.id === id);
const live = (projects, ids) => (ids || []).filter((id) => find(projects, id));

export function subtasksOf(projects, taskId) {
  return all(projects).filter((x) => x.t.parentId === taskId).map((x) => x.t);
}

// open tasks whose waitsOn includes this one ("holds up" is never stored)
export function holdsUp(projects, taskId) {
  return all(projects).filter((x) => x.t.status !== 'done' && (x.t.waitsOn || []).includes(taskId)).map((x) => x.t);
}

// same project, not itself, the child has no subtasks, the parent is not itself a subtask
export function canSetParent(projects, childId, parentId) {
  const c = find(projects, childId), p = find(projects, parentId);
  if (!c || !p || childId === parentId || c.p.id !== p.p.id) return false;
  if (subtasksOf(projects, childId).length) return false;
  return !(p.t.parentId && find(projects, p.t.parentId));
}

// "taskId waits on otherId": not itself, and otherId doesn't already wait (through any chain) on taskId
export function canWaitOn(projects, taskId, otherId) {
  if (taskId === otherId || !find(projects, otherId)) return false;
  const seen = new Set(), todo = [otherId];
  while (todo.length) {
    const id = todo.pop();
    if (id === taskId) return false;
    if (seen.has(id)) continue;
    seen.add(id);
    const x = find(projects, id);
    if (x) todo.push(...(x.t.waitsOn || []));
  }
  return true;
}

// the task is gone: drop its id from every parentId and waitsOn. Returns whether anything changed.
export function dropLinksTo(projects, deletedId) {
  let changed = false;
  all(projects).forEach(({ t }) => {
    if (t.parentId === deletedId) { delete t.parentId; changed = true; }
    if ((t.waitsOn || []).includes(deletedId)) {
      t.waitsOn = t.waitsOn.filter((id) => id !== deletedId);
      if (!t.waitsOn.length) delete t.waitsOn;
      changed = true;
    }
  });
  return changed;
}

// moving to another project: the task leaves its parent and its subtasks leave it
export function detachForMove(projects, taskId) {
  const subs = subtasksOf(projects, taskId);
  subs.forEach((s) => { delete s.parentId; });
  const x = find(projects, taskId);
  const had = !!(x && x.t.parentId);
  if (had) delete x.t.parentId;
  return had || subs.length > 0;
}

// a slip's existing ties as the sort screen's scratch fields (dangling ids left out)
export function tiesOf(projects, taskId) {
  const x = find(projects, taskId);
  if (!x) return { parent: null, subtasks: [], waitsOn: [], holdsUp: [] };
  const parent = find(projects, x.t.parentId) ? x.t.parentId : null;
  return { parent, subtasks: subtasksOf(projects, taskId).map((t) => t.id), waitsOn: live(projects, x.t.waitsOn), holdsUp: holdsUp(projects, taskId).map((t) => t.id) };
}

const isOpen = (x) => x && x.t.status !== 'done';

// can't start yet: waits on an existing open task, or has an open subtask
export function isBlocked(projects, taskId) {
  const x = find(projects, taskId);
  return live(projects, x && x.t.waitsOn).some((id) => isOpen(find(projects, id)))
    || subtasksOf(projects, taskId).some((s) => s.status !== 'done');
}

// how many open tasks finishing this one frees: those waiting on it, plus its parent if it has one
export function unblockCount(projects, taskId) {
  const x = find(projects, taskId);
  return holdsUp(projects, taskId).length + (x && isOpen(find(projects, x.t.parentId)) ? 1 : 0);
}

// the ids the focus pick may start from: unblocked ones with the most unblocked, or all of them
// (allBlocked) when every one is waiting on something
export function rankFocusPool(projects, ids) {
  const free = ids.filter((id) => !isBlocked(projects, id));
  if (!free.length) return { candidates: ids, allBlocked: true };
  const n = free.map((id) => unblockCount(projects, id)), top = Math.max(...n);
  return { candidates: free.filter((_, i) => n[i] === top), allBlocked: false };
}

// the parts of a task's tie line: parent (Board only), subtask counts, open waits-on (with the other
// folder's name when it differs), holds-up count; isWaiting = open and blocked. Empty parts = no line.
export function tieSummary(projects, taskId, { showParent = false } = {}) {
  const x = find(projects, taskId);
  if (!x) return { parent: null, subs: null, waits: [], holds: 0, isWaiting: false };
  const par = showParent ? find(projects, x.t.parentId) : null;
  const subs = subtasksOf(projects, taskId);
  const waits = live(projects, x.t.waitsOn).map((id) => find(projects, id)).filter(isOpen)
    .map((w) => ({ id: w.t.id, title: w.t.title, folder: w.p.id !== x.p.id ? w.p.name : null }));
  return {
    parent: par ? { id: par.t.id, title: par.t.title } : null,
    subs: subs.length ? { total: subs.length, done: subs.filter((s) => s.status === 'done').length } : null,
    waits, holds: holdsUp(projects, taskId).length,
    isWaiting: isOpen(x) && isBlocked(projects, taskId),
  };
}

// the .tie-line markup for a summary ('' when there is nothing to say); task names are buttons
export function tieLineHtml(s) {
  const name = (id, title) => '<button type="button" class="tie-name" data-action="scroll-to-task" data-task="' + esc(id) + '">' + esc(title) + '</button>';
  const parts = [];
  if (s.parent) parts.push('<span class="tie">\u21b3 in ' + name(s.parent.id, s.parent.title) + '</span>');
  if (s.subs) parts.push('<span class="tie">' + s.subs.total + (s.subs.total === 1 ? ' subtask' : ' subtasks') + ' \u00b7 ' + s.subs.done + ' done</span>');
  s.waits.forEach((w) => parts.push('<span class="tie wait">waits on ' + name(w.id, w.title) + (w.folder ? ' \u00b7 ' + esc(w.folder) : '') + '</span>'));
  if (s.holds) parts.push('<span class="tie hold">holds up ' + s.holds + '</span>');
  return parts.length ? '<span class="tie-line">' + parts.join('') + '</span>' : '';
}
