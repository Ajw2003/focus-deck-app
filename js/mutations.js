// focus-deck-app/js/mutations.js
import { state, uid, nextHue, findTaskWithProject } from './state.js';
import { syncIssueCompletion, pushCategoryToIssue, pushCategoryColorToLinkedIssues } from './github-sync.js';
// The one persist() for the whole app: repaint, save locally, schedule the Gist push. mutations.js
// used to have its own copy that saved locally but never pushed, so most edits never reached the
// Gist. See doc-ref 2425 docs/systems/gist-sync.md
import { persist } from './sync.js';
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
  persist();
  return project;
}

// energy is whatever the add-task form's select submits: a literal level, or 'auto' (see
// energyAuto on the task-edit-form's equivalent field in render.js). steps is the raw
// newline-separated textarea value, split into the array shape the rest of the app expects.
// deadline/categoryId/steps were previously dropped entirely -- the add-task form already
// submitted them, but this function's old (projectId, title, energy) signature had nowhere to
// put them.
export function addTask(projectId, title, energy, deadline, categoryId, steps) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const isAuto = energy === 'auto';
  const task = {
    id: uid('t'), title, energy: (!isAuto && energy) ? energy : 'medium', energyAuto: isAuto,
    status: 'next', deadline: deadline || null, categoryId: categoryId || null,
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
  const oldCategoryId = task.categoryId;
  Object.assign(task, fields);
  task.updatedAt = Date.now();
  persist();
  if ('categoryId' in fields && fields.categoryId !== oldCategoryId) {
    pushCategoryToIssue(task, oldCategoryId);
  }
}

// Adapter for the task-edit-form's raw field values (steps as a newline-separated textarea
// string, energy as a literal level or 'auto') onto updateTaskFields' already-normalized shape.
// projectId isn't needed here (findTaskWithProject locates the task on its own) but the edit
// form's submit handler passes it, matching deleteTask's (taskId, projectId) signature.
// Was previously called (as M.editTask) but never exported -- the task-edit form has been
// silently broken since it was added.
export function editTask(taskId, projectId, fields) {
  const normalized = {};
  if (fields.title !== undefined) normalized.title = fields.title;
  if (fields.energy !== undefined) {
    if (fields.energy === 'auto') { normalized.energyAuto = true; }
    else { normalized.energy = fields.energy; normalized.energyAuto = false; }
  }
  if (fields.deadline !== undefined) normalized.deadline = fields.deadline || null;
  if (fields.categoryId !== undefined) normalized.categoryId = fields.categoryId || null;
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
  project.tasks = project.tasks.filter((t) => t.id !== taskId);
  if (!state.deletedTaskIds) state.deletedTaskIds = {};
  state.deletedTaskIds[taskId] = Date.now(); // tombstone — see mergeStates in sync.js
  if (state.focus && state.focus.taskId === taskId) state.focus = null;
  state.completedLog = state.completedLog.filter((e) => e.taskId !== taskId);
  persist();
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

// Was previously called (as M.cycleEnergy) but never exported -- the energy chip has been
// silently broken since it was added.
const ENERGY_CYCLE = ['low', 'medium', 'high'];
export function cycleEnergy(taskId, projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const idx = ENERGY_CYCLE.indexOf(task.energy);
  task.energy = ENERGY_CYCLE[(idx + 1) % ENERGY_CYCLE.length];
  task.energyAuto = false; // a manual cycle always overrides "auto"
  task.updatedAt = Date.now();
  persist();
}

// Removing a project removes all of its tasks too, so each one needs the same deletion tombstone
// deleteTask writes — see the Traps note in docs/systems/gist-sync.md about any "remove this
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
export function fileInboxItem(inboxId, projectId) {
  const item = state.inbox.find((i) => i.id === inboxId);
  const project = state.projects.find((p) => p.id === projectId);
  if (!item || !project) return;
  project.tasks.push({ id: uid('t'), title: item.text, energy: 'medium', status: 'next', deadline: null, categoryId: null, source: 'manual', updatedAt: Date.now() });
  state.inbox = state.inbox.filter((i) => i.id !== inboxId);
  persist();
}

// Was previously called (as M.discardInbox) but never exported -- discarding an inbox item has
// been silently broken since it was added.
export function discardInbox(inboxId) {
  state.inbox = state.inbox.filter((i) => i.id !== inboxId);
  persist();
}

// Picks the first candidate (candidatesForEnergy sorts by soonest deadline) as a deterministic,
// testable choice rather than a random one. pool is kept on state.focus so reroll() has
// something to pick a different task from.
// Was previously called (as M.setEnergyFocus) but never exported -- the entire Focus mode has
// been silently broken since it was added.
export function setEnergyFocus(level, candidatesForEnergy) {
  const pool = candidatesForEnergy(level);
  if (!pool.length) return;
  state.focus = { taskId: pool[0], energy: level, pool, startedAt: Date.now() };
  persist();
}

// "Surprise me instead": no energy filter, so no energy chip is shown for it (renderFocus reads
// !energyLevel to render the "Surprise pick" chip) — just any open task across every project.
// Was previously called (as M.surprise) but never exported.
export function surprise() {
  const pool = [];
  state.projects.forEach((p) => p.tasks.forEach((t) => { if (t.status !== 'done') pool.push(t.id); }));
  if (!pool.length) return;
  const taskId = pool[Math.floor(Math.random() * pool.length)];
  state.focus = { taskId, energy: undefined, pool, startedAt: Date.now() };
  persist();
}

// "Not this one": swaps to a different task from the same pool setEnergyFocus/surprise built,
// keeping the same energy filter. Only shown in the UI when the pool has more than one candidate.
// Was previously called (as M.reroll) but never exported.
export function reroll() {
  if (!state.focus || !state.focus.pool || state.focus.pool.length < 2) return;
  const others = state.focus.pool.filter((id) => id !== state.focus.taskId);
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
  state.projects.forEach((p) => p.tasks.forEach((t) => { if (t.categoryId === id) t.categoryId = null; }));
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
