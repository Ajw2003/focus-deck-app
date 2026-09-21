// focus-deck-app/js/mutations.js
import { state, uid, nextHue, saveStateLocal, findTaskWithProject } from './state.js';
import { syncIssueCompletion, pushCategoryToIssue, pushCategoryColorToLinkedIssues } from './github-sync.js';

function persist() {
  saveStateLocal();
  // registered separately by sync.js to avoid a circular import; see sync.js:persist
  if (state._persistHook) state._persistHook();
}
export { persist };

export function addProject(name, color) {
  const project = { id: uid('p'), name, color: color || 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))', deadline: null, source: 'manual', tasks: [] };
  state.projects.push(project);
  persist();
  return project;
}

export function addTask(projectId, title, energy) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = { id: uid('t'), title, energy: energy || 'medium', status: 'next', deadline: null, categoryId: null, source: 'manual', updatedAt: Date.now() };
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

export function addCategory(name, color) {
  const cat = { id: uid('cat'), name, color: color || 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))' };
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

export function deleteCategory(id) {
  state.categories = state.categories.filter((c) => c.id !== id);
  state.projects.forEach((p) => p.tasks.forEach((t) => { if (t.categoryId === id) t.categoryId = null; }));
  persist();
}

export function addProjectCategory(name, color) {
  const cat = { id: uid('pcat'), name, color: color || 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))' };
  if (!state.projectCategories) state.projectCategories = [];
  state.projectCategories.push(cat);
  persist();
  return cat;
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
