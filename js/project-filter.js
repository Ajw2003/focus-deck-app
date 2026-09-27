// focus-deck-app/js/project-filter.js
// Pure, synchronous — filtering/sorting the projects grid. Takes the project list and view
// options as plain arguments (no state.js import) so it's directly unit-testable, the same way
// mergeStates and the GitHub label heuristics already are.

function openTaskCount(p) { return p.tasks.filter((t) => t.status !== 'done').length; }

function closestDeadlineMs(p) {
  const dates = p.tasks.filter((t) => t.status !== 'done' && t.deadline).map((t) => new Date(t.deadline + 'T00:00:00').getTime());
  if (p.deadline) dates.push(new Date(p.deadline + 'T00:00:00').getTime());
  return dates.length ? Math.min(...dates) : Infinity;
}

export function sortProjects(list, sortBy) {
  const sorted = list.slice();
  if (sortBy === 'open-tasks') {
    sorted.sort((a, b) => openTaskCount(b) - openTaskCount(a));
  } else if (sortBy === 'deadline') {
    sorted.sort((a, b) => closestDeadlineMs(a) - closestDeadlineMs(b));
  } else if (sortBy === 'recent-sync') {
    sorted.sort((a, b) => {
      const aTime = a.source === 'github' && a.lastSyncedAt ? a.lastSyncedAt : -1;
      const bTime = b.source === 'github' && b.lastSyncedAt ? b.lastSyncedAt : -1;
      if (aTime !== bTime) return bTime - aTime; // most recently synced first
      return a.name.localeCompare(b.name); // ties (including all-manual) fall back to name
    });
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
  return sorted;
}

export function filterAndSortProjects(projects, { categoryId, query, sortBy } = {}) {
  let list = projects;
  if (categoryId !== undefined) list = list.filter((p) => (p.categoryId || null) === categoryId);
  if (query) list = list.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  return sortProjects(list, sortBy);
}

// Wide screens show one project at a time (Q22b, Q23a, #82): the one last opened on this device,
// or, the first time (or if it's gone), the project with the most open tasks — ties broken by the
// current sort order, which the caller has already applied to `projects`. Pure so it's directly
// testable; app.js supplies the persisted id and the sorted project list.
export function resolveSelectedProject(projects, storedId) {
  if (!projects.length) return null;
  if (storedId && projects.some((p) => p.id === storedId)) return storedId;
  const busiest = sortProjects(projects, 'open-tasks')[0];
  return busiest.id;
}
