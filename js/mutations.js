// focus-deck-app/js/mutations.js
import { state, uid, nextHue, findTaskWithProject, openTasksMatching, PRIORITY_ORDER } from './state.js';
import { syncIssueCompletion, pushCategoriesToIssue, pushPriorityToIssue, pushCategoryColorToLinkedIssues, closeIssueForDeletedTask } from './github-sync.js';
// The one persist() for the whole app: repaint, save locally, schedule the Gist push. mutations.js
// used to have its own copy that saved locally but never pushed, so most edits never reached the
// Gist. See doc-ref 2425 docs/4-systems/gist-sync.md
import { persist } from './sync.js';
import { ensureSortOrder } from './project-filter.js';
export { persist };

// categoryId was previously discarded here (the add-project form's submit handler was calling
// addProject(name, nextHue, categoryId) against this function's old (name, color) signature, so
// the 3rd argument -- the category the user picked -- silently never made it onto the project).
// A project's initial color matches its category's color, same as setProjectCategory -- creating
// a project with a category shouldn't need a separate recolor step to line up with it.
export function addProject(name, categoryId) {
  const project = { id: uid('p'), name, color: 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))', deadline: null, source: 'manual', categoryId: categoryId || null, tasks: [] };
  if (categoryId) {
    const cat = (state.projectCategories || []).find((c) => c.id === categoryId);
    if (cat) project.color = cat.color;
  }
  state.projects.push(project);
  ensureSortOrder(state.projects); // a new project goes to the end of the custom order
  persist();
  return project;
}

// Applies a drag's result (project-filter.js moveProject: normally one { id: sortOrder } entry) and
// saves. Only the projects named change, so only they are stamped and synced.
export function applySortOrders(changes) {
  let n = 0;
  Object.keys(changes).forEach((id) => {
    const p = state.projects.find((x) => x.id === id);
    if (p) { p.sortOrder = changes[id]; n += 1; }
  });
  if (n) persist();
  return n;
}

// steps is the raw newline-separated textarea value, split into the array shape the rest of the
// app expects. deadline/categories/steps were previously dropped entirely -- the add-task form
// already submitted them, but this function's old (projectId, title) signature had nowhere to
// put them. categoryIds is a list (one per label); priority is a PRIORITY_ORDER level or empty.
export function addTask(projectId, title, deadline, categoryIds, steps, priority) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = {
    id: uid('t'), title,
    status: 'next', deadline: deadline || null, categoryIds: categoryIds || [],
    priority: PRIORITY_ORDER.includes(priority) ? priority : null,
    source: 'manual', updatedAt: Date.now(),
  };
  if (steps) task.steps = String(steps).split('\n').map((s) => s.trim()).filter(Boolean);
  project.tasks.push(task);
  persist();
  return task;
}

export function updateTaskFields(taskId, fields) {
  const found = findTaskWithProject(taskId);
  if (!found) return;
  const { task } = found;
  const oldCategoryIds = (task.categoryIds || []).slice();
  const oldPriority = task.priority || null;
  Object.assign(task, fields);
  task.updatedAt = Date.now();
  persist();
  if ('categoryIds' in fields && JSON.stringify(task.categoryIds) !== JSON.stringify(oldCategoryIds)) {
    pushCategoriesToIssue(task, oldCategoryIds);
  }
  if ('priority' in fields && (task.priority || null) !== oldPriority) pushPriorityToIssue(task);
}

// Adapter for the task-edit-form's raw field values (steps as a newline-separated textarea
// string) onto updateTaskFields' already-normalized shape.
// projectId isn't needed here (findTaskWithProject locates the task on its own) but the edit
// form's submit handler passes it, matching deleteTask's (taskId, projectId) signature.
// Was previously called (as M.editTask) but never exported -- the task-edit form has been
// silently broken since it was added.
export function editTask(taskId, projectId, fields) {
  const normalized = {};
  if (fields.title !== undefined) normalized.title = fields.title;
  if (fields.deadline !== undefined) normalized.deadline = fields.deadline || null;
  if (fields.categoryIds !== undefined) normalized.categoryIds = fields.categoryIds || [];
  if (fields.priority !== undefined) normalized.priority = PRIORITY_ORDER.includes(fields.priority) ? fields.priority : null;
  if (fields.steps !== undefined) {
    normalized.steps = String(fields.steps || '').split('\n').map((s) => s.trim()).filter(Boolean);
  }
  updateTaskFields(taskId, normalized);
}

export function setTaskStatus(taskId, status) {
  const found = findTaskWithProject(taskId);
  if (!found) return;
  const { task, project } = found;
  const wasDone = task.status === 'done';
  task.status = status;
  task.updatedAt = Date.now();
  if (status === 'done' && !wasDone) {
    state.completedLog.unshift({ id: uid('log'), taskId: task.id, title: task.title, projectId: project.id, color: project.color, completedAt: Date.now() });
    state.completedLog = state.completedLog.slice(0, 12);
  } else if (status !== 'done' && wasDone) {
    state.completedLog = state.completedLog.filter((e) => e.taskId !== task.id);
  }
  persist();
  syncIssueCompletion(task); // fire-and-forget
}

export function deleteTask(taskId, projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = project.tasks.find((t) => t.id === taskId);
  const isLinked = task && task.source === 'github' && task.repoFullName && task.issueNumber != null;
  if (isLinked) {
    // keep the issue out of future syncs, even if closing it below fails
    const key = task.repoFullName + '#' + task.issueNumber;
    if (!state.excludedIssues.includes(key)) state.excludedIssues.push(key);
  }
  project.tasks = project.tasks.filter((t) => t.id !== taskId);
  if (!state.deletedTaskIds) state.deletedTaskIds = {};
  state.deletedTaskIds[taskId] = Date.now(); // tombstone — see mergeStates in sync.js
  if (state.focus && state.focus.taskId === taskId) state.focus = null;
  state.completedLog = state.completedLog.filter((e) => e.taskId !== taskId);
  persist();
  if (isLinked) closeIssueForDeletedTask(task); // fire-and-forget; a failure shows in the toast
}

// The task row's checkbox: flips between 'next' and 'done'. Anything mid-flight ('doing') also
// counts as "not done" and un-checking it lands back on 'next' rather than trying to remember
// what it was before — same simplification the rest of the app makes (e.g. reopening a
// GitHub-linked task's issue resolves its status from labels, not from history).
// Was previously called (as M.toggleTask) but never exported -- the task checkbox has been
// silently broken since it was added.
export function toggleTask(taskId, projectId) {
  const found = findTaskWithProject(taskId);
  if (!found) return;
  setTaskStatus(taskId, found.task.status === 'done' ? 'next' : 'done');
}

// The priority chip on a task row: none -> low -> medium -> high -> urgent -> none.
const PRIORITY_CYCLE = [null, 'low', 'medium', 'high', 'urgent'];
export function cyclePriority(taskId) {
  const found = findTaskWithProject(taskId);
  if (!found) return;
  const idx = PRIORITY_CYCLE.indexOf(found.task.priority || null);
  updateTaskFields(taskId, { priority: PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length] });
}

// Removing a project removes all of its tasks too, so each one needs the same deletion tombstone
// deleteTask writes — see the Traps note in docs/4-systems/gist-sync.md about any "remove this
// task" path needing this or a stale Gist pull can resurrect them.
// Was previously called (as M.removeProject) but never exported -- the Remove button has been
// silently broken since it was added.
export function removeProject(projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  if (!state.deletedTaskIds) state.deletedTaskIds = {};
  const now = Date.now();
  const taskIds = new Set(project.tasks.map((t) => t.id));
  project.tasks.forEach((t) => { state.deletedTaskIds[t.id] = now; });
  if (state.focus && taskIds.has(state.focus.taskId)) state.focus = null;
  state.projects = state.projects.filter((p) => p.id !== projectId);
  state.completedLog = state.completedLog.filter((e) => e.projectId !== projectId);
  persist();
}

// Was previously called (as M.addCapture) but never exported -- the capture bar has been
// silently broken since it was added.
export function addCapture(text) {
  text = (text || '').trim();
  if (!text) return;
  state.inbox.push({ id: uid('cap'), text, createdAt: Date.now() });
  persist();
}

// Was previously called (as M.fileInboxItem) but never exported -- filing an inbox item into a
// project has been silently broken since it was added.
// categoryIds: the labels ticked on the Unsorted item. Returns the new task.
export function fileInboxItem(inboxId, projectId, categoryIds) {
  const item = state.inbox.find((i) => i.id === inboxId);
  const project = state.projects.find((p) => p.id === projectId);
  if (!item || !project) return;
  const task = { id: uid('t'), title: item.text, status: 'next', deadline: null, categoryIds: categoryIds || [], priority: null, source: 'manual', updatedAt: Date.now() };
  project.tasks.push(task);
  state.inbox = state.inbox.filter((i) => i.id !== inboxId);
  persist();
  return task;
}

// Was previously called (as M.discardInbox) but never exported -- discarding an inbox item has
// been silently broken since it was added.
export function discardInbox(inboxId) {
  state.inbox = state.inbox.filter((i) => i.id !== inboxId);
  persist();
}

// "Done" on a captured thought, straight from the Unsorted flow: it's finished without ever
// becoming a task, so it logs to Recently done the same way a task completion does, but with no
// taskId/projectId (see merge.js's completedLog filter, which keeps these by inboxId instead).
export function completeInboxItem(inboxId) {
  const item = state.inbox.find((i) => i.id === inboxId);
  if (!item) return;
  state.inbox = state.inbox.filter((i) => i.id !== inboxId);
  state.completedLog.unshift({ id: uid('log'), taskId: null, inboxId, title: item.text, projectId: null, color: 'var(--ink-faint)', completedAt: Date.now() });
  state.completedLog = state.completedLog.slice(0, 12);
  persist();
  return item;
}

// "What's your focus right now?": a random open task, limited to a label and/or project when chosen
// (empty means any). Returns false, changing nothing, when no open task matches.
export function pickFocus(filter) {
  const f = { categoryId: (filter && filter.categoryId) || null, projectId: (filter && filter.projectId) || null };
  const pool = openTasksMatching(f);
  if (!pool.length) return false;
  state.focus = { taskId: pool[Math.floor(Math.random() * pool.length)], pool, filter: f, startedAt: Date.now() };
  persist();
  return true;
}

// "Not this one": swaps to a different task from the same pool the pick built. Only shown in the
// UI when the pool has more than one candidate.
// Was previously called (as M.reroll) but never exported.
export function reroll() {
  if (!state.focus || !state.focus.pool || state.focus.pool.length < 2) return;
  const others = state.focus.pool.filter((id) => {
    const found = id !== state.focus.taskId && findTaskWithProject(id);
    return found && found.task.status !== 'done'; // skip tasks finished since the pick
  });
  if (!others.length) return;
  state.focus.taskId = others[Math.floor(Math.random() * others.length)];
  persist();
}

// Was previously called (as M.completeFocus) but never exported.
export function completeFocus() {
  if (!state.focus) return;
  setTaskStatus(state.focus.taskId, 'done'); // reuses the same completedLog + GitHub sync path
  state.focus = null;
  persist();
}

export function setFocus(taskId) {
  const found = findTaskWithProject(taskId);
  if (!found) { state.focus = null; persist(); return; }
  state.focus = { taskId, startedAt: Date.now() };
  persist();
}

export function clearFocus() {
  state.focus = null;
  persist();
}

// color must be a CSS color string. Callers used to pass the nextHue function itself, which
// JSON.stringify silently drops, so the category came back colorless after every reload.
function categoryColor(color) {
  return typeof color === 'string' && color ? color : 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))';
}

export function addCategory(name, color) {
  const cat = { id: uid('cat'), name, color: categoryColor(color) };
  state.categories.push(cat);
  persist();
  return cat;
}

export function setCategoryColor(id, color) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat || !color) return;
  cat.color = color;
  persist();
  pushCategoryColorToLinkedIssues(id); // fire-and-forget: keeps linked GitHub labels' colors in sync
}

export function renameCategory(id, name) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat || !name) return;
  cat.name = name;
  persist();
}

// Explicit, confirmed removal from Settings (the confirm names how many tasks it's on).
export function removeCategory(id) {
  state.categories = state.categories.filter((c) => c.id !== id);
  state.projects.forEach((p) => p.tasks.forEach((t) => { t.categoryIds = (t.categoryIds || []).filter((c) => c !== id); }));
  persist();
}

export function addProjectCategory(name, color) {
  const cat = { id: uid('pcat'), name, color: categoryColor(color) };
  if (!state.projectCategories) state.projectCategories = [];
  state.projectCategories.push(cat);
  persist();
  return cat;
}

// Assigns (or clears, with categoryId null) a project's category. A project's color follows its
// category's color by default — unless the project has been manually recolored (p.colorLocked),
// in which case the override wins and the category is assigned without touching the color.
// Explicit, confirmed removal from Settings. Projects keep their color; they just lose the
// category assignment.
export function removeProjectCategory(id) {
  state.projectCategories = (state.projectCategories || []).filter((c) => c.id !== id);
  state.projects.forEach((p) => { if (p.categoryId === id) p.categoryId = null; });
  persist();
}

export function setProjectCategory(projectId, categoryId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  project.categoryId = categoryId || null;
  if (categoryId && !project.colorLocked) {
    const cat = (state.projectCategories || []).find((c) => c.id === categoryId);
    if (cat) project.color = cat.color;
  }
  persist();
}

// Recolors a project category and live-syncs that color to every project currently assigned to
// it, except projects with a manual color override (p.colorLocked) — see setProjectColor.
export function setProjectCategoryColor(categoryId, color) {
  const cat = (state.projectCategories || []).find((c) => c.id === categoryId);
  if (!cat || !color) return;
  cat.color = color;
  state.projects.forEach((p) => { if (p.categoryId === categoryId && !p.colorLocked) p.color = color; });
  persist();
}

// Right-click-on-the-project's-own-color-dot entry point: sets a project's color directly and
// locks it, so it stops following its category's color (setProjectCategory/setProjectCategoryColor
// both skip a locked project).
export function setProjectColor(projectId, color) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project || !color) return;
  project.color = color;
  project.colorLocked = true;
  persist();
}

export function excludeRepo(fullName) {
  if (!state.excludedRepos.includes(fullName)) state.excludedRepos.push(fullName);
  state.projects = state.projects.filter((p) => !(p.source === 'github' && p.repoFullName === fullName));
  persist();
}

export function pinRepo(fullName) {
  if (!state.pinnedRepos.includes(fullName)) state.pinnedRepos.push(fullName);
  const idx = state.excludedRepos.indexOf(fullName);
  if (idx !== -1) state.excludedRepos.splice(idx, 1);
  persist();
}

export function unpinRepo(fullName) {
  const idx = state.pinnedRepos.indexOf(fullName);
  if (idx !== -1) state.pinnedRepos.splice(idx, 1);
  persist();
}
