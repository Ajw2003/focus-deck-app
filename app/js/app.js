// focus-deck-app/js/app.js
import { state, findTaskWithProject, findProjectIdForTask, cssColorToHex, storageProblem, onExternalStateChange, requestPersistentStorage } from './state.js';
import * as M from './mutations.js';
import * as R from './render.js';
import { registerPaint, initSyncLifecycle } from './sync.js';
import {
  syncGithub, addRepoManually, linkTaskToIssue, unlinkTask, createGithubIssueFromTask,
  parseRepoInput, listYourRepos, untrackedRepos, isValidRepoName, REPO_NAME_RULE,
  createRepoAndTrack, linkProjectToRepoOnGithub, linkProjectToRepoByInput, transferTaskIssue,
} from './github-sync.js';
import { getToken } from './github.js';
import { initProjectDrag, isDragging } from './project-drag.js';
import { taskOrderChanges, sortTasks, planTaskMove } from './task-move.js';
import { confirmMove } from './move-dialog.js';
import { dueMoment } from './due-stage.js';
import { startComplete, phaseClasses } from './focus-complete.js';
import { mountWallets } from './wallet.js';
import { renderInTrayCard, unsortedCurrent } from './in-tray-view.js';
import { sendToBack, toggleToken, toggleFolder, fileSlip } from './in-tray.js';
import { applyNoteFace } from './note-face.js';
import { filterAndSortProjects, resolveSelectedProject, resolveProjectView, moveProject } from './project-filter.js';

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

// Which project is open at a time on wide screens (Q22b, Q23a, #82) is a per-device layout
// choice, like the collapsed projects above -- not synced state.
const SELECTED_PROJECT_KEY = 'focusdeck-selected-project';
function loadSelectedProjectId() {
  try { return localStorage.getItem(SELECTED_PROJECT_KEY) || null; }
  catch (e) { console.error('Could not read the selected project:', e); return null; }
}
function saveSelectedProjectId(id) {
  try { localStorage.setItem(SELECTED_PROJECT_KEY, id || ''); }
  catch (e) { console.error('Could not save the selected project:', e); }
}

// The app's one layout breakpoint: from 1100px the "All" view is 2x2 tiles, below it every project
// stacks at its natural height. This constant mirrors the `@media (min-width:1100px)` queries in
// css/app.css -- the two are coupled only by both spelling 1100 the same way.
const WIDE_BREAKPOINT_PX = 1100;
function isWideScreen() {
  return typeof matchMedia === 'function' && matchMedia('(min-width:' + WIDE_BREAKPOINT_PX + 'px)').matches;
}

// "All" or "One" (PR 6, 2026-09-27) is a per-device layout choice, like the collapsed projects and
// selected project above -- not synced state. Resolved once at load against the width at the time
// (resolveProjectView, js/project-filter.js); once the user picks, it holds on this device at every
// width from then on. See docs/6-decisions/Decisions.md.
const PROJECT_VIEW_KEY = 'focusdeck-project-view';
function loadProjectView() {
  try { return localStorage.getItem(PROJECT_VIEW_KEY); }
  catch (e) { console.error('Could not read the project view:', e); return null; }
}
function saveProjectView(view) {
  try { localStorage.setItem(PROJECT_VIEW_KEY, view); }
  catch (e) { console.error('Could not save the project view:', e); }
}

// The project sort is a per-device choice too (PR 9): a drag switches it to "custom", and it has to
// still be "custom" after a reload, or the person's order would look lost.
const PROJECT_SORT_KEY = 'focusdeck-project-sort';
const PROJECT_SORTS = ['name', 'open-tasks', 'deadline', 'recent-sync', 'custom'];
function loadProjectSort() {
  try { const v = localStorage.getItem(PROJECT_SORT_KEY); return PROJECT_SORTS.includes(v) ? v : 'name'; }
  catch (e) { console.error('Could not read the project sort:', e); return 'name'; }
}
function saveProjectSort() {
  try { localStorage.setItem(PROJECT_SORT_KEY, ui.projectSort); }
  catch (e) { console.error('Could not save the project sort:', e); }
}

// Per-slip scratch for the Unsorted in-tray (chosen folder, flags stuck on, typed new labels, the
// card facing in each wallet) plus this session's "Later" list and which slip it belongs to. Reset
// whenever the top slip changes -- see renderApp below. See docs/4-systems/in-tray.md
function freshUnsortedScratch(later) {
  return { later: later || [], projectId: null, selected: [], newLabels: '', facingFolder: null, facingFlag: null, currentKey: null };
}

export const ui = {
  completing: null, // the sticky note's "I've done it" sequence in progress (js/focus-complete.js)
  inboxOpen: true, doneOpen: {}, pendingRemove: {}, syncing: false, syncError: null, notice: null, editingTask: null,
  projectFilter: undefined, projectQuery: '', projectSort: loadProjectSort(), projectCollapsed: loadCollapsedProjects(),
  focusFilter: loadFocusFilter(), editingProject: {}, addingTask: {}, unsorted: freshUnsortedScratch(),
  projectsDrawerOpen: false, selectedProjectId: loadSelectedProjectId(), projectView: resolveProjectView(loadProjectView(), isWideScreen()),
  // The "+ New" panel (PR 7, Q29a) and the Edit panel's inline "Link to GitHub repo" chooser
  // (Q30c) -- neither persisted, both reset to closed on load.
  newPanelOpen: false, newPanelTab: 'project', newPanelRepos: null, newPanelRepoFilter: '',
  newPanelCreateOpen: false, newPanelCreating: false, newPanelCreateError: null, newPanelPasteError: null,
  linkPanel: null,
};

// ---- The focus picker's wallets (js/wallet.js) -------------------------------------------------
// A flip of the project wallet is remembered per device (the same focusdeck-focus-filter as the old
// pills) and re-renders only the category wallet, so the project wallet's scroll animation is not
// cut off by a whole repaint. Choosing a card draws a task from it.
function announceWallet(text) {
  // the in-tray's wallets have their own live region, for when the focus wallets aren't on screen
  const live = document.getElementById('wallet-live') || document.getElementById('tray-live');
  if (live) live.textContent = text;
}

const walletHooks = {
  announce: announceWallet,
  onFacing(name, key) {
    if (name === 'projects') {
      ui.focusFilter.projectId = key === R.ALL_PROJECTS_KEY ? null : key;
      saveFocusFilter();
      const slot = document.getElementById('category-wallet');
      if (slot) { slot.innerHTML = R.renderCategoryWalletInner(state, ui); mountWallets(slot, walletHooks); }
    } else if (name === 'categories') {
      ui.focusCategory = key;
    } else if (name === 'tray-folders') {
      ui.unsorted.facingFolder = key;
    } else if (name === 'tray-flags') {
      ui.unsorted.facingFlag = key;
    }
  },
  // Returns false when nothing could be drawn (the card goes back down).
  onChoose(name, key) {
    // the in-tray's wallets don't draw a task: choosing puts a folder or a flag on the slip, and
    // choosing it again takes it off
    if (name === 'tray-folders') {
      ui.unsorted.projectId = toggleFolder(ui.unsorted.projectId, key);
      ui.unsorted.facingFolder = key;
      paint();
      return true;
    }
    if (name === 'tray-flags') {
      ui.unsorted.selected = toggleToken(ui.unsorted.selected, key);
      ui.unsorted.facingFlag = key;
      paint();
      return true;
    }
    const projectId = name === 'projects'
      ? (key === R.ALL_PROJECTS_KEY ? null : key)
      : R.focusProjectId(state, ui);
    const categoryId = name === 'categories' && key !== R.ANY_CATEGORY_KEY ? key : null;
    if (M.pickFocus({ categoryId, projectId })) return true;
    ui.notice = 'No open tasks match that label and project.';
    paint();
    return false;
  },
};

export function renderApp(st) {
  applyNoteFace(st.noteFace && st.noteFace.face); // also after a sync brings in another device's choice
  st._ui = ui; // the sync button reads sync UI state off the state object it's already passed
  if (storageProblem && !ui.syncError && !ui.storageProblemDismissed) ui.syncError = storageProblem;
  // a new current Unsorted item (someone filed/sent to the back/completed the last one, or the queue itself
  // changed under us -- a new capture, a task labelled elsewhere) starts with clean scratch
  const currentUnsorted = unsortedCurrent(st, ui.unsorted);
  const currentKey = currentUnsorted ? currentUnsorted.key : null;
  if (currentKey !== ui.unsorted.currentKey) ui.unsorted = Object.assign(freshUnsortedScratch(ui.unsorted.later), { currentKey });
  const visibleProjects = filterAndSortProjects(st.projects, { categoryId: ui.projectFilter, query: ui.projectQuery, sortBy: ui.projectSort });
  // Resolved against every project, not just the filtered/searched list -- the selected project
  // stays selected in the "One" view even if a search or category filter hides it from the list.
  ui.selectedProjectId = resolveSelectedProject(st.projects, ui.selectedProjectId);
  const hasToken = !!getToken();
  return R.renderProjectSidebar(st, ui, visibleProjects, hasToken)
    + '<div class="main-col view-' + ui.projectView + '">'
      + R.renderFocus(st, findTaskWithProject, ui) + renderInTrayCard(st, ui)
      + R.renderProjectsMain(st, ui, visibleProjects, isWideScreen(), hasToken)
    + '</div>'
    + R.renderToast(ui.syncError || ui.notice, ui.syncError ? 'error' : 'info');
}

// The topbar's sync button and Projects toggle live outside #app (see index.html), so paint()
// updates them directly instead of through the innerHTML replace below.
function paintHeaderControls() {
  const syncSlot = document.getElementById('topbar-sync');
  if (syncSlot) syncSlot.innerHTML = R.renderSyncButton(state);
  const projectsBtn = document.getElementById('projects-btn');
  if (projectsBtn) projectsBtn.setAttribute('aria-expanded', String(!!ui.projectsDrawerOpen));
}

// A repaint mid-drag (a sync landing, say) would tear down the elements being dragged, so it waits
// until the drag ends (js/project-drag.js calls onEnd, below).
let paintWaitingOnDrag = false;

export function paint() {
  if (isDragging()) { paintWaitingOnDrag = true; return; }
  const scrollY = window.scrollY;
  const active = document.activeElement;
  // the one project search box (the sidebar/drawer's)
  const restoreSearch = active && active.matches && active.matches('.project-search')
    ? { start: active.selectionStart, end: active.selectionEnd }
    : null;
  document.getElementById('app').innerHTML = renderApp(state);
  paintHeaderControls();
  mountWallets(document.getElementById('app'), walletHooks);
  window.scrollTo(0, scrollY);
  if (restoreSearch) {
    const el = document.querySelector('.project-search');
    if (el) { el.focus(); el.setSelectionRange(restoreSearch.start, restoreSearch.end); }
  }
}

registerPaint(paint);
onExternalStateChange(paint);

// A drop or arrow key from js/project-drag.js: works out the new sortOrder among the displayed
// order it was given, and only if something changes switches the sort to Custom and saves.
function moveProjectTo(id, toIndex, orderedIds) {
  const changes = moveProject(state.projects, id, toIndex, orderedIds);
  if (!Object.keys(changes).length) return false;
  ui.projectSort = 'custom';
  saveProjectSort();
  M.applySortOrders(changes); // saves, schedules the Gist push and repaints
  return true;
}

// A dropped (or arrow-keyed) task from js/project-drag.js (PR 11). Within its own project it is a
// re-order and/or a status change (into the other group). Into another project it is a move, which
// first asks when it would touch GitHub (planTaskMove says); Cancel changes nothing. Returns true
// when something changed or a question was asked. The GitHub half of a confirmed move runs after
// the task has moved here, and a refusal leaves it moved (github-sync.js transferTaskIssue, and
// the create-issue branch below).
function moveTaskTo(req) {
  const found = findTaskWithProject(req.taskId);
  const to = state.projects.find((p) => p.id === req.toProjectId);
  if (!found || !to) return false;
  const { task, project: from } = found;
  const group = sortTasks(to.tasks.filter((t) => t.status === req.status));
  const changes = taskOrderChanges(group, task.id, req.toIndex);
  if (from.id === to.id) {
    if (task.status === req.status && !Object.keys(changes).length) return false;
    return M.applyTaskMove({ taskId: task.id, toProjectId: to.id, status: req.status, changes });
  }
  const plan = planTaskMove(task, from, to);
  // (re-read by id when it runs: a sync landing while the question was open replaces state's objects)
  const run = () => {
    const now = findTaskWithProject(req.taskId);
    const dest = state.projects.find((p) => p.id === req.toProjectId);
    if (!now || !dest) return;
    const order = taskOrderChanges(sortTasks(dest.tasks.filter((t) => t.status === req.status)), req.taskId, req.toIndex);
    M.applyTaskMove({ taskId: req.taskId, toProjectId: dest.id, status: req.status, changes: order });
    const title = now.task.title;
    if (plan.kind === 'create-issue') {
      createGithubIssueFromTask(req.taskId, dest.repoFullName, ui).then(() => {
        const t = findTaskWithProject(req.taskId);
        if (ui.syncError) ui.syncError = 'Moved “' + title + '” to ' + dest.name + ', but it stays unlinked. ' + ui.syncError;
        else if (t && t.task.source === 'github') ui.notice = 'Moved “' + title + '” to ' + dest.name + ' and linked it to ' + t.task.repoFullName + '#' + t.task.issueNumber + '.';
        paint();
      });
    } else if (plan.kind === 'transfer') {
      transferTaskIssue(req.taskId, dest.repoFullName, ui, dest.name).then(paint);
    }
  };
  if (!plan.confirm) { run(); return true; }
  confirmMove(plan.message, '.task-grip[data-task="' + task.id + '"]').then((ok) => { if (ok) run(); });
  return true;
}

function announceDrag(text) {
  const live = document.getElementById('drag-live');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 30);
}

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

// "I've done it": the box ticks, the title is crossed out, the note peels away, THEN the task is
// completed through the same M.completeFocus path as before (so the GitHub completion sync is
// unchanged). Animating first and mutating last means the repaint the mutation causes is the end of
// the sequence, not something that cuts it off. Reduced motion skips straight to the mutation.
function completeFocusWithNote() {
  if (!state.focus) return;
  const taskId = state.focus.taskId;
  startComplete(ui, taskId, {
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    setPhase: drawCompletePhase,
    isCurrent: () => !!state.focus && state.focus.taskId === taskId,
    complete: () => M.completeFocus(findProjectIdForTask),
    finish: paint,
    wait: (ms, fn) => setTimeout(fn, ms),
  });
}

// Draws a phase on the live DOM (a full repaint would replace the elements and restart nothing: the
// transitions only run when a class is added to an element already on the page).
function drawCompletePhase(phase) {
  const want = phaseClasses(phase);
  const button = document.querySelector('.focus-active .check-btn');
  const note = document.querySelector('.focus-active .note');
  if (button) button.classList.toggle('is-ticked', want.button.includes('is-ticked'));
  if (note) ['is-crossed', 'is-peeling'].forEach((c) => note.classList.toggle(c, want.note.includes(c)));
}

function onAppClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action');
  const taskId = el.getAttribute('data-task');
  const projectId = el.getAttribute('data-project');
  if (action === 'skip-due-step') {
    const form = el.closest('form');
    el.closest('.due-step').remove();
    if (form) form.querySelector('input[name="deadline"]').focus();
    return;
  }
  if (action === 'unsorted-file' || action === 'unsorted-save') {
    // filing repaints, and the repaint resets ui.unsorted for the next slip, so read it all first
    const cur = unsortedCurrent(state, ui.unsorted);
    if (!cur) return;
    const pick = { projectId: ui.unsorted.projectId, selected: ui.unsorted.selected, newLabels: ui.unsorted.newLabels };
    const done = fileSlip(cur, pick, {
      fileInboxItem: M.fileInboxItem, updateTaskFields: M.updateTaskFields,
      createIssue: createIssueIfGithubProject, labelIdByName,
    });
    if (done.outcome === 'filed') {
      const project = state.projects.find((p) => p.id === done.projectId);
      ui.notice = 'Filed to ' + (project ? project.name : 'project') + '.';
      paint();
    } else if (done.outcome === 'later') {
      ui.unsorted.later = sendToBack(ui.unsorted.later, cur.key);
      paint();
    }
  }
  else if (action === 'unsorted-skip') {
    const cur = unsortedCurrent(state, ui.unsorted);
    if (cur) ui.unsorted.later = sendToBack(ui.unsorted.later, cur.key);
    paint();
  }
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
  else if (action === 'reroll') M.reroll();
  else if (action === 'clear-focus') M.clearFocus();
  else if (action === 'complete-focus') completeFocusWithNote();
  // M.setFocusTask doesn't exist -- the correct exported function is setFocus.
  // "Focus on this" lives in the edit form now (Q14a, Q12f) -- picking a task closes the form.
  else if (action === 'focus-task') { ui.editingTask = null; M.setFocus(taskId); }
  else if (action === 'cycle-priority') M.cyclePriority(taskId);
  else if (action === 'delete-task') {
    if (confirmDeleteTask(taskId, projectId)) { ui.editingTask = null; M.deleteTask(taskId, projectId); }
  }
  else if (action === 'remove-project') { ui.pendingRemove[projectId] = true; paint(); }
  else if (action === 'cancel-remove-project') { delete ui.pendingRemove[projectId]; paint(); }
  else if (action === 'confirm-remove-project') { delete ui.editingProject[projectId]; M.removeProject(projectId); }
  else if (action === 'open-project-edit') { ui.editingProject[projectId] = true; paint(); }
  else if (action === 'close-project-edit') { delete ui.editingProject[projectId]; delete ui.pendingRemove[projectId]; ui.linkPanel = null; paint(); }
  else if (action === 'toggle-new-panel') {
    if (ui.newPanelOpen) {
      closeNewPanel();
      paint();
      document.getElementById('new-panel-toggle') && document.getElementById('new-panel-toggle').focus();
    } else {
      ui.newPanelOpen = true;
      if (ui.newPanelTab === 'repo') fetchNewPanelRepos();
      paint();
      focusNewPanelFirstField();
    }
  }
  else if (action === 'set-new-panel-tab') {
    ui.newPanelTab = el.getAttribute('data-tab') === 'repo' ? 'repo' : 'project';
    if (ui.newPanelTab === 'repo' && !ui.newPanelRepos) fetchNewPanelRepos();
    paint();
    focusNewPanelFirstField();
  }
  else if (action === 'retry-new-panel-repos') fetchNewPanelRepos();
  else if (action === 'track-repo') {
    const fullName = el.getAttribute('data-repo');
    addRepoManually(fullName, ui).then(() => {
      const project = state.projects.find((p) => p.source === 'github' && p.repoFullName === fullName);
      closeNewPanel();
      if (project) afterProjectAdded(project.id); else paint();
    });
  }
  else if (action === 'toggle-link-panel') {
    if (ui.linkPanel && ui.linkPanel.projectId === projectId && ui.linkPanel.open) { ui.linkPanel = null; paint(); return; }
    ui.linkPanel = { projectId, open: true, repos: null, error: null };
    fetchLinkPanelRepos(projectId);
    paint();
  }
  else if (action === 'retry-link-panel-repos') fetchLinkPanelRepos(ui.linkPanel && ui.linkPanel.projectId);
  else if (action === 'link-repo') {
    const fullName = el.getAttribute('data-repo');
    const forProjectId = ui.linkPanel && ui.linkPanel.projectId;
    const repos = (ui.linkPanel && ui.linkPanel.repos && ui.linkPanel.repos.list) || [];
    const repo = repos.find((r) => r.full_name === fullName);
    if (!forProjectId || !repo) return;
    linkProjectToRepoOnGithub(forProjectId, repo, ui).then((result) => {
      if (result.error) { ui.linkPanel.error = result.error; paint(); return; }
      ui.linkPanel = null;
      delete ui.editingProject[forProjectId];
      paint();
    });
  }
  else if (action === 'open-add-task') { ui.addingTask[projectId] = true; paint(); scrollOpenedFormIntoView('.add-task-form'); }
  else if (action === 'cancel-add-task') { delete ui.addingTask[projectId]; paint(); }
  else if (action === 'dismiss-toast') {
    if (ui.syncError === storageProblem) ui.storageProblemDismissed = true;
    ui.syncError = null;
    ui.notice = null;
    paint();
  }
  else if (action === 'toggle-inbox') { ui.inboxOpen = !ui.inboxOpen; paint(); }
  else if (action === 'toggle-done') { ui.doneOpen[projectId] = !ui.doneOpen[projectId]; paint(); }
  else if (action === 'scroll-project') scrollToProject(projectId);
  else if (action === 'sync-github') manualSyncGithub();
  else if (action === 'toggle-projects-drawer') { setProjectsDrawerOpen(!ui.projectsDrawerOpen); }
  else if (action === 'close-projects-drawer') { setProjectsDrawerOpen(false); }
  else if (action === 'edit-task') { ui.editingTask = { taskId, projectId }; paint(); scrollOpenedFormIntoView('.task-edit-form'); }
  else if (action === 'cancel-task-edit') { ui.editingTask = null; paint(); }
  else if (action === 'set-project-filter') {
    const cat = el.getAttribute('data-category');
    ui.projectFilter = cat === '' ? undefined : (cat === '__uncat__' ? null : cat);
    paint();
  }
  else if (action === 'toggle-project-collapse') { ui.projectCollapsed[projectId] = !ui.projectCollapsed[projectId]; saveCollapsedProjects(); paint(); }
  else if (action === 'set-project-view') {
    const view = el.getAttribute('data-view');
    if (view === 'all' || view === 'one') { ui.projectView = view; saveProjectView(view); }
    // Left open on phones (the switch lives in the drawer there) so the person sees the view
    // change take effect behind it, rather than closing over the very thing they just changed.
    paint();
  }
  else if (action === 'toggle-collapse-all') {
    const visible = filterAndSortProjects(state.projects, { categoryId: ui.projectFilter, query: ui.projectQuery, sortBy: ui.projectSort });
    const allCollapsed = visible.length > 0 && visible.every((p) => ui.projectCollapsed[p.id]);
    visible.forEach((p) => { ui.projectCollapsed[p.id] = !allCollapsed; });
    saveCollapsedProjects();
    paint();
  }
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

// Colour without right-click (#95): the Edit panel's colour inputs and the label picker's swatches.
// Same split as settings.html: 'input' only previews on the elements already on screen (a repaint
// mid-drag would close the native picker), 'change' commits through the mutation right-click uses.
function colorInputTarget(e) {
  return e.target.matches && e.target.matches('input[data-color-for]') ? e.target : null;
}
function onColorInput(el) {
  const kind = el.getAttribute('data-color-for'), id = el.getAttribute('data-id'), hex = el.value;
  if (kind === 'project') {
    const card = el.closest('.project-card');
    if (card) card.style.setProperty('--proj-color', hex);
  } else {
    const type = kind === 'project-category' ? 'project' : 'task';
    document.querySelectorAll('#app [data-cat-id="' + id + '"][data-cat-type="' + type + '"]').forEach((c) => c.style.setProperty('--chip-color', hex));
    const opt = el.closest('.label-option');
    if (opt) opt.style.setProperty('--chip-color', hex);
  }
}
function onColorChange(el) {
  const kind = el.getAttribute('data-color-for'), id = el.getAttribute('data-id');
  if (kind === 'project') M.setProjectColor(id, el.value);
  else if (kind === 'project-category') M.setProjectCategoryColor(id, el.value);
  else M.setCategoryColor(id, el.value);
}

function onAppChange(e) {
  const colorEl = colorInputTarget(e);
  if (colorEl) { onColorChange(colorEl); return; }
  if (e.target.matches && e.target.matches('.add-task-form input[name="deadline"], .task-edit-form input[name="deadline"]')) { syncDueStageStep(e.target); return; }
  if (e.target.matches && e.target.matches('.due-step select')) {
    const step = e.target.closest('.due-step');
    const yellow = step.querySelector('select[name="dueYellow"]'), red = step.querySelector('select[name="dueRed"]');
    const due = dueMoment({ deadline: step.closest('form').querySelector('input[name="deadline"]').value });
    // red must stay shorter than yellow, so a new yellow rebuilds the red choices
    if (e.target === yellow && due !== null) red.innerHTML = R.dueRedOptions(due - Date.now(), Number(yellow.value), Number(red.value));
    step.querySelector('input[name="dueStepChosen"]').value = '1';
    return;
  }
  if (e.target.matches && e.target.matches('.label-picker input[name="categoryIds"]')) {
    const picker = e.target.closest('.label-picker');
    picker.querySelector('summary').textContent = R.labelPickerSummary(picker.querySelectorAll('input[name="categoryIds"]:checked').length);
  } else if (e.target.matches && e.target.matches('[data-action="toggle-task"]')) {
    M.toggleTask(e.target.getAttribute('data-task'), e.target.getAttribute('data-project'));
  } else if (e.target.matches && e.target.matches('[data-action="set-project-sort"]')) {
    ui.projectSort = e.target.value;
    saveProjectSort();
    paint();
  } else if (e.target.matches && e.target.matches('[data-action="set-project-category"]')) {
    const projectId = e.target.getAttribute('data-project');
    let categoryId = e.target.value;
    if (categoryId === '__new__') {
      const name = prompt('New project category name:');
      categoryId = name ? M.addProjectCategory(name).id : '';
    }
    M.setProjectCategory(projectId, categoryId || null);
  }
}

function onAppInput(e) {
  const colorEl = colorInputTarget(e);
  if (colorEl) { onColorInput(colorEl); return; }
  // keep typed-in new labels across the repaints that toggling a pick causes
  if (e.target.matches && e.target.matches('.sort-new')) { ui.unsorted.newLabels = e.target.value; return; }
  if (e.target.matches && e.target.matches('[data-action="set-project-query"]')) {
    ui.projectQuery = e.target.value;
    paint();
  }
  if (e.target.matches && e.target.matches('.repo-filter')) {
    ui.newPanelRepoFilter = e.target.value;
    paint();
    const field = document.querySelector('.repo-filter');
    if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
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

// After adding a project from the "+ New" panel (Q29a, Q12d): select it in the "One" view, or in
// "All" just scroll to its new card/tile once it's rendered -- the same split as scrollToProject.
function afterProjectAdded(projectId) {
  if (ui.projectView === 'one') {
    ui.selectedProjectId = projectId;
    saveSelectedProjectId(projectId);
  }
  scrollProjectAfterPaint(projectId);
}

// The "+ New" panel's "Your repos" tab (Q29a): fetched once when the tab first opens, cached in
// ui.newPanelRepos until closed. Errors show inline with a Retry (retry-new-panel-repos).
function fetchNewPanelRepos() {
  ui.newPanelRepos = { loading: true };
  paint();
  listYourRepos().then((repos) => {
    ui.newPanelRepos = { list: untrackedRepos(repos, state.projects, state.excludedRepos) };
    paint();
  }).catch((e) => {
    ui.newPanelRepos = { error: e.message };
    paint();
  });
}

// The Edit panel's inline "Link to GitHub repo" chooser (Q30c) -- same idea, its own cache slot.
function fetchLinkPanelRepos(projectId) {
  listYourRepos().then((repos) => {
    if (!ui.linkPanel || ui.linkPanel.projectId !== projectId) return; // panel closed/changed meanwhile
    ui.linkPanel.repos = { list: untrackedRepos(repos, state.projects, state.excludedRepos) };
    paint();
  }).catch((e) => {
    if (!ui.linkPanel || ui.linkPanel.projectId !== projectId) return;
    ui.linkPanel.repos = { error: e.message };
    paint();
  });
}

function closeNewPanel() {
  ui.newPanelOpen = false;
  ui.newPanelTab = 'project';
  ui.newPanelRepos = null;
  ui.newPanelRepoFilter = '';
  ui.newPanelCreateOpen = false;
  ui.newPanelCreateError = null;
  ui.newPanelPasteError = null;
}

// Escape inside the panel closes it and returns focus to "+ New" (Q29a).
function focusNewPanelFirstField() {
  requestAnimationFrame(() => {
    const panel = document.getElementById('new-panel');
    const field = panel && panel.querySelector('input, textarea, select');
    if (field) field.focus();
  });
}

// The skippable due-date step (#106). Shown when a date is first set in the add or edit form, only
// if the span leaves room for a choice; removed when the date is cleared, set back to what the task
// already had, or skipped. A fresh span is now -> end of the due day, the same one dueStage will use.
function syncDueStageStep(dateInput) {
  const form = dateInput.closest('form');
  if (!form) return;
  const old = form.querySelector('.due-step');
  if (old) old.remove();
  if (!dateInput.value || dateInput.value === dateInput.defaultValue) return;
  const due = dueMoment({ deadline: dateInput.value });
  const html = due === null ? '' : R.renderDueStageStep(due - Date.now(), state.dueDefaults);
  if (html) dateInput.insertAdjacentHTML('afterend', html);
}

// Nothing is stored unless the user touched a select: untouched, the step is only a suggestion.
function dueStagesFromForm(fd) {
  if (fd.get('dueStepChosen') !== '1') return undefined;
  const yellow = Number(fd.get('dueYellow')), red = Number(fd.get('dueRed'));
  if (!(yellow > 0 && red > 0)) return undefined;
  return { yellow: { leadHours: yellow }, red: { leadHours: red } };
}

function onAppSubmit(e) {
  const addTaskForm = e.target.closest('[data-action="add-task"]');
  if (addTaskForm) {
    e.preventDefault();
    const fd = new FormData(addTaskForm);
    const projectId = addTaskForm.getAttribute('data-project');
    const task = M.addTask(projectId, fd.get('title'), fd.get('deadline'), labelsFromForm(fd), fd.get('steps'), fd.get('priority'), dueStagesFromForm(fd));
    createIssueIfGithubProject(task, projectId);
    return;
  }
  // The "+ New" panel's "New project" tab (Q29a): a plain name, no category -- set afterward
  // through the project's own Edit panel.
  const addNewProject = e.target.closest('[data-action="add-new-project"]');
  if (addNewProject) {
    e.preventDefault();
    const name = String(new FormData(addNewProject).get('name') || '').trim();
    if (!name) return;
    const project = M.addProject(name, null);
    closeNewPanel();
    afterProjectAdded(project.id);
    return;
  }
  // The "+ New" panel's "GitHub repo" tab, Paste field: same track-repo path as picking one from
  // Your repos (addRepoManually) -- parseRepoInput's error shows inline instead of in the toast.
  const pasteRepo = e.target.closest('[data-action="paste-repo"]');
  if (pasteRepo) {
    e.preventDefault();
    const val = String(new FormData(pasteRepo).get('value') || '').trim();
    if (!parseRepoInput(val)) { ui.newPanelPasteError = 'Enter it as "owner/repo" or a full github.com URL.'; paint(); return; }
    ui.newPanelPasteError = null;
    const repoFullName = parseRepoInput(val);
    addRepoManually(val, ui).then(() => {
      if (ui.syncError) { ui.newPanelPasteError = ui.syncError; ui.syncError = null; paint(); return; }
      const project = state.projects.find((p) => p.source === 'github' && p.repoFullName === repoFullName);
      closeNewPanel();
      if (project) afterProjectAdded(project.id); else paint();
    });
    return;
  }
  // The "+ New" panel's "Create a new repo on GitHub" disclosure (Q31a, #39).
  const createRepoForm = e.target.closest('[data-action="create-repo"]');
  if (createRepoForm) {
    e.preventDefault();
    const fd = new FormData(createRepoForm);
    const name = String(fd.get('name') || '').trim();
    if (!isValidRepoName(name)) { ui.newPanelCreateError = 'Repo name: ' + REPO_NAME_RULE + '.'; ui.newPanelCreateOpen = true; paint(); return; }
    ui.newPanelCreateOpen = true;
    ui.newPanelCreateError = null;
    ui.newPanelCreating = true;
    paint();
    createRepoAndTrack(name, !!fd.get('private'), String(fd.get('description') || '').trim(), ui).then((repo) => {
      ui.newPanelCreating = false;
      if (ui.syncError) { ui.newPanelCreateError = ui.syncError; ui.syncError = null; paint(); return; }
      const project = state.projects.find((p) => p.source === 'github' && p.repoFullName === repo.full_name);
      closeNewPanel();
      if (project) afterProjectAdded(project.id); else paint();
    }).catch((e) => {
      ui.newPanelCreating = false;
      if (e.status === 403 || e.status === 404) {
        ui.newPanelCreateError = 'GitHub refused: your token needs Administration: Read and write to create repos. See Settings.' + (e.githubMessage ? ' (' + e.githubMessage + ')' : '');
      } else {
        ui.newPanelCreateError = e.message;
      }
      paint();
    });
    return;
  }
  // The Edit panel's "Link to GitHub repo" chooser (Q30c), Paste field.
  const pasteLinkRepo = e.target.closest('[data-action="paste-link-repo"]');
  if (pasteLinkRepo) {
    e.preventDefault();
    const val = String(new FormData(pasteLinkRepo).get('value') || '').trim();
    const forProjectId = ui.linkPanel && ui.linkPanel.projectId;
    if (!forProjectId) return;
    linkProjectToRepoByInput(forProjectId, val, ui).then((result) => {
      if (result.error) { ui.linkPanel.error = result.error; paint(); return; }
      ui.linkPanel = null;
      delete ui.editingProject[forProjectId];
      paint();
    });
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
      title: fd.get('title'), deadline: fd.get('deadline'), categoryIds: labelsFromForm(fd), steps: fd.get('steps'), priority: fd.get('priority'), dueStages: dueStagesFromForm(fd),
    });
    return;
  }
}

function onAppKeydown(e) {
  // Escape in the due-date step skips just the step; it must not also close the form around it.
  if (e.key === 'Escape' && e.target.closest && e.target.closest('.due-step')) {
    e.stopPropagation();
    const form = e.target.closest('form');
    e.target.closest('.due-step').remove();
    if (form) form.querySelector('input[name="deadline"]').focus();
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-action="edit-task"]')) {
    e.preventDefault(); // stop Space from scrolling the page
    ui.editingTask = { taskId: e.target.getAttribute('data-task'), projectId: e.target.getAttribute('data-project') };
    paint();
    scrollOpenedFormIntoView('.task-edit-form');
  }
  // Escape collapses a project's open "+ Add task" form while focus is inside it (Q3b).
  if (e.key === 'Escape') {
    const form = e.target.closest && e.target.closest('.add-task-form');
    if (form) { delete ui.addingTask[form.getAttribute('data-project')]; paint(); }
  }
  // Escape inside the "+ New" panel closes it and returns focus to "+ New" (Q29a).
  // Each Escape closes only the innermost thing: stopPropagation keeps it from also reaching the
  // document-level handler that closes the phone drawer the panel sits in.
  if (e.key === 'Escape' && e.target.closest && e.target.closest('#new-panel')) {
    e.stopPropagation();
    closeNewPanel();
    paint();
    const btn = document.getElementById('new-panel-toggle');
    if (btn) btn.focus();
  }
  // Escape inside the Edit panel's inline repo chooser closes just that.
  if (e.key === 'Escape' && e.target.closest && e.target.closest('.link-repo-panel')) {
    e.stopPropagation();
    ui.linkPanel = null;
    paint();
  }
}

// Below 1100px, the project list is a drawer opened from the topbar's Projects button (see
// index.html); at >=1100px CSS shows it as the sticky sidebar regardless of this flag. Opening it
// moves focus to the drawer itself (not its search box, which would raise the phone keyboard over the
// list); closing it returns focus to the button that opened it. See
// docs/4-systems/styling.md#project-sidebar
function setProjectsDrawerOpen(open) {
  ui.projectsDrawerOpen = open;
  paint();
  if (open) {
    const drawer = document.getElementById('projects-drawer');
    if (drawer) drawer.focus({ preventScroll: true });
  } else {
    const btn = document.getElementById('projects-btn');
    if (btn) btn.focus({ preventScroll: true });
  }
}

// Scrolls so a project's card top sits just below the sticky topbar (its height varies with
// width), not underneath it.
function scrollProjectIntoView(target) {
  const header = document.querySelector('.topbar');
  const top = target.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

// Repaints, then scrolls to a project's card once it's in the DOM -- used after a selection change
// or a newly added project, where the target might not exist yet.
function scrollProjectAfterPaint(projectId) {
  paint();
  const target = document.getElementById('proj-' + projectId);
  if (target) scrollProjectIntoView(target);
}

// Opening a row's editor or a project's "+ Add task" form should bring it into view within its own
// tile at >=1100px, not just onto the page (Q26a, #82) -- `block:'nearest'` does that and is a no-op
// below 1100px, where the tile isn't its own scroll container. Runs after the paint that put the
// form in the DOM.
function scrollOpenedFormIntoView(selector) {
  const el = document.querySelector(selector);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

// Jumps to a project's card: in the "One" view this selects it (closing the drawer first) and
// scrolls to it, on any width. In "All" every visible project already renders as its own card/tile
// -- no selection state, no aria-current there -- so this just expands it first if it's minimised
// (there'd be nothing to scroll to see otherwise) and scrolls. The sidebar row, the focus card's
// project chip, and any other scroll-project source all branch here.
function scrollToProject(projectId) {
  if (!state.projects.some((p) => p.id === projectId)) return;
  if (ui.projectsDrawerOpen) setProjectsDrawerOpen(false);
  if (ui.projectView === 'one') {
    ui.selectedProjectId = projectId;
    saveSelectedProjectId(projectId);
  } else if (ui.projectCollapsed[projectId]) {
    ui.projectCollapsed[projectId] = false;
    saveCollapsedProjects();
  }
  scrollProjectAfterPaint(projectId);
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

// The topbar sync button: with no token, it's a shortcut to Settings rather than a no-op; a
// manual sync that succeeds says so (auto-sync stays quiet — the button's title is enough there).
function manualSyncGithub() {
  if (!getToken()) { ui.notice = 'Connect GitHub in Settings to sync.'; paint(); return; }
  const running = syncGithub(ui);
  paint(); // show the spinning icon straight away
  running.then(() => {
    if (!ui.syncError) ui.notice = 'Synced with GitHub.';
    paint();
  });
}

// The 2x2 tiles' shared height (Q26a, #82) is half the space below the sticky topbar, computed
// from its real measured height (like scrollProjectIntoView's offset) rather than a guessed
// constant, since the topbar's height varies with width and content. css/app.css reads it back as
// --topbar-h in the >=1100px tile-height calc(); a sensible minimum lives in the CSS itself.
function updateTopbarHeightVar() {
  const header = document.querySelector('.topbar');
  if (header) document.documentElement.style.setProperty('--topbar-h', header.offsetHeight + 'px');
}

function init() {
  requestPersistentStorage();
  paint();
  updateTopbarHeightVar();
  window.addEventListener('resize', updateTopbarHeightVar);
  initSyncLifecycle(autoSyncGithub);
  const app = document.getElementById('app');
  app.addEventListener('click', onAppClick);
  app.addEventListener('change', onAppChange);
  app.addEventListener('input', onAppInput);
  app.addEventListener('submit', onAppSubmit);
  app.addEventListener('keydown', onAppKeydown);
  app.addEventListener('contextmenu', onAppContextMenu);
  initProjectDrag(app, {
    move: moveProjectTo,
    moveTask: moveTaskTo,
    announce: announceDrag,
    onEnd: () => { if (paintWaitingOnDrag) { paintWaitingOnDrag = false; paint(); } },
  });
  // the sync button and Projects toggle live in the topbar, outside #app -- same handler, since it
  // only acts on data-action values it recognizes
  const topbar = document.querySelector('.topbar');
  if (topbar) topbar.addEventListener('click', onAppClick);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.projectsDrawerOpen) setProjectsDrawerOpen(false);
  });
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
