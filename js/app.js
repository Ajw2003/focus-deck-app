// focus-deck-app/js/app.js
import { state, findTaskWithProject, findProjectIdForTask, candidatesForEnergy, cssColorToHex, storageProblem, onExternalStateChange, requestPersistentStorage, TASK_KINDS } from './state.js';
import * as M from './mutations.js';
import * as R from './render.js';
import { registerPaint, initSyncLifecycle, pullFromGist } from './sync.js';
import { syncGithub, addRepoManually, linkTaskToIssue, unlinkTask, createGithubIssueFromTask } from './github-sync.js';
import { getToken } from './github.js';
import { filterAndSortProjects } from './project-filter.js';

// Which projects are minimised is a per-device layout choice, so it lives in this browser's
// storage rather than in the synced state.
const COLLAPSED_KEY = 'focusdeck-collapsed-projects';
function loadCollapsedProjects() {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY)) || {}; }
  catch (e) { console.error('Could not read minimised projects:', e); return {}; }
}
// The focus pick's chosen project pill, remembered per device like the minimised projects.
const FOCUS_FILTER_KEY = 'focusdeck-focus-filter';
function loadFocusFilter() {
  try { return JSON.parse(localStorage.getItem(FOCUS_FILTER_KEY)) || {}; }
  catch (e) { console.error('Could not read the focus pick filter:', e); return {}; }
}
function saveFocusFilter() {
  try { localStorage.setItem(FOCUS_FILTER_KEY, JSON.stringify(ui.focusFilter)); }
  catch (e) { console.error('Could not save the focus pick filter:', e); }
}

function saveCollapsedProjects() {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ui.projectCollapsed)); }
  catch (e) { console.error('Could not save minimised projects:', e); }
}

// Per-item scratch for the Unsorted flow (chosen project, ticked labels, typed new labels, "show
// all" toggles) plus this session's skip list and which queue item it belongs to. Reset whenever
// the current item changes -- see renderApp below.
function freshUnsortedScratch(skipped) {
  return { skipped: skipped || [], projectId: null, selected: [], newLabels: '', showAllLabels: false, showAllProjects: false, currentKey: null };
}

export const ui = { inboxOpen: true, doneOpen: {}, pendingRemove: {}, syncing: false, syncError: null, notice: null, editingTask: null, projectFilter: undefined, projectQuery: '', projectSort: 'name', projectCollapsed: loadCollapsedProjects(), focusFilter: loadFocusFilter(), editingProjectCategory: null, unsorted: freshUnsortedScratch() };

export function renderApp(st) {
  st._ui = ui; // renderSyncStatus reads sync UI state off the state object it's already passed
  if (storageProblem && !ui.syncError && !ui.storageProblemDismissed) ui.syncError = storageProblem;
  // a new current Unsorted item (someone filed/skipped/completed the last one, or the queue itself
  // changed under us -- a new capture, a task labelled elsewhere) starts with clean scratch
  const currentUnsorted = R.unsortedCurrent(st, ui.unsorted);
  const currentKey = currentUnsorted ? currentUnsorted.key : null;
  if (currentKey !== ui.unsorted.currentKey) ui.unsorted = Object.assign(freshUnsortedScratch(ui.unsorted.skipped), { currentKey });
  const visibleProjects = filterAndSortProjects(st.projects, { categoryId: ui.projectFilter, query: ui.projectQuery, sortBy: ui.projectSort });
  return R.renderProjectSidebar(st, ui, visibleProjects)
    + '<div class="main-col">'
      + R.renderSyncStatus(st) + R.renderFocus(st, findTaskWithProject, ui) + R.renderStats(st) + R.renderDone(st) + R.renderInbox(st, ui)
      + R.renderProjectFilterBar(st, ui, visibleProjects)
      + '<div class="projects-grid">' + visibleProjects.map((p) => R.renderProjectCard(p, ui, st.categories, st.projectCategories)).join('')
        + (st.projects.length && !visibleProjects.length ? '<p class="muted small">No projects match.</p>' : '')
      + '</div>'
      + R.renderAddProjectForm(st.projectCategories)
    + '</div>'
    + R.renderToast(ui.syncError || ui.notice, ui.syncError ? 'error' : 'info');
}

export function paint() {
  const scrollY = window.scrollY;
  const active = document.activeElement;
  // two search boxes exist (filter bar, and the wide-screen sidebar): keep focus in the one being typed in
  const restoreSearch = active && active.matches && active.matches('.project-search')
    ? { start: active.selectionStart, end: active.selectionEnd, selector: active.matches('.sidebar-search') ? '.sidebar-search' : '.project-search:not(.sidebar-search)' }
    : null;
  document.getElementById('app').innerHTML = renderApp(state);
  window.scrollTo(0, scrollY);
  if (restoreSearch) {
    const el = document.querySelector(restoreSearch.selector);
    if (el) { el.focus(); el.setSelectionRange(restoreSearch.start, restoreSearch.end); }
  }
}

registerPaint(paint);
onExternalStateChange(paint);

// Shared by the project card's delete-task button and the Unsorted card's Delete: same confirm
// text, same "can't be undone" warning about a linked issue.
function confirmDeleteTask(taskId, projectId) {
  const found = findTaskWithProject(taskId);
  const t = found && found.task;
  const title = t ? t.title : 'this task';
  const issueNote = t && t.source === 'github' && t.issueNumber != null
    ? ' Its GitHub issue #' + t.issueNumber + ' will be closed as "not planned" (you can reopen it on GitHub).'
    : '';
  return confirm('Delete "' + title + '"? This can\'t be undone.' + issueNote);
}

function onAppClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action');
  const taskId = el.getAttribute('data-task');
  const projectId = el.getAttribute('data-project');
  if (action === 'set-energy') M.setEnergyFocus(el.getAttribute('data-energy'), candidatesForEnergy);
  else if (action === 'surprise') M.surprise();
  else if (action === 'pick-focus') {
    // each card carries its full filter: its own label or project plus the pill chosen above it
    if (!M.pickFocus({ categoryId: el.getAttribute('data-category') || null, projectId: projectId || null })) {
      ui.notice = 'No open tasks match that label and project.';
      paint();
    }
  }
  else if (action === 'set-focus-scope') {
    ui.focusFilter.projectId = el.getAttribute('data-scope') || null;
    saveFocusFilter();
    paint();
  }
  else if (action === 'sort-toggle') {
    const token = el.getAttribute('data-token');
    const sel = ui.unsorted.selected;
    ui.unsorted.selected = sel.includes(token) ? sel.filter((x) => x !== token) : sel.concat(token);
    paint();
  }
  else if (action === 'sort-more-labels') { ui.unsorted.showAllLabels = !ui.unsorted.showAllLabels; paint(); }
  else if (action === 'unsorted-more-projects') { ui.unsorted.showAllProjects = !ui.unsorted.showAllProjects; paint(); }
  else if (action === 'unsorted-project') { ui.unsorted.projectId = el.getAttribute('data-project'); paint(); }
  else if (action === 'unsorted-change-project') { ui.unsorted.projectId = null; paint(); }
  else if (action === 'unsorted-file') {
    // read the project first: filing repaints, and the repaint resets ui.unsorted for the next item
    const targetId = ui.unsorted.projectId;
    const ids = unsortedSelectionToIds();
    const task = M.fileInboxItem(el.getAttribute('data-inbox'), targetId, ids);
    createIssueIfGithubProject(task, targetId);
    const project = state.projects.find((p) => p.id === targetId);
    ui.notice = 'Filed to ' + (project ? project.name : 'project') + '.';
    paint();
  }
  else if (action === 'unsorted-save') {
    const ids = unsortedSelectionToIds();
    if (ids.length) M.updateTaskFields(taskId, { categoryIds: ids });
    else { ui.unsorted.skipped = ui.unsorted.skipped.concat('t:' + taskId); paint(); }
  }
  else if (action === 'unsorted-skip') {
    const cur = R.unsortedCurrent(state, ui.unsorted);
    if (cur) ui.unsorted.skipped = ui.unsorted.skipped.concat(cur.key);
    paint();
  }
  else if (action === 'unsorted-restart') { ui.unsorted.skipped = []; paint(); }
  else if (action === 'unsorted-complete') {
    const inboxId = el.getAttribute('data-inbox');
    if (inboxId) M.completeInboxItem(inboxId);
    else M.setTaskStatus(taskId, 'done');
  }
  else if (action === 'unsorted-delete') {
    const inboxId = el.getAttribute('data-inbox');
    if (inboxId) {
      const item = state.inbox.find((i) => i.id === inboxId);
      const text = item ? item.text : 'this note';
      M.discardInbox(inboxId);
      ui.notice = 'Deleted "' + text + '".';
      paint();
    } else if (confirmDeleteTask(taskId, projectId)) {
      M.deleteTask(taskId, projectId);
    }
  }
  else if (action === 'toggle-focus-all') { ui.focusShowAll = !ui.focusShowAll; paint(); }
  else if (action === 'toggle-focus-projects') { ui.focusShowAllProjects = !ui.focusShowAllProjects; paint(); }
  else if (action === 'reroll') M.reroll();
  else if (action === 'clear-focus') M.clearFocus();
  else if (action === 'complete-focus') M.completeFocus(findProjectIdForTask);
  // M.setFocusTask doesn't exist -- the correct exported function is setFocus.
  else if (action === 'focus-task') M.setFocus(taskId);
  else if (action === 'cycle-energy') M.cycleEnergy(taskId, projectId);
  else if (action === 'cycle-priority') M.cyclePriority(taskId);
  else if (action === 'delete-task') {
    if (confirmDeleteTask(taskId, projectId)) M.deleteTask(taskId, projectId);
  }
  else if (action === 'remove-project') { ui.pendingRemove[projectId] = true; paint(); }
  else if (action === 'cancel-remove-project') { delete ui.pendingRemove[projectId]; paint(); }
  else if (action === 'confirm-remove-project') M.removeProject(projectId);
  else if (action === 'dismiss-toast') {
    if (ui.syncError === storageProblem) ui.storageProblemDismissed = true;
    ui.syncError = null;
    ui.notice = null;
    paint();
  }
  else if (action === 'toggle-inbox') { ui.inboxOpen = !ui.inboxOpen; paint(); }
  else if (action === 'toggle-done') { ui.doneOpen[projectId] = !ui.doneOpen[projectId]; paint(); }
  else if (action === 'scroll-project') scrollToProject(projectId);
  else if (action === 'sync-github') { syncGithub(ui).then(paint); }
  else if (action === 'pull-now') { pullFromGist().then(paint).catch((e) => { ui.syncError = e.message; paint(); }); }
  else if (action === 'edit-task') { ui.editingTask = { taskId, projectId }; paint(); }
  else if (action === 'cancel-task-edit') { ui.editingTask = null; paint(); }
  else if (action === 'set-project-filter') {
    const cat = el.getAttribute('data-category');
    ui.projectFilter = cat === '' ? undefined : (cat === '__uncat__' ? null : cat);
    paint();
  }
  else if (action === 'toggle-project-collapse') { ui.projectCollapsed[projectId] = !ui.projectCollapsed[projectId]; saveCollapsedProjects(); paint(); }
  else if (action === 'toggle-collapse-all') {
    const visible = filterAndSortProjects(state.projects, { categoryId: ui.projectFilter, query: ui.projectQuery, sortBy: ui.projectSort });
    const allCollapsed = visible.length > 0 && visible.every((p) => ui.projectCollapsed[p.id]);
    visible.forEach((p) => { ui.projectCollapsed[p.id] = !allCollapsed; });
    saveCollapsedProjects();
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

// Shared by every right-click-to-recolor entry point below. The picker's <input> is appended to
// <body>, outside #app — persist()'s full #app.innerHTML replace would otherwise destroy it
// mid-drag and close the picker. Only 'change' (fires once, on commit) persists; 'input' just
// live-updates the target element's own color for immediate feedback while dragging.
function openColorPicker(e, initialHex, onInput, onChange) {
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = initialHex;
  picker.style.cssText = 'position:fixed; opacity:0; width:1px; height:1px; pointer-events:none; left:' + e.clientX + 'px; top:' + e.clientY + 'px;';
  document.body.appendChild(picker);
  const cleanup = () => picker.remove();
  picker.addEventListener('input', () => onInput(picker.value));
  picker.addEventListener('change', () => { onChange(picker.value); cleanup(); });
  picker.addEventListener('blur', () => setTimeout(cleanup, 200));
  if (picker.showPicker) picker.showPicker(); else picker.click();
}

// Right-clicking a project's own color dot opens a picker that sets (and locks) that project's
// color directly — see setProjectColor in mutations.js. Right-clicking a category chip (task or
// project category) recolors the category itself instead.
function onAppContextMenu(e) {
  const dot = e.target.closest('[data-project-color]');
  if (dot) {
    e.preventDefault();
    const projectId = dot.getAttribute('data-project-color');
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const card = dot.closest('.project-card');
    openColorPicker(e, cssColorToHex(project.color),
      (hex) => { if (card) card.style.setProperty('--proj-color', hex); },
      (hex) => M.setProjectColor(projectId, hex));
    return;
  }

  const chip = e.target.closest('[data-cat-id]');
  if (!chip) return;
  e.preventDefault();
  const catId = chip.getAttribute('data-cat-id');
  const catType = chip.getAttribute('data-cat-type');
  const list = catType === 'project' ? state.projectCategories : state.categories;
  const cat = list.find((c) => c.id === catId);
  if (!cat) return;
  openColorPicker(e, cssColorToHex(cat.color),
    (hex) => chip.style.setProperty('--chip-color', hex),
    (hex) => { if (catType === 'project') M.setProjectCategoryColor(catId, hex); else M.setCategoryColor(catId, hex); });
}

function onAppChange(e) {
  if (e.target.matches && e.target.matches('.label-picker input[name="categoryIds"]')) {
    const picker = e.target.closest('.label-picker');
    picker.querySelector('summary').textContent = R.labelPickerSummary(picker.querySelectorAll('input[name="categoryIds"]:checked').length);
  } else if (e.target.matches && e.target.matches('[data-action="toggle-task"]')) {
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
      categoryId = name ? M.addProjectCategory(name).id : '';
    }
    M.setProjectCategory(projectId, categoryId || null);
  }
}

function onAppInput(e) {
  // keep typed-in new labels across the repaints that toggling a pick causes
  if (e.target.matches && e.target.matches('.sort-new')) { ui.unsorted.newLabels = e.target.value; return; }
  if (e.target.matches && e.target.matches('[data-action="set-project-query"]')) {
    ui.projectQuery = e.target.value;
    paint();
  }
}

// A label's id by name, ignoring case; creates the label (with color, if given) when it doesn't exist.
function labelIdByName(name, color) {
  const existing = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return existing ? existing.id : M.addCategory(name, color).id;
}

// The ticked labels plus any typed into "New labels" (comma-separated); a typed name that matches
// an existing label, ignoring case, reuses it instead of making a duplicate.
function labelsFromForm(fd) {
  const ids = fd.getAll('categoryIds');
  String(fd.get('newLabels') || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((name) => {
    const id = labelIdByName(name);
    if (!ids.includes(id)) ids.push(id);
  });
  return ids;
}

// The Unsorted flow's picks as label ids: chosen labels, the #42 kinds (a kind's label is created
// on first use), and anything typed into its "New labels" field.
function unsortedSelectionToIds() {
  const ids = [];
  const add = (id) => { if (!ids.includes(id)) ids.push(id); };
  ui.unsorted.selected.forEach((token) => {
    const kind = token.startsWith('kind:') && TASK_KINDS.find((k) => 'kind:' + k.key === token);
    add(kind ? labelIdByName(kind.key, kind.color) : token);
  });
  String(ui.unsorted.newLabels || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((name) => add(labelIdByName(name)));
  return ids;
}

// A task added to (or filed into) a GitHub project becomes an issue straight away, through the same
// path as "+ Create issue" (duplicate check included). If that fails the task stays local and the
// edit form's "+ Create issue" retries.
// See docs/4-systems/github-sync.md#creating-an-issue-from-a-task--creategithubissuefromtask-jsgithub-syncjs176
function createIssueIfGithubProject(task, projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (task && project && project.source === 'github' && project.repoFullName) {
    createGithubIssueFromTask(task.id, project.repoFullName, ui).then(paint);
  }
}

function onAppSubmit(e) {
  const addTaskForm = e.target.closest('[data-action="add-task"]');
  if (addTaskForm) {
    e.preventDefault();
    const fd = new FormData(addTaskForm);
    const projectId = addTaskForm.getAttribute('data-project');
    const task = M.addTask(projectId, fd.get('title'), fd.get('energy'), fd.get('deadline'), labelsFromForm(fd), fd.get('steps'), fd.get('priority'));
    createIssueIfGithubProject(task, projectId);
    return;
  }
  const addProjectForm = e.target.closest('[data-action="add-project"]');
  if (addProjectForm) {
    e.preventDefault();
    const fd = new FormData(addProjectForm);
    let categoryId = fd.get('category');
    if (categoryId === '__new__') {
      const name = prompt('New project category name:');
      categoryId = name ? M.addProjectCategory(name).id : '';
    }
    // addProject(name, categoryId) -- was previously passing nextHue itself (a function
    // reference, not a color) as the 2nd arg, so categoryId silently never made it onto the
    // project. See addProject's own comment in mutations.js.
    M.addProject(fd.get('name'), categoryId);
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
    M.editTask(editForm.getAttribute('data-task'), editForm.getAttribute('data-project'), {
      title: fd.get('title'), energy: fd.get('energy'), deadline: fd.get('deadline'), categoryIds: labelsFromForm(fd), steps: fd.get('steps'), priority: fd.get('priority'),
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

// Jumps to a project's card. It is opened first if minimised, and the project filter and search are
// cleared if they hide it, so the jump always lands on the project's task list.
function scrollToProject(projectId) {
  if (!state.projects.some((p) => p.id === projectId)) return;
  let changed = false;
  if (ui.projectCollapsed[projectId]) { ui.projectCollapsed[projectId] = false; saveCollapsedProjects(); changed = true; }
  if (!document.getElementById('proj-' + projectId)) { ui.projectFilter = undefined; ui.projectQuery = ''; changed = true; }
  if (changed) paint();
  const target = document.getElementById('proj-' + projectId);
  if (!target) return;
  // stop just below the sticky header (its height varies with width), not underneath it
  const header = document.querySelector('.topbar');
  const top = target.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

// GitHub syncs by itself when the app opens and whenever it comes back to the foreground, once the
// Gist sync for that moment has settled. At most once a minute, so quick app switching doesn't
// hammer GitHub; the "Sync GitHub" button always works. See docs/4-systems/github-sync.md#auto-sync
const AUTO_SYNC_MIN_GAP_MS = 60 * 1000;
let lastAutoSync = 0;
function autoSyncGithub() {
  if (!getToken() || ui.syncing || Date.now() - lastAutoSync < AUTO_SYNC_MIN_GAP_MS) return;
  lastAutoSync = Date.now();
  const running = syncGithub(ui);
  paint(); // show "Syncing…" straight away
  running.then(paint);
}

function init() {
  requestPersistentStorage();
  paint();
  initSyncLifecycle(autoSyncGithub);
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
