// focus-deck-app/js/app.js
import { state, esc, findTaskWithProject, findProjectIdForTask, cssColorToHex, storageProblem, onExternalStateChange, requestPersistentStorage, GIST_ID_KEY, STORAGE_KEY, backupRaw } from './state.js';
import * as M from './mutations.js';
import * as R from './render.js';
import { registerPaint, initSyncLifecycle } from './sync.js';
import {
  syncGithub, addRepoManually, linkTaskToIssue, unlinkTask, createGithubIssueFromTask,
  parseRepoInput, listYourRepos, untrackedRepos, isValidRepoName, REPO_NAME_RULE,
  createRepoAndTrack, linkProjectToRepoOnGithub, linkProjectToRepoByInput, transferTaskIssue, pushReviewToIssue,
} from './github-sync.js';
import { getToken } from './github.js';
import { initProjectDrag, isDragging } from './project-drag.js';
import { taskOrderChanges, sortTasks, planTaskMove } from './task-move.js';
import { confirmMove } from './move-dialog.js';
import { dueMoment } from './due-stage.js';
import { startComplete, phaseClasses } from './focus-complete.js';
import { mountWallets, onSpreadChange } from './wallet.js';
import { tiesOf } from './task-links.js';
import { renderInTrayCard, unsortedCurrent, STEP_LOCKED_WHY } from './in-tray-view.js';
import { sendToBack, toggleToken, toggleFolder, fileSlip, MORE_FLAGS_KEY, orderTray, pickedSlips, bulkBlocker, bulkSort } from './in-tray.js';
import { ONBOARDING_KEY, shouldShowOnboarding, nextStep } from './onboarding.js';
import { renderOnboarding } from './onboarding-view.js';
import { pickState, dueDates, parseDue } from './pick-bits.js';
import { renderReview } from './review-view.js';
import { renderTidy } from './tidy-view.js';
import { tidyGroups, confirmIds } from './tidy.js';
import { renderTriage } from './triage-view.js';
import { triageLists, moveId, NOW_SIZE, NEXT_SIZE } from './triage.js';
import { initTriageDrag } from './triage-drag.js';
import { renderRoadmap } from './roadmap-view.js';
import { initRoadmapDrag } from './roadmap-drag.js';
import { openMilestoneSettings } from './milestone-settings.js';
import { COLS, roadmapOf, applyMilestoneSettings, stepMilestone, stepSection, moveMilestone, moveSection, addSection, addMilestone, makeMilestone } from './roadmap.js';
import { reviewLists } from './board.js';
import { notesSummary, renderTaskDetails } from './task-details.js';
import { canSetParent, canWaitOn } from './task-links.js';
import { applyNoteFace } from './note-face.js';
import { applyComfort, getChunk } from './comfort.js';
import { VIEW_ALL, renderViewSwitch, normalizeView, defaultFor, viewProjects, viewState, inView } from './view-switch.js';
import { moveProject, filterAndSortProjects } from './project-filter.js';

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

// Per-slip scratch for the Unsorted in-tray (step, search text, chosen folder, flags stuck on, edited title and notes, the
// card facing in each wallet) plus this session's "Later" list and which slip it belongs to. Reset
// whenever the top slip changes -- see renderApp below. See docs/4-systems/in-tray.md
// "Select many" on the Sort screen: memory only, and kept apart from ui.unsorted, which resets
// whenever the top slip changes. `picked` holds queue keys.
function freshBulk(on) {
  return { on: !!on, priority: null, due: '', dateOpen: false, picked: [], projectId: null, selected: [], groupTitle: '', newLabel: '', why: '' };
}

function freshUnsortedScratch(later) {
  return { later: later || [], priority: null, due: '', dateOpen: false, projectId: null, selected: [], step: 1, find: '', title: null, notes: null, notesOpen: false, facingFolder: null, facingFlag: null, showAllFlags: false, currentKey: null,
    parent: null, subtasks: [], waitsOn: [], holdsUp: [], newSubtasks: [], picking: null, pickQuery: '', why: '' };
}

// First-run onboarding (#124): shown once per device to someone with nothing here yet, or on
// demand with ?welcome (Settings > Help). See docs/4-systems/onboarding.md
function loadOnboarding() {
  let seen = false, hasGist = !!state.gistId;
  try {
    seen = !!localStorage.getItem(ONBOARDING_KEY);
    hasGist = hasGist || !!localStorage.getItem(GIST_ID_KEY);
  } catch (e) { console.error('Could not read the onboarding flag:', e); }
  const forced = new URLSearchParams(location.search).has('welcome');
  return shouldShowOnboarding({ st: state, seen, hasToken: !!getToken(), hasGist, forced })
    ? { step: 'welcome', projectId: null, category: null, forced }
    : null;
}

function finishOnboarding() {
  try { localStorage.setItem(ONBOARDING_KEY, 'done'); }
  catch (e) { console.error('Could not save the onboarding flag:', e); }
  if (ui.onboarding && ui.onboarding.forced) history.replaceState(null, '', location.pathname);
  ui.onboarding = null;
}

function focusLater(selector) {
  requestAnimationFrame(() => { const el = document.querySelector(selector); if (el) el.focus(); });
}

// Which screen shows (#135), remembered on this device like the minimised projects.
const SCREEN_KEY = 'focusdeck-screen';
function loadScreen() {
  try { return R.normalizeScreen(localStorage.getItem(SCREEN_KEY)); }
  catch (e) { console.error('Could not read the screen:', e); return 'focus'; }
}
function setScreen(screen) {
  ui.screen = R.normalizeScreen(screen);
  try { localStorage.setItem(SCREEN_KEY, ui.screen); }
  catch (e) { console.error('Could not save the screen:', e); }
}

// The All | Area | Project switch (js/view-switch.js): one choice for every screen, per device (not synced).
const VIEW_KEY = 'focusdeck-view';
function loadView() {
  try { return JSON.parse(localStorage.getItem(VIEW_KEY)) || VIEW_ALL; }
  catch (e) { console.error('Could not read the view switch:', e); return VIEW_ALL; }
}
function setView(view) {
  ui.view = normalizeView(view, state);
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(ui.view)); }
  catch (e) { console.error('Could not save the view switch:', e); }
}

export const ui = {
  screen: loadScreen(),
  view: loadView(), viewOpen: false,
  // The Board's own state (#200), memory only: boardCol is the open tab; boardShown the cards shown so
  // far (null = one group); boardSelected the selected card's id, which Task details (#201) renders from.
  boardSelected: null,
  // Task details (#201): the open row, a subtask being typed, the link search, the label list open
  boardOpen: null, boardAddSub: false, boardLink: null, boardPicker: false,
  onboarding: loadOnboarding(),
  rmOpen: {}, rmCol: {}, rmAdd: null, // the Roadmap (#257), memory only: milestones opened/closed by hand, the phone's column per milestone, the add form open
  completing: null, // the sticky note's "I've done it" sequence in progress (js/focus-complete.js)
  inboxOpen: true, doneOpen: {}, pendingRemove: {}, syncing: false, syncError: null, notice: null, editingTask: null,
  projectQuery: '', taskQuery: '', projectSort: loadProjectSort(), // the Roadmap's Find boxes and project order
  focusFilter: loadFocusFilter(), editingProject: {}, addingTask: {}, addDraft: {}, addPick: {}, unsorted: freshUnsortedScratch(), bulk: freshBulk(false),
 
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
      if (slot) { slot.innerHTML = R.renderCategoryWalletInner(viewState(state), ui); mountWallets(slot, walletHooks); }
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
    if (name === 'tray-flags' && key === MORE_FLAGS_KEY) {
      ui.unsorted.showAllFlags = true; // Settings > Category choices hid some (#133)
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

// The notice's Open button belongs to one notice text; any other notice replaces it (#242).
function noticeAction() {
  const a = ui.noticeAction;
  return !ui.syncError && a && a.text === ui.notice ? a : undefined;
}

export function renderApp(st) {
  applyNoteFace(st.noteFace && st.noteFace.face); // also after a sync brings in another device's choice
  applyComfort(st);
  st._ui = ui; // the sync button reads sync UI state off the state object it's already passed
  if (storageProblem && !ui.syncError && !ui.storageProblemDismissed) ui.syncError = storageProblem;
  // a new current Unsorted item (someone filed/sent to the back/completed the last one, or the queue itself
  // changed under us -- a new capture, a task labelled elsewhere) starts with clean scratch
  const currentUnsorted = unsortedCurrent(st, ui.unsorted);
  const currentKey = currentUnsorted ? currentUnsorted.key : null;
  if (currentKey !== ui.unsorted.currentKey) ui.unsorted = Object.assign(freshUnsortedScratch(ui.unsorted.later), { currentKey }, currentUnsorted && currentUnsorted.kind === 'task' ? tiesOf(st.projects, currentUnsorted.task.id) : {});
  // A sync that brings projects in while the welcome is still on its first screen means this device
  // already has a life elsewhere: step aside (not when replayed on purpose).
  if (ui.onboarding && ui.onboarding.step === 'welcome' && !ui.onboarding.forced && st.projects.length) ui.onboarding = null;
  if (ui.onboarding) {
    return '<div class="main-col onboarding-col">'
      + renderOnboarding(st, ui.onboarding, () => R.renderFocus(st, findTaskWithProject, ui))
      + '</div>' + R.renderToast(ui.syncError || ui.notice, ui.syncError ? 'error' : 'info', noticeAction());
  }
  ui.view = normalizeView(ui.view, st); // a gone area or project is All
  st._ui = ui;
  const sw = renderViewSwitch(st, ui.view, ui.viewOpen);
  const hasToken = !!getToken();
  // one activity at a time (#135): the rail, then only the chosen screen
  const rail = R.renderRail(ui.screen, R.unsortedQueue(st).length, R.renderSyncButton(st), reviewLists(st, null, Date.now()).waiting.length);
  const toast = R.renderToast(ui.syncError || ui.notice, ui.syncError ? 'error' : 'info', noticeAction());
  // Task details (#201) opens from a task on any tab: Review and Roadmap draw it themselves, the others get it here
  const details = ['sort', 'tidy', 'triage', 'focus'].includes(ui.screen) && ui.boardSelected && findTaskWithProject(ui.boardSelected) ? renderTaskDetails(st, ui, ui.boardSelected) : '';
  const screen = (name, body) => rail + '<div class="screen screen-' + name + '">' + sw + body + details + '</div>' + toast;
  if (ui.screen === 'sort') return screen('sort', renderInTrayCard(st, Object.assign({}, ui, { inboxOpen: true }))); // the tray, always open
  if (ui.screen === 'tidy') return screen('tidy', renderTidy(st, ui));
  if (ui.screen === 'roadmap') return rail + '<div class="screen screen-roadmap">' + sw + renderRoadmap(st, ui, hasToken) + '</div>' + toast;
  if (ui.screen === 'triage') return screen('triage', renderTriage(st, ui));
  if (ui.screen === 'review') return rail + '<div class="screen screen-review">' + sw + renderReview(st, ui) + '</div>' + toast;
  return screen('focus', R.renderFocus(st, findTaskWithProject, ui));
}

// Triage: a drop, Alt+Arrow or an up/down button. `to` is the place to end at, or (when null) `by` steps
// from where it is now. The new order is saved at once (every task in the view gets a triageRank).
function moveTriage(id, to, by) {
  const l = triageLists(state, ui.view, dueDates().today);
  const ids = l.now.concat(l.next, l.later).map((r) => r.id), from = ids.indexOf(id);
  const at = Math.max(0, Math.min(ids.length - 1, to === null ? from + by : to));
  if (from < 0 || at === from) return;
  M.saveTriageOrder(moveId(ids, id, at));
  if (at >= NOW_SIZE + NEXT_SIZE) ui.triageLaterOpen = true;
  paint();
  const again = document.querySelector('.tr-row[data-task-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  if (again) again.focus({ preventScroll: true });
}

// Roadmap (#257). A column move is a status change, exactly as the Board makes one (setTaskStatus: the
// "needs review" label, closing the issue on done). The others edit the project's sections and milestones.
const rmFocus = (kind, id) => { const g = document.querySelector('.rm-grip[data-kind="' + kind + '"][data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); if (g) g.focus({ preventScroll: true }); };
function rmTask(id, status) {
  const f = findTaskWithProject(id);
  if (f && COLS.some((c) => c[0] === status) && f.task.status !== status) M.setTaskStatus(id, status);
  paint(); rmFocus('task', id);
}
function rmTaskStep(id, dir) {
  const f = findTaskWithProject(id), i = f ? COLS.findIndex((c) => c[0] === f.task.status) : -1;
  if (i >= 0 && COLS[i + dir]) rmTask(id, COLS[i + dir][0]);
}
const rmProject = () => (ui.view.mode === 'project' ? ui.view.id : null);
function rmEdit(kind, id, fn) { M.editRoadmap(rmProject(), fn); paint(); rmFocus(kind, id); }

// The topbar's sync button and Projects toggle live outside #app (see index.html), so paint()
// updates them directly instead of through the innerHTML replace below.
function paintHeaderControls() {
  const syncSlot = document.getElementById('topbar-sync');
  if (syncSlot) syncSlot.innerHTML = R.renderSyncButton(state);
  const to = document.getElementById('capture-to');
  if (to) {
    const target = R.jotTarget(state, ui);
    to.innerHTML = '<option value="">To: Unsorted</option>' + state.projects.map((p) => '<option value="' + esc(p.id) + '">To: ' + esc(p.name) + '</option>').join('');
    to.value = target;
    const addBtn = document.querySelector('#capture-form .jot-add');
    if (addBtn) addBtn.textContent = target ? 'Add task' : 'Add';
  }
}

// Puts focus (and caret, else the end) in a project's add-row title box.
function focusAddTitle(projectId, caret) {
  const el = document.querySelector('.add-row[data-project="' + CSS.escape(projectId) + '"] input[name="title"]');
  if (!el) return;
  el.focus();
  const n = el.value.length;
  el.setSelectionRange(caret ? caret.start : n, caret ? caret.end : n);
}

// A repaint mid-drag (a sync landing, say) would tear down the elements being dragged, so it waits
// until the drag ends (js/project-drag.js calls onEnd, below).
let paintWaitingOnDrag = false;

export function paint() {
  if (isDragging()) { paintWaitingOnDrag = true; return; }
  const scrollY = window.scrollY;
  const active = document.activeElement;
  // the one project search box (the sidebar/drawer's)
  const addPid = active && active.matches && active.matches('.add-row input[name="title"]') ? active.closest('.add-row').getAttribute('data-project') : null;
  const addCaret = addPid ? { start: active.selectionStart, end: active.selectionEnd } : null;
  const restoreSearch = active && active.matches && active.matches('.project-search')
    ? { start: active.selectionStart, end: active.selectionEnd }
    : null;
  document.getElementById('app').innerHTML = renderApp(state);
  paintHeaderControls();
  mountWallets(document.getElementById('app'), walletHooks);
  growAll();
  window.scrollTo(0, scrollY);
  if (addPid) focusAddTitle(addPid, addCaret);
  if (restoreSearch) {
    const el = document.querySelector('.project-search');
    if (el) { el.focus(); el.setSelectionRange(restoreSearch.start, restoreSearch.end); }
  }
}

// Notes and thoughts have no length limit, so their boxes grow with the text. CSS field-sizing does
// it where supported; elsewhere (Safari, Firefox at the time of writing) this sets the height from
// the content. The jotter's 40vh cap is in its CSS max-height.
const GROWING_BOXES = '#capture-input, .slip-notes, [data-detail-notes]';
const growsByItself = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content');
function autoGrow(box) {
  if (growsByItself || !box) return;
  box.style.height = 'auto';
  box.style.height = box.scrollHeight + 'px';
}
document.addEventListener('input', (e) => {
  if (!(e.target.matches && e.target.matches('.add-row input[name="title"]'))) return;
  const row = e.target.closest('.add-row');
  ui.addDraft[row.getAttribute('data-project')] = e.target.value;
  const blocks = row.querySelector('.pick-blocks'); // shown once there is a title (#249)
  if (blocks) blocks.hidden = !e.target.value.trim();
});
document.addEventListener('input', (e) => { if (e.target.matches && e.target.matches(GROWING_BOXES)) autoGrow(e.target); });
function growAll() { document.querySelectorAll(GROWING_BOXES).forEach(autoGrow); }

registerPaint(paint);
onSpreadChange(paint); // wallets lie flat on a wide screen, flip on a narrow one (#128)
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
    const wasR = now.task.status === 'review';
    M.applyTaskMove({ taskId: req.taskId, toProjectId: dest.id, status: req.status, changes: order });
    const relabel = () => { const t = findTaskWithProject(req.taskId); if (t && (wasR || t.task.status === 'review')) pushReviewToIssue(t.task, t.task.status !== 'review'); };
    const title = now.task.title;
    if (plan.kind === 'create-issue') {
      createGithubIssueFromTask(req.taskId, dest.repoFullName, ui).then(() => {
        relabel();
        const t = findTaskWithProject(req.taskId);
        if (ui.syncError) ui.syncError = 'Moved “' + title + '” to ' + dest.name + ', but it stays unlinked. ' + ui.syncError;
        else if (t && t.task.source === 'github') ui.notice = 'Moved “' + title + '” to ' + dest.name + ' and linked it to ' + t.task.repoFullName + '#' + t.task.issueNumber + '.';
        paint();
      });
    } else if (plan.kind === 'transfer') {
      transferTaskIssue(req.taskId, dest.repoFullName, ui, dest.name).then((ok) => { if (ok) relabel(); paint(); });
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

// ---- Priority and due pickers (#249; js/pick-bits.js) --------------------------------------------
const PICK_FIELD = { priority: 'priority', due: 'deadline' };
function focusPickChip(field, taskId) {
  const c = document.querySelector('[data-action="open-pick"][data-field="' + field + '"][data-task="' + CSS.escape(taskId) + '"]');
  if (c) c.focus();
}
function closePick() { Object.assign(pickState, { field: null, taskId: null, dateOpen: false }); }
// The state a pick edits: the add row's, the Sort slip's or the bulk panel's.
function pickTarget(el) {
  const scope = el.getAttribute('data-scope');
  if (scope === 'add') { const id = el.getAttribute('data-project'); return ui.addPick[id] || (ui.addPick[id] = {}); }
  return scope === 'sort' ? ui.unsorted : scope === 'bulk' ? ui.bulk : null;
}
function onPickSet(el) {
  const field = el.getAttribute('data-field'), value = el.getAttribute('data-value'), scope = el.getAttribute('data-scope');
  const val = field === 'priority' || value === 'date' ? value : value === 'none' ? '' : dueDates()[value];
  if (scope === 'task') {
    const id = el.getAttribute('data-task');
    if (value === 'date') { pickState.dateOpen = true; paint(); const d = document.querySelector('.pick-pop [data-pick-date]'); if (d) d.focus(); return; }
    M.updateTaskFields(id, { [PICK_FIELD[field]]: val || null });
    closePick(); paint(); focusPickChip(field, id);
    return;
  }
  const S = pickTarget(el);
  if (!S) return;
  if (value === 'date') S.dateOpen = true;
  else { if (field === 'priority') S.priority = val; else { S.due = val; S.dateOpen = false; } }
  const q = '[data-action="pick-set"][data-scope="' + scope + '"][data-field="' + field + '"][data-value="' + value + '"]' + (scope === 'add' ? '[data-project="' + CSS.escape(el.getAttribute('data-project')) + '"]' : '');
  paint();
  const next = value === 'date' ? document.querySelector('[data-pick-date][data-scope="' + scope + '"]') : document.querySelector(q);
  if (next) next.focus();
}
// A date from the date box or typed ("fri", "15 dec"); an unreadable typed one is left alone.
function onPickDate(el, text) {
  const iso = el.matches('[data-pick-type]') ? parseDue(text) : text;
  if (el.matches('[data-pick-type]') && !iso) { el.setAttribute('aria-invalid', 'true'); return; }
  if (el.getAttribute('data-scope') === 'task') {
    const id = el.getAttribute('data-task');
    M.updateTaskFields(id, { deadline: iso || null });
    closePick(); paint(); focusPickChip('due', id);
    return;
  }
  const S = pickTarget(el);
  if (!S) return;
  S.due = iso || ''; S.dateOpen = !!iso && el.matches('[data-pick-date]');
  paint();
}
document.addEventListener('change', (e) => { if (e.target.matches && e.target.matches('[data-pick-date], [data-pick-type]')) onPickDate(e.target, e.target.value); });
// click-away closes an open chip picker (a tap on another action then repaints as usual)
document.addEventListener('click', (e) => {
  if (!pickState.field || e.target.closest('.pick-wrap')) return;
  closePick();
  document.querySelectorAll('.pick-pop').forEach((n) => n.remove());
}, true);

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
  if (action.startsWith('ob-')) { onOnboardingClick(action, el); return; }
  if (action === 'pick-set') { onPickSet(el); return; }
  if (action === 'open-pick') {
    const same = pickState.field === el.getAttribute('data-field') && pickState.taskId === taskId;
    Object.assign(pickState, same ? { field: null, taskId: null, dateOpen: false } : { field: el.getAttribute('data-field'), taskId, dateOpen: false });
    paint();
    focusPickChip(el.getAttribute('data-field'), taskId);
    return;
  }
  if (action === 'label-show-all') {
    // Settings > Category choices hid some labels in this form (#133): show them, without a repaint
    const picker = el.closest('.label-picker');
    if (picker) picker.classList.add('show-all');
    el.remove();
    return;
  }
  if (action === 'set-screen') {
    setScreen(el.getAttribute('data-screen') || el.getAttribute('data-go'));
    ui.jotTo = undefined;
    ui.projectQuery = ''; ui.taskQuery = '';
    paint();
    window.scrollTo(0, 0);
    return;
  }
  if (action === 'view-mode') { setView(defaultFor(el.getAttribute('data-mode'), ui.view, state)); ui.viewOpen = ui.view.mode !== 'all'; paint(); focusViewPop(); return; }
  if (action === 'view-open') { ui.viewOpen = !ui.viewOpen; paint(); focusViewPop(); return; }
  if (action === 'view-close') { closeViewPop(); return; }
  if (action === 'view-pick') { setView({ mode: el.getAttribute('data-mode'), id: el.getAttribute('data-id') }); closeViewPop(); return; }
  if (action === 'scroll-to-task') {
    const id = el.getAttribute('data-task'), q = (window.CSS && CSS.escape) ? CSS.escape(id) : id;
    const to = document.querySelector('[data-task-id="' + q + '"]') || document.querySelector('.task-row[data-task="' + q + '"]');
    if (to) { to.scrollIntoView({ block: 'center' }); const f = to.querySelector('button, input, [tabindex]'); if (f) f.focus({ preventScroll: true }); }
    return;
  }
  if (action === 'tidy-mark') {
    const id = el.getAttribute('data-task'), m = el.getAttribute('data-mark');
    ui.tidyMarks = Object.assign({}, ui.tidyMarks); // marks only; nothing is closed until tidy-confirm
    if (ui.tidyMarks[id] === m) delete ui.tidyMarks[id]; else ui.tidyMarks[id] = m;
    paint(); return;
  }
  if (action === 'tidy-confirm') {
    const ids = confirmIds(state, ui.view, ui.tidyMarks || {});
    const titles = new Map(); state.projects.forEach((p) => p.tasks.forEach((t) => titles.set(t.id, t.title)));
    M.confirmTidy(ids);
    ui.tidyClosed = ids.map((id) => ({ id, title: titles.get(id) })).concat(ui.tidyClosed || []);
    ids.forEach((id) => delete ui.tidyMarks[id]);
    setScreen('triage'); paint(); window.scrollTo(0, 0); return; // "Confirm N, then Triage"
  }
  if (action === 'rm-open') { setView({ mode: 'project', id: el.getAttribute('data-project') }); paint(); window.scrollTo(0, 0); return; }
  if (action === 'rm-settings') {
    const pid = rmProject(), p = state.projects.find((x) => x.id === pid), id = el.getAttribute('data-id'), r = p && roadmapOf(p);
    const sec = r && r.sections.find((s) => s.milestones.some((x) => x.id === id)), m = sec && sec.milestones.find((x) => x.id === id);
    if (!m) return;
    const sel = '.rm-ms-name[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]';
    openMilestoneSettings({ project: p, m, sub: [p.name, sec.virtual ? null : sec.n, sec.name].filter((x) => x !== null).join(' · '), returnTo: sel,
      others: r.milestones.filter((x) => x.id !== id).map((x) => ({ id: x.id, name: x.name, share: x.share })) },
    (draft) => { M.editRoadmap(pid, (pr) => applyMilestoneSettings(pr, id, draft)); paint(); });
    return;
  }
  if (action === 'rm-toggle') { const id = el.getAttribute('data-id'), was = el.getAttribute('aria-expanded') === 'true'; ui.rmOpen[id] = !was; paint(); return; }
  if (action === 'rm-col') { ui.rmCol[el.getAttribute('data-ms')] = el.getAttribute('data-col'); paint(); return; }
  if (action === 'rm-task') { const id = el.getAttribute('data-id'); selectBoardTask(ui.boardSelected === id ? null : id); paint(); return; }
  if (action === 'rm-task-step') { rmTaskStep(el.getAttribute('data-id'), Number(el.getAttribute('data-dir'))); return; }
  if (action === 'rm-ms-step') { const id = el.getAttribute('data-id'), d = Number(el.getAttribute('data-dir')); rmEdit('ms', id, (p) => stepMilestone(p, id, d)); return; }
  if (action === 'rm-sec-step') { const id = el.getAttribute('data-id'), d = Number(el.getAttribute('data-dir')); rmEdit('sec', id, (p) => stepSection(p, id, d)); return; }
  if (action === 'rm-add') { ui.rmAdd = { kind: el.getAttribute('data-kind'), ms: el.getAttribute('data-ms') }; if (ui.rmAdd.kind === 'task') ui.rmOpen[ui.rmAdd.ms] = true; paint(); const f = document.querySelector('.rm-add-form input, .rm .add-row input[name="title"]'); if (f) f.focus(); return; }
  if (action === 'rm-add-cancel') { ui.rmAdd = null; paint(); return; }
  if (action === 'rm-make') { const m = M.editRoadmap(rmProject(), (p) => makeMilestone(p, p.tasks.find((t) => t.id === el.getAttribute('data-id')))); ui.notice = m ? '“' + m.name + '” is now a milestone.' : 'It already is one.'; paint(); return; }
  if (action === 'triage-later') { ui.triageLaterOpen = !ui.triageLaterOpen; paint(); return; }
  if (action === 'triage-move') { moveTriage(el.getAttribute('data-task'), null, Number(el.getAttribute('data-dir'))); return; }
  if (action === 'triage-reset') { const l = triageLists(state, ui.view, dueDates().today); M.resetTriageOrder(l.now.concat(l.next, l.later).map((r) => r.id)); paint(); return; }
  if (action === 'tidy-undo') { const id = el.getAttribute('data-task'); M.undoDone(id); ui.tidyClosed = (ui.tidyClosed || []).filter((c) => c.id !== id); paint(); return; }
  if (action === 'review-done') { M.setTaskStatus(el.getAttribute('data-task'), 'done'); paint(); return; }
  if (action === 'review-more') { M.setTaskStatus(el.getAttribute('data-task'), 'doing'); paint(); return; }
  if (action === 'review-undo') { M.undoDone(el.getAttribute('data-task')); paint(); return; }
  if (action === 'review-open') { selectBoardTask(el.getAttribute('data-task')); paint(); return; }
  if (action === 'task-open') { const id = el.getAttribute('data-task'); selectBoardTask(ui.boardSelected === id ? null : id); paint(); return; }
  if (action.startsWith('detail-')) { onDetailAction(action, el); return; }
  if (action === 'start-new-project') { openFirstProjectPanel(); return; }
  if (action === 'unsorted-file' || action === 'unsorted-save') {
    // filing repaints, and the repaint resets ui.unsorted for the next slip, so read it all first
    const cur = unsortedCurrent(state, ui.unsorted);
    if (!cur) return;
    const pick = { priority: ui.unsorted.priority, deadline: ui.unsorted.due, projectId: ui.unsorted.projectId, selected: ui.unsorted.selected, title: ui.unsorted.title, notes: ui.unsorted.notes,
      parent: ui.unsorted.parent, subtasks: ui.unsorted.subtasks, waitsOn: ui.unsorted.waitsOn, holdsUp: ui.unsorted.holdsUp, newSubtasks: ui.unsorted.newSubtasks };
    const done = fileSlip(cur, pick, {
      fileInboxItem: M.fileInboxItem, updateTaskFields: M.updateTaskFields, applyTaskMove: M.applyTaskMove, addTask: M.addTask, projects: state.projects,
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
  else if (action === 'sort-step' || action === 'sort-next' || action === 'sort-back') {
    const to = action === 'sort-step' ? +el.getAttribute('data-step') : ui.unsorted.step + (action === 'sort-next' ? 1 : -1);
    const u = ui.unsorted;
    const cur = unsortedCurrent(state, u);
    const hasProject = !!u.projectId || !!(cur && cur.kind === 'task');
    if (action === 'sort-step' && to > 1 && !hasProject) u.why = STEP_LOCKED_WHY;
    else if (to >= 1 && to <= 3) { u.step = to; u.find = ''; u.why = ''; }
    paint();
  }
  else if (action === 'sort-add-notes') {
    ui.unsorted.notesOpen = true;
    paint();
    const box = document.querySelector('.slip-notes');
    if (box) box.focus();
  }
  else if (action === 'sort-new-flag') {
    const name = ui.unsorted.find.trim();
    if (name) {
      const id = labelIdByName(name);
      if (!ui.unsorted.selected.includes(id)) ui.unsorted.selected = ui.unsorted.selected.concat(id);
      ui.unsorted.find = '';
    }
    paint();
  }
  else if (action === 'tie-open') {
    const f = el.getAttribute('data-field');
    ui.unsorted.picking = ui.unsorted.picking === f ? null : f;
    ui.unsorted.pickQuery = '';
    paint();
    const box = document.querySelector('[data-tie-find]');
    if (box) box.focus();
  }
  else if (action === 'tie-add' || action === 'tie-remove' || action === 'tie-new-sub') {
    const u = ui.unsorted, f = el.getAttribute('data-field'), id = el.getAttribute('data-id');
    if (action === 'tie-new-sub') { if (u.pickQuery.trim()) u.newSubtasks = u.newSubtasks.concat(u.pickQuery.trim()); }
    else if (f === 'parent') u.parent = action === 'tie-add' ? id : null;
    else if (f === 'newSubtasks') u.newSubtasks = u.newSubtasks.filter((_, i) => i !== +id);
    else u[f] = action === 'tie-add' ? u[f].concat(id) : u[f].filter((x) => x !== id);
    u.picking = null; u.pickQuery = '';
    paint();
  }
  else if (action.startsWith('bulk-')) onBulkAction(action, el);
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
      confirmMove('Delete "' + text + '"? It leaves the tray for good.', '[data-action="unsorted-delete"]', 'Delete').then((ok) => {
        if (!ok) return;
        // the thought may have gone while the question was open (another tab, a sync)
        if (!state.inbox.some((i) => i.id === inboxId)) { paint(); return; }
        M.discardInbox(inboxId);
        ui.notice = 'Deleted "' + text + '".';
        paint();
      });
    } else if (confirmDeleteTask(taskId, projectId)) {
      M.deleteTask(taskId, projectId);
    }
  }
  else if (action === 'reroll') M.reroll();
  else if (action === 'pick-for-me') { if (!M.pickForMe()) { ui.notice = 'Nothing open to pick from here.'; paint(); } }
  else if (action === 'clear-focus') M.clearFocus();
  else if (action === 'focus-doing') {
    // same path as a board drop: lands at the end of In progress; the task stays in focus
    const f = state.focus && findTaskWithProject(state.focus.taskId);
    if (f && f.task.status === 'next') {
      const end = f.project.tasks.filter((t) => t.status === 'doing').length;
      if (moveTaskTo({ taskId: f.task.id, toProjectId: f.project.id, status: 'doing', toIndex: end })) ui.notice = 'Moved to In progress';
      paint();
    }
  }
  else if (action === 'complete-focus') completeFocusWithNote();
  // M.setFocusTask doesn't exist -- the correct exported function is setFocus.
  // "Focus on this" lives in the edit form now (Q14a, Q12f) -- picking a task closes the form.
  else if (action === 'focus-task') { ui.editingTask = null; M.setFocus(taskId); }
  else if (action === 'focus-subtask') M.setFocus(taskId);
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
  else if (action === 'toggle-add-more') { if (ui.addingTask[projectId]) delete ui.addingTask[projectId]; else ui.addingTask[projectId] = true; paint(); focusAddTitle(projectId); if (ui.addingTask[projectId]) scrollOpenedFormIntoView('.add-row[data-project="' + CSS.escape(projectId) + '"]'); }
  else if (action === 'open-added-task') {
    setScreen('roadmap'); setView({ mode: 'project', id: el.getAttribute('data-project') });
    selectBoardTask(el.getAttribute('data-task')); ui.notice = null; ui.jotTo = undefined; paint();
  }
  else if (action === 'dismiss-toast') {
    if (ui.syncError === storageProblem) ui.storageProblemDismissed = true;
    ui.syncError = null;
    ui.notice = null;
    paint();
  }
  else if (action === 'toggle-inbox') { ui.inboxOpen = !ui.inboxOpen; paint(); }
  else if (action === 'toggle-done') { ui.doneOpen[projectId] = !ui.doneOpen[projectId]; paint(); }
  else if (action === 'sync-github') manualSyncGithub();
  else if (action === 'rm-project-step') { const ids = visibleRoadmapProjects().map((p) => p.id), i = ids.indexOf(el.getAttribute('data-project')); moveProjectTo(ids[i], i + Number(el.getAttribute('data-dir')), ids); }
  else if (action === 'edit-task') { ui.editingTask = { taskId, projectId }; paint(); scrollOpenedFormIntoView('.task-edit-form'); }
  else if (action === 'cancel-task-edit') { ui.editingTask = null; paint(); }
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

  // Sort's project and label cards (inside the in-tray's wallets): same picker, committed on change.
  const sleeveEl = e.target.closest('.tray-wallets .sleeve');
  if (sleeveEl) {
    const key = sleeveEl.getAttribute('data-key');
    const project = state.projects.find((p) => p.id === key);
    const cat = project ? null : state.categories.find((c) => c.id === key);
    const target = project || cat;
    if (!target) return;
    e.preventDefault();
    openColorPicker(e, cssColorToHex(target.color), () => {},
      (hex) => { if (project) M.setProjectColor(key, hex); else M.setCategoryColor(key, hex); });
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

// ---- Board > Task details (#201, js/task-details.js) -------------------------------------------
// Selecting a card (or none) starts the panel afresh: no row open, no half-made subtask or link.
function selectBoardTask(id) {
  ui.boardSelected = id; ui.boardOpen = null; ui.boardAddSub = false; ui.boardLink = null; ui.boardPicker = false;
}
function detailTask() {
  const found = ui.boardSelected && findTaskWithProject(ui.boardSelected);
  return found ? { task: found.task, project: found.project } : null;
}
// Each change goes through the same mutations Projects' task editor uses, so it is stamped, synced and,
// for a GitHub-linked task, pushed (updateTaskFields / setTaskStatus do the push).
function addDetailTie(task, field, otherId) {
  const ps = state.projects;
  if (field === 'parent' && canSetParent(ps, task.id, otherId)) M.updateTaskFields(task.id, { parentId: otherId });
  else if (field === 'waitsOn' && canWaitOn(ps, task.id, otherId)) M.updateTaskFields(task.id, { waitsOn: (task.waitsOn || []).concat(otherId) });
  else if (field === 'holdsUp' && canWaitOn(ps, otherId, task.id)) {
    const other = findTaskWithProject(otherId);
    if (other) M.updateTaskFields(otherId, { waitsOn: (other.task.waitsOn || []).concat(task.id) });
  }
}
function onDetailAction(action, el) {
  const d = detailTask();
  if (!d) return;
  const { task, project } = d;
  if (action === 'detail-close') { selectBoardTask(null); paint(); }
  else if (action === 'detail-fold') {
    const key = el.getAttribute('data-key');
    ui.boardOpen = ui.boardOpen === key ? null : key; ui.boardAddSub = false; ui.boardLink = null; ui.boardPicker = false;
    paint();
  }
  else if (action === 'detail-goto') { selectBoardTask(el.getAttribute('data-task-id')); paint(); }
  else if (action === 'detail-make-cat') {
    const id = el.getAttribute('data-cat');
    M.updateTaskFields(task.id, { categoryIds: [id].concat((task.categoryIds || []).filter((c) => c !== id)) });
  }
  else if (action === 'detail-add-sub-open') {
    ui.boardAddSub = true; paint();
    const box = document.querySelector('[data-detail-newsub]');
    if (box) box.focus();
  }
  else if (action === 'detail-add-sub') addDetailSubtask(task, project);
  else if (action === 'detail-link-open') {
    const f = el.getAttribute('data-field');
    ui.boardLink = ui.boardLink && ui.boardLink.field === f ? null : { field: f, query: '' };
    paint();
    const box = document.querySelector('[data-detail-find]');
    if (box) box.focus();
  }
  else if (action === 'detail-link-add') { addDetailTie(task, el.getAttribute('data-field'), el.getAttribute('data-id')); ui.boardLink = null; paint(); }
  else if (action === 'detail-unlink') {
    const f = el.getAttribute('data-field'), id = el.getAttribute('data-id');
    if (f === 'parent') M.updateTaskFields(task.id, { parentId: undefined });
    else if (f === 'waitsOn') { const w = (task.waitsOn || []).filter((x) => x !== id); M.updateTaskFields(task.id, { waitsOn: w.length ? w : undefined }); }
    else if (f === 'holdsUp') { const o = findTaskWithProject(id); if (o) { const w = (o.task.waitsOn || []).filter((x) => x !== task.id); M.updateTaskFields(id, { waitsOn: w.length ? w : undefined }); } }
  }
  else if (action === 'detail-focus') { M.setFocus(task.id); ui.notice = 'Focus is now “' + task.title + '”.'; paint(); }
  else if (action === 'detail-delete') {
    if (confirmDeleteTask(task.id, project.id)) { selectBoardTask(null); M.deleteTask(task.id, project.id); }
  }
}
function addDetailSubtask(task, project) {
  const box = document.querySelector('[data-detail-newsub]');
  const title = box ? box.value.trim() : '';
  if (!title) { if (box) box.focus(); return; }
  const sub = M.addTask(project.id, title);
  if (!sub) return;
  createIssueIfGithubProject(sub, project.id);
  if (canSetParent(state.projects, sub.id, task.id)) M.updateTaskFields(sub.id, { parentId: task.id });
  ui.boardAddSub = true; // ready for the next one
  paint();
  const next = document.querySelector('[data-detail-newsub]');
  if (next) next.focus();
}
// Fields that save when they change or are left (the Notes summary follows each keystroke, see onAppInput).
function onDetailChange(t) {
  const d = detailTask();
  if (!d) return false;
  const { task, project } = d;
  if (t.matches('[data-detail-status]')) M.setTaskStatus(task.id, t.value);
  else if (t.matches('[data-detail-notes]')) M.updateTaskFields(task.id, { notes: t.value.trim() });
  else if (t.matches('[data-detail-priority]')) M.editTask(task.id, project.id, { priority: t.value });
  else if (t.matches('[data-detail-size]')) M.updateTaskFields(task.id, { size: t.value || null });
  else if (t.matches('[data-detail-due]')) M.editTask(task.id, project.id, { deadline: t.value });
  else if (t.matches('.detail-labels input[name="categoryIds"]')) {
    const checked = Array.from(t.closest('.label-options').querySelectorAll('input[name="categoryIds"]:checked')).map((i) => i.value);
    const kept = (task.categoryIds || []).filter((c) => checked.includes(c));
    ui.boardPicker = true;
    M.updateTaskFields(task.id, { categoryIds: kept.concat(checked.filter((c) => !kept.includes(c))) });
  } else if (t.matches('.detail-labels input[name="newLabels"]')) {
    const ids = (task.categoryIds || []).slice();
    t.value.split(',').map((s) => s.trim()).filter(Boolean).forEach((name) => { const id = labelIdByName(name); if (!ids.includes(id)) ids.push(id); });
    ui.boardPicker = true;
    M.updateTaskFields(task.id, { categoryIds: ids });
  } else return false;
  return true;
}
// The title is edited in place and saved when it is left.
function onDetailFocusOut(e) {
  if (!e.target.matches || !e.target.matches('[data-detail-title]')) return;
  const d = detailTask();
  if (!d) return;
  const title = e.target.textContent.trim();
  if (title && title !== d.task.title) M.editTask(d.task.id, d.project.id, { title });
  else if (!title) paint(); // an empty title is not saved; the old one comes back
}

function onAppChange(e) {
  const colorEl = colorInputTarget(e);
  if (colorEl) { onColorChange(colorEl); return; }
  if (e.target.matches && e.target.matches('[data-bulk-key]')) {
    const key = e.target.getAttribute('data-bulk-key');
    ui.bulk.picked = e.target.checked ? ui.bulk.picked.filter((k) => k !== key).concat(key) : ui.bulk.picked.filter((k) => k !== key);
    ui.bulk.why = '';
    paintKeepingFocus('[data-bulk-key="' + CSS.escape(key) + '"]');
    return;
  }
  if (e.target.matches && e.target.matches('[data-bulk-project]')) {
    ui.bulk.projectId = e.target.value || null;
    ui.bulk.why = '';
    paintKeepingFocus('[data-bulk-project]');
    return;
  }
  if (e.target.matches && onDetailChange(e.target)) return;
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
  } else if (e.target.matches && e.target.matches('[data-action="rm-set-milestone"]')) {
    M.setTaskMilestone(e.target.getAttribute('data-id'), e.target.value); paint();
  } else if (e.target.matches && e.target.matches('[data-action="set-project-category"]')) {
    const projectId = e.target.getAttribute('data-project');
    let categoryId = e.target.value;
    if (categoryId === '__new__') {
      const name = prompt('Name of the new area:');
      categoryId = name ? M.addProjectCategory(name).id : '';
    }
    M.setProjectCategory(projectId, categoryId || null);
  }
}

function onAppInput(e) {
  const colorEl = colorInputTarget(e);
  if (colorEl) { onColorInput(colorEl); return; }
  if (e.target.matches && e.target.matches('[data-detail-notes]')) {
    const v = document.querySelector('[data-summary="notes"]');
    if (v) v.textContent = notesSummary(e.target.value);
    return;
  }
  if (e.target.matches && e.target.matches('[data-detail-find]')) {
    ui.boardLink.query = e.target.value; paint();
    const box = document.querySelector('[data-detail-find]');
    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    return;
  }
  if (e.target.matches && e.target.matches('[data-action="set-task-query"]')) { ui.taskQuery = e.target.value; paint(); return; }
  // the slip's title and notes are kept in the scratch without a repaint (it would lose the caret);
  // innerText, not textContent, so a line break typed into the title is kept
  if (e.target.matches && e.target.matches('[data-slip-title]')) { ui.unsorted.title = e.target.innerText; return; }
  if (e.target.matches && e.target.matches('[data-bulk-group]')) { ui.bulk.groupTitle = e.target.value; refreshBulkApply(); return; }
  if (e.target.matches && e.target.matches('[data-bulk-newlabel]')) { ui.bulk.newLabel = e.target.value; return; }
  if (e.target.matches && e.target.matches('.slip-notes')) { ui.unsorted.notes = e.target.value; return; }
  if (e.target.matches && e.target.matches('[data-tie-find]')) {
    ui.unsorted.pickQuery = e.target.value;
    paint();
    const box = document.querySelector('[data-tie-find]');
    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    return;
  }
  if (e.target.matches && e.target.matches('.car-find')) {
    ui.focusFind = e.target.value;
    const slot = document.getElementById('project-wallet');
    if (slot) { slot.innerHTML = R.renderProjectWalletInner(viewState(state), ui); mountWallets(slot, walletHooks); }
    return;
  }
  if (e.target.matches && e.target.matches('.sort-find')) {
    ui.unsorted.find = e.target.value;
    paint();
    const box = document.querySelector('.sort-find');
    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    return;
  }
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

// ---- "Select many" on the Sort screen (js/in-tray.js bulkSort) ---------------------------------
function bulkOrdered() { return orderTray(R.unsortedQueue(state), ui.unsorted.later); }

// A repaint replaces the controls, so put focus back on the one that was in use.
function paintKeepingFocus(selector) {
  paint();
  const el = document.querySelector(selector);
  if (el) el.focus();
}

// Typing a group name changes whether Apply can run, without a repaint (it would lose the caret).
function refreshBulkApply() {
  const btn = document.querySelector('[data-action="bulk-apply"]');
  const slips = pickedSlips(bulkOrdered(), ui.bulk.picked);
  if (btn) btn.disabled = !slips.length || !!bulkBlocker(slips, ui.bulk);
}

function onBulkAction(action, el) {
  const b = ui.bulk;
  if (action === 'bulk-toggle') { ui.bulk = freshBulk(!b.on); paint(); return; }
  if (action === 'bulk-all') { b.picked = bulkOrdered().map((x) => x.key); b.why = ''; paint(); return; }
  if (action === 'bulk-none') { b.picked = []; b.why = ''; paint(); return; }
  if (action === 'bulk-flag') { b.selected = toggleToken(b.selected, el.getAttribute('data-token')); paintKeepingFocus('[data-action="bulk-flag"][data-token="' + CSS.escape(el.getAttribute('data-token')) + '"]'); return; }
  if (action === 'bulk-new-flag') {
    const name = (b.newLabel || '').trim();
    if (name) {
      const id = labelIdByName(name);
      if (!b.selected.includes(id)) b.selected = b.selected.concat(id);
      b.newLabel = '';
    }
    paintKeepingFocus('[data-bulk-newlabel]');
    return;
  }
  if (action === 'bulk-apply') {
    const slips = pickedSlips(bulkOrdered(), b.picked);
    const blocked = bulkBlocker(slips, b);
    if (blocked) { b.why = blocked; paint(); return; }
    // a copy of everything as it stands, first: the same backup list a load or a shrinking save uses
    try { backupRaw(localStorage.getItem(STORAGE_KEY), 'before sorting many at once'); } catch (err) { console.error('Could not back up before sorting many at once:', err); }
    const done = bulkSort(slips, Object.assign({}, b, { deadline: b.due }), {
      fileInboxItem: M.fileInboxItem, updateTaskFields: M.updateTaskFields, applyTaskMove: M.applyTaskMove, addTask: M.addTask, projects: state.projects,
      createIssue: createIssueIfGithubProject, labelIdByName,
    });
    const project = state.projects.find((p) => p.id === b.projectId);
    const parts = [];
    if (done.filed) parts.push('filed ' + done.filed + ' into ' + (project ? project.name : 'the project'));
    if (done.moved) parts.push('moved ' + done.moved);
    if (done.labelled) parts.push('labelled ' + done.labelled);
    if (done.parent) parts.push('grouped ' + done.grouped + ' under "' + done.parent.title + '"');
    if (done.skipped) parts.push(done.skipped + ' had already gone and were left alone');
    ui.notice = parts.length ? 'Sorted: ' + parts.join(', ') + '.' : 'Nothing changed.';
    ui.bulk = freshBulk(true);
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

// A project the switch hides (a new one, or one linked from a Focus card) is shown by going back to All.
function showInView(projectId) {
  const p = state.projects.find((q) => q.id === projectId);
  if (p && !inView(state, ui.view, p)) setView(VIEW_ALL);
}

// The switch's list (a bottom sheet on a phone, a dropdown on desktop): focus goes in, Tab stays in,
// Escape or the backdrop closes it and focus returns to the button.
function focusViewPop() {
  const pop = document.querySelector('.vs-pop');
  if (pop) (pop.querySelector('.vs-search, .vs-item.on, .vs-item') || pop).focus();
}
function closeViewPop() { ui.viewOpen = false; paint(); const b = document.querySelector('.vs-pick'); if (b) b.focus(); }
document.addEventListener('keydown', (e) => {
  const pop = document.querySelector('.vs-pop');
  if (!pop || !ui.viewOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeViewPop(); return; }
  if (e.key !== 'Tab') return;
  const f = [...pop.querySelectorAll('button, input')].filter((x) => x.offsetParent);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!pop.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}, true);
document.addEventListener('input', (e) => {
  if (!(e.target.matches && e.target.matches('[data-view-search]'))) return;
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('.vs-pop .vs-item').forEach((b) => { b.parentElement.hidden = !!q && !b.getAttribute('data-name').includes(q); });
  document.querySelectorAll('.vs-pop .vs-grp').forEach((g) => { g.hidden = ![...g.querySelectorAll('li')].some((li) => !li.hidden); });
});

// After adding a project from the "+ New" panel (Q29a, Q12d): open it on the Roadmap's Project view.
function afterProjectAdded(projectId) {
  setView({ mode: 'project', id: projectId });
  paint();
  window.scrollTo(0, 0);
}

// The projects the Roadmap's group view lists, in the order it shows them (Find box and sort control).
function visibleRoadmapProjects() {
  return filterAndSortProjects(viewProjects(state, ui.view), { query: ui.projectQuery, sortBy: ui.projectSort });
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

// No projects yet (#124): the empty main column opens the "+ New" panel in place, since the sidebar
// that normally holds it isn't drawn until there is a project.
function openFirstProjectPanel() {
  ui.newPanelOpen = true;
  ui.newPanelTab = 'project';
  paint();
  const spot = document.querySelector('.projects-empty');
  if (spot) spot.scrollIntoView({ block: 'center' });
  focusNewPanelFirstField();
}

function onOnboardingClick(action, el) {
  const ob = ui.onboarding;
  if (!ob) return;
  if (action === 'ob-next') {
    ob.step = nextStep(ob.step);
    if (!ob.step) finishOnboarding();
    paint();
    if (ob.step === 'folder') focusLater('#ob-folder-name');
  } else if (action === 'ob-skip' || action === 'ob-finish') {
    finishOnboarding();
    paint();
  } else if (action === 'ob-suggest') {
    const input = document.getElementById('ob-folder-name');
    if (input) { input.value = el.getAttribute('data-name'); input.focus(); }
  } else if (action === 'ob-category') {
    const name = el.getAttribute('data-name');
    ob.category = ob.category === name ? null : name;
    paint();
    focusLater('#ob-task-title');
  } else if (action === 'ob-deal') {
    M.pickFocus({ projectId: ob.projectId });
    ob.step = 'pick';
    paint();
  } else if (action === 'ob-sync') {
    finishOnboarding();
    location.href = 'setup.html';
  }
}

function onAppSubmit(e) {
  const obForm = e.target.closest('[data-action="ob-folder"], [data-action="ob-task"]');
  if (obForm && ui.onboarding) {
    e.preventDefault();
    const fd = new FormData(obForm);
    if (obForm.getAttribute('data-action') === 'ob-folder') {
      const name = String(fd.get('name') || '').trim();
      if (!name) return;
      ui.onboarding.projectId = M.addProject(name, null).id;
      ui.onboarding.step = 'tasks';
      paint();
    } else {
      const title = String(fd.get('title') || '').trim();
      if (!title) return;
      const ids = ui.onboarding.category ? [labelIdByName(ui.onboarding.category)] : [];
      M.addTask(ui.onboarding.projectId, title, null, ids);
      paint();
    }
    focusLater('#ob-task-title');
    return;
  }
  const rmForm = e.target.closest('[data-action="rm-add-submit"]');
  if (rmForm) {
    e.preventDefault();
    const name = String(new FormData(rmForm).get('name') || '').trim(), kind = rmForm.getAttribute('data-kind');
    if (name) M.editRoadmap(rmProject(), (p) => (kind === 'section' ? addSection(p, name) : addMilestone(p, name)));
    ui.rmAdd = null; paint();
    return;
  }
  const addTaskForm = e.target.closest('[data-action="add-task"]');
  if (addTaskForm) {
    e.preventDefault();
    const fd = new FormData(addTaskForm);
    const projectId = addTaskForm.getAttribute('data-project');
    if (!String(fd.get('title') || '').trim()) return;
    const task = M.addTaskPicked(projectId, fd.get('title'), fd.get('deadline'), labelsFromForm(fd), fd.get('steps'), fd.get('priority'), dueStagesFromForm(fd));
    if (!task) return; // no priority picked: nothing is added (#249)
    const inMs = fd.get('milestone'); if (inMs && inMs !== 'unplanned') M.setTaskMilestone(task.id, String(inMs)); // added from a Roadmap milestone
    ui.rmAdd = null;
    createIssueIfGithubProject(task, projectId);
    delete ui.addDraft[projectId]; delete ui.addingTask[projectId]; delete ui.addPick[projectId];
    paint(); focusAddTitle(projectId);
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
  // an open chip picker: Escape closes it and gives focus back to its chip
  if (e.key === 'Escape' && pickState.field) {
    const { field, taskId } = pickState;
    e.stopPropagation(); closePick(); paint(); focusPickChip(field, taskId);
    return;
  }
  // a typed date: Enter reads it instead of submitting the row
  if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-pick-type]')) { e.preventDefault(); onPickDate(e.target, e.target.value); return; }
  // 1-4 pick Urgent/High/Medium/Low while focus is on a button in the add row (not in a box, where digits are typing)
  if ('1234'.includes(e.key) && e.key.length === 1 && e.target.tagName === 'BUTTON' && e.target.closest && e.target.closest('.add-row')) {
    const row = e.target.closest('.add-row');
    const b = row.querySelector('.pick-opt[data-field="priority"][data-value="' + ['urgent', 'high', 'medium', 'low'][+e.key - 1] + '"]');
    if (b && !row.querySelector('.pick-blocks').hidden) { e.preventDefault(); b.click(); return; }
  }
  // Task details: Enter finishes the title (saved on leaving it) or adds the typed subtask
  if (e.key === 'Enter' && e.target.matches) {
    if (e.target.matches('[data-detail-title]')) { e.preventDefault(); e.target.blur(); return; }
    if (e.target.matches('[data-detail-newsub]')) { e.preventDefault(); const d = detailTask(); if (d) addDetailSubtask(d.task, d.project); return; }
  }
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
  // Escape closes a project's add row's "More" boxes while focus is inside the row (Q3b, #240).
  if (e.key === 'Escape') {
    const form = e.target.closest && e.target.closest('.add-task-form');
    const pid = form && form.getAttribute('data-project');
    if (form && ui.addingTask[pid]) { delete ui.addingTask[pid]; paint(); focusAddTitle(pid); }
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

// Opening a row's editor or a project's add row's "More" boxes should bring it into view within its own
// tile at >=1100px, not just onto the page (Q26a, #82) -- `block:'nearest'` does that and is a no-op
// below 1100px, where the tile isn't its own scroll container. Runs after the paint that put the
// form in the DOM.
function scrollOpenedFormIntoView(selector) {
  const el = document.querySelector(selector);
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
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
  // Settings' checklist links here to link a first GitHub repo (#126): open "+ New" on its repo tab
  const params = new URLSearchParams(location.search);
  if (params.get('new') === 'repo') {
    setScreen('roadmap'); // the + New panel is on the Roadmap
    ui.newPanelOpen = true;
    ui.newPanelTab = 'repo';
    fetchNewPanelRepos();
    history.replaceState(null, '', location.pathname);
  }
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
  app.addEventListener('focusout', onDetailFocusOut);
  app.addEventListener('contextmenu', onAppContextMenu);
  initTriageDrag(app, (id, to) => moveTriage(id, to, 0));
  initRoadmapDrag(app, {
    task: rmTask, taskStep: rmTaskStep,
    ms: (id, sec, i) => rmEdit('ms', id, (p) => moveMilestone(p, id, sec, i)), msStep: (id, d) => rmEdit('ms', id, (p) => stepMilestone(p, id, d)),
    sec: (id, i) => rmEdit('sec', id, (p) => moveSection(p, id, i)), secStep: (id, d) => rmEdit('sec', id, (p) => stepSection(p, id, d)),
  });
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
  const captureForm = document.getElementById('capture-form');
  const captureInput = document.getElementById('capture-input');
  document.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName, typing = e.target && (e.target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
    // J jumps to the jot box from anywhere on a wide screen (not while typing); Escape leaves it (#259)
    if ((e.key === 'j' || e.key === 'J') && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && isWideScreen()) { e.preventDefault(); captureInput.focus(); }
    else if (e.key === 'Escape' && e.target === captureInput) captureInput.blur();
    else if (e.key === 'Escape' && ui.boardSelected && !typing) { selectBoardTask(null); paint(); }
  });
  captureForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const target = R.jotTarget(state, ui), title = captureInput.value.trim();
    if (!target) M.addCapture(captureInput.value);
    else if (!title) return;
    else {
      const task = M.addTask(target, title);
      createIssueIfGithubProject(task, target);
      ui.notice = 'Added "' + title + '" to ' + state.projects.find((q) => q.id === target).name;
      ui.noticeAction = { text: ui.notice, label: 'Open', action: 'open-added-task', attrs: { 'data-task': task.id, 'data-project': target } };
      paint();
    }
    captureInput.value = '';
    autoGrow(captureInput);
    captureInput.focus();
  });
  // Enter adds the thought, as it did when the jotter was a one-line input; Shift+Enter is a new line
  captureInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); captureForm.requestSubmit(); }
  });
  captureInput.addEventListener('input', () => autoGrow(captureInput));
  document.getElementById('capture-to').addEventListener('change', (e) => { ui.jotTo = e.target.value; paint(); });
  paintHeaderControls();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
