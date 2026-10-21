// focus-deck-app/js/board.js -- the pure part of the Board screen (#143, part of #140).
// boardColumns(st, projectId, now) -> { next, doing, done, counts: { next, doing, done } }.
// projectId null = all projects. Next/doing keep each project's own order (sortTasks), projects in
// st.projects order. Done = tasks finished since Monday 00:00 local time, newest first.
// A task has no completedAt of its own today (setTaskStatus stamps updatedAt and a capped
// completedLog), so the finish time is task.completedAt when present, else task.updatedAt.
// There are no archived projects in state; inbox items are not tasks, so they never appear.
import { sortTasks } from './task-move.js';
import { subtasksOf, holdsUp, isBlocked } from './task-links.js';

export function weekStart(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday = 0
  return d.getTime();
}

export function finishedAt(t) {
  return typeof t.completedAt === 'number' ? t.completedAt : (typeof t.updatedAt === 'number' ? t.updatedAt : 0);
}

export function boardColumns(st, projectId, now) {
  const projects = (st.projects || []).filter((p) => projectId == null || p.id === projectId);
  const since = weekStart(now);
  const next = [];
  const doing = [];
  const done = [];
  projects.forEach((p) => {
    const tasks = p.tasks || [];
    sortTasks(tasks.filter((t) => t.status === 'next')).forEach((t) => next.push(t));
    sortTasks(tasks.filter((t) => t.status === 'doing')).forEach((t) => doing.push(t));
    tasks.forEach((t) => {
      const at = finishedAt(t);
      if (t.status === 'done' && at >= since && at <= now) done.push(t);
    });
  });
  done.sort((a, b) => finishedAt(b) - finishedAt(a));
  return { next, doing, done, counts: { next: next.length, doing: doing.length, done: done.length } };
}

export const SHOW_FILTERS = ['all', 'subs', 'waits', 'holds'];

// The one visible list (#200): the tab's tasks, narrowed by project, project category, Find (task
// title, project name or label name) and Show. Subtasks of a live parent are not cards of their own.
// counts are per tab: how many cards that tab would show under the same narrowing, so they leave out
// subtasks too (#217). -> { tasks, counts }
export function boardList(st, opts, now) {
  const o = opts || {};
  const cols = boardColumns(st, null, now);
  const owner = new Map();
  (st.projects || []).forEach((p) => (p.tasks || []).forEach((t) => owner.set(t.id, p)));
  const top = (t) => !(t.parentId && owner.has(t.parentId));
  const q = String(o.find || '').trim().toLowerCase();
  const labelName = (id) => ((st.categories || []).find((c) => c.id === id) || {}).name || '';
  const shown = (t) => {
    const p = owner.get(t.id);
    if (o.project && p.id !== o.project) return false;
    if (o.pcat && p.categoryId !== o.pcat) return false;
    if (q && !(t.title.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      || (t.categoryIds || []).some((id) => labelName(id).toLowerCase().includes(q)))) return false;
    if (o.show === 'subs' && !subtasksOf(st.projects, t.id).length) return false;
    if (o.show === 'waits' && !(t.status !== 'done' && isBlocked(st.projects, t.id))) return false;
    if (o.show === 'holds' && !holdsUp(st.projects, t.id).length) return false;
    return true;
  };
  const tab = (k) => cols[k].filter(top).filter(shown);
  const counts = { next: tab('next').length, doing: tab('doing').length, done: tab('done').length };
  const tasks = tab(cols[o.tab] ? o.tab : 'next');
  return { tasks, counts };
}
