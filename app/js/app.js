// focus-deck-app/js/app.js
import { state, esc, findTaskWithProject, findProjectIdForTask, cssColorToHex, storageProblem, onExternalStateChange, requestPersistentStorage, GIST_ID_KEY, STORAGE_KEY, backupRaw } from './state.js';
import * as M from './mutations.js';
import * as R from './render.js';
import { registerPaint, initSyncLifecycle } from './sync.js';
import {
  syncGithub, linkTaskToIssue, unlinkTask, createGithubIssueFromTask,
  parseRepoInput, listYourRepos, untrackedRepos, isValidRepoName,
  linkProjectToRepoOnGithub, linkProjectToRepoByInput, transferTaskIssue, pushReviewToIssue,
} from './github-sync.js';
import { getToken, createRepo } from './github.js';
import { initProjectDrag, isDragging } from './project-drag.js';
import { taskOrderChanges, sortTasks, planTaskMove } from './task-move.js';
import { confirmMove } from './move-dialog.js';
import { dueMoment } from './due-stage.js';
import { startComplete, phaseClasses } from './focus-complete.js';
import { mountWallets, onSpreadChange } from './wallet.js';
import { tiesOf } from './task-links.js';
import { renderInTrayCard, unsortedCurrent } from './in-tray-view.js';
import { navigate, shiftMonth, warnPlan } from './sort-flow.js';
import { sendToBack, toggleToken, toggleFolder, fileSlip, MORE_FLAGS_KEY, orderTray, pickedSlips, bulkBlocker, bulkSort } from './in-tray.js';
import { ONBOARDING_KEY, shouldShowOnboarding, nextStep } from './onboarding.js';
import { renderOnboarding } from './onboarding-view.js';
import { pickState, dueDates, parseDue } from './pick-bits.js';
import { renderReview } from './review-view.js';
import { renderTidy, TIDY_STEPS } from './tidy-view.js';
import { tidyGroups, confirmIds, GROUPS } from './tidy.js';
import { renderTriage } from './triage-view.js';
import { triageLists, moveId, NOW_SIZE, NEXT_SIZE } from './triage.js';
import { initTriageDrag } from './triage-drag.js';
import { renderRoadmap } from './roadmap-view.js';
import { renderProjects } from './projects-view.js';
import { initRoadmapDrag } from './roadmap-drag.js';
import { openMilestoneSettings } from './milestone-settings.js';
import { COLS, roadmapOf, applyMilestoneSettings, stepMilestone, stepSection, moveMilestone, moveSection, addSection, addMilestone, makeMilestone } from './roadmap.js';
import { reviewLists } from './board.js';
import { notesSummary, renderTaskDetails } from './task-details.js';
import { canSetParent, canWaitOn } from './task-links.js';
import { applyNoteFace } from './note-face.js';
import { applyComfort, getChunk } from './comfort.js';
import { VIEW_ALL, renderViewSwitch, normalizeView, viewProjects, viewState, inView } from './view-switch.js';
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

// J opens the + Jot screen only from the wide layout up (mirrors the 1100px media queries in css/app.css).
const isWideScreen = () => typeof matchMedia === 'function' && matchMedia('(min-width:1100px)').matches;

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
  return { on: !!on, step: 1, sub: null, fromReceipt: false, find: '', facingFolder: null, facingFlag: null, showAllFlags: false, priority: null, due: '', dateOpen: false, picked: [], projectId: null, selected: [], groupTitle: '', newLabel: '', why: '' };
}

function freshUnsortedScratch(later) {
  return { later: later || [], priority: null, due: '', dateOpen: false, projectId: null, selected: [], step: 0, sub: null, menu: false, month: null, letter: null, dueStages: null, fromReceipt: false, find: '', title: null, notes: null, notesOpen: false, facingFolder: null, facingFlag: null, showAllFlags: false, currentKey: null,
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
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(ui.view));
    if (ui.view.mode === 'project') localStorage.setItem(LAST_PROJECT_KEY, ui.view.id);
  } catch (e) { console.error('Could not save the view switch:', e); }
}
// The Roadmap tab shows one project: the one picked last, else the first (#262).
const LAST_PROJECT_KEY = 'focusdeck-last-project';
function lastProjectId() {
  let id = null;
  try { id = localStorage.getItem(LAST_PROJECT_KEY); } catch (e) { console.error('Could not read the last project:', e); }
  return state.projects.some((p) => p.id === id) ? id : (state.projects[0] || {}).id;
}

export const ui = {
  screen: loadScreen(),
  view: loadView(), viewOpen: false,
  // boardSelected: the open task's id, which Task details (#201) renders from, on any tab.
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
  np: null, projSortOpen: false, projOrder: false, // New project (#267): the open flow (memory only), the Sort by drawer, the My order screen
  newPanelRepos: null, newPanelRepoFilter: '', // the repos "My repo" lists
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

// The Sort tab's carousels write to the one-thought flow, or to Sort several when that is open.
const trayScratch = () => (ui.bulk.on ? ui.bulk : ui.unsorted);

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
      trayScratch().facingFolder = key;
    } else if (name === 'tray-flags') {
      trayScratch().facingFlag = key;
    }
  },
  // Returns false when nothing could be drawn (the card goes back down).
  onChoose(name, key) {
    // the in-tray's wallets don't draw a task: choosing puts a folder or a flag on the slip, and
    // choosing it again takes it off
    if (name === 'tray-folders') {
      const S = trayScratch();
      S.projectId = toggleFolder(S.projectId, key);
      S.facingFolder = key;
      paint();
      return true;
    }
    if (name === 'tray-flags' && key === MORE_FLAGS_KEY) {
      trayScratch().showAllFlags = true; // Settings > Category choices hid some (#133)
      paint();
      return true;
    }
    if (name === 'tray-flags') {
      const S = trayScratch();
      S.selected = toggleToken(S.selected, key);
      S.facingFlag = key;
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
  if (currentKey !== ui.unsorted.currentKey) ui.unsorted = Object.assign(freshUnsortedScratch(ui.unsorted.later), { currentKey }, currentUnsorted && currentUnsorted.kind === 'task' ? Object.assign({ priority: currentUnsorted.task.priority || null, due: currentUnsorted.task.deadline || '' }, tiesOf(st.projects, currentUnsorted.task.id)) : {});
  // A sync that brings projects in while the welcome is still on its first screen means this device
  // already has a life elsewhere: step aside (not when replayed on purpose).
  if (ui.onboarding && ui.onboarding.step === 'welcome' && !ui.onboarding.forced && st.projects.length) ui.onboarding = null;
  if (ui.onboarding) {
    return '<div class="main-col onboarding-col">'
      + renderOnboarding(st, ui.onboarding, () => R.renderFocus(st, findTaskWithProject, ui))
      + '</div>' + R.renderToast(ui.syncError || ui.notice, ui.syncError ? 'error' : 'info', noticeAction());
  }
  ui.view = normalizeView(ui.view, st); // a gone area or project is All
  if (ui.screen === 'roadmap' && ui.view.mode !== 'project' && lastProjectId()) setView({ mode: 'project', id: lastProjectId() }); // the Roadmap is one project
  st._ui = ui;
  const sw = renderViewSwitch(st, ui.view, ui.viewOpen);
  const hasToken = !!getToken();
  // one activity at a time (#135): the rail, then only the chosen screen
  const rail = R.renderRail(ui.screen, R.unsortedQueue(st).length, reviewLists(st, null, Date.now()).waiting.length);
  const toast = R.renderToast(ui.syncError || ui.notice, ui.syncError ? 'error' : 'info', noticeAction());
  // Task details (#201) opens from a task on any tab: Review and Roadmap draw it themselves, the others get it here
  const details = ['sort', 'tidy', 'triage', 'focus'].includes(ui.screen) && ui.boardSelected && findTaskWithProject(ui.boardSelected) ? renderTaskDetails(st, ui, ui.boardSelected) : '';
  const screen = (name, body) => rail + '<div class="screen screen-' + name + '">' + sw + body + details + '</div>' + toast;
  if (ui.screen === 'sort') return screen('sort', renderInTrayCard(st, Object.assign({}, ui, { inboxOpen: true }))); // the tray, always open
  if (ui.screen === 'tidy') return screen('tidy', renderTidy(st, ui));
  if (ui.screen === 'projects') return screen('projects', renderProjects(st, ui, hasToken));
  if (ui.screen === 'roadmap') return rail + '<div class="screen screen-roadmap">' + sw + renderRoadmap(st, ui, hasToken) + '</div>' + toast;
  if (ui.screen === 'triage') return screen('triage', renderTriage(st, ui));
  if (ui.screen === 'review') return rail + '<div class="screen screen-review">' + sw + renderReview(st, ui) + '</div>' + toast;
  return screen('focus', R.renderFocus(st, findTaskWithProject, ui));
}

// Tidy up: the current tick screen's tasks, and the move to the next screen (after the last, "Close these?", or Triage when nothing is marked).
const tidyItems = () => { const g = tidyGroups(state, ui.view).groups.find((x) => x.key === GROUPS[(ui.tidyStep || 1) - 1].key); return g ? g.items : []; };
function tidyAdvance(step) {
  ui.tidyTicks = {};
  if (step > TIDY_STEPS && !confirmIds(state, ui.view, ui.tidyMarks || {}).length) { ui.tidyStep = 0; ui.triageStep = 'top'; setScreen('triage'); } else ui.tidyStep = step;
  paint(); window.scrollTo(0, 0);
}

// Triage: a drop, Alt+Arrow or an up/down button. `to` is the place to end at, or (when null) `by` steps
// from where it is now. The new order is saved at once (every task in the view gets a triageRank).
function moveTriage(id, to, by) {
  const l = triageLists(state, ui.view, dueDates().today);
  const ids = l.now.concat(l.next, l.later).map((r) => r.id), from = ids.indexOf(id);
  const at = Math.max(0, Math.min(ids.length - 1, to === null ? from + by : to));
  if (from < 0 || at === from) return;
  M.saveTriageOrder(moveId(ids, id, at));
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

// The + Jot screen (#263), drawn into #jot-screen on its own so a sync repaint never eats the draft.
function paintJot() { document.getElementById('jot-screen').innerHTML = R.renderJotScreen(state, ui); }
function keepJotDraft() { const box = document.getElementById('jot-input'); if (box) ui.jotDraft = box.value; }
function openJot() { ui.jotOpen = true; ui.jotPick = false; paintJot(); document.getElementById('jot-input').focus(); }
function closeJot() { ui.jotOpen = false; ui.jotPick = false; ui.jotDraft = ''; paintJot(); const b = document.getElementById('jot-open'); if (b) b.focus(); }
// Files the thought exactly as the old topbar jot box did: Sort, or a task in the stamped project.
function saveJot() {
  keepJotDraft();
  const target = R.jotTarget(state, ui), title = (ui.jotDraft || '').trim();
  if (!title) { document.getElementById('jot-input').focus(); return; }
  if (!target) { M.addCapture(ui.jotDraft); ui.notice = 'Saved ✓'; ui.noticeAction = null; }
  else {
    const task = M.addTask(target, title);
    createIssueIfGithubProject(task, target);
    ui.notice = 'Saved ✓';
    ui.noticeAction = { text: ui.notice, label: 'Open', action: 'open-added-task', attrs: { 'data-task': task.id, 'data-project': target } };
  }
  closeJot();
  paint();
}

// The topbar's sync button and Projects toggle live outside #app (see index.html), so paint()
// updates them directly instead of through the innerHTML replace below.
function paintHeaderControls() {
  const syncSlot = document.getElementById('topbar-sync');
  if (syncSlot) syncSlot.innerHTML = R.renderSyncButton(state);
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
const GROWING_BOXES = '.slip-notes, [data-detail-notes]';
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
  const isoDay = field === 'due' && /^\d{4}-\d\d-\d\d$/.test(value);
  const val = field === 'priority' ? (value === 'none' ? '' : value) : value === 'date' ? value : value === 'none' ? '' : isoDay ? value : dueDates()[value];
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
  else { if (field === 'priority') S.priority = val; else { S.due = val; if (!isoDay) S.dateOpen = false; S.dueStages = null; } } // a day picked on the month page keeps it open until "Use"
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
  if (ui.rmAdd && ui.rmAdd.kind === 'task' && !e.target.closest('.add-row, .rm-add-link')) { ui.rmAdd = null; paint(); } // click away closes the Roadmap's add box
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
    ui.tidyStep = 0; ui.tidyTicks = {}; ui.triageStep = 'top'; ui.tidyClosed = []; // Organize opens on its two cards
    paint();
    window.scrollTo(0, 0);
    return;
  }
  if (action === 'view-step') { ui.viewOpen = el.getAttribute('data-step'); paint(); focusViewPop(); return; }
  if (action === 'view-open') { ui.viewOpen = ui.viewOpen ? false : 'menu'; paint(); focusViewPop(); return; }
  if (action === 'sync-drawer') { ui.syncOpen = !ui.syncOpen; paint(); return; }
  if (action === 'jot-open') { openJot(); return; }
  if (action === 'jot-close') { closeJot(); return; }
  if (action === 'jot-where') { keepJotDraft(); ui.jotPick = !ui.jotPick; paintJot(); const f = document.querySelector(ui.jotPick ? '.jot-drawer .vs-search' : '.jot-where'); if (f) f.focus(); return; }
  if (action === 'jot-pick') { ui.jotTo = el.getAttribute('data-id'); keepJotDraft(); ui.jotPick = false; paintJot(); document.querySelector('.jot-where').focus(); return; }
  if (action === 'jot-save') { saveJot(); return; }
  if (action === 'view-close') { closeViewPop(); return; }
  if (action === 'view-pick') { setView({ mode: el.getAttribute('data-mode'), id: el.getAttribute('data-id') }); closeViewPop(); return; }
  if (action === 'scroll-to-task') {
    const id = el.getAttribute('data-task'), q = (window.CSS && CSS.escape) ? CSS.escape(id) : id;
    const to = document.querySelector('[data-task-id="' + q + '"]') || document.querySelector('.task-row[data-task="' + q + '"]');
    if (to) { to.scrollIntoView({ block: 'center' }); const f = to.querySelector('button, input, [tabindex]'); if (f) f.focus({ preventScroll: true }); }
    return;
  }
  if (action === 'tidy-step') { ui.tidyStep = Number(el.getAttribute('data-step')); ui.tidyTicks = {}; paint(); window.scrollTo(0, 0); return; }
  if (action === 'tidy-skip') { tidyAdvance(Number(el.getAttribute('data-step'))); return; }
  if (action === 'tidy-all') { ui.tidyTicks = Object.fromEntries(tidyItems().map((i) => [i.id, true])); paint(); return; }
  if (action === 'tidy-none') { ui.tidyTicks = {}; paint(); return; }
  if (action === 'tidy-mark') { // the desk object a tick list ends on: marks every ticked task (nothing closes until Confirm), then the next screen
    const m = el.getAttribute('data-mark'), marks = Object.assign({}, ui.tidyMarks);
    tidyItems().forEach((i) => { if (ui.tidyTicks[i.id]) marks[i.id] = m; });
    ui.tidyMarks = marks;
    tidyAdvance(ui.tidyStep + 1); return;
  }
  if (action === 'tidy-confirm') {
    const ids = confirmIds(state, ui.view, ui.tidyMarks || {});
    const titles = new Map(); state.projects.forEach((p) => p.tasks.forEach((t) => titles.set(t.id, t.title)));
    M.confirmTidy(ids);
    ui.tidyClosed = ids.map((id) => ({ id, title: titles.get(id) })); // the "Closed N ✓ / Undo" slip on Triage
    ids.forEach((id) => delete ui.tidyMarks[id]);
    ui.tidyStep = 0; ui.triageStep = 'top';
    setScreen('triage'); paint(); window.scrollTo(0, 0); return; // Confirm, then Triage
  }
  if (action === 'rm-open') { setScreen('roadmap'); setView({ mode: 'project', id: el.getAttribute('data-project') }); paint(); window.scrollTo(0, 0); return; }
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
  if (action === 'triage-later') { ui.triageStep = 'later'; ui.triageFind = ''; paint(); window.scrollTo(0, 0); return; }
  if (action === 'triage-go') {
    const to = el.getAttribute('data-to'), from = el.getAttribute('data-from'), l = triageLists(state, ui.view, dueDates().today);
    if (to === 'move') ui.triageMoveIds = (from === 'next' ? l.next : from === 'later' ? l.later.filter((r) => r.task.title.toLowerCase().includes((ui.triageFind || '').toLowerCase())) : l.now).map((r) => r.id); // Move works on the list it was opened from
    setScreen('triage'); ui.triageStep = to; paint(); window.scrollTo(0, 0); return; // the Triage card on the first screen comes here too
  }
  if (action === 'triage-move') { moveTriage(el.getAttribute('data-task'), null, Number(el.getAttribute('data-dir'))); return; }
  if (action === 'triage-reset') { const l = triageLists(state, ui.view, dueDates().today); M.resetTriageOrder(l.now.concat(l.next, l.later).map((r) => r.id)); ui.triageStep = 'top'; paint(); return; }
  if (action === 'tidy-undo') { // the slip's Undo brings every closed task back; with data-task, one
    const one = el.getAttribute('data-task'), back = (ui.tidyClosed || []).filter((c) => !one || c.id === one);
    back.forEach((c) => M.undoDone(c.id)); ui.tidyClosed = (ui.tidyClosed || []).filter((c) => !back.includes(c)); paint(); return;
  }
  if (action === 'review-done') { M.setTaskStatus(el.getAttribute('data-task'), 'done'); paint(); return; }
  if (action === 'review-more') { M.setTaskStatus(el.getAttribute('data-task'), 'doing'); paint(); return; }
  if (action === 'review-undo') { M.undoDone(el.getAttribute('data-task')); paint(); return; }
  if (action === 'review-open') { selectBoardTask(el.getAttribute('data-task')); paint(); return; }
  if (action === 'task-open') { const id = el.getAttribute('data-task'); selectBoardTask(ui.boardSelected === id ? null : id); paint(); return; }
  if (action.startsWith('detail-')) { onDetailAction(action, el); return; }
  if (action === 'start-new-project') { openNewProject(); return; }
  if (onProjectsAction(action, el)) return;
  if (action === 'unsorted-file' || action === 'unsorted-save') {
    // filing repaints, and the repaint resets ui.unsorted for the next slip, so read it all first
    const cur = unsortedCurrent(state, ui.unsorted);
    if (!cur) return;
    const u = ui.unsorted;
    const pick = { priority: u.priority, deadline: u.due, dueStages: u.dueStages, projectId: u.projectId, selected: u.selected, title: u.title, notes: u.notes,
      parent: u.parent, subtasks: u.subtasks, waitsOn: u.waitsOn, holdsUp: u.holdsUp, newSubtasks: u.newSubtasks };
    const done = fileSlip(cur, pick, {
      fileInboxItem: M.fileInboxItem, updateTaskFields: M.updateTaskFields, applyTaskMove: M.applyTaskMove, addTask: M.addTask, projects: state.projects,
      createIssue: createIssueIfGithubProject, labelIdByName,
    });
    if (done.outcome === 'filed' || done.outcome === 'saved') {
      const project = state.projects.find((p) => p.id === (done.projectId || pick.projectId || cur.project.id));
      const taskId = done.outcome === 'filed' ? (done.task && done.task.id) : done.taskId;
      ui.notice = 'Filed to ' + (project ? project.name : 'project') + ' ✓';
      ui.noticeAction = project && taskId ? { text: ui.notice, label: 'Open', action: 'open-added-task', attrs: { 'data-task': taskId, 'data-project': project.id } } : null;
      paint();
    } else if (done.outcome === 'later') {
      ui.unsorted.later = sendToBack(ui.unsorted.later, cur.key);
      paint();
    }
  }
  else if (action.startsWith('sort-') || action.startsWith('tie-')) onSortAction(action, el);
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
  else if (action === 'sync-github') { ui.syncOpen = false; manualSyncGithub(); }
  else if (action === 'rm-project-step') {
    const ids = visibleRoadmapProjects().map((p) => p.id), i = ids.indexOf(el.getAttribute('data-project')), dir = el.getAttribute('data-dir');
    moveProjectTo(ids[i], i + Number(dir), ids);
    const again = document.querySelector('.pj-key[data-project="' + el.getAttribute('data-project') + '"][data-dir="' + dir + '"]');
    if (again && !again.disabled) again.focus(); else { const o = document.querySelector('.pj-key[data-project="' + el.getAttribute('data-project') + '"]:not(:disabled)'); if (o) o.focus(); }
  }
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
  if (e.target.matches && e.target.matches('[data-tidy-tick]')) {
    const id = e.target.getAttribute('data-tidy-tick');
    ui.tidyTicks = Object.assign({}, ui.tidyTicks); if (e.target.checked) ui.tidyTicks[id] = true; else delete ui.tidyTicks[id];
    paintKeepingFocus('[data-tidy-tick="' + CSS.escape(id) + '"]');
    return;
  }
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
  if (e.target.matches && e.target.matches('[data-warn]')) {
    // red must stay shorter than yellow, so warnPlan re-suggests a red that no longer fits
    const u = ui.unsorted, hours = (k) => Number(document.querySelector('[data-warn="' + k + '"]').value);
    const plan = warnPlan(u.due, Date.now(), state.dueDefaults, { yellow: hours('yellow'), red: hours('red') });
    if (plan) u.dueStages = { yellow: { leadHours: plan.yellow.hours }, red: { leadHours: plan.red.hours } };
    paint();
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
  if (e.target.matches && e.target.matches('[data-bulk-newlabel]')) {
    ui.bulk.newLabel = e.target.value;
    const add = document.querySelector('[data-action="bulk-new-flag"]');
    if (add) add.disabled = !e.target.value.trim();
    return;
  }
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
  if (e.target.matches && e.target.matches('[data-triage-find]')) {
    ui.triageFind = e.target.value;
    paintKeepingFocus('[data-triage-find]');
    const box = document.querySelector('[data-triage-find]');
    if (box) box.setSelectionRange(box.value.length, box.value.length);
    return;
  }
  if (e.target.matches && e.target.matches('[data-bulk-find]')) {
    ui.bulk.find = e.target.value;
    paintKeepingFocus('[data-bulk-find]');
    const box = document.querySelector('[data-bulk-find]');
    if (box) box.setSelectionRange(box.value.length, box.value.length);
    return;
  }
  if (e.target.matches && e.target.matches('.sort-find:not([data-bulk-newlabel]):not(.pj-find)')) {
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
  const npField = ui.np && e.target.matches && [['data-np-name', 'name'], ['data-np-areaname', 'areaName'], ['data-np-reponame', 'repoName'], ['data-np-link', 'link']].find(([a]) => e.target.hasAttribute(a));
  if (npField) { // no repaint: it would lose the caret; only the stamp's state changes
    ui.np[npField[1]] = e.target.value;
    const v = e.target.value.trim(), next = document.querySelector('.pj-flow .sort-foot .dk-btn');
    const ok = { name: !!v, areaName: !!v, repoName: isValidRepoName(v), link: !!parseRepoInput(v) }[npField[1]];
    if (next) { next.disabled = !ok; next.classList.toggle('off', !ok); }
  }
  if (e.target.matches && e.target.matches('.repo-filter')) {
    ui.newPanelRepoFilter = e.target.value;
    paint();
    const field = document.querySelector('.repo-filter');
    if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
  }
}

// ---- The Sort tab's steps (js/sort-flow.js decides the order, js/sort-flow-view.js draws them) ---
function onSortAction(action, el) {
  const u = ui.unsorted;
  const cur = unsortedCurrent(state, u);
  const hasProject = !!u.projectId || !!(cur && cur.kind === 'task');
  const go = (how) => {
    const patch = navigate(u, how, { hasProject, needsPriority: !!cur && cur.kind === 'thought', now: Date.now(), defaults: state.dueDefaults });
    if (patch.why) u.why = patch.why; else Object.assign(u, patch, { why: '', find: '', pickQuery: '' });
    paint();
  };
  const focusLater = (sel) => { const box = document.querySelector(sel); if (box) box.focus(); };
  if (action === 'sort-next') go('next');
  else if (action === 'sort-skip') go('skip');
  else if (action === 'sort-back') go('back');
  else if (action === 'sort-step') {
    // a receipt pencil: open that step (or the notes page) and come back to the receipt
    const to = el.getAttribute('data-step');
    if (to === 'notes') { u.sub = 'notes'; paint(); focusLater('.slip-notes'); } else go(+to);
  }
  else if (action === 'sort-menu') { u.menu = !u.menu; paint(); focusLater(u.menu ? '.sort-drawer' : '.slip-more'); }
  else if (action === 'sort-add-notes') { u.menu = false; u.sub = 'notes'; paint(); focusLater('.slip-notes'); }
  else if (action === 'sort-notes-done') { u.sub = null; paint(); }
  else if (action === 'sort-new-label' || action === 'sort-new-project') { u.sub = action === 'sort-new-label' ? 'newlabel' : 'newproject'; u.find = ''; paint(); focusLater('.sort-type'); }
  else if (action === 'sort-new-flag') {
    const name = u.find.trim();
    if (name) {
      const id = labelIdByName(name);
      if (!u.selected.includes(id)) u.selected = u.selected.concat(id);
    }
    u.find = ''; u.sub = null; paint();
  }
  else if (action === 'sort-add-project') {
    const name = u.find.trim();
    if (name) { const project = M.addProject(name, null); u.projectId = project.id; u.facingFolder = project.id; }
    u.find = ''; u.sub = null; paint();
  }
  else if (action === 'sort-azl') { u.sub = 'azl'; u.find = ''; paint(); }
  else if (action === 'sort-letter') { u.letter = el.getAttribute('data-letter'); u.find = ''; paint(); }
  else if (action === 'sort-flag') { u.selected = toggleToken(u.selected, el.getAttribute('data-token')); paint(); }
  else if (action === 'sort-month') { u.month = shiftMonth(u.month || (u.due || dueDates().today).slice(0, 7), +el.getAttribute('data-dir')); paint(); }
  else if (action === 'sort-use-date') { u.dateOpen = false; paint(); }
  else if (action === 'tie-add' || action === 'tie-remove' || action === 'tie-new-sub') {
    const f = el.getAttribute('data-field'), id = el.getAttribute('data-id');
    if (action === 'tie-new-sub') { if (u.pickQuery.trim()) u.newSubtasks = u.newSubtasks.concat(u.pickQuery.trim()); }
    else if (f === 'parent') u.parent = action === 'tie-add' ? id : null;
    else if (f === 'newSubtasks') u.newSubtasks = u.newSubtasks.filter((_, i) => i !== +id);
    else u[f] = action === 'tie-add' ? u[f].concat(id) : u[f].filter((x) => x !== id);
    u.pickQuery = '';
    paint();
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
  const go = (step) => { b.step = step; b.find = ''; b.why = ''; paint(); };
  if (action === 'bulk-next' || action === 'bulk-skip') {
    if (action === 'bulk-skip' && b.step === 4) b.groupTitle = '';
    if (action === 'bulk-skip' && b.step === 3) b.selected = [];
    go(b.fromReceipt ? 5 : Math.min(5, b.step + 1)); b.fromReceipt = false; return;
  }
  if (action === 'bulk-back') {
    if (b.sub) { b.sub = null; paint(); return; }
    if (b.step === 1) { ui.bulk = freshBulk(false); paint(); return; }
    const to = b.fromReceipt ? 5 : b.step - 1; b.fromReceipt = false; go(to); return;
  }
  if (action === 'bulk-step') { b.fromReceipt = true; go(+el.getAttribute('data-step')); return; }
  if (action === 'bulk-new-label') { b.sub = 'newlabel'; paintKeepingFocus('[data-bulk-newlabel]'); return; }
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
    b.sub = null; paint();
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

// The switch's list (a bottom sheet on a phone, a dropdown on desktop): focus goes in, Tab stays in,
// Escape or the backdrop closes it and focus returns to the button.
function focusViewPop() {
  const pop = document.querySelector('.vs-pop');
  if (pop) (pop.querySelector('.vs-search, .vs-item.on, .vs-item, .dk-choice.on, .dk-choice') || pop).focus();
}
function closeViewPop() { ui.viewOpen = false; paint(); const b = document.querySelector('.vs-tape'); if (b) b.focus(); }
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

// The projects the Projects tab lists, in the order it shows them (Find box and sort order).
function visibleRoadmapProjects() {
  return filterAndSortProjects(viewProjects(state, ui.view), { query: ui.projectQuery, sortBy: ui.projectSort });
}

// New project's "My repo" step: fetched when it opens, cached in ui.newPanelRepos until the flow closes. Errors show inline with a Retry (retry-new-panel-repos).
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

// ---- Projects tab (#267): the list's drawer and My order, and New project in four steps ----------------------
function freshNew(extra) { return Object.assign({ step: 1, name: '', areaId: null, addArea: false, areaName: '', color: null, gh: 'no', sub: null, repo: null, repoName: '', priv: true, link: '', error: null, busy: false }, extra); }
function closeNewProject() { ui.np = null; ui.newPanelRepos = null; ui.newPanelRepoFilter = ''; }
function openNewProject(extra) {
  ui.np = freshNew(extra); ui.projSortOpen = false; setScreen('projects');
  if (ui.np.sub === 'mine') fetchNewPanelRepos(); else paint();
  window.scrollTo(0, 0); focusLater('.pj-field');
}
const slug = (n) => n.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
const refuse = (e) => (e.status === 403 || e.status === 404) ? 'GitHub refused: your token needs Administration: Read and write to create repos. See Settings.' + (e.githubMessage ? ' (' + e.githubMessage + ')' : '') : e.message;

// Make it / Link it / Create it / Track it: the project is added with addProject, then linked to its repo with the same
// functions the Edit panel uses; if the link fails the new project is taken back out and the error shows on the step.
async function makeNewProject(how) {
  const np = ui.np;
  if (!np || np.busy) return;
  np.busy = true; np.error = null; paint();
  let repo = null, fullName = null;
  try {
    if (how === 'new') { repo = await createRepo(np.repoName.trim(), np.priv, ''); fullName = repo.full_name; }
    if (how === 'mine') { repo = ((ui.newPanelRepos || {}).list || []).find((r) => r.full_name === np.repo); fullName = np.repo; }
    if (how === 'other') fullName = parseRepoInput(np.link);
  } catch (e) { np.busy = false; np.error = refuse(e); paint(); return; }
  const project = M.addProject(np.name.trim() || (fullName || '').split('/')[1] || 'New project', null);
  let res = { project };
  if (how === 'mine' || how === 'new') res = await linkProjectToRepoOnGithub(project.id, repo, ui);
  else if (how === 'other') res = await linkProjectToRepoByInput(project.id, np.link, ui);
  ui.syncError = null;
  if (res.error) { M.removeProject(project.id); if (fullName) M.unpinRepo(fullName); np.busy = false; np.error = res.error; paint(); return; }
  const areaId = np.addArea && np.areaName.trim() ? M.addProjectCategory(np.areaName.trim()).id : np.areaId;
  if (areaId) M.setProjectCategory(project.id, areaId);
  if (np.color) M.setProjectColor(project.id, np.color);
  closeNewProject();
  setScreen('roadmap'); setView({ mode: 'project', id: project.id });
  ui.notice = 'Made ✓'; paint(); window.scrollTo(0, 0);
}

// Returns true when the action is the Projects tab's own.
function onProjectsAction(action, el) {
  const np = ui.np;
  if (action === 'proj-sort-menu') { ui.projSortOpen = !ui.projSortOpen; paint(); focusLater(ui.projSortOpen ? '.sort-drawer' : '.pj-pull'); return true; }
  if (action === 'set-project-sort') {
    ui.projectSort = el.getAttribute('data-value'); saveProjectSort(); ui.projSortOpen = false;
    if (ui.projectSort === 'custom') { ui.projOrder = true; ui.projectQuery = ''; }
    paint(); return true;
  }
  if (action === 'proj-order-done') { ui.projOrder = false; paint(); return true; }
  if (action === 'toggle-new-panel') { openNewProject(); return true; }
  if (!np || !action.match(/^(np-|add-new-project$|link-new-repo$|create-repo$|track-repo$|retry-new-panel-repos$)/)) return false;
  if (action === 'np-back') {
    if (np.sub) { np.sub = null; np.gh = 'no'; np.error = null; np.repo = null; }
    else if (np.step > 1) np.step -= 1;
    else closeNewProject();
    paint(); focusLater('.pj-field'); return true;
  }
  if (action === 'np-next') { np.step = Math.min(4, np.step + 1); paint(); focusLater('.pj-field'); return true; }
  if (action === 'np-area') { const id = el.getAttribute('data-id'); np.areaId = np.areaId === id && !np.addArea ? null : id; np.addArea = false; paint(); return true; }
  if (action === 'np-area-new') { np.addArea = !np.addArea; if (np.addArea) np.areaId = null; paint(); focusLater('.pj-field'); return true; }
  if (action === 'np-color') { const c = el.getAttribute('data-color'); np.color = np.color === c ? null : c; paint(); return true; }
  if (action === 'np-gh') {
    np.gh = el.getAttribute('data-mode'); np.sub = np.gh === 'no' ? null : np.gh; np.error = null;
    if (np.gh === 'new' && !np.repoName) np.repoName = slug(np.name);
    if (np.gh === 'mine') { np.repo = null; fetchNewPanelRepos(); } else { paint(); focusLater('.pj-field'); }
    return true;
  }
  if (action === 'np-repo') { np.repo = el.getAttribute('data-repo'); paint(); return true; }
  if (action === 'np-private') { np.priv = el.getAttribute('data-value') === '1'; paint(); return true; }
  if (action === 'retry-new-panel-repos') { fetchNewPanelRepos(); return true; }
  makeNewProject({ 'add-new-project': 'no', 'link-new-repo': 'mine', 'create-repo': 'new', 'track-repo': 'other' }[action]);
  return true;
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
    // the Roadmap's add box stays open, empty and focused for the next task; Escape or a click away closes it
    createIssueIfGithubProject(task, projectId);
    delete ui.addDraft[projectId]; delete ui.addingTask[projectId]; delete ui.addPick[projectId];
    paint(); focusAddTitle(projectId);
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
    else if (form && ui.rmAdd && ui.rmAdd.kind === 'task') { ui.rmAdd = null; paint(); }
  }
  // Escape inside New project steps back (and out of the first step), like the Back corner.
  if (e.key === 'Escape' && e.target.closest && e.target.closest('.pj-flow') && ui.np) {
    e.stopPropagation();
    onProjectsAction('np-back', e.target);
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
    openNewProject({ step: 4, gh: 'mine', sub: 'mine' }); // New project's "My repo" step
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
  const jotScreen = document.getElementById('jot-screen');
  jotScreen.addEventListener('click', onAppClick);
  jotScreen.addEventListener('input', (e) => {
    if (e.target.id === 'jot-input') ui.jotDraft = e.target.value;
    else if (e.target.matches('[data-jot-search]')) { const q = e.target.value.trim().toLowerCase(); jotScreen.querySelectorAll('[data-jot-name]').forEach((x) => { x.hidden = !x.getAttribute('data-jot-name').includes(q); }); }
  });
  document.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName, typing = e.target && (e.target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target.closest && e.target.closest('[data-wallet]'))); // a wallet takes typed letters to find a card
    // J opens the + Jot screen from anywhere on a wide screen (not while typing); Escape closes it (#263)
    if ((e.key === 'j' || e.key === 'J') && !typing && !ui.jotOpen && !e.ctrlKey && !e.metaKey && !e.altKey && isWideScreen()) { e.preventDefault(); openJot(); }
    else if (e.key === 'Escape' && ui.jotOpen) { e.preventDefault(); if (ui.jotPick) { keepJotDraft(); ui.jotPick = false; paintJot(); document.querySelector('.jot-where').focus(); } else closeJot(); }
    else if (e.key === 'Escape' && ui.unsorted.menu) { e.preventDefault(); ui.unsorted.menu = false; paint(); const b = document.querySelector('.slip-more'); if (b) b.focus(); }
    else if (e.key === 'Escape' && ui.boardSelected && !typing) { selectBoardTask(null); paint(); }
  });
  paintHeaderControls();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
