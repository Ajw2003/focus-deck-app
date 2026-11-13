// focus-deck-app/js/roadmap-view.js -- the Roadmap screen's markup (#257, reshaped by #268): one project, one milestone at a
// time on a clipboard (ruler, four folder tabs, tick rows, flags to the neighbours), All milestones, Find a task, the new task /
// milestone / section screens, Edit project as a receipt, and the drawers. Milestone settings are js/milestone-steps.js. The project list and New project are the Projects tab (js/projects-view.js). The data is roadmapOf (js/roadmap.js); moves are js/roadmap-drag.js + app.js.
// See docs/4-systems/roadmap.md and docs/4-systems/styling.md
import { esc, PRIORITY } from './state.js';
import { effectivePriority, UNSORTED_ID } from './areas.js';
import { roadmapOf, COLS, UNPLANNED, sectionsOf, milestoneOf } from './roadmap.js';
import { noProject, COLOURS } from './projects-view.js';
import { stamp, foot, choice } from './sort-flow-view.js';
import { board } from './tidy-view.js';
import { renderSettings } from './milestone-steps.js';
import { renderTaskDetails } from './task-details.js';
import { subtasksOf } from './task-links.js';

const back = () => '<button type="button" class="dk-back" data-action="rm-back">‹ Back</button>';
const scroll = (inner) => '<div class="pj-scroll">' + inner + '</div>';
const field = (attr, value, ph) => '<input type="text" class="pj-field" ' + attr + ' value="' + esc(value) + '" maxlength="200" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '" autocomplete="off" spellcheck="false">';
const ruler = (pct) => '<span class="pj-ruler" role="img" aria-label="' + pct + '% done"><i style="width:' + pct + '%"></i></span>';
const to = (screen) => ' data-screen="' + screen + '"';
const grip = (kind, id, label, keys) => '<button type="button" class="rm-grip" data-kind="' + kind + '" data-id="' + esc(id) + '" aria-label="Move ' + esc(label) + '" title="Drag, or ' + keys + '">⋮⋮</button>';
const key = (action, id, dir, label, off) => '<button type="button" class="tr-move rm-key" data-action="' + action + '" data-id="' + esc(id) + '" data-dir="' + dir + '"' + (off ? ' disabled' : '') + ' aria-label="Move ' + (dir < 0 ? 'up' : 'down') + ': ' + esc(label) + '">' + (dir < 0 ? '↑' : '↓') + '</button>';
const drawer = (label, body) => '<div class="vs-backdrop" data-action="rm-drawer-close"></div><div class="vs-pop dk-sheet sort-drawer" role="dialog" aria-modal="true" aria-label="' + esc(label) + '" tabindex="-1">'
  + '<div class="vs-pop-head"><b>' + esc(label) + '</b><button type="button" class="vs-x" data-action="rm-drawer-close" aria-label="Close">×</button></div><div class="vs-pop-body">' + body + '</div></div>';

// The milestone on the clipboard: the one picked (ui.rmMs), else the first with open tasks, else the first.
export const currentOf = (r, ui) => r.milestones.find((m) => m.id === ui.rmMs) || r.milestones.find((m) => m.id === r.currentId) || r.milestones[0] || null;

// A task row: a tick, the title (opens the task's drawer), and on a computer a grip to drag it onto a folder tab.
function taskRow(t, p) {
  return '<div class="dk-choice rm-task' + (t.status === 'done' ? ' is-done' : '') + '" data-task-id="' + esc(t.id) + '">' + grip('task', t.id, t.title, 'Alt plus left or right arrow')
    + '<input type="checkbox" class="rm-tick" data-action="toggle-task" data-task="' + esc(t.id) + '" data-project="' + esc(p.id) + '"' + (t.status === 'done' ? ' checked' : '') + ' aria-label="Done: ' + esc(t.title) + '">'
    + '<button type="button" class="rm-task-title" data-action="rm-task" data-id="' + esc(t.id) + '">' + esc(t.title) + '</button></div>';
}

function main(st, ui, p, r) {
  const m = currentOf(r, ui), i = m ? r.milestones.indexOf(m) : -1;
  const flag = (label, dir, aria) => '<button type="button" class="dk-link rm-flag" data-action="rm-ms-go" data-dir="' + dir + '" aria-label="' + aria + '"' + (r.milestones[i + dir] ? '' : ' disabled') + '>' + label + '</button>';
  let body = '';
  if (m) {
    const col = (ui.rmCol || {})[m.id] || 'next';
    const tabs = COLS.map(([k, n]) => '<button type="button" class="rm-tab rm-col' + (k === col ? ' on' : '') + '" data-action="rm-col" data-ms="' + esc(m.id) + '" data-col="' + k + '" data-status="' + k + '" aria-pressed="' + (k === col) + '">' + n + ' <b>' + m.cols[k].length + '</b></button>').join('');
    body = ruler(m.pct) + '<div class="rm-tabs" role="group" aria-label="Show a column">' + tabs + '</div>'
      + '<div class="pj-scroll rm-list rm-col" data-status="' + col + '" data-ms="' + esc(m.id) + '">' + m.cols[col].map((t) => taskRow(t, p)).join('') + '</div>'
      + '<div class="rm-nav">' + flag('‹', -1, 'Previous milestone') + '<button type="button" class="dk-link rm-flag rm-all" data-action="rm-screen"' + to('all') + '>All milestones</button>' + flag('›', 1, 'Next milestone') + '</div>';
  }
  return '<div class="pj rm-main"><div class="dk-board sort-board"><div class="dk-paper sort-paper pj-paper">'
    + '<button type="button" class="slip-more pj-pull" data-action="rm-drawer" data-drawer="menu" aria-haspopup="dialog" aria-expanded="' + (ui.rmDrawer === 'menu') + '" aria-label="More"></button>'
    + '<h2 class="sort-q">' + esc(m ? m.name : p.name) + '</h2><div class="sort-body">' + body + '</div></div></div>'
    + foot([stamp('+ Add a task', { action: 'rm-screen', attrs: to('task') })]) + '</div>';
}

function allMs(p, r) {
  const row = (m, s, j) => '<div class="dk-choice rm-ms" data-ms-id="' + esc(m.id) + '" data-section-id="' + esc(s.id) + '" data-index="' + j + '">'
    + (m.unplanned ? '' : grip('ms', m.id, m.name, 'Alt plus up or down arrow'))
    + '<button type="button" class="rm-ms-open" data-action="rm-ms-open" data-id="' + esc(m.id) + '"><span class="rm-ms-name">' + esc(m.name) + '</span>' + ruler(m.pct) + '</button>'
    + (m.unplanned ? '' : '<span class="tr-moves">' + key('rm-ms-step', m.id, -1, m.name, false) + key('rm-ms-step', m.id, 1, m.name, false) + '</span>') + '</div>';
  const real = r.sections.filter((x) => !x.virtual).length;
  const secs = r.sections.map((s) => '<section class="rm-sec" data-section-id="' + esc(s.id) + '"' + (s.virtual ? '' : ' data-sec-index="' + (s.n - 1) + '"') + ' aria-label="' + esc(s.name) + '">'
    + '<h3 class="rm-sec-h">' + (s.virtual ? '' : grip('sec', s.id, s.name, 'Alt plus up or down arrow')) + '<span class="rm-sec-name">' + esc(s.name) + '</span>'
    + (s.virtual ? '' : '<span class="tr-moves">' + key('rm-sec-step', s.id, -1, s.name, s.n === 1) + key('rm-sec-step', s.id, 1, s.name, s.n === real) + '</span>') + '</h3>'
    + s.milestones.map((m, j) => row(m, s, j)).join('') + '</section>').join('');
  const un = r.unplanned ? '<section class="rm-sec rm-unplanned" data-section-id="' + UNPLANNED + '">' + row(r.unplanned, { id: UNPLANNED }, 0) + '</section>' : '';
  return '<div class="pj rm-all-screen">' + board('Milestones', scroll(secs + un)) + foot([back(), stamp('+ Section', { action: 'rm-screen', attrs: to('sec') }), stamp('+ Milestone', { action: 'rm-screen', attrs: to('ms') })]) + '</div>';
}

function find(st, ui, p) {
  const q = (ui.taskQuery || '').trim().toLowerCase();
  const hits = q ? p.tasks.filter((t) => t.title.toLowerCase().includes(q)) : [];
  const rows = hits.map((t) => { const pr = effectivePriority(t, st); return choice(esc(t.title), { action: 'rm-task', attrs: ' data-id="' + esc(t.id) + '"', small: pr ? PRIORITY[pr].label : '' }); }).join('');
  return '<div class="pj">' + board('Find a task', '<input type="search" class="sort-find project-search pj-find" data-action="set-task-query" value="' + esc(ui.taskQuery || '') + '" placeholder="Find a task…" aria-label="Find a task">' + scroll(rows)) + foot([back()]) + '</div>';
}

function forms(ui, p, kind) {
  const f = ui.rmForm || {};
  const add = (action, ok) => stamp('Add', { action, disabled: !ok });
  if (kind === 'task') return '<div class="pj">' + board('New task', field('data-rm-field="title"', f.title || '', 'What needs doing?'))
    + foot([back(), '<button type="button" class="dk-skip" data-action="rm-add-more">More…</button>', add('rm-add-task', (f.title || '').trim())]) + '</div>';
  if (kind === 'sec') return '<div class="pj">' + board('New section', field('data-rm-field="name"', f.name || '', 'Name the section…')) + foot([back(), add('rm-add-sec', (f.name || '').trim())]) + '</div>';
  const secs = sectionsOf(p), sel = f.sec !== undefined ? f.sec : (secs.length ? secs[secs.length - 1].id : '');
  const pick = secs.length ? scroll(secs.map((s) => choice(esc(s.name), { action: 'rm-form-sec', attrs: ' data-id="' + esc(s.id) + '"', on: sel === s.id, toggle: true })).join('')) : '';
  return '<div class="pj">' + board('New milestone', field('data-rm-field="name"', f.name || '', 'Name the milestone…') + pick) + foot([back(), add('rm-add-ms', (f.name || '').trim())]) + '</div>';
}

function edit(st, ui, p, hasToken) {
  const fld = ui.rmEditField, cats = (st.projectCategories || []).filter((a) => a.id !== UNSORTED_ID);
  if (fld === 'name') {
    const v = (ui.rmForm || {}).pname !== undefined ? ui.rmForm.pname : p.name;
    return '<div class="pj">' + board('Name it', field('data-rm-field="pname"', v, 'Name the project…')) + foot([back(), stamp('Save', { action: 'rm-edit-save', disabled: !String(v).trim() })]) + '</div>';
  }
  if (fld === 'area') return '<div class="pj">' + board('Which area?', scroll(choice('Unsorted', { action: 'rm-edit-area', attrs: ' data-id=""', on: !p.categoryId })
    + cats.map((a) => choice(esc(a.name), { action: 'rm-edit-area', attrs: ' data-id="' + esc(a.id) + '"', on: p.categoryId === a.id })).join(''))) + foot([back()]) + '</div>';
  if (fld === 'colour') return '<div class="pj">' + board('Pick a colour', '<div class="pj-swatches" role="group" aria-label="Colour">' + COLOURS.map(([c, n]) => '<button type="button" class="pj-swatch' + (p.color === c ? ' on' : '') + '" style="--c:' + c + '" data-action="rm-edit-color" data-color="' + c + '" aria-pressed="' + (p.color === c) + '" aria-label="' + n + '"></button>').join('') + '</div>') + foot([back()]) + '</div>';
  if (fld === 'repo') {
    const rs = (ui.linkPanel && ui.linkPanel.repos) || {};
    let body;
    if (p.source === 'github') body = choice(esc(p.repoFullName || ''), { action: 'rm-back', on: true });
    else if (!hasToken) body = '<a class="dk-choice" href="settings.html"><span>Connect GitHub in Settings</span></a>';
    else if (rs.error) body = '<p class="step-why" role="status">' + esc(rs.error) + '</p>' + choice('Retry', { action: 'retry-link-panel-repos' });
    else if (!rs.list) body = '<p class="muted">Loading your repos…</p>';
    else body = scroll(rs.list.map((x) => choice(esc(x.full_name), { action: 'link-repo', attrs: ' data-repo="' + esc(x.full_name) + '"', small: x.private ? 'Private' : '' })).join('') || '<p class="muted">No untracked repos.</p>');
    return '<div class="pj">' + board('Which repo?', body + (ui.linkPanel && ui.linkPanel.error ? '<p class="step-why" role="status">' + esc(ui.linkPanel.error) + '</p>' : '')) + foot([back()]) + '</div>';
  }
  const area = cats.find((a) => a.id === p.categoryId);
  const row = (icon, label, val, f) => '<div><span aria-hidden="true">' + icon + '</span><b class="sr-only">' + label + ': </b><em>' + val + '</em><button type="button" class="dk-pencil" data-action="rm-edit-field" data-field="' + f + '" aria-label="Change ' + label.toLowerCase() + '">✎</button></div>';
  const receipt = '<div class="dk-summary sort-receipt">' + row('🏷', 'Name', esc(p.name), 'name') + row('🗄', 'Area', esc(area ? area.name : 'Unsorted'), 'area')
    + row('🎨', 'Colour', '<i class="rm-dot" style="--c:' + esc(p.color) + '"></i>', 'colour') + row('🐙', 'Repo', esc(p.repoFullName || 'None'), 'repo') + '</div>';
  return '<div class="pj">' + board('Edit project', receipt + choice('Remove project', { action: 'rm-drawer', attrs: ' data-drawer="remove"', cls: ' danger' })) + foot([back()]) + '</div>';
}

// The drawers over the clipboard: the ⋯ menu, a tapped task, Move to, and "Remove it?".
function drawers(st, ui, p, r) {
  const m = currentOf(r, ui), d = ui.rmDrawer;
  if (d === 'menu') {
    const pick = (label, screen) => choice(label, { action: 'rm-screen', attrs: to(screen) });
    return drawer(p.name, choice('⚙ Milestone', { action: 'rm-settings', attrs: ' data-id="' + esc(m ? m.id : '') + '"' + (!m || m.unplanned ? ' disabled' : '') })
      + pick('🗺 All milestones', 'all') + pick('🔍 Find a task', 'find') + pick('✏️ Edit project', 'edit')
      + choice('⟳ Sync', { action: 'sync-github', attrs: p.source === 'github' ? '' : ' disabled' }));
  }
  if (d === 'remove') return drawer('Remove ' + p.name + '?', '<div class="rm-ask">' + stamp('Back', { action: 'rm-drawer-close' }) + stamp('Remove', { action: 'confirm-remove-project', attrs: ' data-project="' + esc(p.id) + '"' }) + '</div>');
  const t = ui.rmTask && p.tasks.find((x) => x.id === ui.rmTask);
  if (!t) return '';
  if (d === 'move') {
    const cur = milestoneOf(p, t);
    return drawer('Move to', r.milestones.map((x) => choice(esc(x.name), { action: 'rm-move-to', attrs: ' data-ms="' + esc(x.id) + '"', on: x.id === cur })).join(''));
  }
  if (d === 'task') {
    const stamps = [['doing', 'Doing', '#B7791F'], ['review', 'Review', '#7B4BB5'], ['done', 'Done', '#2F7A4B']].map(([k, n, c]) => '<button type="button" class="rm-stamp' + (t.status === k ? ' on' : '') + '" style="--s:' + c + '" data-action="rm-task-to" data-status="' + k + '" aria-pressed="' + (t.status === k) + '">' + n + '</button>').join('')
      + '<button type="button" class="rm-stamp" style="--s:#59627A" data-action="rm-focus">◎ Focus</button>';
    const mk = subtasksOf(st.projects, t.id).length && !(p.milestones || []).some((x) => x.parentTaskId === t.id) ? choice('🏁 Make it a milestone', { action: 'rm-make', attrs: ' data-id="' + esc(t.id) + '"' }) : '';
    return drawer(t.title, '<div class="rm-stamps">' + stamps + '</div>' + choice('➜ Other milestone', { action: 'rm-drawer', attrs: ' data-drawer="move"' }) + mk
      + choice('Details', { action: 'rm-details', small: '›' }));
  }
  return '';
}

function projectView(st, ui, p, hasToken) {
  const r = roadmapOf(p), s = ui.rmScreen;
  const screen = s === 'all' ? allMs(p, r) : s === 'find' ? find(st, ui, p) : s === 'set' && ui.rmSet ? renderSettings(ui.rmSet) : s === 'edit' ? edit(st, ui, p, hasToken)
    : s === 'task' || s === 'ms' || s === 'sec' ? forms(ui, p, s) : main(st, ui, p, r);
  return screen + drawers(st, ui, p, r) + detail(st, ui, p);
}

function detail(st, ui, p) {
  const t = ui.boardSelected && st.projects.flatMap((x) => x.tasks).find((x) => x.id === ui.boardSelected); // in any project: Move takes the task out of this one
  if (!t) return '';
  return '<div class="rm-detail">' + renderTaskDetails(st, ui, t.id) + '</div>';
}

// The Roadmap tab shows one project (#262); with none yet it offers New project, which is on the Projects tab.
export function renderRoadmap(st, ui, hasToken = false) {
  const view = ui.view || { mode: 'all' };
  const p = view.mode === 'project' && (st.projects || []).find((x) => x.id === view.id);
  return p ? '<div class="rm rm-project" style="--c:' + esc(p.color) + '">' + projectView(st, ui, p, hasToken) + '</div>' : '<div class="rm">' + noProject() + '</div>';
}
