// focus-deck-app/js/view-switch.js
// The All | Area | Project switch shown at the top of every screen, one piece of per-device UI state
// (ui.view = { mode, id }). Pure: filters and markup only. See docs/4-systems/view-switch.md
import { esc } from './state.js';
import { areaIdOf, inView, UNSORTED_ID } from './areas.js';
export { inView };

export const VIEW_ALL = { mode: 'all', id: null };

export const areaList = (st) => {
  const a = (st.projectCategories || []).slice();
  if (!a.some((c) => c.id === UNSORTED_ID)) a.push({ id: UNSORTED_ID, name: 'Unsorted', color: 'hsl(215 10% 55%)' });
  return a;
};

// A stored or clicked view, made safe: a gone area or project, or junk, is All.
export function normalizeView(v, st) {
  if (v && v.mode === 'area' && areaList(st).some((c) => c.id === v.id)) return { mode: 'area', id: v.id };
  if (v && v.mode === 'project' && (st.projects || []).some((p) => p.id === v.id)) return { mode: 'project', id: v.id };
  return VIEW_ALL;
}

export const viewProjects = (st, view) => (st.projects || []).filter((p) => inView(st, view, p));
// The state with only the chosen projects in it: what Focus draws from. `_ui.view` is set by renderApp.
export const viewState = (st) => Object.assign({}, st, { projects: viewProjects(st, st._ui && st._ui.view) });

// The pick when the person taps Area or Project: the current one if it is already that mode.
export function defaultFor(mode, view, st) {
  if (mode === 'all') return VIEW_ALL;
  if (view.mode === mode) return view;
  if (mode === 'area') {
    const withProjects = areaList(st).find((c) => (st.projects || []).some((p) => areaIdOf(st, p) === c.id));
    return { mode, id: (withProjects || areaList(st)[0]).id };
  }
  const first = (st.projects || []).slice().sort((a, b) => a.name.localeCompare(b.name))[0];
  return first ? { mode, id: first.id } : VIEW_ALL;
}

export function viewLabel(st, view) {
  if (view.mode === 'area') return (areaList(st).find((c) => c.id === view.id) || {}).name || '';
  if (view.mode === 'project') return ((st.projects || []).find((p) => p.id === view.id) || {}).name || '';
  return '';
}

const item = (view, mode, id, name, color) => {
  const on = view.mode === mode && view.id === id;
  return '<li><button type="button" class="vs-item dk-choice' + (on ? ' on' : '') + '" data-action="view-pick" data-mode="' + mode + '" data-id="' + esc(id) + '" aria-pressed="' + on + '" data-name="' + esc(name.toLowerCase()) + '">'
    + '<span class="vs-dot" style="--c:' + esc(color) + '" aria-hidden="true"></span><span class="vs-name">' + esc(name) + '</span></button></li>';
};

function list(st, view) {
  if (view.mode === 'area') return '<ul class="vs-list">' + areaList(st).map((c) => item(view, 'area', c.id, c.name, c.color)).join('') + '</ul>';
  const projects = st.projects || [];
  const search = projects.length > 8 ? '<input type="search" class="vs-search" data-view-search placeholder="Search projects…" aria-label="Search projects">' : '';
  const groups = areaList(st).map((c) => ({ c, ps: projects.filter((p) => areaIdOf(st, p) === c.id).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.ps.length);
  return search + groups.map((g) => '<div class="vs-grp"><p class="vs-group">' + esc(g.c.name) + '</p><ul class="vs-list">' + g.ps.map((p) => item(view, 'project', p.id, p.name, p.color)).join('') + '</ul></div>').join('');
}

// The view tape (#262): one label-maker strip naming the view in caps, with a drawer (a bottom sheet) of index cards.
// open: false, 'menu' (Everything / One area / One project) or 'area' / 'project' (that list, with a back corner).
export function renderViewSwitch(st, view, open) {
  const name = view.mode === 'all' ? 'Everything' : viewLabel(st, view);
  const tape = '<button type="button" class="vs-tape dk-tape" data-action="view-open" aria-haspopup="dialog" aria-expanded="' + !!open + '" title="' + esc(name) + '"><span class="vs-pick-name">' + esc(name) + '</span> <span aria-hidden="true">▾</span></button>';
  const card = (action, extra, label, on) => '<button type="button" class="dk-choice' + (on ? ' on' : '') + '" data-action="' + action + '" ' + extra + ' aria-pressed="' + !!on + '">' + label + '</button>';
  const sub = open === 'area' || open === 'project';
  const title = sub ? (open === 'area' ? 'One area' : 'One project') : 'Show';
  const body = sub
    ? '<button type="button" class="dk-back" data-action="view-step" data-step="menu">‹ Back</button>' + list(st, view.mode === open ? view : { mode: open, id: null })
    : card('view-pick', 'data-mode="all" data-id=""', 'Everything', view.mode === 'all') + card('view-step', 'data-step="area"', 'One area ›', view.mode === 'area') + card('view-step', 'data-step="project"', 'One project ›', view.mode === 'project');
  const pop = open
    ? '<div class="vs-backdrop" data-action="view-close"></div><div class="vs-pop dk-sheet" role="dialog" aria-modal="true" aria-label="' + title + '" tabindex="-1">'
      + '<div class="vs-pop-head"><b>' + title + '</b><button type="button" class="vs-x" data-action="view-close" aria-label="Close">×</button></div>'
      + '<div class="vs-pop-body">' + body + '</div></div>'
    : '';
  return '<div class="vs-row">' + tape + pop + '</div>';
}
