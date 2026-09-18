// focus-deck-app/js/app.js
import { state, findTaskWithProject, findProjectIdForTask, candidatesForEnergy, nextHue } from './state.js';
import * as M from './mutations.js';
import * as R from './render.js';
import { registerPaint, initSyncLifecycle, pullFromGist } from './sync.js';
import { syncGithub, addRepoManually } from './github-sync.js';

export const ui = { inboxOpen: true, doneOpen: {}, pendingRemove: {}, syncing: false, syncError: null, editingTask: null };

export function renderApp(st) {
  st._ui = ui; // renderSyncStatus reads sync UI state off the state object it's already passed
  return R.renderSyncStatus(st) + R.renderStats(st) + R.renderFocus(st, findTaskWithProject) + R.renderDone(st) + R.renderInbox(st, ui)
    + '<div class="projects-grid">' + st.projects.map((p) => R.renderProjectCard(p, ui, st.categories)).join('') + '</div>'
    + R.renderAddProjectForm();
}

export function paint() {
  const scrollY = window.scrollY;
  document.getElementById('app').innerHTML = renderApp(state);
  window.scrollTo(0, scrollY);
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
}

function onAppChange(e) {
  if (e.target.matches && e.target.matches('[data-action="toggle-task"]')) {
    M.toggleTask(e.target.getAttribute('data-task'), e.target.getAttribute('data-project'));
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
    M.addTask(addTaskForm.getAttribute('data-project'), fd.get('title'), fd.get('energy'), fd.get('deadline'), categoryId);
    return;
  }
  const addProjectForm = e.target.closest('[data-action="add-project"]');
  if (addProjectForm) {
    e.preventDefault();
    M.addProject(new FormData(addProjectForm).get('name'), nextHue);
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
      title: fd.get('title'), energy: fd.get('energy'), deadline: fd.get('deadline'), categoryId: editCategoryId,
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
  app.addEventListener('submit', onAppSubmit);
  app.addEventListener('keydown', onAppKeydown);
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
