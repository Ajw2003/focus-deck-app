// focus-deck-app/js/roadmap-view.js -- the Roadmap screen's markup (#257): one project, sections each holding
// milestones; the open one shows four columns. The project list and New project are the Projects tab (js/projects-view.js). The data is roadmapOf (js/roadmap.js); moves are js/roadmap-drag.js + app.js.
// See docs/4-systems/roadmap.md and docs/4-systems/styling.md
import { esc, PRIORITY, deadlineChip } from './state.js';
import { effectivePriority } from './areas.js';
import { roadmapOf, COLS, UNPLANNED } from './roadmap.js';
import { renderProjectEditPanel, renderAddTaskRow } from './render.js';
import { noProject } from './projects-view.js';
import { renderTaskDetails } from './task-details.js';
import { subtasksOf } from './task-links.js';

const count = (m) => m.text;
const bar = (pct, cls) => '<span class="rm-bar' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><i style="width:' + pct + '%"></i></span>';
// The project bar: one segment per milestone, as wide as it added to the project (share x progress).
const segBar = (r) => '<span class="rm-bar rm-bar-big rm-segs" role="img" aria-label="' + r.pct + '% done">' + r.milestones.filter((m) => m.contribution > 0).map((m) => '<i style="width:' + m.contribution + '%" title="' + esc(m.name + ': ' + Math.round(m.contribution * 10) / 10 + '% of the project') + '"></i>').join('') + '</span>';

const grip = (kind, id, label, keys) => '<button type="button" class="rm-grip" data-kind="' + kind + '" data-id="' + esc(id) + '" aria-label="Move ' + esc(label) + '" title="Drag, or ' + keys + '">⋮⋮</button>';
const step = (action, id, dir, label) => '<button type="button" class="btn ghost rm-step" data-action="' + action + '" data-id="' + esc(id) + '" data-dir="' + dir + '" aria-label="Move ' + (dir < 0 ? 'up' : 'down') + ': ' + esc(label) + '">' + (dir < 0 ? '↑' : '↓') + '</button>';

function taskChip(t, p, col, st) {
  const pr = effectivePriority(t, st);
  const i = COLS.findIndex((c) => c[0] === col);
  const tstep = (d) => '<button type="button" class="btn ghost rm-step" data-action="rm-task-step" data-id="' + esc(t.id) + '" data-dir="' + d + '"' + (COLS[i + d] ? '' : ' disabled') + ' aria-label="Move to ' + (COLS[i + d] ? COLS[i + d][1] : 'nowhere') + ': ' + esc(t.title) + '">' + (d < 0 ? '←' : '→') + '</button>';
  return '<li class="rm-task' + (t.status === 'done' ? ' is-done' : '') + '" data-task-id="' + esc(t.id) + '">'
    + grip('task', t.id, t.title, 'Alt plus left or right arrow')
    + '<input type="checkbox" data-action="toggle-task" data-task="' + esc(t.id) + '" data-project="' + esc(p.id) + '"' + (t.status === 'done' ? ' checked' : '') + ' aria-label="Done: ' + esc(t.title) + '">'
    + '<button type="button" class="rm-task-title" data-action="rm-task" data-id="' + esc(t.id) + '">' + esc(t.title) + '</button>'
    // read-only priority chip; a click opens Task details, where it is changed
    + (pr ? '<button type="button" class="chip priority-chip small" data-action="rm-task" data-id="' + esc(t.id) + '" style="--chip-color:var(--prio-' + pr + ')" aria-label="Priority ' + PRIORITY[pr].label + ': ' + esc(t.title) + '">' + PRIORITY[pr].label + '</button>' : '')
    + (t.deadline && t.status !== 'done' ? deadlineChip(t.deadline, t) : '')
    + '<span class="rm-tmoves">' + tstep(-1) + tstep(1) + '</span></li>';
}

function milestone(m, p, ui, st, at) {
  // Find a task: narrows every milestone's columns, and opens the milestones so the matches show
  const q = (ui.taskQuery || '').trim().toLowerCase();
  if (q) m = Object.assign({}, m, { cols: Object.fromEntries(COLS.map(([k]) => [k, m.cols[k].filter((t) => t.title.toLowerCase().includes(q))])) });
  const open = q ? true : (ui.rmOpen || {})[m.id] !== undefined ? !!ui.rmOpen[m.id] : m.id === at.currentId;
  const col = (ui.rmCol || {})[m.id] || 'next';
  const head = '<div class="rm-ms-head">' + (m.unplanned ? '' : grip('ms', m.id, m.name, 'Alt plus up or down arrow'))
    + (m.unplanned ? '<span class="rm-ms-name">' + esc(m.name) + '</span>' : '<button type="button" class="rm-ms-name" data-action="rm-settings" data-id="' + esc(m.id) + '" title="Milestone settings">' + esc(m.name) + '</button>')
    + '<button type="button" class="rm-ms-toggle" data-action="rm-toggle" data-id="' + esc(m.id) + '" aria-expanded="' + open + '" aria-label="' + (open ? 'Hide' : 'Show') + ' tasks: ' + esc(m.name) + '"><span class="rm-ms-count">' + esc(count(m)) + ' <span aria-hidden="true">' + (open ? '▾' : '▸') + '</span></span></button>'
    + (m.unplanned ? '' : '<span class="rm-moves">' + step('rm-ms-step', m.id, -1, m.name) + step('rm-ms-step', m.id, 1, m.name) + '</span>') + '</div>';
  let body = '';
  if (open) {
    const tabs = COLS.map(([k, n]) => '<button type="button" class="rm-coltab' + (k === col ? ' on' : '') + '" data-action="rm-col" data-ms="' + esc(m.id) + '" data-col="' + k + '" aria-pressed="' + (k === col) + '">' + n + '</button>').join('');
    const cols = COLS.map(([k, n]) => '<div class="rm-col' + (k === col ? ' is-on' : '') + '" data-status="' + k + '" data-ms="' + esc(m.id) + '" role="group" aria-label="' + n + '"><h4 class="rm-col-h">' + n + ' <b>' + m.cols[k].length + '</b></h4><ul class="rm-list">'
      + m.cols[k].map((t) => taskChip(t, p, k, st)).join('') + '</ul></div>').join('');
    const adding = ui.rmAdd && ui.rmAdd.kind === 'task' && ui.rmAdd.ms === m.id;
    const add = adding
      ? renderAddTaskRow(p, st.categories || [], !!(ui.addingTask || {})[p.id], (ui.addDraft || {})[p.id] || '', 'Add a task to ' + m.name + '…', (ui.addPick || {})[p.id]).replace('<div class="add-line">', '<input type="hidden" name="milestone" value="' + esc(m.id) + '"><div class="add-line">')
      : '<button type="button" class="link-btn small rm-add-link" data-action="rm-add" data-kind="task" data-ms="' + esc(m.id) + '">+ Add a task</button>';
    body = '<div class="rm-coltabs" role="group" aria-label="Show a column">' + tabs + '</div><div class="rm-cols">' + cols + '</div>' + add;
  }
  return '<article class="rm-ms' + (open ? ' is-open' : '') + '" data-ms-id="' + esc(m.id) + '" data-section-id="' + esc(m.sectionId || '') + '" data-index="' + (m.index || 0) + '">' + head + body + '</article>';
}

function detail(st, ui, p) {
  const t = ui.boardSelected && p.tasks.find((x) => x.id === ui.boardSelected);
  if (!t) return '';
  const all = roadmapOf(p).sections.flatMap((s) => s.milestones);
  const opts = '<option value="">Unplanned</option>' + all.map((m) => '<option value="' + esc(m.id) + '"' + (m.id === t.milestoneId ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('');
  const mk = subtasksOf(st.projects, t.id).length && !(p.milestones || []).some((m) => m.parentTaskId === t.id)
    ? '<button type="button" class="btn ghost" data-action="rm-make" data-id="' + esc(t.id) + '">Make this a milestone</button>' : '';
  // the tools go inside the panel's own markup, so on a phone (where Task details fills the screen) they come with it
  const tools = '<div class="rm-detail-tools"><label>Milestone <select data-action="rm-set-milestone" data-id="' + esc(t.id) + '">' + opts + '</select></label>' + mk + '</div>';
  return '<div class="rm-detail">' + renderTaskDetails(st, ui, t.id).replace(/^<aside[^>]*>/, (open) => open + tools) + '</div>';
}

function projectView(st, ui, p, hasToken) {
  const r = roadmapOf(p);
  const secs = r.sections.map((s) => '<section class="rm-sec" data-section-id="' + esc(s.id) + '"' + (s.virtual ? '' : ' data-sec-index="' + (s.n - 1) + '"') + ' aria-label="' + esc(s.name) + '">'
    + '<h3 class="rm-sec-h">' + (s.virtual ? '' : grip('sec', s.id, s.name, 'Alt plus up or down arrow')) + '<span class="rm-sec-name">' + (s.virtual ? '' : s.n + ' · ') + esc(s.name) + '</span>'
    + (s.virtual ? '' : '<span class="rm-moves">' + step('rm-sec-step', s.id, -1, s.name) + step('rm-sec-step', s.id, 1, s.name) + '</span>') + '</h3>'
    + s.milestones.map((m, j) => milestone(Object.assign({ sectionId: s.id, index: j }, m), p, ui, st, r)).join('') + '</section>').join('');
  const un = r.unplanned ? '<section class="rm-sec rm-unplanned" data-section-id="' + UNPLANNED + '">' + milestone(r.unplanned, p, ui, st, r) + '</section>' : '';
  const form = (kind, ph) => '<form class="rm-add-form" data-action="rm-add-submit" data-kind="' + kind + '"><input type="text" name="name" maxlength="120" required autofocus placeholder="' + ph + '" aria-label="' + ph + '"><button type="submit" class="btn primary">Add</button><button type="button" class="btn-text" data-action="rm-add-cancel">Cancel</button></form>';
  const foot = ui.rmAdd && ui.rmAdd.kind === 'milestone' ? form('milestone', 'Milestone name') : ui.rmAdd && ui.rmAdd.kind === 'section' ? form('section', 'Section name')
    : '<p class="rm-foot"><button type="button" class="link-btn small" data-action="rm-add" data-kind="milestone">+ Add a milestone</button> · <button type="button" class="link-btn small" data-action="rm-add" data-kind="section">+ Add a section</button></p>';
  const editing = !!(ui.editingProject || {})[p.id];
  const sync = p.source === 'github' ? '<button type="button" class="btn ghost" data-action="sync-github">Sync now</button>' : '';
  return '<div class="rm-head"><h2 class="board-title rm-title"><span class="rm-dot" aria-hidden="true"></span>' + esc(p.name) + '</h2><div class="rm-tools">' + sync
    + '<button type="button" class="btn ghost" data-action="' + (editing ? 'close-project-edit' : 'open-project-edit') + '" data-project="' + esc(p.id) + '">Edit project</button></div></div>'
    + (editing ? renderProjectEditPanel(p, Object.assign({ pendingRemove: {} }, ui), st.projectCategories || [], hasToken) : '')
    + '<input type="search" class="project-search rm-find" data-action="set-task-query" value="' + esc(ui.taskQuery || '') + '" placeholder="Find a task…" aria-label="Find a task in this project">'
    + '<div class="rm-total"><span class="rm-big">' + r.pct + '%</span><span class="rm-total-sub">' + r.done + ' of ' + r.total + ' tasks done</span></div>' + segBar(r)
    + secs + un + foot + detail(st, ui, p);
}

// The Roadmap tab shows one project (#262); with none yet it offers New project, which is on the Projects tab.
export function renderRoadmap(st, ui, hasToken = false) {
  const view = ui.view || { mode: 'all' };
  const p = view.mode === 'project' && (st.projects || []).find((x) => x.id === view.id);
  return p ? '<div class="rm rm-project" style="--c:' + esc(p.color) + '">' + projectView(st, ui, p, hasToken) + '</div>' : '<div class="rm">' + noProject() + '</div>';
}
