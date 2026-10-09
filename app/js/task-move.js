// focus-deck-app/js/task-move.js
// Pure, synchronous: where a dragged task lands in its group (sortOrder) and what moving it to
// another project means for GitHub (planTaskMove). No state.js import, so it is directly
// unit-testable, like project-filter.js, whose positionBetween it reuses.
// See docs/4-systems/styling.md#dragging-tasks and docs/4-systems/github-sync.md#moving-a-task-to-another-project.
import { positionBetween } from './project-filter.js';

const hasOrder = (t) => typeof t.sortOrder === 'number' && Number.isFinite(t.sortOrder);

// Numbers every task without a sortOrder, project by project, after that project's current
// maximum, in the current array order (old data keeps the order it was stored in; a new task goes
// to the end). Mutates in place; returns how many tasks it numbered.
export function ensureTaskSortOrder(projects) {
  let count = 0;
  (projects || []).forEach((p) => {
    const tasks = p.tasks || [];
    let max = 0;
    let any = false;
    tasks.forEach((t) => { if (hasOrder(t)) { max = any ? Math.max(max, t.sortOrder) : t.sortOrder; any = true; } });
    tasks.forEach((t) => { if (!hasOrder(t)) { max = any ? max + 1 : 1; any = true; t.sortOrder = max; count += 1; } });
  });
  return count;
}

// Ascending sortOrder; a task without one goes last; ties keep array order (Array.sort is stable).
export function sortTasks(tasks) {
  const key = (t) => (hasOrder(t) ? t.sortOrder : Infinity);
  return tasks.slice().sort((a, b) => (key(a) === key(b) ? 0 : (key(a) < key(b) ? -1 : 1)));
}

// Where a dragged task lands. `groupTasks` are the target group's open tasks in displayed order
// (they may include the moved task itself), `toIndex` is the moved task's index in that list once
// it has moved (i.e. among the others). Returns { id: newSortOrder }: normally exactly one entry (the
// moved task), `{}` for a move to the same place. When the gap between the two new neighbours is
// too small to split (or they tie), the whole group is renumbered 1..n instead.
export function taskOrderChanges(groupTasks, movedId, toIndex) {
  const from = groupTasks.findIndex((t) => t.id === movedId);
  const others = groupTasks.filter((t) => t.id !== movedId);
  const to = Math.max(0, Math.min(others.length, toIndex));
  if (from === to) return {};
  const before = to > 0 ? others[to - 1].sortOrder : null;
  const after = to < others.length ? others[to].sortOrder : null;
  const pos = positionBetween(before, after);
  if (pos !== null) return { [movedId]: pos };
  const seq = others.map((t) => t.id);
  seq.splice(to, 0, movedId);
  const current = new Map(groupTasks.map((t) => [t.id, t.sortOrder]));
  const out = {};
  seq.forEach((id, i) => { if (id === movedId || current.get(id) !== i + 1) out[id] = i + 1; });
  return out;
}

const hasRepo = (p) => !!p && p.source === 'github' && !!p.repoFullName;
const isLinked = (t) => t.source === 'github' && !!t.repoFullName && t.issueNumber != null;
const lower = (s) => String(s || '').toLowerCase();
const ownerOf = (full) => lower(full).split('/')[0];

// What dropping `task` (from `fromProject`) into `toProject` means. Returns
//   { kind, message, confirm }
// kind: 'local'        -- move in the app only, nothing on GitHub (offline target, or the task's own repo)
//       'create-issue' -- a hand-made task into a repo project: create an issue there and link it
//       'transfer'     -- a linked task into another repo of the same owner: GitHub transferIssue
//       'cross-owner'  -- a linked task into a repo of another owner: moves here only, keeps its link
// message: the confirmation text ('' when kind is 'local'); confirm: whether to ask first.
export function planTaskMove(task, fromProject, toProject) {
  const title = '“' + task.title + '”';
  const name = toProject.name;
  if (!hasRepo(toProject)) return { kind: 'local', message: '', confirm: false };
  const target = toProject.repoFullName;
  if (!isLinked(task)) {
    return { kind: 'create-issue', confirm: true, message: 'Move ' + title + ' to ' + name + '? This creates a new issue in ' + target + ' and links the task to it.' };
  }
  if (lower(task.repoFullName) === lower(target)) return { kind: 'local', message: '', confirm: false };
  if (ownerOf(task.repoFullName) === ownerOf(target)) {
    return { kind: 'transfer', confirm: true, message: 'Move ' + title + ' to ' + name + '? Issue #' + task.issueNumber + ' will move from ' + task.repoFullName + ' to ' + target + ' on GitHub.' };
  }
  return { kind: 'cross-owner', confirm: true, message: 'Move ' + title + ' to ' + name + '? GitHub can’t move issues between different owners, so it moves in Focus Deck only and stays linked to ' + task.repoFullName + '#' + task.issueNumber + '.' };
}
