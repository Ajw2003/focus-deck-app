// focus-deck-app/js/mutations.js
import { state, uid } from './state.js';
import { persist } from './sync.js';
import { parseSteps, wordCount, estimateComplexity, tierFromScore } from './complexity.js';

function computeAutoEnergy(title, steps) {
  const text = [title, (steps || []).join(' ')].filter(Boolean).join(' ');
  const score = estimateComplexity({ stepCount: (steps || []).length, text, wordCount: wordCount(text) });
  return tierFromScore(score);
}

export function addCapture(text) {
  text = (text || '').trim();
  if (!text) return;
  state.inbox.unshift({ id: uid('cap'), text, createdAt: Date.now() });
  persist();
}

export function fileInboxItem(inboxId, projectId) {
  const idx = state.inbox.findIndex((i) => i.id === inboxId);
  if (idx === -1) return;
  const item = state.inbox[idx];
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  project.tasks.push({ id: uid('t'), title: item.text, energy: 'medium', status: 'next', deadline: null, categoryId: null, source: 'manual', updatedAt: Date.now() });
  state.inbox.splice(idx, 1);
  persist();
}

export function discardInbox(inboxId) {
  state.inbox = state.inbox.filter((i) => i.id !== inboxId);
  persist();
}

export function addTask(projectId, title, energy, deadline, categoryId, stepsText) {
  title = (title || '').trim();
  if (!title) return;
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const steps = parseSteps(stepsText);
  const energyAuto = !energy || energy === 'auto';
  const resolvedEnergy = energyAuto ? computeAutoEnergy(title, steps) : energy;
  const task = { id: uid('t'), title, energy: resolvedEnergy, energyAuto, status: 'next', deadline: deadline || null, categoryId: categoryId || null, source: 'manual', updatedAt: Date.now() };
  if (steps.length) task.steps = steps;
  project.tasks.push(task);
  persist();
}

export function editTask(taskId, projectId, fields) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) return;
  if (fields.title !== undefined) { const t = fields.title.trim(); if (t) task.title = t; }
  if (fields.steps !== undefined) {
    const steps = parseSteps(fields.steps);
    if (steps.length) task.steps = steps; else delete task.steps;
  }
  if (fields.deadline !== undefined) task.deadline = fields.deadline || null;
  if (fields.categoryId !== undefined) task.categoryId = fields.categoryId || null;
  if (fields.energy !== undefined) {
    if (fields.energy === 'auto') {
      task.energyAuto = true;
      task.energy = computeAutoEnergy(task.title, task.steps || []);
    } else {
      task.energyAuto = false;
      task.energy = fields.energy;
    }
  }
  task.updatedAt = Date.now();
  persist();
}

export function deleteTask(taskId, projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  project.tasks = project.tasks.filter((t) => t.id !== taskId);
  if (state.focus && state.focus.taskId === taskId) state.focus = null;
  state.completedLog = state.completedLog.filter((e) => e.taskId !== taskId);
  persist();
}

export function toggleTask(taskId, projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) return;
  if (task.status === 'done') {
    task.status = 'next';
    state.completedLog = state.completedLog.filter((e) => e.taskId !== taskId);
  } else {
    task.status = 'done';
    state.completedLog.unshift({ id: uid('log'), taskId: task.id, title: task.title, projectId: project.id, color: project.color, completedAt: Date.now() });
    state.completedLog = state.completedLog.slice(0, 12);
    if (state.focus && state.focus.taskId === taskId) state.focus = null;
  }
  task.updatedAt = Date.now();
  persist();
}

export function cycleEnergy(taskId, projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task || task.status === 'done') return;
  const order = ['low', 'medium', 'high'];
  task.energy = order[(order.indexOf(task.energy) + 1) % order.length];
  task.energyAuto = false;
  task.updatedAt = Date.now();
  persist();
}

export function setFocusTask(taskId) { state.focus = { taskId, energy: null, pool: [taskId], poolIndex: 0 }; persist(); }

export function setEnergyFocus(level, candidatesForEnergy) {
  const pool = candidatesForEnergy(level);
  if (pool.length === 0) return;
  state.focus = { taskId: pool[0], energy: level, pool, poolIndex: 0 };
  persist();
}

export function surprise() {
  const all = [];
  state.projects.forEach((p) => p.tasks.forEach((t) => { if (t.status !== 'done') all.push(t.id); }));
  if (all.length === 0) return;
  const pick = all[Math.floor(Math.random() * all.length)];
  state.focus = { taskId: pick, energy: null, pool: all, poolIndex: all.indexOf(pick) };
  persist();
}

export function reroll() {
  if (!state.focus || !state.focus.pool || state.focus.pool.length < 2) return;
  state.focus.poolIndex = (state.focus.poolIndex + 1) % state.focus.pool.length;
  state.focus.taskId = state.focus.pool[state.focus.poolIndex];
  persist();
}

export function clearFocus() { state.focus = null; persist(); }

export function completeFocus(findProjectIdForTask) {
  if (!state.focus) return;
  const pid = findProjectIdForTask(state.focus.taskId);
  if (!pid) { state.focus = null; persist(); return; }
  toggleTask(state.focus.taskId, pid);
}

export function addProject(name, nextHue, categoryId) {
  name = (name || '').trim();
  if (!name) return;
  const hue = nextHue();
  state.projects.push({ id: uid('proj'), name, color: 'hsl(' + hue + ' var(--proj-sat) var(--proj-light))', deadline: null, source: 'manual', categoryId: categoryId || null, tasks: [] });
  persist();
}

export function addProjectCategory(name, nextHue) {
  name = (name || '').trim();
  if (!name) return null;
  const existing = state.projectCategories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const id = uid('pcat');
  state.projectCategories.push({ id, name, color: 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))' });
  persist();
  return id;
}

export function setProjectCategoryColor(id, color) {
  const cat = state.projectCategories.find((c) => c.id === id);
  if (!cat || !color) return;
  cat.color = color;
  persist();
}

export function removeProjectCategory(id) {
  state.projectCategories = state.projectCategories.filter((c) => c.id !== id);
  state.projects.forEach((p) => { if (p.categoryId === id) p.categoryId = null; });
  persist();
}

export function setProjectCategory(projectId, categoryId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  project.categoryId = categoryId || null;
  persist();
}

export function addCategory(name, nextHue) {
  name = (name || '').trim();
  if (!name) return null;
  const existing = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const id = uid('cat');
  state.categories.push({ id, name, color: 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))' });
  persist();
  return id;
}

export function setCategoryColor(id, color) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat || !color) return;
  cat.color = color;
  persist();
}

export function removeCategory(id) {
  state.categories = state.categories.filter((c) => c.id !== id);
  state.projects.forEach((p) => p.tasks.forEach((t) => { if (t.categoryId === id) t.categoryId = null; }));
  persist();
}

export function removeProject(id) {
  const idx = state.projects.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const proj = state.projects[idx];
  if (proj.source === 'github' && proj.repoFullName) {
    if (state.excludedRepos.indexOf(proj.repoFullName) === -1) state.excludedRepos.push(proj.repoFullName);
    state.pinnedRepos = state.pinnedRepos.filter((r) => r !== proj.repoFullName);
  }
  const taskIds = proj.tasks.map((t) => t.id);
  state.projects.splice(idx, 1);
  state.completedLog = state.completedLog.filter((e) => taskIds.indexOf(e.taskId) === -1);
  if (state.focus && taskIds.indexOf(state.focus.taskId) !== -1) state.focus = null;
  persist();
}
