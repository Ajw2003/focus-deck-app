// focus-deck-app/js/focus-view.js -- the Focus tab (#270): two questions (which project, what kind of work), then one
// task on its sticky note with two rubber stamps (Done, Another) and a ⋯ tag for the card-index drawer. Done crosses the
// note out and "Next one" picks again. What a tap does is in js/app.js (the mutations are in js/mutations.js: pickFocus,
// pickForMe, reroll, completeFocus, setFocus, clearFocus); the blockers-first pick order is js/pick-order.js. Same clipboard,
// stamps and carousels as Sort and Organize. See docs/4-systems/focus.md
import { state, esc, formatLabelName, UNLABELLED } from './state.js';
import { findFilter } from './wallet.js';
import { kindsOfWork } from './areas.js';
import { viewState } from './view-switch.js';
import { subtasksOf } from './task-links.js';
import { phaseClasses } from './focus-complete.js';
import { sleeve, walletInner, mutedChip, openWhere, focusProjectId, focusChoosingMode, ALL_PROJECTS_KEY, ANY_CATEGORY_KEY } from './render.js';
import { stamp, foot, dots } from './sort-flow-view.js';

const paper = (q, inner) => '<div class="dk-board sort-board"><div class="dk-paper sort-paper">' + (q ? '<h2 class="sort-q">' + esc(q) + '</h2>' : '') + '<div class="sort-body">' + inner + '</div></div></div>';
const back = (action) => '<button type="button" class="dk-back" data-action="' + action + '">‹ Back</button>';
const tag = (label, action, extra = '') => '<button type="button" class="dk-tag focus-tag" data-action="' + action + '"' + extra + '>' + label + '</button>';
const find = (kind, value, placeholder) => '<input type="search" class="sort-find" data-car-find="' + kind + '" value="' + esc(value || '') + '" placeholder="' + placeholder + '" aria-label="' + placeholder.replace('…', '') + '">';

// The project strip, narrowed by the Find box (ui.focusFind). Re-rendered on its own as the text changes, so the
// box keeps its caret. All projects first, then busiest first; a project with nothing open is left out unless it is
// the one facing you.
export function renderProjectWalletInner(st, ui) {
  const projectId = focusProjectId(st, ui);
  const q = (ui && ui.focusFind) || '';
  const projects = findFilter(st.projects.map((p) => ({ id: p.id, name: p.name, color: p.color, matches: openWhere(st, null, p.id) })), q)
    .filter((x) => x.matches.length || x.id === projectId)
    .sort((a, b) => b.matches.length - a.matches.length || a.name.localeCompare(b.name));
  const folders = (q.trim() ? [] : [sleeve({ key: ALL_PROJECTS_KEY, name: 'All projects', color: 'var(--lamp-dot)', kind: 'project', speak: 'All projects' })])
    .concat(projects.map((x) => sleeve({ key: x.id, name: x.name, color: x.color, kind: 'project', speak: x.name })));
  if (!folders.length) return '<p class="muted find-empty">No project matches &ldquo;' + esc(q) + '&rdquo;.</p>';
  const facing = projects.some((x) => x.id === projectId) ? projectId : (q.trim() ? projects[0].id : ALL_PROJECTS_KEY);
  return walletInner({ wallet: 'projects', label: '', aria: 'Projects. Arrow keys flip, Enter chooses.', items: folders, facing, mode: focusChoosingMode(st) });
}

// The kinds-of-work strip for the chosen project (or all of them): the labels with open tasks (busiest first),
// Unlabelled, and Surprise me (no kind at all) last.
export function renderCategoryWalletInner(st, ui) {
  const projectId = focusProjectId(st, ui);
  const q = (ui && ui.focusKindFind) || '';
  const labels = findFilter(kindsOfWork(st).map((c) => ({ id: c.id, name: formatLabelName(c.name), color: mutedChip(c.color), matches: openWhere(st, c.id, projectId) })), q)
    .filter((x) => x.matches.length)
    .sort((a, b) => b.matches.length - a.matches.length || a.name.localeCompare(b.name));
  const kindIds = new Set(kindsOfWork(st).map((c) => c.id)); // a task with only unticked labels counts as unlabelled
  const unlabelled = openWhere(st, null, projectId).filter(({ t }) => !(t.categoryIds || []).some((id) => kindIds.has(id)));
  if (unlabelled.length && findFilter([{ name: 'Unlabelled' }], q).length) labels.push({ id: UNLABELLED, name: 'Unlabelled', color: 'var(--ink-faint)' });
  if (!q.trim()) labels.push({ id: ANY_CATEGORY_KEY, name: 'Surprise me', color: 'var(--accent)' });
  if (!labels.length) return '<p class="muted find-empty">No kind of work matches &ldquo;' + esc(q) + '&rdquo;.</p>';
  const cards = labels.map((x) => sleeve({ key: x.id, name: x.name, color: x.color, speak: x.name }));
  const wanted = ui && ui.focusCategory;
  const facing = labels.some((x) => x.id === wanted) ? wanted : labels[0].id;
  return walletInner({ wallet: 'categories', label: '', aria: 'Kinds of work. Arrow keys flip, Enter chooses.', items: cards, facing, mode: focusChoosingMode(st) });
}

function renderPicker(full, ui) {
  const st = viewState(full); // only the chosen area/project's tasks are counted and offered
  if (!st.projects.some((p) => p.tasks.some((t) => t.status !== 'done'))) {
    return '<div class="org focusflow">' + paper('Your desk is clear', '') + foot([stamp('Go to Roadmap', { action: 'set-screen', attrs: ' data-screen="roadmap"' })]) + '</div>';
  }
  if (ui.focusQ === 2) {
    return '<div class="org focusflow">' + dots(2, 2)
      + paper('What kind of work?', find('kinds', ui.focusKindFind, 'Find a kind of work…') + '<div class="wallet" id="category-wallet">' + renderCategoryWalletInner(st, ui) + '</div><div class="sr-only" id="wallet-live" aria-live="polite"></div>')
      + foot([back('focus-back'), '<button type="button" class="dk-skip" data-action="focus-skip">Skip</button>', stamp('Show me one', { action: 'focus-show' })]) + '</div>';
  }
  return '<div class="org focusflow">' + dots(1, 2)
    + paper('Which project?', find('projects', ui.focusFind, 'Find a project…') + '<div class="wallet" id="project-wallet">' + renderProjectWalletInner(st, ui) + '</div><div class="sr-only" id="wallet-live" aria-live="polite"></div>')
    + foot([tag('🎲 Pick for me', 'pick-for-me'), stamp('Next', { action: 'focus-next', cls: ' focus-go' })]) + '</div>';
}

// the ⋯ drawer (a card-index drawer, as on Sort): Start it, Smaller steps, Details, the project, Clear
function drawer(t, p, open) {
  const card = (label, action, attrs = '', cls = '') => '<button type="button" class="dk-choice' + cls + '" data-action="' + action + '"' + attrs + '>' + label + '</button>';
  return '<div class="vs-backdrop" data-action="focus-menu"></div><div class="vs-pop dk-sheet sort-drawer" role="dialog" aria-modal="true" aria-label="' + esc(t.title) + '" tabindex="-1">'
    + '<div class="vs-pop-head"><b>' + esc(t.title) + '</b><button type="button" class="vs-x" data-action="focus-menu" aria-label="Close">×</button></div>'
    + '<div class="vs-pop-body">'
    + (t.status === 'next' ? card('▶ Start it', 'focus-doing') : '')
    + (open.length ? card('🪜 Smaller steps', 'focus-steps') : '')
    + card('<span>Details</span><small>›</small>', 'task-open', ' data-task="' + esc(t.id) + '"')
    + card('<span>📁 ' + esc(p.name) + '</span><small>›</small>', 'rm-open', ' data-project="' + esc(p.id) + '"')
    + card('✕ Clear', 'clear-focus')
    + '</div></div>';
}

// Smaller steps: a tick list of the task's open steps; "Focus on one" makes the ticked one the focus
function renderSteps(t, open, ui) {
  const on = ui.focusTick;
  const rows = open.map((s) => '<div class="org-row' + (on === s.id ? ' on' : '') + '"><label class="org-box"><input type="checkbox" data-focus-tick="' + esc(s.id) + '"' + (on === s.id ? ' checked' : '') + ' aria-label="' + esc(s.title) + '"></label>'
    + '<span class="org-title">' + esc(s.title) + '</span></div>').join('');
  return '<div class="org focusflow">' + paper('Smaller steps', '<div class="org-list">' + rows + '</div>')
    + foot([back('focus-steps-back'), stamp('◎ Focus on one', { action: 'focus-subtask', attrs: on ? ' data-task="' + esc(on) + '"' : '', disabled: !on })]) + '</div>';
}

export function renderFocus(st, findTaskWithProject, ui) {
  if (!st.focus) {
    if (ui && ui.focusDone) { // Done: the note crossed out, then "Next one" picks again
      return '<div class="org focusflow">' + paper('', '<div class="note-shadow"><div class="note is-crossed is-done"><h2 class="focus-title"><span class="ink">' + esc(ui.focusDone.title) + '</span></h2></div></div>')
        + foot([stamp('Next one', { action: 'focus-next-one' })]) + '</div>';
    }
    return renderPicker(st, ui || {});
  }
  const found = findTaskWithProject(st.focus.taskId);
  if (!found) { state.focus = null; return renderFocus(st, findTaskWithProject, ui); }
  const t = found.task, p = found.project;
  const open = subtasksOf(st.projects || [], t.id).filter((s) => s.status !== 'done');
  if (ui && ui.focusSteps === t.id && open.length) return renderSteps(t, open, ui);
  const canReroll = st.focus.pool && st.focus.pool.length > 1;
  // a repaint during the Done sequence (js/focus-complete.js) draws the phase it had reached
  const leaving = ui && ui.completing && ui.completing.taskId === t.id ? phaseClasses(ui.completing.phase) : { button: '', note: '' };
  return '<div class="org focusflow focus-active">'
    + paper('', '<div class="note-shadow"><div class="note' + leaving.note + '"><h2 class="focus-title"><span class="ink">' + esc(t.title) + '</span></h2></div></div>'
      + '<div class="dk-stamps focus-stamps">' + stamp('✓ Done', { action: 'complete-focus', cls: ' rv-ok focus-done' + leaving.button })
      + stamp('↻ Another', { action: 'reroll', disabled: !canReroll, cls: ' focus-another' }) + '</div>')
    + foot([tag('⋯', 'focus-menu', ' aria-haspopup="dialog" aria-expanded="' + !!(ui && ui.focusMenu === t.id) + '" aria-label="More: start it, smaller steps, details, project, clear"')]) + '</div>'
    + (ui && ui.focusMenu === t.id ? drawer(t, p, open) : '');
}
