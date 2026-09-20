// focus-deck-app/js/app.js
import { state, findTaskWithProject, findProjectIdForTask, candidatesForEnergy, nextHue, cssColorToHex } from './state.js';
import * as M from './mutations.js';
import * as R from './render.js';
import { registerPaint, initSyncLifecycle, pullFromGist } from './sync.js';
import { syncGithub, addRepoManually, linkTaskToIssue, unlinkTask, createGithubIssueFromTask } from './github-sync.js';
import { filterAndSortProjects } from './project-filter.js';

export const ui = { inboxOpen: true, doneOpen: {}, pendingRemove: {}, syncing: false, syncError: null, editingTask: null, projectFilter: undefined, projectQuery: '', projectSort: 'name', projectCollapsed: {}, editingProjectCategory: null };

export function renderApp(st) {
  st._ui = ui; // renderSyncStatus reads sync UI state off the state object it's already passed
  const visibleProjects = filterAndSortProjects(st.projects, { categoryId: ui.projectFilter, query: ui.projectQuery, sortBy: ui.projectSort });
  return R.renderSyncStatus(st) + R.renderStats(st) + R.renderFocus(st, findTaskWithProject) + R.renderDone(st) + R.renderInbox(st, ui)
    + R.renderProjectFilterBar(st, ui, visibleProjects)
    + '<div class="projects-grid">' + visibleProjects.map((p) => R.renderProjectCard(p, ui, st.categories, st.projectCategories)).join('')
      + (st.projects.length && !visibleProjects.length ? '<p class="muted small">No projects match.</p>' : '')
    + '</div>'
    + R.renderAddProjectForm(st.projectCategories);
}

export function paint() {
  const scrollY = window.scrollY;
  const active = document.activeElement;
  const restoreSearch = active && active.matches && active.matches('.project-search') ? { start: active.selectionStart, end: active.selectionEnd } : null;
  document.getElementById('app').innerHTML = renderApp(state);
  window.scrollTo(0, scrollY);
  if (restoreSearch) {
    const el = document.querySelector('.project-search');
    if (el) { el.focus(); el.setSelectionRange(restoreSearch.start, restoreSearch.end); }
  }
}

registerPaint(paint);

function onAppClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action');
  const taskId = el.getAttribute('data-task');
  const projectId = el.getAttribute('data-project');
  if (action === 'set-energy') M.setEnergyFocus(el.getAttribute('data-energy'), candidatesForEnergy);
  else if (action === 'surprise') M.surprise();
  else if (action === 'reroll') M.reroll();
  else if (action === 'clear-focus') M.clearFocus();
  else if (action === 'complete-focus') M.completeFocus(findProjectIdForTask);
  else if (action === 'focus-task') M.setFocusTask(taskId);
  else if (action === 'cycle-energy') M.cycleEnergy(taskId, projectId);
  else if (action === 'delete-task') M.deleteTask(taskId, projectId);
  else if (action === 'file-inbox') M.fileInboxItem(el.getAttribute('data-inbox'), projectId);
  else if (action === 'discard-inbox') M.discardInbox(el.getAttribute('data-inbox'));
  else if (action === 'remove-project') { ui.pendingRemove[projectId] = true; paint(); }
  else if (action === 'cancel-remove-project') { delete ui.pendingRemove[projectId]; paint(); }
  else if (action === 'confirm-remove-project') M.removeProject(projectId);
  else if (action === 'toggle-inbox') { ui.inboxOpen = !ui.inboxOpen; paint(); }
  else if (action === 'toggle-done') { ui.doneOpen[projectId] = !ui.doneOpen[projectId]; paint(); }
  else if (action === 'scroll-project') {
    const target = document.getElementById('proj-' + projectId);
    if (target) target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  else if (action === 'sync-github') { syncGithub(ui).then(paint); }
  else if (action === 'pull-now') { pullFromGist().then(paint).catch((e) => { ui.syncError = e.message; paint(); }); }
  else if (action === 'edit-task') { ui.editingTask = { taskId, projectId }; paint(); }
  else if (action === 'cancel-task-edit') { ui.editingTask = null; paint(); }
  else if (action === 'set-project-filter') {
    const cat = el.getAttribute('data-category');
    ui.projectFilter = cat === '' ? undefined : (cat === '__uncat__' ? null : cat);
    paint();
  }
  else if (action === 'toggle-project-collapse') { ui.projectCollapsed[projectId] = !ui.projectCollapsed[projectId]; paint(); }
  else if (action === 'toggle-collapse-all') {
    const visible = filterAndSortProjects(state.projects, { categoryId: ui.projectFilter, query: ui.projectQuery, sortBy: ui.projectSort });
    const allCollapsed = visible.length > 0 && visible.every((p) => ui.projectCollapsed[p.id]);
    visible.forEach((p) => { ui.projectCollapsed[p.id] = !allCollapsed; });
    paint();
  }
  else if (action === 'edit-project-category') { ui.editingProjectCategory = projectId; paint(); }
  else if (action === 'cancel-edit-project-category') { ui.editingProjectCategory = null; paint(); }
  else if (action === 'link-github-issue') {
    const input = prompt('Link to which GitHub issue? Paste "owner/repo#123" or the issue URL:');
    if (input) linkTaskToIssue(taskId, input, ui).then(paint);
  }
  else if (action === 'unlink-github-issue') {
    if (confirm('Unlink this task from its GitHub issue? Both the task and the issue stay as they are — only the connection is removed.')) unlinkTask(taskId);
  }
  else if (action === 'create-github-issue') {
    // when the task's own project is already tied to a repo, push straight there — no need to
    // ask again for a repo the app already knows
    const proj = state.projects.find((p) => p.id === projectId);
    const input = (proj && proj.repoFullName) || prompt('Create a new issue in which repo? Enter "owner/repo" or a github.com URL:');
    if (input) createGithubIssueFromTask(taskId, input, ui).then(paint);
  }
}

// Right-clicking a category chip opens a native color picker for that category. The picker's
// <input> is appended to <body>, outside #app — persist()'s full #app.innerHTML replace would
// otherwise destroy it mid-drag and close the picker. Only 'change' (fires once, on commit)
// persists; 'input' just live-updates the chip's own color.
function onAppContextMenu(e) {
  const chip = e.target.closest('[data-cat-id]');
  if (!chip) return;
  e.preventDefault();
  const catId = chip.getAttribute('data-cat-id');
  const catType = chip.getAttribute('data-cat-type');
  const list = catType === 'project' ? state.projectCategories : state.categories;
  const cat = list.find((c) => c.id === catId);
  if (!cat) return;

  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = cssColorToHex(cat.color);
  picker.style.cssText = 'position:fixed; opacity:0; width:1px; height:1px; pointer-events:none; left:' + e.clientX + 'px; top:' + e.clientY + 'px;';
  document.body.appendChild(picker);
  const cleanup = () => picker.remove();
  picker.addEventListener('input', () => chip.style.setProperty('--chip-color', picker.value));
  picker.addEventListener('change', () => {
    if (catType === 'project') M.setProjectCategoryColor(catId, picker.value);
    else M.setCategoryColor(catId, picker.value);
    cleanup();
  });
  picker.addEventListener('blur', () => setTimeout(cleanup, 200));
  if (picker.showPicker) picker.showPicker(); else picker.click();
}

function onAppChange(e) {
  if (e.target.matches && e.target.matches('[data-action="toggle-task"]')) {
    M.toggleTask(e.target.getAttribute('data-task'), e.target.getAttribute('data-project'));
  } else if (e.target.matches && e.target.matches('[data-action="set-project-sort"]')) {
    ui.projectSort = e.target.value;
    paint();
  } else if (e.target.matches && e.target.matches('[data-action="set-project-category"]')) {
    const projectId = e.target.getAttribute('data-project');
    let categoryId = e.target.value;
    // ui.editingProjectCategory is cleared *before* the mutation: M.setProjectCategory ->
    // persist() repaints synchronously, so clearing it after the call would still show the
    // select for this project in that repaint.
    ui.editingProjectCategory = null;
    if (categoryId === '__new__') {
      const name = prompt('New project category name:');
      categoryId = name ? M.addProjectCategory(name, nextHue) : '';
    }
    M.setProjectCategory(projectId, categoryId || null);
  }
}

function onAppInput(e) {
  if (e.target.matches && e.target.matches('[data-action="set-project-query"]')) {
    ui.projectQuery = e.target.value;
    paint();
  }
}

function onAppSubmit(e) {
  const addTaskForm = e.target.closest('[data-action="add-task"]');
  if (addTaskForm) {
    e.preventDefault();
    const fd = new FormData(addTaskForm);
    let categoryId = fd.get('category');
    if (categoryId === '__new__') {
      const name = prompt('New category name:');
      categoryId = name ? M.addCategory(name, nextHue) : '';
    }
    M.addTask(addTaskForm.getAttribute('data-project'), fd.get('title'), fd.get('energy'), fd.get('deadline'), categoryId, fd.get('steps'));
    return;
  }
  const addProjectForm = e.target.closest('[data-action="add-project"]');
  if (addProjectForm) {
    e.preventDefault();
    const fd = new FormData(addProjectForm);
    let categoryId = fd.get('category');
    if (categoryId === '__new__') {
      const name = prompt('New project category name:');
      categoryId = name ? M.addProjectCategory(name, nextHue) : '';
    }
    M.addProject(fd.get('name'), nextHue, categoryId);
    return;
  }
  const addRepoForm = e.target.closest('[data-action="add-repo"]');
  if (addRepoForm) {
    e.preventDefault();
    const val = new FormData(addRepoForm).get('repo');
    addRepoManually(val, ui).then(paint);
    addRepoForm.reset();
    return;
  }
  const editForm = e.target.closest('[data-action="save-task-edit"]');
  if (editForm) {
    e.preventDefault();
    const fd = new FormData(editForm);
    // ui.editingTask is cleared *before* the mutation: M.editTask -> persist() repaints
    // synchronously, so clearing it after the call would still show the edit form for
    // this task in that repaint.
    ui.editingTask = null;
    let editCategoryId = fd.get('category');
    if (editCategoryId === '__new__') {
      const name = prompt('New category name:');
      editCategoryId = name ? M.addCategory(name, nextHue) : '';
    }
    M.editTask(editForm.getAttribute('data-task'), editForm.getAttribute('data-project'), {
      title: fd.get('title'), energy: fd.get('energy'), deadline: fd.get('deadline'), categoryId: editCategoryId, steps: fd.get('steps'),
    });
    return;
  }
}

function onAppKeydown(e) {
  if (e.key === 'Enter' && e.target.matches('[data-action="edit-task"]')) {
    ui.editingTask = { taskId: e.target.getAttribute('data-task'), projectId: e.target.getAttribute('data-project') };
    paint();
  }
}

function init() {
  paint();
  initSyncLifecycle();
  const app = document.getElementById('app');
  app.addEventListener('click', onAppClick);
  app.addEventListener('change', onAppChange);
  app.addEventListener('input', onAppInput);
  app.addEventListener('submit', onAppSubmit);
  app.addEventListener('keydown', onAppKeydown);
  app.addEventListener('contextmenu', onAppContextMenu);
  const captureForm = document.getElementById('capture-form');
  captureForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('capture-input');
    M.addCapture(input.value);
    input.value = '';
    input.focus();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
