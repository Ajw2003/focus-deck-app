// focus-deck-app/js/render.js
import { state, esc, cssColorToHex, relTime, deadlineChip, formatLabelName, PRIORITY, PRIORITY_ORDER, UNLABELLED } from './state.js';
import { ICON_SYNC, ICON_GRIP, ICON_CLAUDE_CREATED, ICON_CLAUDE_COMPLETED } from './icons.js';
import { sortTasks } from './task-move.js';
import { leadChoices, suggestLead, normalizeDueDefaults } from './due-stage.js';
import { phaseClasses } from './focus-complete.js';
import { normalizeChoosingMode, CHOOSING_MODE_INFO } from './wallet.js';

// A label (task category) colour, muted toward the app's palette rather than shown at its raw
// GitHub saturation (Q4b) — see docs/4-systems/styling.md#colour. Applied everywhere a label colour
// paints something except the project-identity uses of --proj-color, which stay full strength.
export function mutedChip(color) { return 'color-mix(in oklab, ' + color + ' 65%, var(--ink-soft))'; }

// A project pill/chip, neutral (Q4b — a project's colour is identity only: its dot and its card
// edge), carrying a small colour dot before the name instead of a tint.

// The top-bar sync icon: two curved arrows in a circle, hand-drawn (see docs/4-systems/styling.md#sync-button).
// Its title/aria-label carry the same text so a screen reader gets exactly what a sighted hover gets.
export function syncButtonTitle(st) {
  return (st.githubSync && st.githubSync.lastSyncedAt)
    ? 'Sync with GitHub · synced ' + relTime(st.githubSync.lastSyncedAt)
    : 'Sync with GitHub';
}

export function renderSyncButton(st) {
  const syncing = !!(st._ui && st._ui.syncing);
  const title = syncButtonTitle(st);
  return '<button type="button" class="icon-btn sync-btn' + (syncing ? ' is-syncing' : '') + '" data-action="sync-github" title="' + esc(title) + '" aria-label="' + esc(title) + '"' + (syncing ? ' disabled' : '') + '>'
    + ICON_SYNC
    + '</button>';
}

// The one place errors and notices appear, on every page: pinned to the bottom of the viewport
// (see .toast) so it's seen wherever the page is scrolled. kind is 'error' or 'info'.
// See docs/4-systems/styling.md#how-it-works
export function renderToast(text, kind) {
  if (!text) return '';
  const isError = kind === 'error';
  return '<div class="toast' + (isError ? ' toast-error' : '') + '" role="' + (isError ? 'alert' : 'status') + '">'
    + '<p class="toast-text">' + esc(text) + '</p>'
    + '<button type="button" class="toast-close" data-action="dismiss-toast" aria-label="Dismiss">×</button>'
    + '</div>';
}

// The focus picker: two wallets (js/wallet.js). Projects are manila folders; categories are index
// cards, narrowed to the project facing you. Why and how: docs/4-systems/wallets.md
export const ALL_PROJECTS_KEY = 'all';
export const ANY_CATEGORY_KEY = 'any';

// A remembered project that no longer exists counts as "All projects", which is what shows.
export function focusProjectId(st, ui) {
  const f = (ui && ui.focusFilter) || {};
  return st.projects.some((p) => p.id === f.projectId) ? f.projectId : null;
}

function openWhere(st, catId, projId) {
  const out = [];
  st.projects.forEach((p) => {
    if (projId && p.id !== projId) return;
    p.tasks.forEach((t) => { if (t.status !== 'done' && (!catId || (t.categoryIds || []).includes(catId))) out.push({ t, p }); });
  });
  return out;
}

// One card in a wallet. `key` is what the hooks in js/app.js get back; `speak` is read aloud when
// the card comes to face you.
export function sleeve({ key, name, color, detail, speak, kind, picked }) {
  return '<div class="sleeve" data-key="' + esc(key) + '" data-speak="' + esc(speak) + '">'
    + '<button type="button" tabindex="-1" class="icard' + (kind ? ' ' + kind : '') + (picked ? ' is-picked' : '') + '" style="--c:' + color + '">'
    + '<span class="nm">' + esc(name) + '</span><span class="ct">' + esc(detail) + '</span><span class="go"></span></button></div>';
}

// The strip itself. `facing` goes in the markup as data-facing so a repaint puts the same card in
// the middle again; js/wallet.js reads it, and the data-mode, when it mounts.
export function walletInner({ wallet, label, aria, items, facing, mode, verb }) {
  return '<div class="wallet-h"><div class="q">' + label + '</div><span class="wallet-count muted small"></span></div>'
    + '<div class="flip"><div class="flip-track' + (mode === 'swipe' ? ' swipe-mode' : '') + '" tabindex="0" role="group" aria-label="' + esc(aria) + '" data-wallet="' + wallet + '" data-mode="' + mode + '"' + (verb ? ' data-verb="' + verb + '"' : '') + ' data-facing="' + esc(facing) + '">'
    + '<div class="flip-pad"></div>' + items.join('') + '<div class="flip-pad"></div></div></div>';
}

export function focusChoosingMode(st) {
  return normalizeChoosingMode(st.choosingMode && st.choosingMode.mode);
}

// The category wallet's contents (header and strip). Re-rendered on its own when the project
// wallet flips, so the project wallet's scroll animation is not cut off by a whole repaint.
export function renderCategoryWalletInner(st, ui) {
  const projectId = focusProjectId(st, ui);
  const labels = st.categories.map((c) => ({ id: c.id, name: formatLabelName(c.name), color: mutedChip(c.color), matches: openWhere(st, c.id, projectId) }))
    .filter((x) => x.matches.length)
    .sort((a, b) => b.matches.length - a.matches.length || a.name.localeCompare(b.name));
  // Tasks with no label get their own card (neutral colour), and "Surprise me" (no type at all) is the last card.
  const unlabelled = openWhere(st, null, projectId).filter(({ t }) => !(t.categoryIds || []).length);
  if (unlabelled.length) labels.push({ id: UNLABELLED, name: 'Unlabelled', color: 'var(--ink-faint)', matches: unlabelled });
  labels.push({ id: ANY_CATEGORY_KEY, name: 'Surprise me', color: 'var(--accent)', matches: openWhere(st, null, projectId) });
  const cards = labels.map((x) => {
    const detail = focusCardDetail(x.matches, !projectId);
    return sleeve({ key: x.id, name: x.name, color: x.color, detail, speak: x.name + ', ' + detail });
  });
  const wanted = ui && ui.focusCategory;
  const facing = labels.some((x) => x.id === wanted) ? wanted : labels[0].id;
  return walletInner({ wallet: 'categories', label: 'Category', aria: 'Categories. Arrow keys flip, Enter chooses.', items: cards, facing, mode: focusChoosingMode(st) });
}

function renderFocusPicker(st, ui) {
  const projectId = focusProjectId(st, ui);
  if (!st.projects.some((p) => p.tasks.some((t) => t.status !== 'done'))) {
    // an empty desk, with the next step spelled out (a project can be added from the list; a stray
    // thought can go on the jotter above and be sorted later)
    return '<section class="focus-card focus-empty desk-empty">'
      + '<h2 class="focus-q">Your desk is clear.</h2>'
      + '<p class="muted">Nothing is waiting to be picked. Add a task to a project in the list (the Projects button, on a phone), or jot a thought on the pad above and sort it later.</p>'
      + '</section>';
  }
  const mode = focusChoosingMode(st);
  // Folders: All projects first, then busiest first. A project with nothing open is left out unless it is the one facing you.
  const projects = st.projects.map((p) => ({ id: p.id, name: p.name, color: p.color, matches: openWhere(st, null, p.id) }))
    .filter((x) => x.matches.length || x.id === projectId)
    .sort((a, b) => b.matches.length - a.matches.length || a.name.localeCompare(b.name));
  const all = openWhere(st, null, null);
  const folders = [sleeve({ key: ALL_PROJECTS_KEY, name: 'All projects', color: 'var(--lamp-dot)', kind: 'project', detail: focusCardDetail(all, false), speak: 'All projects, ' + focusCardDetail(all, false) })]
    .concat(projects.map((x) => {
      const detail = focusCardDetail(x.matches, false);
      return sleeve({ key: x.id, name: x.name, color: x.color, kind: 'project', detail, speak: x.name + ', ' + detail });
    }));

  return '<section class="card focus-card focus-empty wallet-root">'
    + '<h2 class="focus-q">What&rsquo;s your focus right now?</h2>'
    + '<p class="muted">Flip to a folder and a kind of work, and I&rsquo;ll surface one task.</p>'
    + '<div class="wallet" id="project-wallet">' + walletInner({ wallet: 'projects', label: 'Project', aria: 'Projects. Arrow keys flip, Enter chooses.', items: folders, facing: projectId || ALL_PROJECTS_KEY, mode }) + '</div>'
    + '<div class="wallet" id="category-wallet">' + renderCategoryWalletInner(st, ui) + '</div>'
    + '<div class="flip-hint">' + CHOOSING_MODE_INFO[mode].hint + '</div>'
    + '<div class="sr-only" id="wallet-live" aria-live="polite"></div>'
    + '</section>';
}

// "3 open · top: High · 2 projects": the count, the highest priority present, and (when not
// narrowed to one project) how many projects the tasks come from.
function focusCardDetail(matches, acrossProjects) {
  const parts = [matches.length + ' open'];
  const top = PRIORITY_ORDER.find((lvl) => matches.some(({ t }) => t.priority === lvl));
  if (top) parts.push('top: ' + PRIORITY[top].label);
  const projects = new Set(matches.map(({ p }) => p.id)).size;
  if (acrossProjects && projects > 1) parts.push(projects + ' projects');
  return parts.join(' · ');
}

export function renderFocus(st, findTaskWithProject, ui) {
  if (!st.focus) return renderFocusPicker(st, ui);
  const found = findTaskWithProject(st.focus.taskId);
  if (!found) { state.focus = null; return renderFocus(st, findTaskWithProject, ui); }
  const t = found.task, p = found.project;
  const deadlineHTML = t.deadline ? deadlineChip(t.deadline, t) : '';
  const canReroll = st.focus.pool && st.focus.pool.length > 1;
  // a repaint during the "I've done it" sequence (js/focus-complete.js) draws the phase it had reached
  const leaving = ui && ui.completing && ui.completing.taskId === t.id ? phaseClasses(ui.completing.phase) : { button: '', note: '' };
  return '<section class="focus-card focus-active desk-focus">'
    + '<div class="note-shadow"><div class="note' + leaving.note + '">'
      + '<div class="note-meta">'
        + '<button type="button" class="note-project" data-action="scroll-project" data-project="' + p.id + '" title="Go to ' + esc(p.name) + '">' + esc(p.name) + ' ↓</button>'
        + focusMetaParts(st, t)
        + deadlineHTML
      + '</div>'
      + '<h2 class="focus-title"><span class="ink">' + esc(t.title) + '</span></h2>'
    + '</div></div>'
    + '<div class="desk-acts' + (canReroll ? '' : ' is-single') + '">'
      + '<button type="button" class="check-btn' + leaving.button + '" data-action="complete-focus">'
        + '<span class="box" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="tick" d="M4.5 12.8l4.6 4.7L19.8 6.2"/></svg></span>'
        + '<span class="check-words"><span class="slip-main">I&rsquo;ve done it</span><span class="slip-sub">tick it off</span></span>'
      + '</button>'
      + (canReroll ? '<button type="button" class="slip-btn" data-action="reroll"><span class="slip-main">Not this one</span><span class="slip-sub">slip it back in the deck</span></button>' : '')
    + '</div>'
    + '<div class="desk-clear"><button type="button" class="btn-text" data-action="clear-focus">Clear</button></div>'
    + '</section>';
}

// The note's line after the project: the task's labels (or why it was picked when it has none), then
// its priority. Plain words, separated by a dot in CSS; the deadline chip follows separately.
function focusMetaParts(st, t) {
  const focus = st.focus;
  const parts = [];
  const labels = (t.categoryIds || []).map((id) => (st.categories || []).find((c) => c.id === id)).filter(Boolean);
  if (focus.filter && focus.filter.categoryId === UNLABELLED) parts.push('Unlabelled');
  labels.forEach((c) => parts.push(formatLabelName(c.name)));
  if (focus.pool && !(focus.filter && focus.filter.categoryId)) parts.push('Random pick');
  if (t.priority && PRIORITY[t.priority]) parts.push(PRIORITY[t.priority].label);
  return parts.map((x) => '<span>' + esc(x) + '</span>').join('');
}

// The Unsorted queue: captured thoughts (oldest first), then every open task with no labels, in
// project order then task order. Computed live off state every render, so a new capture or a task
// labelled elsewhere (or from another device) simply drops out or in on the next paint — nothing
// here is stored except which keys this session sent to the back (ui.unsorted.later).
// Drawn as the in-tray by js/in-tray-view.js. See docs/4-systems/in-tray.md
export function unsortedQueue(st) {
  const out = [];
  st.inbox.forEach((item) => out.push({ key: 'i:' + item.id, kind: 'thought', item }));
  st.projects.forEach((p) => {
    p.tasks.forEach((t) => {
      if (t.status !== 'done' && !(t.categoryIds || []).length) out.push({ key: 't:' + t.id, kind: 'task', task: t, project: p });
    });
  });
  return out;
}

// A task can carry several labels (categories), so both task forms pick them with checkboxes in a
// collapsible list, plus a field for new ones. The summary's count is kept current by app.js.
export function renderLabelPicker(categories, selectedIds) {
  const selected = selectedIds || [];
  const options = categories.map((c) => '<label class="label-option" style="--chip-color:' + mutedChip(c.color) + '">'
    + '<input type="checkbox" name="categoryIds" value="' + c.id + '"' + (selected.includes(c.id) ? ' checked' : '') + '>'
    + '<span>' + esc(formatLabelName(c.name)) + '</span>'
    + '<input type="color" class="cat-color-input label-swatch" data-color-for="label" data-id="' + c.id + '" value="' + cssColorToHex(c.color) + '" aria-label="Colour for ' + esc(formatLabelName(c.name)) + '">'
    + '</label>').join('');
  return '<details class="label-picker">'
    + '<summary>' + labelPickerSummary(selected.length) + '</summary>'
    + '<div class="label-options">' + options + '</div>'
    + '<input type="text" name="newLabels" placeholder="New labels, comma-separated…" maxlength="120">'
    + '</details>';
}
export function labelPickerSummary(count) { return count ? 'Labels (' + count + ')' : 'Labels'; }

export function renderPrioritySelect(selected) {
  return '<select name="priority" aria-label="Priority"><option value="">No priority</option>'
    + PRIORITY_ORDER.map((lvl) => '<option value="' + lvl + '"' + (selected === lvl ? ' selected' : '') + '>' + PRIORITY[lvl].label + ' priority</option>').join('')
    + '</select>';
}

// The skippable step under a due date field (#106): one line, never a dialog. app.js inserts it when
// a date is first set and removes it on Skip, Escape, or a date with no room for a choice. The
// selects start on the lead times nearest the percentage defaults, but nothing is stored until one
// is changed (the hidden dueStepChosen flips to "1"), so saving untouched stores nothing.
// spanMs is now -> due moment; yellow choices must leave a shorter choice for red.
function dueOption(c, selected) {
  return '<option value="' + c.hours + '"' + (selected && selected.hours === c.hours ? ' selected' : '') + '>' + c.label + ' left</option>';
}
export function dueRedOptions(spanMs, yellowHours, selectedHours) {
  const choices = leadChoices(spanMs, yellowHours);
  const pick = choices.find((c) => c.hours === selectedHours) || suggestLead(spanMs, 10, yellowHours);
  return choices.map((c) => dueOption(c, pick)).join('');
}
export function renderDueStageStep(spanMs, defaults) {
  const d = normalizeDueDefaults(defaults);
  const yellowChoices = leadChoices(spanMs).filter((c) => leadChoices(spanMs, c.hours).length);
  if (!yellowChoices.length) return '';
  const yellow = yellowChoices.find((c) => c.hours === (suggestLead(spanMs, d.yellowPct) || {}).hours) || yellowChoices[yellowChoices.length - 1];
  return '<div class="due-step" role="group" aria-label="When this task turns yellow and red">'
    + '<span>Turn yellow at</span>'
    + '<select name="dueYellow" aria-label="Turn yellow when this much time is left">' + yellowChoices.map((c) => dueOption(c, yellow)).join('') + '</select>'
    + '<span>and red at</span>'
    + '<select name="dueRed" aria-label="Turn red when this much time is left">' + dueRedOptions(spanMs, yellow.hours, null) + '</select>'
    + '<input type="hidden" name="dueStepChosen" value="">'
    + '<button type="button" class="link-btn small" data-action="skip-due-step" title="Use the automatic stages (Escape does the same)">Skip</button>'
    + '</div>';
}

// The edit form's GitHub line: a linked task can be unlinked (kept here, dropped from GitHub sync);
// an unlinked one can get a new issue or be linked to an existing one.
function renderTaskGithubLine(t, p) {
  const btn = (action, label, title) => '<button type="button" class="link-btn small" data-action="' + action + '" data-task="' + t.id + '" data-project="' + p.id + '" title="' + title + '">' + label + '</button>';
  if (t.source === 'github') {
    return '<div class="task-edit-github"><span>Linked to ' + esc(t.repoFullName || '') + '#' + t.issueNumber + '</span>'
      + btn('unlink-github-issue', 'Unlink', 'Keep this task here but stop syncing it with the issue') + '</div>';
  }
  return '<div class="task-edit-github"><span>Not on GitHub</span>'
    + btn('create-github-issue', '+ Create issue', 'Create a new GitHub issue from this task')
    + btn('link-github-issue', 'Link to an existing issue', 'Link this task to an issue that already exists') + '</div>';
}

// The edit form's own quiet action row (Q14a, Q12f): Focus on this (closes the form), Open issue
// for a linked task (a real link, new tab), and Delete (shares confirmDeleteTask with app.js).
// Everything that used to live on the row itself now lives here instead.
function renderTaskEditActions(t, p) {
  const isLinked = t.source === 'github' && !!t.url;
  const focusBtn = t.status !== 'done'
    ? '<button type="button" class="link-btn small" data-action="focus-task" data-task="' + t.id + '" data-project="' + p.id + '">Focus on this</button>'
    : '';
  const openIssue = isLinked
    ? '<a class="link-btn small" href="' + esc(t.url) + '" target="_blank" rel="noopener">Open issue ↗ ' + esc(t.repoFullName || '') + '#' + t.issueNumber + '</a>'
    : '';
  return '<div class="task-edit-actions">' + focusBtn + openIssue
    + '<button type="button" class="btn-text danger" data-action="delete-task" data-task="' + t.id + '" data-project="' + p.id + '">Delete</button></div>';
}

export function renderTaskEditForm(t, p, categories) {
  return '<form class="task-edit-form" data-action="save-task-edit" data-task="' + t.id + '" data-project="' + p.id + '">'
    + '<input type="text" name="title" value="' + esc(t.title) + '" maxlength="280" required autofocus>'
    + '<textarea name="steps" placeholder="Steps (optional, one per line)…" rows="2">' + esc((t.steps || []).join('\n')) + '</textarea>'
    + renderPrioritySelect(t.priority)
    + '<input type="date" name="deadline" value="' + (t.deadline || '') + '">'
    + renderLabelPicker(categories, t.categoryIds)
    + renderTaskGithubLine(t, p)
    + renderTaskEditActions(t, p)
    + '<button type="submit">Save</button>'
    + '<button type="button" data-action="cancel-task-edit">Cancel</button>'
    + '</form>';
}

// How wide a task row's chips column may grow, as a % of the row: half for a short title, easing
// down to a third as the title gets longer, so a long title keeps most of the row and a short one
// lets several chips sit side by side. The column itself is only as wide as its chips need (CSS
// fit-content), so this is a ceiling, not a size (#97, #92).
export function chipsMaxPct(title) {
  const len = (title || '').length;
  return Math.round(50 - Math.min(17, Math.max(0, len - 30) / 3));
}

// Quiet provenance icons trailing the title (#104): a spark when Claude opened the issue, a ringed
// tick when Claude closed it (only ever on a done task; github-sync clears claudeCompleted on reopen).
// They sit in the title zone, not the chips column, so chipsMaxPct and the chip wrapping never see them.
// See docs/4-systems/claude-integration.md#where-the-marker-shows
function claudeMarks(t) {
  const mark = (icon, label) => '<span class="claude-mark" role="img" title="' + label + '" aria-label="' + label + '">' + icon + '</span>';
  return (t.claudeCreated ? mark(ICON_CLAUDE_CREATED, 'Opened by Claude') : '')
    + (t.claudeCompleted && t.status === 'done' ? mark(ICON_CLAUDE_COMPLETED, 'Completed by Claude') : '');
}

export function renderTaskRow(t, p, categories, ui) {
  if (ui.editingTask && ui.editingTask.taskId === t.id) return renderTaskEditForm(t, p, categories);
  const isDone = t.status === 'done';
  // Tapping the title always opens the editor now, linked or not (Q14a) -- the row itself carries
  // no GitHub badge, Edit link, Focus → or delete button any more; those moved into the editor's
  // own action row. See docs/4-systems/github-sync.md#where-the-github-controls-live
  const catChips = (t.categoryIds || []).map((id) => categories.find((c) => c.id === id)).filter(Boolean)
    .map((cat) => '<span class="chip cat-chip small" data-cat-id="' + cat.id + '" data-cat-type="task" title="' + esc(formatLabelName(cat.name)) + '" aria-label="' + esc(formatLabelName(cat.name)) + '" style="--chip-color:' + mutedChip(cat.color) + '">' + esc(formatLabelName(cat.name)) + '</span>').join('');
  // "Claude created" renders like any other label, but from the claudeCreated flag: the GitHub label is
  // reserved (never a category), so it has no category chip of its own. No data-cat-id: it is not editable.
  const claudeChip = t.claudeCreated
    ? '<span class="chip cat-chip claude-chip small" title="Claude created" aria-label="Claude created" style="--chip-color:var(--ink-soft)">Claude created</span>'
    : '';
  const priorityChip = t.priority && PRIORITY[t.priority]
    ? '<button type="button" class="chip priority-chip small" data-action="cycle-priority" data-task="' + t.id + '" title="Priority — tap to change" style="--chip-color:var(--prio-' + t.priority + ')"' + (isDone ? ' disabled' : '') + '>' + PRIORITY[t.priority].label + '</button>'
    : '';
  // Open rows carry a drag grip before the checkbox (PR 11); done rows don't drag. The grip is a real
  // button so the arrow keys work on it (js/project-drag.js). See docs/4-systems/styling.md#dragging-tasks
  const grip = isDone ? '' : '<button type="button" class="task-grip" data-task="' + t.id + '" data-project="' + p.id + '" aria-label="Move ' + esc(t.title) + '" title="Drag to move, or use the arrow keys">' + ICON_GRIP + '</button>';
  return '<div class="task-row' + (isDone ? ' is-done' : ' has-grip') + '" data-task="' + t.id + '" data-project="' + p.id + '" style="--chips-max:' + chipsMaxPct(t.title) + '%">'
    + grip
    + '<input type="checkbox" data-action="toggle-task" data-task="' + t.id + '" data-project="' + p.id + '"' + (isDone ? ' checked' : '') + '>'
    // two zones beside the checkbox: the title in the left 75%, the chips right-anchored in the
    // right 25% (kept even when there are no chips, so the title never grows into it) -- #97, #92
    + '<span class="task-title" data-action="edit-task" data-task="' + t.id + '" data-project="' + p.id + '" role="button" tabindex="0">' + esc(t.title) + claudeMarks(t) + '</span>'
    + '<div class="task-chips">' + priorityChip + catChips + claudeChip
    + (t.deadline ? deadlineChip(t.deadline, t) : '')
    + '</div>'
    + '</div>';
}

// The project controls (category pills, sort, collapse all) are shared by the filter bar above the
// project cards and the wide-screen sidebar.
function projectFilterPills(st, ui) {
  const usedCategoryIds = new Set(st.projects.map((p) => p.categoryId).filter(Boolean));
  const hasUncategorized = st.projects.some((p) => !p.categoryId);
  const pills = [{ key: '', label: 'All' }]
    .concat(st.projectCategories.filter((c) => usedCategoryIds.has(c.id)).map((c) => ({ key: c.id, label: c.name })))
    .concat(hasUncategorized ? [{ key: '__uncat__', label: 'Uncategorized' }] : []);
  const activeKey = ui.projectFilter === undefined ? '' : (ui.projectFilter === null ? '__uncat__' : ui.projectFilter);
  const pillsHTML = pills.map((pill) => {
    const active = pill.key === activeKey;
    return '<button type="button" class="filter-pill' + (active ? ' active' : '') + '" data-action="set-project-filter" data-category="' + pill.key + '">' + esc(pill.label) + '</button>';
  }).join('');
  return pillsHTML;
}
function projectSortSelect(ui) {
  const sortOptions = [
    ['name', 'Name (A–Z)'], ['open-tasks', 'Most open tasks'], ['deadline', 'Closest deadline'], ['recent-sync', 'Recently synced'], ['custom', 'Custom order'],
  ].map(([value, label]) => '<option value="' + value + '"' + (ui.projectSort === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  return '<select class="project-sort-select" data-action="set-project-sort" aria-label="Sort projects">' + sortOptions + '</select>';
}
function collapseAllButton(ui, visibleProjects) {
  // Minimising does nothing useful in the "One" view (there's only ever one card on screen), so
  // "Collapse all" is left out there rather than shown disabled. See docs/4-systems/styling.md.
  if (ui.projectView === 'one') return '';
  const allCollapsed = !!(visibleProjects && visibleProjects.length && visibleProjects.every((p) => ui.projectCollapsed[p.id]));
  const collapseAllBtn = visibleProjects && visibleProjects.length
    ? '<button type="button" class="btn-text small" data-action="toggle-collapse-all">' + (allCollapsed ? 'Expand all' : 'Collapse all') + '</button>'
    : '';
  return collapseAllBtn;
}

// The "All" / "One" switch (PR 6, 2026-09-27): a two-option segmented control, styled as pills like
// every other choice in the sidebar. Sits right under the "Projects" title row so it reads as the
// list's own setting, not a filter. See docs/6-decisions/Decisions.md.
function renderViewSwitch(ui) {
  const view = ui.projectView === 'one' ? 'one' : 'all';
  const option = (value, label) => '<button type="button" class="filter-pill' + (view === value ? ' active' : '') + '" data-action="set-project-view" data-view="' + value + '" aria-pressed="' + (view === value) + '">' + label + '</button>';
  return '<div class="view-switch" role="group" aria-label="Project view">' + option('all', 'All projects') + option('one', 'One project') + '</div>';
}

// The "+ New" panel (PR 7, replacing the old bottom add field, Q29a): a two-tab segmented control
// (New project / GitHub repo) that opens directly under the header row. See
// docs/4-systems/styling.md#add-a-project-or-a-repo.
function renderRepoRow(r) {
  return '<li class="repo-row"><span class="repo-name">' + esc(r.full_name) + '</span>'
    + (r.private ? '<span class="chip small">Private</span>' : '')
    + '<button type="button" class="btn-text small" data-action="track-repo" data-repo="' + esc(r.full_name) + '">Track</button></li>';
}
function renderYourRepos(ui) {
  const rs = ui.newPanelRepos || {};
  if (rs.loading) return '<p class="muted small">Loading your repos…</p>';
  if (rs.error) return '<p class="field-error small">' + esc(rs.error) + ' <button type="button" class="link-btn small" data-action="retry-new-panel-repos">Retry</button></p>';
  const repos = rs.list || [];
  const q = (ui.newPanelRepoFilter || '').toLowerCase();
  const filtered = q ? repos.filter((r) => r.full_name.toLowerCase().includes(q)) : repos;
  const filterBox = repos.length > 8
    ? '<input type="text" class="repo-filter" data-action="set-repo-filter" placeholder="Filter repos…" value="' + esc(ui.newPanelRepoFilter || '') + '">'
    : '';
  const rows = filtered.map(renderRepoRow).join('');
  return filterBox + '<ul class="repo-list">' + (rows || '<li class="muted small">No untracked repos.</li>') + '</ul>';
}
function renderPasteRepo(ui) {
  return '<form class="add-project-form" data-action="paste-repo">'
    + '<input type="text" name="value" placeholder="owner/repo or URL" required>'
    + '<button type="submit">Track</button>'
    + '</form>'
    + (ui.newPanelPasteError ? '<p class="field-error small">' + esc(ui.newPanelPasteError) + '</p>' : '');
}
function renderCreateRepo(ui) {
  return '<details class="new-repo-disclosure"' + (ui.newPanelCreateOpen ? ' open' : '') + '>'
    + '<summary>Create a new repo on GitHub</summary>'
    + '<form class="new-repo-form" data-action="create-repo">'
      + '<input type="text" name="name" placeholder="repo-name" required>'
      + '<p class="muted small">letters, numbers, dots, hyphens and underscores only, no spaces</p>'
      + '<label><input type="checkbox" name="private" checked> Private</label>'
      + '<input type="text" name="description" placeholder="Description (optional)">'
      + '<button type="submit">Create</button>'
    + '</form>'
    + (ui.newPanelCreateError ? '<p class="field-error small">' + esc(ui.newPanelCreateError) + '</p>' : '')
    + '</details>';
}
function renderNewRepoTab(ui, hasToken) {
  if (!hasToken) return '<p class="muted small">Connect GitHub in <a href="settings.html">Settings</a> to add repos.</p>';
  return '<div class="new-panel-section"><h4 class="group-label">Your repos</h4>' + renderYourRepos(ui) + '</div>'
    + '<div class="new-panel-section"><h4 class="group-label">Paste</h4>' + renderPasteRepo(ui) + '</div>'
    + '<div class="new-panel-section">' + renderCreateRepo(ui) + '</div>';
}
function renderNewPanel(ui, hasToken) {
  if (!ui.newPanelOpen) return '';
  const tab = ui.newPanelTab === 'repo' ? 'repo' : 'project';
  const tabBtn = (value, label) => '<button type="button" class="filter-pill' + (tab === value ? ' active' : '') + '" data-action="set-new-panel-tab" data-tab="' + value + '" aria-pressed="' + (tab === value) + '">' + label + '</button>';
  const tabs = '<div class="view-switch" role="group" aria-label="Add">' + tabBtn('project', 'New project') + tabBtn('repo', 'GitHub repo') + '</div>';
  const body = tab === 'project'
    ? '<form class="add-project-form" data-action="add-new-project"><input type="text" name="name" placeholder="Project name" maxlength="200" required autofocus><button type="submit">Add</button></form>'
    : renderNewRepoTab(ui, hasToken);
  return '<div class="new-panel" id="new-panel">' + tabs + body + '</div>';
}

// The single project list: search, category pills, sort, Collapse all, and a row per project that
// jumps to its card. CSS shows it as a sticky left column at >=1100px; below that it's the drawer
// opened from the topbar's Projects button (see app.js's toggle-projects-drawer/scroll-project).
// See docs/4-systems/styling.md#project-sidebar
export function renderProjectSidebar(st, ui, visibleProjects, hasToken) {
  if (!st.projects.length) return '';
  const isOpen = !!ui.projectsDrawerOpen;
  const isOneView = ui.projectView === 'one';
  const open = (p) => p.tasks.filter((t) => t.status !== 'done').length;
  const rows = visibleProjects.map((p) => {
    // Selection only means anything in the "One" view (PR 6): an "All" row just scrolls to the
    // project's card/tile, with no "current" project and no aria-current there.
    const isSelected = isOneView && ui.selectedProjectId === p.id;
    return '<li><button type="button" class="sidebar-project' + (isSelected ? ' is-selected' : '') + '" data-action="scroll-project" data-project="' + p.id + '" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" style="--dot:' + p.color + '"' + (isSelected ? ' aria-current="true"' : '') + '>'
      + '<span class="dot"></span><span class="sidebar-name">' + esc(p.name) + '</span><span class="sidebar-count" title="Open tasks">' + open(p) + '</span></button></li>';
  }).join('');
  return '<div class="drawer-backdrop' + (isOpen ? ' is-open' : '') + '" data-action="close-projects-drawer"></div>'
    // a modal dialog only while open as the phone drawer; otherwise a plain landmark, so the wide-screen
    // sidebar doesn't tell screen readers the rest of the page is out of reach
    + '<aside class="project-sidebar' + (isOpen ? ' is-open' : '') + '" id="projects-drawer" tabindex="-1" aria-label="Projects"' + (isOpen ? ' role="dialog" aria-modal="true"' : '') + '>'
    + '<div class="sidebar-head"><h2 class="sidebar-title">Projects</h2><div class="sidebar-head-right"><span class="muted small">' + visibleProjects.length + '</span>'
      + '<button type="button" class="link-btn small" id="new-panel-toggle" data-action="toggle-new-panel" aria-expanded="' + !!ui.newPanelOpen + '" aria-controls="new-panel">+ New</button></div></div>'
    + renderNewPanel(ui, hasToken)
    + renderViewSwitch(ui)
    + '<input type="text" class="project-search sidebar-search" data-action="set-project-query" placeholder="Search projects…" value="' + esc(ui.projectQuery || '') + '">'
    + '<div class="filter-pills sidebar-pills">' + projectFilterPills(st, ui) + '</div>'
    + '<div class="sidebar-tools">' + projectSortSelect(ui) + collapseAllButton(ui, visibleProjects) + '</div>'
    + '<ul class="sidebar-list">' + (rows || '<li class="muted small">No projects match.</li>') + '</ul>'
    + '</aside>';
}

// The project header's Edit panel (Q15a): the category picker (moved off the header itself) and
// Remove project (moved off the header's own button), both under one "Edit" link. Replaces the
// old header "+ Category" placeholder and "Remove" button.
// Q30c (PR 7): a hand-made (non-GitHub) project also gets a "Link to GitHub repo" row here, opening
// the same repo picker (your untracked repos + paste, no Create) inline in the panel.
function renderLinkRepoPanel(p, ui) {
  if (!ui.linkPanel || ui.linkPanel.projectId !== p.id || !ui.linkPanel.open) return '';
  const err = ui.linkPanel.error ? '<p class="field-error small">' + esc(ui.linkPanel.error) + '</p>' : '';
  return '<div class="new-panel link-repo-panel">'
    + '<div class="new-panel-section"><h4 class="group-label">Your repos</h4>' + renderYourReposForLink(ui) + '</div>'
    + '<div class="new-panel-section"><h4 class="group-label">Paste</h4>' + renderPasteRepoForLink(ui) + '</div>'
    + err
    + '</div>';
}
function renderYourReposForLink(ui) {
  const rs = (ui.linkPanel && ui.linkPanel.repos) || {};
  if (rs.loading) return '<p class="muted small">Loading your repos…</p>';
  if (rs.error) return '<p class="field-error small">' + esc(rs.error) + ' <button type="button" class="link-btn small" data-action="retry-link-panel-repos">Retry</button></p>';
  const repos = rs.list || [];
  const rows = repos.map((r) => '<li class="repo-row"><span class="repo-name">' + esc(r.full_name) + '</span>'
    + (r.private ? '<span class="chip small">Private</span>' : '')
    + '<button type="button" class="btn-text small" data-action="link-repo" data-repo="' + esc(r.full_name) + '">Link</button></li>').join('');
  return '<ul class="repo-list">' + (rows || '<li class="muted small">No untracked repos.</li>') + '</ul>';
}
function renderPasteRepoForLink() {
  return '<form class="add-project-form" data-action="paste-link-repo">'
    + '<input type="text" name="value" placeholder="owner/repo or URL" required>'
    + '<button type="submit">Link</button>'
    + '</form>';
}
function renderProjectEditPanel(p, ui, projectCategories, hasToken) {
  const total = p.tasks.length;
  const pendingRemove = !!ui.pendingRemove[p.id];
  const projCatOptions = projectCategories.map((c) => '<option value="' + c.id + '"' + (p.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  const catSelect = '<label class="project-edit-cat">Category '
    + '<select data-action="set-project-category" data-project="' + p.id + '"><option value="">No category</option>' + projCatOptions + '<option value="__new__">+ Add new…</option></select>'
    + '</label>';
  // Colour without right-click (#95): native colour inputs, wired in app.js (input previews, change commits).
  const colorInput = (kind, id, color, label) => '<label class="project-edit-cat">' + label
    + ' <input type="color" class="cat-color-input" data-color-for="' + kind + '" data-id="' + id + '" value="' + cssColorToHex(color) + '"></label>';
  const projCat = projectCategories.find((c) => c.id === p.categoryId);
  const colorRows = colorInput('project', p.id, p.color, 'Colour')
    + (projCat ? colorInput('project-category', projCat.id, projCat.color, 'Category colour') : '');
  const removeControl = pendingRemove
    ? '<span class="remove-confirm">Remove' + (total ? (' &amp; ' + total + ' task' + (total === 1 ? '' : 's')) : '') + '? <button type="button" class="btn-text danger" data-action="confirm-remove-project" data-project="' + p.id + '">Yes</button><button type="button" class="btn-text" data-action="cancel-remove-project" data-project="' + p.id + '">No</button></span>'
    : '<button type="button" class="btn-text danger" data-action="remove-project" data-project="' + p.id + '">Remove project</button>';
  // A project already tracking a repo has nothing new here -- unlinking is out of scope (Q30c).
  const linkRow = (p.source !== 'github' && hasToken)
    ? '<button type="button" class="link-btn small" data-action="toggle-link-panel" data-project="' + p.id + '">Link to GitHub repo</button>' + renderLinkRepoPanel(p, ui)
    : '';
  return '<div class="project-edit-panel">' + catSelect + colorRows + removeControl
    + '<button type="button" class="btn-text" data-action="close-project-edit" data-project="' + p.id + '">Done</button>' + linkRow + '</div>';
}

// One of a project's two open-task groups. Both always render, so a task can be dropped into either
// (PR 11): an empty one stays hidden (CSS) until a task is being dragged, then shows a "Drop here"
// zone. Rows are in ascending sortOrder. See docs/4-systems/styling.md#dragging-tasks
function taskGroup(p, status, label, tasks, ui, categories) {
  const rows = sortTasks(tasks).map((t) => renderTaskRow(t, p, categories, ui)).join('');
  return '<div class="task-group' + (tasks.length ? '' : ' is-empty') + '" data-group="' + status + '" data-project="' + p.id + '">'
    + '<h4 class="group-label">' + label + '</h4>' + rows
    + (tasks.length ? '' : '<div class="drop-zone">Drop here</div>')
    + '</div>';
}

// The confirmation shown before a task move that touches GitHub (js/move-dialog.js puts it on the
// page). A small modal card: the question, an accent Move, a quiet Cancel.
export function renderMoveDialog(message) {
  return '<div class="move-dialog-backdrop">'
    + '<div class="move-dialog" role="dialog" aria-modal="true" aria-labelledby="move-dialog-text">'
    + '<p class="move-dialog-text" id="move-dialog-text">' + esc(message) + '</p>'
    + '<div class="move-dialog-actions">'
    + '<button type="button" class="btn-text" data-dialog="cancel">Cancel</button>'
    + '<button type="button" class="btn primary" data-dialog="move">Move</button>'
    + '</div></div></div>';
}

export function renderProjectCard(p, ui, categories, projectCategories, hasToken) {
  const doing = p.tasks.filter((t) => t.status === 'doing');
  const next = p.tasks.filter((t) => t.status === 'next');
  const done = p.tasks.filter((t) => t.status === 'done');
  const total = p.tasks.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const doneOpen = !!ui.doneOpen[p.id];
  const isOneView = ui.projectView === 'one';
  // Minimising is back (PR 6, 2026-09-27): the saved per-project flag applies in the "All" view, at
  // every width. In the "One" view the flag is ignored at render (never written) -- the one card on
  // screen always shows expanded, since minimising it would do nothing useful. See
  // docs/4-systems/styling.md.
  const collapsed = !isOneView && !!ui.projectCollapsed[p.id];
  // Selection only means anything in the "One" view: below 1100px CSS hides every card but the
  // selected one; from 1100px this class still marks which card is "current" for that view.
  const isSelected = isOneView && ui.selectedProjectId === p.id;
  const ghBadge = p.source === 'github' ? '<a class="chip gh-chip small" href="' + esc(p.htmlUrl || '#') + '" target="_blank" rel="noopener">' + (p.private ? 'Private · ' : '') + 'GitHub ↗</a>' : '';
  const projCat = projectCategories.find((c) => c.id === p.categoryId);
  const projCatChip = projCat ? '<span class="chip cat-chip small" data-cat-id="' + projCat.id + '" data-cat-type="project" title="Right-click to change color" style="--chip-color:' + projCat.color + '">' + esc(projCat.name) + '</span>' : '';
  const editingPanel = !!ui.editingProject[p.id];
  // The minimise button is hidden in the "One" view along with "Collapse all" (collapseAllButton,
  // above) -- there's only ever one card on screen there.
  const collapseBtn = isOneView ? '' : '<button type="button" class="btn-text collapse-toggle" data-action="toggle-project-collapse" data-project="' + p.id + '" aria-label="' + (collapsed ? 'Expand project' : 'Minimise project') + '" aria-expanded="' + (!collapsed) + '">' + (collapsed ? '▸' : '▾') + '</button>';
  const editLink = '<button type="button" class="link-btn small" data-action="' + (editingPanel ? 'close-project-edit' : 'open-project-edit') + '" data-project="' + p.id + '">Edit</button>';
  // The drag grip (PR 9) shows in the "All" view only: in "One" the list in the sidebar/drawer is
  // the order, and there's a single card. A real button, so the arrow keys work on it too
  // (js/project-drag.js). See docs/4-systems/styling.md#dragging-projects
  const gripBtn = isOneView ? '' : '<button type="button" class="drag-grip" data-project="' + p.id + '" aria-label="Move ' + esc(p.name) + '" title="Drag to reorder, or use the arrow keys">' + ICON_GRIP + '</button>';
  const addingTask = !!ui.addingTask[p.id];
  const addTaskBlock = addingTask
    ? '<form class="add-task-form" data-action="add-task" data-project="' + p.id + '">'
        + '<input type="text" name="title" placeholder="Add a task…" maxlength="280" required autofocus>'
        + '<textarea name="steps" placeholder="Steps (optional, one per line)…" rows="2"></textarea>'
        + renderPrioritySelect(null)
        + '<input type="date" name="deadline">'
        + renderLabelPicker(categories, [])
        + '<button type="submit" aria-label="Add task">+</button>'
        + '<button type="button" data-action="cancel-add-task" data-project="' + p.id + '">Cancel</button>'
      + '</form>'
    : '<button type="button" class="link-btn add-task-toggle" data-action="open-add-task" data-project="' + p.id + '">+ Add task</button>';
  return '<section class="card project-card' + (collapsed ? ' is-collapsed' : '') + (isSelected ? ' is-selected' : '') + '" id="proj-' + p.id + '" style="--proj-color:' + p.color + '">'
    // Line 1: dot, name (wraps, never truncated), collapse toggle + Edit -- always on this line,
    // whatever the name's length (#83). Line 2 (badges) always renders, even empty, so a card's
    // progress bar always sits at the same offset from its top as its neighbours'.
    + '<div class="project-head">'
      + '<div class="project-title">' + gripBtn + '<span class="dot" data-project-color="' + p.id + '" title="Right-click to set a custom color"></span><h3>' + esc(p.name) + '</h3></div>'
      + '<div class="project-head-right">' + (p.deadline ? deadlineChip(p.deadline) : '') + collapseBtn + editLink + '</div>'
    + '</div>'
    + '<div class="project-badges">' + ghBadge + projCatChip + '</div>'
    + (editingPanel ? renderProjectEditPanel(p, ui, projectCategories, hasToken) : '')
    + '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
    // The task groups, done group and "+ Add task" scroll inside a fixed-height tile at >=1100px
    // (Q26a, #82) instead of the whole tile growing; below that width this is just a plain block in
    // the page's own scroll. tabindex/role/aria-label keep the scroll region reachable by keyboard
    // and named for a screen reader. See docs/4-systems/styling.md.
    + (collapsed ? '' : (
      '<div class="project-body" tabindex="0" role="region" aria-label="' + esc(p.name) + ' tasks">'
      + taskGroup(p, 'doing', 'In progress', doing, ui, categories)
      + taskGroup(p, 'next', 'Up next', next, ui, categories)
      + (!doing.length && !next.length ? '<p class="muted small empty-note">Nothing open — add a task below.</p>' : '')
      + (done.length ? (
          '<button type="button" class="section-toggle small" data-action="toggle-done" data-project="' + p.id + '">' + (doneOpen ? '−' : '+') + ' ' + done.length + ' done</button>'
          + (doneOpen ? '<div class="task-group done-group">' + done.map((t) => renderTaskRow(t, p, categories, ui)).join('') + '</div>' : '')
        ) : '')
      + addTaskBlock
      + '</div>'
    ))
    + '</section>';
}

// The main column's projects area: what renders depends on ui.projectView and, in "All", the
// caller's isWide. Pure and directly testable. See docs/4-systems/styling.md#project-sidebar.
export function renderProjectsMain(st, ui, visibleProjects, isWide, hasToken) {
  const noMatch = st.projects.length && !visibleProjects.length ? '<p class="muted small">No projects match.</p>' : '';
  const card = (p) => renderProjectCard(p, ui, st.categories, st.projectCategories, hasToken);
  if (ui.projectView === 'one') {
    const selected = visibleProjects.find((p) => p.id === ui.selectedProjectId);
    return '<div class="projects-grid">' + (selected ? card(selected) : noMatch) + '</div>';
  }
  if (isWide) {
    const full = visibleProjects.filter((p) => !ui.projectCollapsed[p.id]);
    const minimised = visibleProjects.filter((p) => ui.projectCollapsed[p.id]);
    return '<div class="projects-grid">' + full.map(card).join('') + noMatch + '</div>'
      + (minimised.length
        ? '<div class="minimised-projects"><h4>Minimised</h4><div class="projects-grid minimised-grid">' + minimised.map(card).join('') + '</div></div>'
        : '');
  }
  return '<div class="projects-grid">' + visibleProjects.map(card).join('') + noMatch + '</div>';
}
