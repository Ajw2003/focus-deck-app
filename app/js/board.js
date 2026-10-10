// focus-deck-app/js/board.js -- the pure part of the Board screen (#143, part of #140).
// boardColumns(st, projectId, now) -> { next, doing, done, counts: { next, doing, done } }.
// projectId null = all projects. Next/doing keep each project's own order (sortTasks), projects in
// st.projects order. Done = tasks finished since Monday 00:00 local time, newest first.
// A task has no completedAt of its own today (setTaskStatus stamps updatedAt and a capped
// completedLog), so the finish time is task.completedAt when present, else task.updatedAt.
// There are no archived projects in state; inbox items are not tasks, so they never appear.
import { sortTasks } from './task-move.js';

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
