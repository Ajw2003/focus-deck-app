// Code removed from app/js/render.js in step 11 (#259): the Projects screen's list, sidebar, cards and task groups.
// Kept for reference only; nothing imports this file.

// The project controls (category pills, sort, collapse all) are shared by the filter bar above the
// project cards and the wide-screen sidebar.
function projectFilterPills(st, ui) {
  const usedCategoryIds = new Set(st.projects.map((p) => p.categoryId).filter(Boolean));
  const hasUncategorized = st.projects.some((p) => !p.categoryId);
  const pills = [{ key: '', label: 'All' }]
    .concat(st.projectCategories.filter((c) => c.id !== UNSORTED_ID && usedCategoryIds.has(c.id)).map((c) => ({ key: c.id, label: c.name })))
    .concat(hasUncategorized ? [{ key: '__uncat__', label: 'Unsorted' }] : []);
  const activeKey = ui.projectFilter === undefined ? '' : (ui.projectFilter === null ? '__uncat__' : ui.projectFilter);
  const pillsHTML = pills.map((pill) => {
    const active = pill.key === activeKey;
    return '<button type="button" class="filter-pill' + (active ? ' active' : '') + '" data-action="set-project-filter" data-category="' + pill.key + '">' + esc(pill.label) + '</button>';
  }).join('');
  return pillsHTML;
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

// One of a project's two open-task groups. Both always render, so a task can be dropped into either
// (PR 11): an empty one stays hidden (CSS) until a task is being dragged, then shows a "Drop here"
// zone. Rows are in ascending sortOrder. See docs/4-systems/styling.md#dragging-tasks
function taskGroup(p, status, label, tasks, ui, categories, projects) {
  // a task whose parent is an open task in this group is drawn right after it (after earlier siblings)
  const sorted = sortTasks(tasks), ids = new Set(sorted.map((t) => t.id));
  const rows = sorted.filter((t) => !(t.parentId && ids.has(t.parentId))).map((t) => [t].concat(sorted.filter((c) => c.parentId === t.id))
    .map((r) => renderTaskRow(r, p, categories, ui, projects, r !== t)).join('')).join('');
  return '<div class="task-group' + (tasks.length ? '' : ' is-empty') + '" data-group="' + status + '" data-project="' + p.id + '">'
    + '<h4 class="group-label">' + label + '</h4>' + rows
    + (tasks.length ? '' : '<div class="drop-zone">Drop here</div>')
    + '</div>';
}


export function renderProjectCard(p, ui, categories, projectCategories, hasToken, projects = []) {
  const doing = p.tasks.filter((t) => t.status === 'doing');
  const review = p.tasks.filter((t) => t.status === 'review');
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
  const projCatChip = projCat ? '<span class="chip cat-chip small" data-cat-id="' + projCat.id + '" data-cat-type="project" title="Area. Right-click to change color" style="--chip-color:' + projCat.color + '">' + esc(projCat.name) + '</span>' : '';
  const editingPanel = !!ui.editingProject[p.id];
  // The minimise button is hidden in the "One" view along with "Collapse all" (collapseAllButton,
  // above) -- there's only ever one card on screen there.
  const collapseBtn = isOneView ? '' : '<button type="button" class="btn-text collapse-toggle" data-action="toggle-project-collapse" data-project="' + p.id + '" aria-label="' + (collapsed ? 'Expand project' : 'Minimise project') + '" aria-expanded="' + (!collapsed) + '">' + (collapsed ? '▸' : '▾') + '</button>';
  const editLink = '<button type="button" class="link-btn small" data-action="' + (editingPanel ? 'close-project-edit' : 'open-project-edit') + '" data-project="' + p.id + '">Edit</button>';
  // The drag grip (PR 9) shows in the "All" view only: in "One" the list in the sidebar/drawer is
  // the order, and there's a single card. A real button, so the arrow keys work on it too
  // (js/project-drag.js). See docs/4-systems/styling.md#dragging-projects
  const gripBtn = isOneView ? '' : '<button type="button" class="drag-grip" data-project="' + p.id + '" aria-label="Move ' + esc(p.name) + '" title="Drag to reorder, or use the arrow keys">' + ICON_GRIP + '</button>';
  const addTaskBlock = renderAddTaskRow(p, categories, !!ui.addingTask[p.id], (ui.addDraft || {})[p.id] || '', undefined, (ui.addPick || {})[p.id]);
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
    // The task groups, done group and the add row scroll inside a fixed-height tile at >=1100px
    // (Q26a, #82) instead of the whole tile growing; below that width this is just a plain block in
    // the page's own scroll. tabindex/role/aria-label keep the scroll region reachable by keyboard
    // and named for a screen reader. See docs/4-systems/styling.md.
    + (collapsed ? '' : (
      '<div class="project-body" tabindex="0" role="region" aria-label="' + esc(p.name) + ' tasks">'
      + taskGroup(p, 'doing', 'In progress', doing, ui, categories, projects)
      + taskGroup(p, 'review', 'Review', review, ui, categories, projects)
      + taskGroup(p, 'next', 'Up next', next, ui, categories, projects)
      + (!doing.length && !review.length && !next.length ? '<p class="muted small empty-note">Nothing open — add a task below.</p>' : '')
      + (done.length ? (
          '<button type="button" class="section-toggle small" data-action="toggle-done" data-project="' + p.id + '">' + (doneOpen ? '−' : '+') + ' ' + done.length + ' done</button>'
          + (doneOpen ? '<div class="task-group done-group">' + done.map((t) => renderTaskRow(t, p, categories, ui, projects)).join('') + '</div>' : '')
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
  // No projects at all is not a dead end (#124): say what goes here and offer the first one. The
  // sidebar (home of the "+ New" panel) isn't drawn until there is a project, so the panel opens here.
  if (!st.projects.length) {
    return '<div class="desk-empty projects-empty"><p><strong>No projects yet.</strong> A project holds one project&rsquo;s tasks: a subject, a room, a side project.</p>'
      + (ui.newPanelOpen ? renderNewPanel(ui, hasToken) : '<button type="button" class="btn primary" data-action="start-new-project">+ New project</button>') + '</div>';
  }
  const card = (p) => renderProjectCard(p, ui, st.categories, st.projectCategories, hasToken, st.projects);
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
