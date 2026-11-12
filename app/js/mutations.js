// focus-deck-app/js/mutations.js
import { rankFocusPool, isBlocked } from './task-links.js';
import { pickOrder } from './pick-order.js';
import { dueDates } from './pick-bits.js';
import { state, uid, nextHue, findTaskWithProject, openTasksMatching, PRIORITY_ORDER, splitLongThought } from './state.js';
import { syncIssueCompletion, pushCategoriesToIssue, pushTiesToIssue, pushPriorityToIssue, pushReviewToIssue, pushCategoryColorToLinkedIssues, closeIssueForDeletedTask } from './github-sync.js';
// The one persist() for the whole app: repaint, save locally, schedule the Gist push. mutations.js
// used to have its own copy that saved locally but never pushed, so most edits never reached the
// Gist. See doc-ref 2425 docs/4-systems/gist-sync.md
import { persist } from './sync.js';
import { UNSORTED_ID, LEVELS } from './areas.js';
import { ensureSortOrder } from './project-filter.js';
import { ensureTaskSortOrder } from './task-move.js';
import { DEFAULT_DUE_DEFAULTS } from './due-stage.js';
import { CHOOSING_MODES } from './wallet.js';
import { dropLinksTo, detachForMove } from './task-links.js';
import { NOTE_FACES, applyNoteFace } from './note-face.js';
import { MOTIONS, CHUNKS, OVERDUE_STYLES, applyComfort, normalizeColourBy } from './comfort.js';
export { persist };

// Runs fn (which changes other tasks' ties directly), then pushes every task whose parentId/waitsOn
// changed to GitHub. The pushes are fire-and-forget.
const tiesOfTask = (t) => ({ parentId: t.parentId, waitsOn: (t.waitsOn || []).slice() });
const tiesChanged = (b, t) => b.parentId !== t.parentId || JSON.stringify(b.waitsOn) !== JSON.stringify(t.waitsOn || []);
function withTiePush(fn) {
  const snap = state.projects.flatMap((p) => p.tasks).map((t) => [t, tiesOfTask(t)]);
  fn();
  snap.forEach(([t, b]) => { if (tiesChanged(b, t)) pushTiesToIssue(t, b); });
}

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

// A dragged task's move (PR 11), after the caller has worked the order out (task-move.js
// taskOrderChanges: normally just the moved task's own number). Within a project into the other
// group the status changes through setTaskStatus, so it behaves as a status change does anywhere
// else; into another project the task leaves its old project's list and joins the new one, keeping
// its id, and its status is set directly (no issue update: the move is not a completion change).
// The moved task is stamped explicitly: a move to another project changes no field of the task,
// so the change stamper would not see it, and the Gist merge picks the newest copy of a task
// wherever it lives (merge.js dedupeMovedTasks). Returns false when the task or project is gone.
export function applyTaskMove({ taskId, toProjectId, status, changes }) {
  const found = findTaskWithProject(taskId);
  const to = state.projects.find((p) => p.id === toProjectId);
  if (!found || !to) return false;
  const { task, project: from } = found;
  const crossing = from.id !== to.id;
  const wasReview = task.status === 'review';
  if (!crossing && status && task.status !== status) setTaskStatus(taskId, status);
  if (crossing) {
    withTiePush(() => detachForMove(state.projects, taskId)); // a subtask can't stay in another folder than its parent
    from.tasks = from.tasks.filter((t) => t.id !== taskId);
    to.tasks.push(task);
    if (status) task.status = status;
    // within one repo the label moves with the task; a transfer or new issue is handled by the caller (app.js moveTaskTo)
    if (status && String(task.repoFullName || '').toLowerCase() === String(to.repoFullName || '').toLowerCase()) pushReviewToIssue(task, wasReview);
  }
  Object.keys(changes || {}).forEach((id) => {
    const t = to.tasks.find((x) => x.id === id);
    if (t) t.sortOrder = changes[id];
  });
  task.updatedAt = Date.now();
  persist();
  return true;
}

// steps is the raw newline-separated textarea value, split into the array shape the rest of the
// app expects. deadline/categories/steps were previously dropped entirely -- the add-task form
// already submitted them, but this function's old (projectId, title) signature had nowhere to
// put them. categoryIds is a list (one per label); priority is a PRIORITY_ORDER level or empty.
export function addTask(projectId, title, deadline, categoryIds, steps, priority, dueStages) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = {
    id: uid('t'), title,
    status: 'next', deadline: deadline || null, categoryIds: categoryIds || [],
    priority: PRIORITY_ORDER.includes(priority) ? priority : null,
    source: 'manual', updatedAt: Date.now(),
  };
  // The span of the due-date stages starts when the date is set (js/due-stage.js).
  if (task.deadline) {
    task.dueSetAt = Date.now();
    if (dueStages) task.dueStages = dueStages;
  }
  if (steps) task.steps = String(steps).split('\n').map((s) => s.trim()).filter(Boolean);
  project.tasks.push(task);
  ensureTaskSortOrder([project]); // a new task goes to the end of its group
  persist();
  return task;
}

// The add row's submit: a priority is required there (#249), so no task is made without one even if
// the disabled button was bypassed. Other callers (jotter stamp, subtasks) use addTask as before.
export function addTaskPicked(projectId, title, deadline, categoryIds, steps, priority, dueStages) {
  if (!PRIORITY_ORDER.includes(priority)) return;
  return addTask(projectId, title, deadline, categoryIds, steps, priority, dueStages);
}

export function updateTaskFields(taskId, fields) {
  const found = findTaskWithProject(taskId);
  if (!found) return;
  const { task } = found;
  const oldCategoryIds = (task.categoryIds || []).slice();
  const oldPriority = task.priority || null;
  const oldTies = tiesOfTask(task);
  // A changed deadline starts a new span: stamp it, and drop stage choices made for the old date
  // unless the caller brings new ones. The edit form sends the deadline on every save, so an
  // unchanged one must not restamp.
  if ('deadline' in fields && (fields.deadline || null) !== (task.deadline || null)) {
    if (fields.deadline) task.dueSetAt = Date.now(); else delete task.dueSetAt;
    if (!('dueStages' in fields)) delete task.dueStages;
  }
  Object.assign(task, fields);
  if ('notes' in fields && !task.notes) delete task.notes;
  if (!task.deadline) delete task.dueStages;
  task.updatedAt = Date.now();
  persist();
  if ('categoryIds' in fields && JSON.stringify(task.categoryIds) !== JSON.stringify(oldCategoryIds)) {
    pushCategoriesToIssue(task, oldCategoryIds);
  }
  if ('priority' in fields && (task.priority || null) !== oldPriority) pushPriorityToIssue(task);
  if (tiesChanged(oldTies, task)) pushTiesToIssue(task, oldTies);
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
  if (fields.dueStages) normalized.dueStages = fields.dueStages;
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
  const wasReview = task.status === 'review';
  const before = task.status;
  task.status = status;
  task.updatedAt = Date.now();
  if (status === 'done' && !wasDone) {
    task.statusBeforeDone = before; // what the Review tab's Undo goes back to
    task.completedAt = Date.now(); // when it was finished; the Board's "Done this week" reads it (#145)
    state.completedLog.unshift({ id: uid('log'), taskId: task.id, title: task.title, projectId: project.id, color: project.color, completedAt: Date.now() });
    state.completedLog = state.completedLog.slice(0, 12);
  } else if (status !== 'done' && wasDone) {
    delete task.completedAt;
    state.completedLog = state.completedLog.filter((e) => e.taskId !== task.id);
  }
  persist();
  syncIssueCompletion(task); // fire-and-forget
  pushReviewToIssue(task, wasReview);
}

// The Review tab's Undo: back to the status the task had before it was done ('next' if unknown).
export function undoDone(taskId) {
  const found = findTaskWithProject(taskId);
  if (!found || found.task.status !== 'done') return;
  const prev = found.task.statusBeforeDone;
  setTaskStatus(taskId, ['next', 'doing', 'review'].includes(prev) ? prev : 'next');
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
  withTiePush(() => dropLinksTo(state.projects, taskId)); // before the filter: the pushes look the deleted task's issue up
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
// extra: { title, notes, priority, deadline } typed on the slip; a non-empty trimmed title replaces the text,
// notes become task.notes. A thought needs a priority (#249): without a valid one nothing is filed.
export function fileInboxItem(inboxId, projectId, categoryIds, extra) {
  const item = state.inbox.find((i) => i.id === inboxId);
  const project = state.projects.find((p) => p.id === projectId);
  const { title, notes, priority, deadline } = extra || {};
  if (!item || !project || !PRIORITY_ORDER.includes(priority)) return;
  const task = { id: uid('t'), title: item.text, status: 'next', deadline: deadline || null, categoryIds: categoryIds || [], priority, source: 'manual', updatedAt: Date.now() };
  if (task.deadline) task.dueSetAt = Date.now();
  const long = splitLongThought(title && title.trim() ? title : item.text);
  task.title = long.title;
  const typed = notes && notes.trim() ? notes.trim() : '';
  if (long.notes || typed) task.notes = [long.notes, typed].filter(Boolean).join('\n\n');
  project.tasks.push(task);
  ensureTaskSortOrder([project]); // a new task goes to the end of its group
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
  const pool = openTasksMatching({ ...f, view: state._ui && state._ui.view }); // the view is not saved in state.focus
  if (!pool.length) return false;
  const { candidates, allBlocked } = rankFocusPool(state.projects, pool);
  state.focus = { taskId: candidates[Math.floor(Math.random() * candidates.length)], pool, filter: f, startedAt: Date.now() };
  if (allBlocked) state.focus.allBlocked = true;
  persist();
  return true;
}

// "Or let me pick for you": the best open task in the current view by js/pick-order.js. The pool is
// kept in that order, so "Not this one" (reroll) offers the next one down.
export function pickForMe() {
  const ids = openTasksMatching({ view: state._ui && state._ui.view });
  if (!ids.length) return false;
  const ordered = pickOrder(ids.map((id) => { const f = findTaskWithProject(id); return { t: f.task, p: f.project }; }), state, dueDates().today).map((x) => x.t.id);
  state.focus = { taskId: ordered[0], pool: ordered, ordered: true, filter: { categoryId: null, projectId: null }, startedAt: Date.now() };
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
  if (state.focus.ordered) { // picked for you: the next one down the order, wrapping round
    const pool = state.focus.pool, at = pool.indexOf(state.focus.taskId);
    state.focus.taskId = pool.slice(at + 1).concat(pool.slice(0, at)).find((id) => others.includes(id));
    persist();
    return;
  }
  const free = others.filter((id) => !isBlocked(state.projects, id)); // prefer a task that can be started
  const from = free.length ? free : others;
  state.focus.taskId = from[Math.floor(Math.random() * from.length)];
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

// Settings > Due dates. Stamped here, not by stampChanges: dueDefaults is one object, not a record
// in a list, and mergeStates picks the newer stamp (js/merge.js). Returns false for values the
// stage arithmetic cannot use (both must be between 0 and 100, red lower than yellow).
export function setDueDefaults(yellowPct, redPct) {
  const y = Number(yellowPct), r = Number(redPct);
  if (!(y > 0 && y < 100 && r > 0 && r < 100 && r < y)) return false;
  state.dueDefaults = { yellowPct: y, redPct: r, updatedAt: Date.now() };
  persist();
  return true;
}

// Settings > Choosing a card. Stamped here like dueDefaults (js/merge.js picks the newer stamp).
// Returns false for a mode the wallets do not know.
export function setChoosingMode(mode) {
  if (!CHOOSING_MODES.includes(mode)) return false;
  state.choosingMode = { mode, updatedAt: Date.now() };
  persist();
  return true;
}

// Settings > Category choices (#133). Stamped like choosingMode.
export function setCategoryFilter(on) {
  state.categoryFilter = { on: !!on, updatedAt: Date.now() };
  persist();
}

// Settings > Note writing (#122). Stamped like choosingMode; applies the face to <html> at once.
// Returns false for a face we do not know.
export function setNoteFace(face) {
  if (!NOTE_FACES.includes(face)) return false;
  state.noteFace = { face, updatedAt: Date.now() };
  applyNoteFace(face);
  persist();
  return true;
}

// Settings > Comfort (#203). Each value is stamped on its own, like noteFace (js/merge.js picks the
// newer stamp per value); each returns false for a value we do not know and changes nothing.
function setComfort(key, value) {
  state.comfort = Object.assign({}, state.comfort, { [key]: { value, updatedAt: Date.now() } });
  applyComfort(state);
  persist();
  return true;
}
export function setMotion(v) { return MOTIONS.includes(v) && setComfort('motion', v); }
export function setCalmColours(on) { return typeof on === 'boolean' && setComfort('calm', on); }
export function setChunk(n) { return CHUNKS.includes(Number(n)) && setComfort('chunk', Number(n)); }
export function setOverdueStyle(v) { return OVERDUE_STYLES.includes(v) && setComfort('overdue', v); }
export function setColourBy(list) { return Array.isArray(list) && setComfort('colourBy', normalizeColourBy(list)); }

export function resetDueDefaults() {
  state.dueDefaults = { yellowPct: DEFAULT_DUE_DEFAULTS.yellowPct, redPct: DEFAULT_DUE_DEFAULTS.redPct, updatedAt: Date.now() };
  persist();
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
// Unsorted is fixed: refused, returns false. Projects in a removed area go to Unsorted (no area).
export function removeProjectCategory(id) {
  if (id === UNSORTED_ID) return false;
  state.projectCategories = (state.projectCategories || []).filter((c) => c.id !== id);
  state.projects.forEach((p) => { if (p.categoryId === id) p.categoryId = null; });
  persist();
  return true;
}

// Unsorted cannot be renamed. Returns false when nothing changed.
export function renameProjectCategory(id, name) {
  const cat = (state.projectCategories || []).find((c) => c.id === id);
  name = String(name || '').trim();
  if (!cat || !name || id === UNSORTED_ID) return false;
  cat.name = name;
  persist();
  return true;
}

// Kinds of work (Settings): tick = offered on Focus's kinds row; level = the priority this label counts as.
export function setKindOfWork(id, on) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat || typeof on !== 'boolean') return;
  cat.kind = on;
  persist();
}
export function setLabelPriority(id, level) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  if (LEVELS.includes(level)) cat.priority = level; else delete cat.priority;
  persist();
}

export function setProjectCategory(projectId, categoryId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  if (categoryId === UNSORTED_ID) categoryId = null; // Unsorted is "no area"
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
