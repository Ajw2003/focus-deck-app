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
  } else if (sortBy === 'custom') {
    // the person's own order (PR 9): ascending sortOrder; a project without one (not yet through
    // ensureSortOrder) goes last, ties fall back to name so the order is always deterministic
    const key = (p) => (hasSortOrder(p) ? p.sortOrder : Infinity);
    sorted.sort((a, b) => (key(a) === key(b) ? a.name.localeCompare(b.name) : (key(a) < key(b) ? -1 : 1)));
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
  return sorted;
}

// Custom order (PR 9, docs/6-decisions/Decisions.md "How dragging projects works"): each project
// carries its own numeric `sortOrder`, and moving one project changes only that project's number,
// so the per-record newest-wins Gist merge carries a move without any special code. See
// docs/4-systems/gist-sync.md#sortorder.
const hasSortOrder = (p) => typeof p.sortOrder === 'number' && Number.isFinite(p.sortOrder);

// A gap narrower than this between two neighbours can't be split reliably (floating precision
// after many moves into the same gap), so the move renumbers every project 1..n instead.
export const MIN_SORT_GAP = 1e-6;

// Gives every project without a sortOrder a position after the current maximum, in the current
// array order (so old data keeps the order it was stored in, and a new project goes to the end).
// Mutates the projects in place; returns how many it numbered.
export function ensureSortOrder(projects) {
  let max = 0;
  let any = false;
  projects.forEach((p) => { if (hasSortOrder(p)) { max = any ? Math.max(max, p.sortOrder) : p.sortOrder; any = true; } });
  let count = 0;
  projects.forEach((p) => { if (!hasSortOrder(p)) { max = any ? max + 1 : 1; any = true; p.sortOrder = max; count += 1; } });
  return count;
}

// A number strictly between two neighbours' sortOrder. `null` at an end means "nothing there":
// one beyond the other neighbour, or 0 when both are null (the only project). Returns null when
// the gap is too small to split (see MIN_SORT_GAP) -- the caller renumbers instead.
export function positionBetween(before, after) {
  const hasB = typeof before === 'number' && Number.isFinite(before);
  const hasA = typeof after === 'number' && Number.isFinite(after);
  if (!hasB && !hasA) return 0;
  if (!hasB) return after - 1;
  if (!hasA) return before + 1;
  if (after - before < MIN_SORT_GAP) return null;
  const mid = (before + after) / 2;
  return mid > before && mid < after ? mid : null;
}

// Where a dragged project should land. `orderedIds` are the ids in the order currently DISPLAYED
// for the group being reordered (the tiles, the minimised cards, or the sidebar list), `toIndex`
// is the moved project's index in that list once it has moved. Returns { id: newSortOrder } --
// normally exactly one entry (the moved project), `{}` for a move to the same place.
// Two cases change more than the moved project, both rare:
//  - the displayed order isn't the custom order (the first drag from another sort): the group's
//    projects take each other's existing numbers so custom order matches what was on screen;
//  - the gap between the two new neighbours is too small: every project is renumbered 1..n.
// Projects outside `orderedIds` (hidden by a search or category filter, or in the other group)
// keep their own numbers either way. Pure: doesn't touch `projects`.
export function moveProject(projects, id, toIndex, orderedIds) {
  const from = orderedIds.indexOf(id);
  if (from === -1) return {};
  const to = Math.max(0, Math.min(orderedIds.length - 1, toIndex));
  if (to === from) return {};
  const byId = new Map(projects.map((p) => [p.id, p]));
  const orderOf = (pid) => (byId.has(pid) && hasSortOrder(byId.get(pid)) ? byId.get(pid).sortOrder : null);
  const moved = orderedIds.slice();
  moved.splice(from, 1);
  moved.splice(to, 0, id);
  const displayed = orderedIds.map(orderOf);

  if (displayed.some((v, i) => v === null || (i > 0 && !(v > displayed[i - 1])))) {
    // not in custom order yet: hand the group's existing numbers out again in the new order
    const slots = displayed.filter((v) => v !== null).sort((a, b) => a - b);
    if (slots.length === moved.length && new Set(slots).size === slots.length) {
      const out = {};
      moved.forEach((pid, i) => { if (orderOf(pid) !== slots[i]) out[pid] = slots[i]; });
      return out;
    }
    return renumberAll(projects, id, moved, to);
  }

  const before = to > 0 ? orderOf(moved[to - 1]) : null;
  const after = to < moved.length - 1 ? orderOf(moved[to + 1]) : null;
  // Sit right next to the neighbour on the side the drop landed (not halfway to the neighbour on the
  // other side): with a filter on, projects hidden between the two visible neighbours then stay
  // where they were, and the new number can never equal a hidden project's.
  const others = projects.filter((p) => p.id !== id && hasSortOrder(p)).map((p) => p.sortOrder);
  let pos;
  if (before !== null) pos = positionBetween(before, others.filter((v) => v > before).reduce((m, v) => (m === null || v < m ? v : m), null));
  else pos = positionBetween(others.filter((v) => v < after).reduce((m, v) => (m === null || v > m ? v : m), null), after);
  if (pos !== null) return { [id]: pos };
  return renumberAll(projects, id, moved, to);
}

// The rare fallback: every project 1..n in custom order, with the moved one placed right after its
// new left neighbour (or first). Returns only the entries that actually change.
function renumberAll(projects, id, moved, to) {
  const all = sortProjects(projects.filter((p) => p.id !== id), 'custom').map((p) => p.id);
  const left = to > 0 ? all.indexOf(moved[to - 1]) : -1;
  all.splice(left + 1, 0, id);
  const out = {};
  const byId = new Map(projects.map((p) => [p.id, p]));
  all.forEach((pid, i) => { if (byId.get(pid).sortOrder !== i + 1) out[pid] = i + 1; });
  return out;
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

// "All" or "One" is a per-device layout choice (PR 6, 2026-09-27), remembered once picked. Before
// anything is stored, the default follows the width at load -- "All" from 1100px, "One" below
// (docs/6-decisions/Decisions.md, "Minimising comes back..."). A stored value, once there, wins at
// every width from then on. Pure so it's directly testable, like resolveSelectedProject above.
export function resolveProjectView(stored, isWide) {
  if (stored === 'all' || stored === 'one') return stored;
  return isWide ? 'all' : 'one';
}
