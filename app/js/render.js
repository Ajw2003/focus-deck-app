// focus-deck-app/js/render.js
import { pickChip, renderPickBlocks } from './pick-bits.js';
import { state, esc, cssColorToHex, relTime, deadlineChip, formatLabelName, PRIORITY, PRIORITY_ORDER, UNLABELLED } from './state.js';
import { ICON_GRIP, ICON_CLAUDE_CREATED, ICON_CLAUDE_COMPLETED } from './icons.js';
import { unblockCount, subtasksOf, tieSummary, tieLineHtml } from './task-links.js';
import { sortTasks } from './task-move.js';
import { leadChoices, suggestLead, normalizeDueDefaults } from './due-stage.js';
import { phaseClasses } from './focus-complete.js';
import { normalizeChoosingMode, CHOOSING_MODE_INFO } from './wallet.js';
import { splitCategories } from './category-filter.js';
import { effectivePriority, kindsOfWork, UNSORTED_ID } from './areas.js';
import { viewState } from './view-switch.js';
import { findFilter } from './wallet.js';

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

// The sync light (green dot; amber while syncing, red after an error). Tapping it opens a small drawer with
// Sync now and Sync settings (st._ui.syncOpen). The light's title/aria-label carry syncButtonTitle.
export function renderSyncButton(st) {
  const ui = st._ui || {}, syncing = !!ui.syncing;
  const title = syncButtonTitle(st);
  return '<button type="button" class="sync-light' + (syncing ? ' is-syncing' : ui.syncError ? ' is-error' : '') + '" data-action="sync-drawer" aria-haspopup="true" aria-expanded="' + !!ui.syncOpen + '" title="' + esc(title) + '" aria-label="' + esc(title) + '"></button>'
    + (ui.syncOpen ? '<div class="sync-drawer" role="menu"><button type="button" role="menuitem" class="dk-choice" data-action="sync-github"' + (syncing ? ' disabled' : '') + '>Sync now</button>'
      + '<a role="menuitem" class="dk-choice" href="settings.html#sync-section">Sync settings</a></div>' : '');
}

// The one place errors and notices appear, on every page: pinned to the bottom of the viewport
// (see .toast) so it's seen wherever the page is scrolled. kind is 'error' or 'info'.
// See docs/4-systems/styling.md#how-it-works
// One activity at a time (#135): the screens, and the rail that switches between them (a column
// on the left on a wide screen, a bar along the bottom on a phone). Adding stays on every screen:
// it is the jotter in the topbar. See docs/4-systems/styling.md#one-screen-at-a-time
export const SCREENS = ['sort', 'tidy', 'triage', 'projects', 'roadmap', 'focus', 'review'];
const SCREEN_INFO = {
  focus: { label: 'Focus', icon: '◎' },
  sort: { label: 'Sort', icon: '📥' },
  review: { label: 'Review', icon: '✓' },
  tidy: { label: 'Tidy up', icon: '🧹' },
  triage: { label: 'Triage', icon: '🧹' },
  projects: { label: 'Projects', icon: '📁' },
  roadmap: { label: 'Roadmap', icon: '🗺' },
};
// A saved screen from before the Projects tab (Board) opens Projects; anything else unknown (Start here) opens Focus.
export function normalizeScreen(value) { return SCREENS.includes(value) ? value : value === 'board' ? 'projects' : 'focus'; }
// The six tabs, drawn as ring-binder dividers (.dk-tabs), in the order of the flow. Organize holds Tidy up and Triage.
// Only Sort and Review carry a count. See docs/4-systems/tabs.md
export function renderRail(screen, unsortedCount, reviewCount = 0) {
  const org = screen === 'tidy' || screen === 'triage';
  const tab = (label, key, on, attrs, count, countLabel) => '<button type="button" class="rail-item dk-tab' + (on ? ' is-on on' : '') + '" data-action="set-screen" ' + attrs + (on ? ' aria-current="page"' : '') + '>'
    + '<span class="rail-icon" aria-hidden="true">' + SCREEN_INFO[key].icon + '</span>' + (count ? '<b class="rail-count" aria-label="' + count + ' ' + countLabel + '">' + count + '</b>' : '')
    + '<span class="rail-label">' + label + '</span></button>';
  const sub = (k) => '<button type="button" class="rail-sub' + (screen === k ? ' is-on' : '') + '" data-action="set-screen" data-screen="' + k + '"' + (screen === k ? ' aria-current="page"' : '') + '>' + SCREEN_INFO[k].label + '</button>';
  return '<nav class="rail dk-tabs" aria-label="What to do">'
    + tab('Sort', 'sort', screen === 'sort', 'data-screen="sort"', unsortedCount, 'to sort')
    + tab('Organize', 'tidy', org, 'data-go="tidy"', 0, '')
    + '<div class="rail-subs">' + sub('tidy') + sub('triage') + '</div>'
    + tab('Projects', 'projects', screen === 'projects', 'data-screen="projects"', 0, '')
    + tab('Roadmap', 'roadmap', screen === 'roadmap', 'data-screen="roadmap"', 0, '')
    + tab('Focus', 'focus', screen === 'focus', 'data-screen="focus"', 0, '')
    + tab('Review', 'review', screen === 'review', 'data-screen="review"', reviewCount, 'to review')
    + '</nav>';
}

// The jotter's "To:" stamp (#242): ui.jotTo undefined follows the screen (Board's chosen project, or
// Projects' single selected project); a project that no longer exists falls back to '' (Unsorted).
export function jotTarget(st, ui) {
  let id = ui.jotTo;
  if (id === undefined) id = (ui.view && ui.view.mode === 'project' && ui.screen === 'roadmap' && ui.view.id) || '';
  return st.projects.some((p) => p.id === id) ? id : '';
}

// The + Jot screen (#263): a clipboard over the current tab with the jotter, a "where it goes" index card
// and a Save stamp; ui.jotPick opens the card-index drawer of destinations. Not repainted by paint().
export function renderJotScreen(st, ui) {
  if (!ui.jotOpen) return '';
  const target = jotTarget(st, ui), proj = st.projects.find((p) => p.id === target);
  const dest = proj ? '📁 ' + esc(proj.name) : '📥 Sort';
  const card = (id, label, on) => '<button type="button" class="dk-choice' + (on ? ' on' : '') + '" data-action="jot-pick" data-id="' + esc(id) + '" aria-pressed="' + on + '">' + label + '</button>';
  const drawer = ui.jotPick
    ? '<div class="vs-backdrop" data-action="jot-where"></div><div class="vs-pop dk-sheet jot-drawer" role="dialog" aria-modal="true" aria-label="Where should it go?" tabindex="-1">'
      + '<div class="vs-pop-head"><b>Where should it go?</b><button type="button" class="vs-x" data-action="jot-where" aria-label="Close">×</button></div>'
      + '<div class="vs-pop-body">' + card('', '📥 Sort', !target)
      + '<input type="search" class="vs-search" data-jot-search placeholder="Find a project…" aria-label="Find a project">'
      + st.projects.map((p) => '<span data-jot-name="' + esc(p.name.toLowerCase()) + '">' + card(p.id, '📁 ' + esc(p.name), p.id === target) + '</span>').join('')
      + '</div></div>'
    : '';
  return '<div class="jot-screen" role="dialog" aria-modal="true" aria-label="Jot a thought"><div class="dk-board jot-board">'
    + '<div class="vs-pop-head"><b>Jot a thought</b><button type="button" class="vs-x" data-action="jot-close" aria-label="Close">×</button></div>'
    + '<div class="dk-paper jot-paper"><div class="jotter"><textarea id="jot-input" rows="5" placeholder="Type it here…" aria-label="Your thought">' + esc(ui.jotDraft || '') + '</textarea></div>'
    + '<button type="button" class="dk-choice jot-where" data-action="jot-where" aria-haspopup="dialog" aria-expanded="' + !!ui.jotPick + '">Where it goes <small>' + dest + ' ▾</small></button>'
    + '<button type="button" class="dk-btn jot-save" data-action="jot-save">Save</button></div></div>' + drawer + '</div>';
}

// action (optional): { label, action, attrs } renders a button before the close button.
export function renderToast(text, kind, action) {
  if (!text) return '';
  const isError = kind === 'error';
  return '<div class="toast' + (isError ? ' toast-error' : '') + '" role="' + (isError ? 'alert' : 'status') + '">'
    + '<p class="toast-text">' + esc(text) + '</p>'
    + (action ? '<button type="button" class="btn ghost toast-action" data-action="' + esc(action.action) + '"' + Object.entries(action.attrs || {}).map(([k, v]) => ' ' + k + '="' + esc(v) + '"').join('') + '>' + esc(action.label) + '</button>' : '')
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
    + '<div class="flip"><div class="flip-track" tabindex="0" role="group" aria-label="' + esc(aria) + '" data-wallet="' + wallet + '" data-mode="' + mode + '"' + (verb ? ' data-verb="' + verb + '"' : '') + ' data-facing="' + esc(facing) + '">'
    + '<div class="flip-pad"></div>' + items.join('') + '<div class="flip-pad"></div></div></div>';
}

export function focusChoosingMode(st) {
  return normalizeChoosingMode(st.choosingMode && st.choosingMode.mode);
}

// The category wallet's contents (header and strip). Re-rendered on its own when the project
// wallet flips, so the project wallet's scroll animation is not cut off by a whole repaint.
export function renderCategoryWalletInner(st, ui) {
  const projectId = focusProjectId(st, ui);
  const labels = kindsOfWork(st).map((c) => ({ id: c.id, name: formatLabelName(c.name), color: mutedChip(c.color), matches: openWhere(st, c.id, projectId) }))
    .filter((x) => x.matches.length)
    .sort((a, b) => b.matches.length - a.matches.length || a.name.localeCompare(b.name));
  // Tasks with no label get their own card (neutral colour), and "Surprise me" (no type at all) is the last card.
  const kindIds = new Set(kindsOfWork(st).map((c) => c.id)); // a task with only unticked labels counts as unlabelled
  const unlabelled = openWhere(st, null, projectId).filter(({ t }) => !(t.categoryIds || []).some((id) => kindIds.has(id)));
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

function renderFocusPicker(full, ui) {
  const st = viewState(full); // only the chosen area/project's tasks are counted and offered
  const projectId = focusProjectId(st, ui);
  if (!st.projects.some((p) => p.tasks.some((t) => t.status !== 'done'))) {
    // an empty desk, with the next step spelled out (a project can be added from the list; a stray
    // thought can go on the jotter above and be sorted later)
    return '<section class="focus-card focus-empty desk-empty">'
      + '<h2 class="focus-q">Your desk is clear.</h2>'
      + (st.projects.length
        ? '<p class="muted">Nothing is waiting to be picked. Add a task to a project on the Roadmap, or jot a thought on the pad above and sort it later.</p>'
        : '<p class="muted">Nothing is waiting to be picked. Make your first project on the Roadmap and add a task to it, or jot a thought on the pad above and sort it later.</p>')
      + '<button type="button" class="btn primary" data-action="set-screen" data-screen="roadmap">Go to Roadmap</button>'
      + '</section>';
  }
  const mode = focusChoosingMode(st);
  return '<section class="card focus-card focus-empty wallet-root">'
    + '<h2 class="focus-q">What&rsquo;s your focus right now?</h2>'
    + '<p class="muted"><span class="only-narrow">Flip to a project</span><span class="only-wide">Pick a project</span> and a kind of work, and I&rsquo;ll surface one task.</p>'
    + '<input type="search" class="car-find" data-car-find value="' + esc((ui && ui.focusFind) || '') + '" placeholder="Find a project…" aria-label="Find a project">'
    + '<div class="wallet" id="project-wallet">' + renderProjectWalletInner(st, ui) + '</div>'
    + '<div class="wallet" id="category-wallet">' + renderCategoryWalletInner(st, ui) + '</div>'
    + '<div class="flip-hint">' + CHOOSING_MODE_INFO[mode].hint + '</div>'
    + '<p class="car-alt"><button type="button" class="link-btn" data-action="pick-for-me">Or let me pick for you</button></p>'
    + '<div class="sr-only" id="wallet-live" aria-live="polite"></div>'
    + '</section>';
}

// The project wallet's contents, narrowed by the Find box (ui.focusFind). Re-rendered on its own as
// the Find text changes, so the box keeps its caret. Folders: All projects first, then busiest first;
// a project with nothing open is left out unless it is the one facing you.
export function renderProjectWalletInner(st, ui) {
  const projectId = focusProjectId(st, ui);
  const q = (ui && ui.focusFind) || '';
  const projects = findFilter(st.projects.map((p) => ({ id: p.id, name: p.name, color: p.color, matches: openWhere(st, null, p.id) })), q)
    .filter((x) => x.matches.length || x.id === projectId)
    .sort((a, b) => b.matches.length - a.matches.length || a.name.localeCompare(b.name));
  const all = openWhere(st, null, null);
  const folders = (q.trim() ? [] : [sleeve({ key: ALL_PROJECTS_KEY, name: 'All projects', color: 'var(--lamp-dot)', kind: 'project', detail: focusCardDetail(all, false), speak: 'All projects, ' + focusCardDetail(all, false) })])
    .concat(projects.map((x) => {
      const detail = focusCardDetail(x.matches, false);
      return sleeve({ key: x.id, name: x.name, color: x.color, kind: 'project', detail, speak: x.name + ', ' + detail });
    }));
  if (!folders.length) return '<p class="muted small find-empty">No project matches &ldquo;' + esc(q) + '&rdquo;.</p>';
  const facing = projects.some((x) => x.id === projectId) ? projectId : (q.trim() ? projects[0].id : ALL_PROJECTS_KEY);
  return walletInner({ wallet: 'projects', label: 'Project', aria: 'Projects. Arrow keys flip, Enter chooses.', items: folders, facing, mode: focusChoosingMode(st) });
}

// "3 open · top: High · 2 projects": the count, the highest priority present, and (when not
// narrowed to one project) how many projects the tasks come from.
function focusCardDetail(matches, acrossProjects) {
  const parts = [matches.length + ' open'];
  const top = PRIORITY_ORDER.find((lvl) => matches.some(({ t }) => effectivePriority(t, state) === lvl));
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
        + '<button type="button" class="note-project" data-action="rm-open" data-project="' + p.id + '" title="Open on the Roadmap: ' + esc(p.name) + '">' + esc(p.name) + ' ↓</button>'
        + focusMetaParts(st, t)
        + deadlineHTML
        + '<button type="button" class="btn-text task-open" data-action="task-open" data-task="' + esc(t.id) + '" aria-label="Task details: ' + esc(t.title) + '">Details</button>'
      + '</div>'
      + '<h2 class="focus-title"><span class="ink">' + esc(t.title) + '</span></h2>'
      + nextSubLine(st, t)
    + '</div></div>'
    + (t.status === 'next' ? '<div class="focus-doing"><button type="button" class="btn-text focus-doing-btn" data-action="focus-doing">Mark in progress</button></div>'
      : t.status === 'doing' ? '<div class="focus-doing"><span class="focus-doing-mark">In progress</span></div>'
      : t.status === 'review' ? '<div class="focus-doing"><span class="focus-doing-mark">Review</span></div>' : '')
    + '<div class="desk-acts' + (canReroll ? '' : ' is-single') + '">'
      + '<button type="button" class="check-btn' + leaving.button + '" data-action="complete-focus">'
        + '<span class="box" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="tick" d="M4.5 12.8l4.6 4.7L19.8 6.2"/></svg></span>'
        + '<span class="check-words"><span class="slip-main">I&rsquo;ve done it</span><span class="slip-sub">mark it done</span></span>'
      + '</button>'
      + (canReroll ? '<button type="button" class="slip-btn" data-action="reroll"><span class="slip-main">Not this one</span><span class="slip-sub">pick another task</span></button>' : '')
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
  const n = unblockCount(st.projects || [], t.id);
  let reason = '';
  if (focus.pool && !(focus.filter && focus.filter.categoryId)) {
    if (focus.allBlocked) parts.push('Everything here is waiting on something');
    else if (n > 0) reason = '<span><b class="unblocks">Unblocks ' + n + (n === 1 ? ' task' : ' tasks') + '</b></span>';
    else parts.push(focus.ordered ? 'Picked for you' : 'Random pick');
  }
  const lvl = effectivePriority(t, st);
  if (lvl) parts.push(PRIORITY[lvl].label);
  return reason + parts.map((x) => '<span>' + esc(x) + '</span>').join('');
}

// "Next step: <first open subtask> · N subtasks left" with a button that focuses it
function nextSubLine(st, t) {
  const open = subtasksOf(st.projects || [], t.id).filter((s) => s.status !== 'done');
  if (!open.length) return '';
  return '<p class="next-sub">Next step: <b>' + esc(open[0].title) + '</b> · ' + open.length + (open.length === 1 ? ' subtask' : ' subtasks') + ' left '
    + '<button type="button" class="btn-text" data-action="focus-subtask" data-task="' + open[0].id + '">Start it</button></p>';
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
// With Settings > Category choices on (#133) and a project given, labels that project doesn't use
// (and that aren't ticked) are drawn hidden behind "Show all N" (app.js's label-show-all toggles a
// class, no repaint, so a half-typed form is never lost).
export function renderLabelPicker(categories, selectedIds, project, filterOn = !state.categoryFilter || state.categoryFilter.on !== false) {
  const selected = selectedIds || [];
  const { hidden } = splitCategories(categories, project, { on: filterOn, selected });
  const extra = new Set(hidden.map((c) => c.id));
  const options = categories.map((c) => '<label class="label-option' + (extra.has(c.id) ? ' is-extra' : '') + '" style="--chip-color:' + mutedChip(c.color) + '">'
    + '<input type="checkbox" name="categoryIds" value="' + c.id + '"' + (selected.includes(c.id) ? ' checked' : '') + '>'
    + '<span>' + esc(formatLabelName(c.name)) + '</span>'
    + '<input type="color" class="cat-color-input label-swatch" data-color-for="label" data-id="' + c.id + '" value="' + cssColorToHex(c.color) + '" aria-label="Colour for ' + esc(formatLabelName(c.name)) + '">'
    + '</label>').join('');
  return '<details class="label-picker">'
    + '<summary>' + labelPickerSummary(selected.length) + '</summary>'
    + '<div class="label-options">' + options + '</div>'
    + (hidden.length ? '<button type="button" class="link-btn small label-show-all" data-action="label-show-all">Show all ' + categories.length + ' categories</button>' : '')
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
    + renderLabelPicker(categories, t.categoryIds, p)
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

export function renderTaskRow(t, p, categories, ui, projects = [], isSub = false) {
  if (ui.editingTask && ui.editingTask.taskId === t.id) return renderTaskEditForm(t, p, categories);
  const isDone = t.status === 'done';
  const ties = tieSummary(projects, t.id);
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
  // the chips open a small picker (js/pick-bits.js); a done task shows what it had, not editable
  const priorityChip = isDone
    ? (effectivePriority(t, state) ? '<span class="chip priority-chip small" style="--chip-color:var(--prio-' + effectivePriority(t, state) + ')">' + PRIORITY[effectivePriority(t, state)].label + '</span>' : '')
    : pickChip('priority', t);
  // Open rows carry a drag grip before the checkbox (PR 11); done rows don't drag. The grip is a real
  // button so the arrow keys work on it (js/project-drag.js). See docs/4-systems/styling.md#dragging-tasks
  const grip = isDone ? '' : '<button type="button" class="task-grip" data-task="' + t.id + '" data-project="' + p.id + '" aria-label="Move ' + esc(t.title) + '" title="Drag to move, or use the arrow keys">' + ICON_GRIP + '</button>';
  return '<div class="task-row' + (isDone ? ' is-done' : ' has-grip') + (ties.isWaiting ? ' is-waiting' : '') + (isSub ? ' is-sub' : '') + '" data-task="' + t.id + '" data-project="' + p.id + '" style="--chips-max:' + chipsMaxPct(t.title) + '%">'
    + grip
    + '<input type="checkbox" data-action="toggle-task" data-task="' + t.id + '" data-project="' + p.id + '"' + (isDone ? ' checked' : '') + '>'
    // two zones beside the checkbox: the title in the left 75%, the chips right-anchored in the
    // right 25% (kept even when there are no chips, so the title never grows into it) -- #97, #92
    + '<span class="task-title" data-action="edit-task" data-task="' + t.id + '" data-project="' + p.id + '" role="button" tabindex="0">' + esc(t.title) + claudeMarks(t) + tieLineHtml(ties) + '</span>'
    + '<div class="task-chips">' + priorityChip + catChips + claudeChip
    + (isDone ? (t.deadline ? deadlineChip(t.deadline, t) : '') : pickChip('due', t))
    + '</div>'
    + '</div>';
}

// The sort control: the Roadmap's group view uses it (and the saved order carries over from the Projects screen)
export function projectSortSelect(ui) {
  const sortOptions = [
    ['name', 'Name (A–Z)'], ['open-tasks', 'Most open tasks'], ['deadline', 'Closest deadline'], ['recent-sync', 'Recently synced'], ['custom', 'Custom order'],
  ].map(([value, label]) => '<option value="' + value + '"' + (ui.projectSort === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  return '<select class="project-sort-select" data-action="set-project-sort" aria-label="Sort projects">' + sortOptions + '</select>';
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
export function renderNewPanel(ui, hasToken) {
  if (!ui.newPanelOpen) return '';
  const tab = ui.newPanelTab === 'repo' ? 'repo' : 'project';
  const tabBtn = (value, label) => '<button type="button" class="filter-pill' + (tab === value ? ' active' : '') + '" data-action="set-new-panel-tab" data-tab="' + value + '" aria-pressed="' + (tab === value) + '">' + label + '</button>';
  const tabs = '<div class="view-switch" role="group" aria-label="Add">' + tabBtn('project', 'New project') + tabBtn('repo', 'GitHub repo') + '</div>';
  const body = tab === 'project'
    ? '<form class="add-project-form" data-action="add-new-project"><input type="text" name="name" placeholder="Project name" maxlength="200" required autofocus><button type="submit">Add</button></form>'
    : renderNewRepoTab(ui, hasToken);
  return '<div class="new-panel" id="new-panel">' + tabs + body + '</div>';
}

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
export function renderProjectEditPanel(p, ui, projectCategories, hasToken) {
  const total = p.tasks.length;
  const pendingRemove = !!ui.pendingRemove[p.id];
  const projCatOptions = projectCategories.filter((c) => c.id !== UNSORTED_ID).map((c) => '<option value="' + c.id + '"' + (p.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  const catSelect = '<label class="project-edit-cat">Area '
    + '<select data-action="set-project-category" data-project="' + p.id + '"><option value="">Unsorted</option>' + projCatOptions + '<option value="__new__">+ Add an area…</option></select>'
    + '</label>';
  // Colour without right-click (#95): native colour inputs, wired in app.js (input previews, change commits).
  const colorInput = (kind, id, color, label) => '<label class="project-edit-cat">' + label
    + ' <input type="color" class="cat-color-input" data-color-for="' + kind + '" data-id="' + id + '" value="' + cssColorToHex(color) + '"></label>';
  const projCat = projectCategories.find((c) => c.id === p.categoryId);
  const colorRows = colorInput('project', p.id, p.color, 'Colour')
    + (projCat ? colorInput('project-category', projCat.id, projCat.color, 'Area colour') : '');
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

// The confirmation shown before a task move that touches GitHub (js/move-dialog.js puts it on the
// page). A small modal card: the question, an accent button (Move unless `actionLabel` says
// otherwise, e.g. Delete for a tray thought), a quiet Cancel.
export function renderMoveDialog(message, actionLabel = 'Move') {
  return '<div class="move-dialog-backdrop">'
    + '<div class="move-dialog" role="dialog" aria-modal="true" aria-labelledby="move-dialog-text">'
    + '<p class="move-dialog-text" id="move-dialog-text">' + esc(message) + '</p>'
    + '<div class="move-dialog-actions">'
    + '<button type="button" class="btn-text" data-dialog="cancel">Cancel</button>'
    + '<button type="button" class="btn primary" data-dialog="move">' + esc(actionLabel) + '</button>'
    + '</div></div></div>';
}

// The one-line add row at a project card's foot (docs/4-systems/quick-add.md). "More" opens the
// old boxes underneath; `draft` is the title typed so far, so a repaint does not lose it (#235).
export function renderAddTaskRow(project, categories, isMoreOpen, draft, placeholder, pick) {
  const id = esc(project.id), S = pick || {};
  return '<form class="add-task-form add-row" data-action="add-task" data-project="' + id + '">'
    + '<div class="add-line"><span class="add-plus" aria-hidden="true">+</span>'
      + '<input type="text" name="title" maxlength="280" required placeholder="' + esc(placeholder || 'Add a task…') + '" aria-label="Add a task to ' + esc(project.name) + '" value="' + esc(draft || '') + '">'
      + '<button type="button" class="btn-text" data-action="toggle-add-more" data-project="' + id + '" aria-expanded="' + !!isMoreOpen + '">' + (isMoreOpen ? 'Less' : 'More') + '</button>'
      + '<button type="submit" class="btn primary"' + (S.priority ? '' : ' disabled') + '>' + 'Add</button></div>'
    // priority (required) and due date, shown once there is a title (#249); app.js keeps them in ui.addPick
    + renderPickBlocks(S, 'add', { project: project.id }, !String(draft || '').trim(), undefined, 'Pick a priority to add')
    + (isMoreOpen
      ? '<div class="add-more">'
          + '<textarea name="steps" placeholder="Steps (optional, one per line)…" rows="2"></textarea>'
          + renderLabelPicker(categories, [], project)
        + '</div>'
      : '')
    + '</form>';
}
