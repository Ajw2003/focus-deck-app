// focus-deck-app/js/projects-view.js -- the Projects tab (#267): the "Projects" clipboard (one card per project, a
// sort drawer, a My order screen with up/down keys) and New project in four steps (Name it, Which area?, Pick a
// colour, On GitHub?) with progress dots, a Back corner and a Next stamp. What a tap does is in js/app.js; the
// project data is roadmapOf (js/roadmap.js). It reuses the Sort steps' stamp / foot / dots / choice (js/sort-flow-view.js).
// See docs/4-systems/projects-tab.md
import { esc } from './state.js';
import { viewProjects } from './view-switch.js';
import { UNSORTED_ID } from './areas.js';
import { roadmapOf } from './roadmap.js';
import { filterAndSortProjects } from './project-filter.js';
import { parseRepoInput, isValidRepoName, REPO_NAME_RULE } from './github-sync.js';
import { stamp, foot, dots, choice, why } from './sort-flow-view.js';
import { board } from './tidy-view.js';

export const SORTS = [['name', 'A–Z'], ['open-tasks', 'Most tasks'], ['deadline', 'Due soonest'], ['recent-sync', 'Last synced'], ['custom', 'My order']];
export const COLOURS = [['#c9584f', 'Red'], ['#d98a12', 'Amber'], ['#2f7a4b', 'Green'], ['#3d5a80', 'Blue'], ['#8459c0', 'Purple'], ['#59627a', 'Slate']];
export const NEW_STEPS = 4;

const back = () => '<button type="button" class="dk-back" data-action="np-back">‹ Back</button>';
const field = (attr, value, ph) => '<input type="text" class="pj-field" ' + attr + ' value="' + esc(value) + '" maxlength="200" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '" autocomplete="off" spellcheck="false">';
const scroll = (inner) => '<div class="pj-scroll">' + inner + '</div>';

// ---- the list ---------------------------------------------------------------------------------------
function card(p) {
  return '<button type="button" class="pj-card" data-action="rm-open" data-project="' + esc(p.id) + '" style="--c:' + esc(p.color) + '"><h3 class="pj-name">📁 ' + esc(p.name) + '</h3>'
    + '<span class="pj-ruler" role="img" aria-label="' + roadmapOf(p).pct + '% done"><i style="width:' + roadmapOf(p).pct + '%"></i></span></button>';
}

function sortDrawer(ui) {
  const cur = ui.projectSort;
  return '<div class="vs-backdrop" data-action="proj-sort-menu"></div><div class="vs-pop dk-sheet sort-drawer" role="dialog" aria-modal="true" aria-label="Sort by" tabindex="-1">'
    + '<div class="vs-pop-head"><b>Sort by</b><button type="button" class="vs-x" data-action="proj-sort-menu" aria-label="Close">×</button></div>'
    + '<div class="vs-pop-body">' + SORTS.map(([v, label]) => choice(label, { action: 'set-project-sort', attrs: ' data-value="' + v + '"', on: cur === v, small: v === 'custom' ? '↑↓' : '' })).join('') + '</div></div>';
}

function list(st, ui) {
  const ps = filterAndSortProjects(viewProjects(st, ui.view), { query: ui.projectQuery, sortBy: ui.projectSort });
  const find = '<input type="search" class="sort-find project-search pj-find" data-action="set-project-query" value="' + esc(ui.projectQuery || '') + '" placeholder="Find a project…" aria-label="Find a project">';
  const body = find + scroll(ps.length ? ps.map(card).join('') : '<p class="muted">No projects here yet.</p>');
  return '<div class="pj">' + '<div class="dk-board sort-board"><div class="dk-paper sort-paper pj-paper">'
    + '<button type="button" class="slip-more pj-pull" data-action="proj-sort-menu" aria-haspopup="dialog" aria-expanded="' + !!ui.projSortOpen + '" aria-label="Sort by"></button>'
    + '<h2 class="sort-q">Projects</h2><div class="sort-body">' + body + '</div></div></div>'
    + foot([stamp('+ New project', { action: 'toggle-new-panel', attrs: ' id="new-panel-toggle"' })]) + '</div>' + (ui.projSortOpen ? sortDrawer(ui) : '');
}

// My order: every project with an up and a down key
function order(st, ui) {
  const ps = filterAndSortProjects(viewProjects(st, ui.view), { sortBy: 'custom' });
  const key = (p, d, off) => '<button type="button" class="tr-move pj-key" data-action="rm-project-step" data-project="' + esc(p.id) + '" data-dir="' + d + '"' + (off ? ' disabled' : '') + ' aria-label="Move ' + (d < 0 ? 'up' : 'down') + ': ' + esc(p.name) + '">' + (d < 0 ? '↑' : '↓') + '</button>';
  const rows = ps.map((p, i) => '<div class="dk-choice pj-row" data-project="' + esc(p.id) + '"><span>📁 ' + esc(p.name) + '</span><span class="tr-moves">' + key(p, -1, i === 0) + key(p, 1, i === ps.length - 1) + '</span></div>').join('');
  return '<div class="pj">' + board('My order', scroll(rows)) + foot([stamp('Done', { action: 'proj-order-done' })]) + '</div>';
}

// ---- New project -------------------------------------------------------------------------------------
function newFlow(st, ui, hasToken) {
  const np = ui.np, step = np.step;
  const wrap = (n, q, inner, footParts) => '<div class="pj pj-flow">' + dots(n, NEW_STEPS) + board(q, inner) + foot(footParts) + '</div>';
  const err = np.error ? why(np.error) : '';
  if (np.sub) {
    if (np.sub === 'mine') {
      const rs = ui.newPanelRepos || {}, q = (ui.newPanelRepoFilter || '').toLowerCase();
      let body = '<input type="text" class="sort-find repo-filter pj-find" data-action="set-repo-filter" value="' + esc(ui.newPanelRepoFilter || '') + '" placeholder="Find a repo…" aria-label="Find a repo">';
      if (rs.loading) body += '<p class="muted">Loading your repos…</p>';
      else if (rs.error) body += why(rs.error) + choice('Retry', { action: 'retry-new-panel-repos' });
      else body += scroll((rs.list || []).filter((r) => !q || r.full_name.toLowerCase().includes(q)).map((r) => choice(esc(r.full_name), { action: 'np-repo', attrs: ' data-repo="' + esc(r.full_name) + '"', on: np.repo === r.full_name, small: r.private ? 'Private' : '' })).join('') || '<p class="muted">No untracked repos.</p>');
      return wrap(4, 'Which repo?', body + err, [back(), stamp('Link it', { action: 'link-new-repo', disabled: !np.repo || np.busy })]);
    }
    if (np.sub === 'new') {
      const bad = np.repoName.trim() && !isValidRepoName(np.repoName.trim());
      const body = field('data-np-reponame', np.repoName, 'Repo name') + choice('🔒 Private', { action: 'np-private', attrs: ' data-value="1"', on: np.priv }) + choice('🌍 Public', { action: 'np-private', attrs: ' data-value="0"', on: !np.priv });
      return wrap(4, 'New repo', body + why(np.error || (bad ? 'Repo name: ' + REPO_NAME_RULE + '.' : '')), [back(), stamp('Create it', { action: 'create-repo', disabled: !isValidRepoName(np.repoName.trim()) || np.busy })]);
    }
    return wrap(4, 'Paste its link', field('data-np-link', np.link, 'github.com/…') + err, [back(), stamp('Track it', { action: 'track-repo', disabled: !parseRepoInput(np.link) || np.busy })]);
  }
  if (step === 1) return wrap(1, 'Name it', field('data-np-name', np.name, 'Name the project…'), [back(), stamp('Next', { action: 'np-next', disabled: !np.name.trim() })]);
  if (step === 2) {
    const areas = (st.projectCategories || []).filter((a) => a.id !== UNSORTED_ID);
    const body = scroll(areas.map((a) => choice(esc(a.name), { action: 'np-area', attrs: ' data-id="' + esc(a.id) + '"', on: np.areaId === a.id && !np.addArea, toggle: true })).join('')
      + choice('+ New area', { action: 'np-area-new', on: np.addArea, toggle: true }))
      + (np.addArea ? field('data-np-areaname', np.areaName, 'Name the area…') : '');
    return wrap(2, 'Which area?', body, [back(), stamp('Next', { action: 'np-next', disabled: np.addArea && !np.areaName.trim() })]);
  }
  if (step === 3) {
    const sw = COLOURS.map(([c, n]) => '<button type="button" class="pj-swatch' + (np.color === c ? ' on' : '') + '" style="--c:' + c + '" data-action="np-color" data-color="' + c + '" aria-pressed="' + (np.color === c) + '" aria-label="' + n + '"></button>').join('');
    return wrap(3, 'Pick a colour', '<div class="pj-swatches" role="group" aria-label="Colour">' + sw + '</div>', [back(), stamp('Next', { action: 'np-next' })]);
  }
  const gh = (label, mode) => choice(label, { action: 'np-gh', attrs: ' data-mode="' + mode + '"' + (hasToken ? '' : ' disabled'), on: np.gh === mode });
  const body = gh('No', 'no') + gh('🔗 My repo', 'mine') + gh('✨ New repo', 'new') + gh('👀 Someone else’s', 'other')
    + (hasToken ? '' : '<a class="dk-choice" href="settings.html"><span>Connect GitHub in Settings</span></a>');
  return wrap(4, 'On GitHub?', body + err, [back(), stamp('Make it', { action: 'add-new-project', disabled: np.busy })]);
}

// ---- the whole tab -----------------------------------------------------------------------------------
export function renderProjects(st, ui, hasToken = false) {
  if (ui.np) return newFlow(st, ui, hasToken);
  return ui.projOrder ? order(st, ui) : list(st, ui);
}

// the Roadmap tab with no project to show
export const noProject = () => '<div class="pj">' + board('Roadmap', '<p class="muted">No projects yet.</p>') + foot([stamp('+ New project', { action: 'toggle-new-panel' })]) + '</div>';
