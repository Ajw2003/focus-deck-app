// focus-deck-app/js/render.js
import { state, esc, relTime, deadlineChip, shortName, ENERGY } from './state.js';

export function energyBtn(level, label, desc) {
  return '<button type="button" class="energy-btn" data-action="set-energy" data-energy="' + level + '" style="--chip-color:var(--energy-' + level + ')"><span class="energy-label">' + label + '</span><span class="energy-desc">' + desc + '</span></button>';
}

export function renderSyncStatus(st) {
  const note = (st.githubSync && st.githubSync.lastSyncedAt)
    ? 'Synced ' + relTime(st.githubSync.lastSyncedAt) + (st.githubSync.user ? (' · @' + esc(st.githubSync.user)) : '')
    : (st.gistId ? 'Pull in labeled issues from your GitHub repos' : 'Connect GitHub in Settings to sync across devices');
  const btnLabel = st._ui && st._ui.syncing ? 'Syncing…' : '🔄 Sync GitHub';
  let html = '<div class="sync-row">'
    + '<p class="sync-note">' + note + '</p>'
    + '<button type="button" class="link-btn small sync-btn" data-action="sync-github"' + (st._ui && st._ui.syncing ? ' disabled' : '') + '>' + btnLabel + '</button>'
    + (st.gistId ? '<button type="button" class="link-btn small" data-action="pull-now">⬇ Pull latest</button>' : '')
    + '</div>';
  if (st._ui && st._ui.syncError) html += '<p class="sync-error">' + esc(st._ui.syncError) + '</p>';
  return html;
}

export function renderStats(st) {
  const pills = st.projects.map((p) => {
    const doing = p.tasks.filter((t) => t.status === 'doing').length;
    const open = p.tasks.filter((t) => t.status !== 'done').length;
    const label = doing > 0 ? (doing + ' in progress') : (open > 0 ? (open + ' waiting') : 'all clear');
    return '<button type="button" class="stat-pill" data-action="scroll-project" data-project="' + p.id + '" style="--dot:' + p.color + '"><span class="dot"></span><span class="stat-name">' + esc(p.name) + '</span><span class="stat-val">' + label + '</span></button>';
  }).join('');
  return '<div class="stats-row">' + pills + '</div>';
}

export function renderFocus(st, findTaskWithProject) {
  if (!st.focus) {
    return '<section class="card focus-card focus-empty">'
      + '<h2 class="focus-q">What&rsquo;s your focus right now?</h2>'
      + '<p class="muted">Pick your bandwidth and I&rsquo;ll surface one task to work on.</p>'
      + '<div class="energy-grid">'
        + energyBtn('low', 'Low', 'Quick, low-stakes wins')
        + energyBtn('medium', 'Medium', 'Steady, doable progress')
        + energyBtn('high', 'High', 'Deep focus / creative work')
      + '</div>'
      + '<button type="button" class="link-btn" data-action="surprise">Surprise me instead</button>'
      + '</section>';
  }
  const found = findTaskWithProject(st.focus.taskId);
  if (!found) { state.focus = null; return renderFocus(st, findTaskWithProject); }
  const t = found.task, p = found.project;
  const energyLevel = st.focus.energy;
  const deadlineHTML = t.deadline ? deadlineChip(t.deadline) : '';
  const canReroll = st.focus.pool && st.focus.pool.length > 1;
  return '<section class="card focus-card focus-active">'
    + '<div class="focus-tags">'
      + '<span class="chip proj-chip" style="--chip-color:' + p.color + '">' + esc(p.name) + '</span>'
      + (energyLevel ? '<span class="chip energy-chip" style="--chip-color:var(--energy-' + energyLevel + ')">' + ENERGY[energyLevel].label + ' energy</span>' : '<span class="chip">Surprise pick</span>')
      + deadlineHTML
    + '</div>'
    + '<h2 class="focus-title">' + esc(t.title) + '</h2>'
    + '<div class="focus-actions">'
      + '<button type="button" class="btn primary" data-action="complete-focus">Done ✓</button>'
      + (canReroll ? '<button type="button" class="btn ghost" data-action="reroll">Not this one</button>' : '')
      + '<button type="button" class="btn ghost" data-action="clear-focus">Clear</button>'
    + '</div>'
    + '</section>';
}

export function renderDone(st) {
  if (!st.completedLog.length) return '';
  const chips = st.completedLog.slice(0, 8).map((entry) => {
    return '<div class="done-chip" style="--dot:' + entry.color + '"><span class="dot"></span><span class="done-title">' + esc(entry.title) + '</span><span class="done-time">' + relTime(entry.completedAt) + '</span></div>';
  }).join('');
  return '<section class="done-strip"><h3 class="section-label">Recently done</h3><div class="done-list">' + chips + '</div></section>';
}

export function renderInbox(st, ui) {
  const count = st.inbox.length;
  let items = '';
  if (ui.inboxOpen) {
    if (count === 0) {
      items = '<p class="muted small">Nothing waiting — capture a thought above and it lands here until you file it.</p>';
    } else {
      items = st.inbox.map((item) => {
        const chips = st.projects.map((p) => {
          return '<button type="button" class="mini-chip" data-action="file-inbox" data-inbox="' + item.id + '" data-project="' + p.id + '" style="--chip-color:' + p.color + '">' + esc(shortName(p.name)) + '</button>';
        }).join('');
        return '<div class="inbox-row">'
          + '<div class="inbox-text">' + esc(item.text) + '<span class="inbox-time">' + relTime(item.createdAt) + '</span></div>'
          + '<div class="inbox-actions">' + chips + '<button type="button" class="mini-x" data-action="discard-inbox" data-inbox="' + item.id + '" aria-label="Discard">×</button></div>'
          + '</div>';
      }).join('');
    }
  }
  return '<section class="card inbox-card">'
    + '<button type="button" class="section-toggle" data-action="toggle-inbox">📥 Unsorted <span class="count">' + count + '</span><span class="chev">' + (ui.inboxOpen ? '−' : '+') + '</span></button>'
    + (ui.inboxOpen ? '<div class="inbox-list">' + items + '</div>' : '')
    + '</section>';
}

export function renderTaskEditForm(t, p, categories) {
  const catOptions = categories.map((c) => '<option value="' + c.id + '"' + (t.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  const energyValue = t.energyAuto ? 'auto' : t.energy;
  return '<form class="task-edit-form" data-action="save-task-edit" data-task="' + t.id + '" data-project="' + p.id + '">'
    + '<input type="text" name="title" value="' + esc(t.title) + '" maxlength="140" required autofocus>'
    + '<textarea name="steps" placeholder="Steps (optional, one per line)…" rows="2">' + esc((t.steps || []).join('\n')) + '</textarea>'
    + '<select name="energy">'
      + '<option value="auto"' + (energyValue === 'auto' ? ' selected' : '') + '>Auto</option>'
      + ['low', 'medium', 'high'].map((lvl) => '<option value="' + lvl + '"' + (energyValue === lvl ? ' selected' : '') + '>' + ENERGY[lvl].label + '</option>').join('')
    + '</select>'
    + '<select name="category"><option value="">No category</option>' + catOptions + '<option value="__new__">+ Add new…</option></select>'
    + '<input type="date" name="deadline" value="' + (t.deadline || '') + '">'
    + '<button type="submit">Save</button>'
    + '<button type="button" data-action="cancel-task-edit">Cancel</button>'
    + '</form>';
}

export function renderTaskRow(t, p, categories, ui) {
  if (ui.editingTask && ui.editingTask.taskId === t.id) return renderTaskEditForm(t, p, categories);
  const isDone = t.status === 'done';
  const ghBadge = t.source === 'github'
    ? '<a class="chip gh-chip small" href="' + esc(t.url || '#') + '" target="_blank" rel="noopener">#' + (t.issueNumber != null ? t.issueNumber : '') + '</a>'
      + '<button type="button" class="link-btn small" data-action="unlink-github-issue" data-task="' + t.id + '" data-project="' + p.id + '" title="Unlink from this GitHub issue">Unlink</button>'
    : '<button type="button" class="link-btn small" data-action="link-github-issue" data-task="' + t.id + '" data-project="' + p.id + '" title="Link this task to a GitHub issue">🔗 Link</button>'
      + '<button type="button" class="link-btn small" data-action="create-github-issue" data-task="' + t.id + '" data-project="' + p.id + '" title="Create a new GitHub issue from this task">+ Issue</button>';
  const cat = categories.find((c) => c.id === t.categoryId);
  const catChip = cat ? '<span class="chip cat-chip small" data-cat-id="' + cat.id + '" data-cat-type="task" title="Right-click to change color" style="--chip-color:' + cat.color + '">' + esc(cat.name) + '</span>' : '';
  const claudeChips = (t.claudeCreated ? '<span class="chip claude-chip claude-created-chip small" title="Claude opened this issue">Claude created</span>' : '')
    + (t.claudeCompleted && isDone ? '<span class="chip claude-chip claude-completed-chip small" title="Claude closed this issue">Claude completed</span>' : '');
  return '<div class="task-row' + (isDone ? ' is-done' : '') + '" data-task="' + t.id + '" data-project="' + p.id + '">'
    + '<input type="checkbox" data-action="toggle-task" data-task="' + t.id + '" data-project="' + p.id + '"' + (isDone ? ' checked' : '') + '>'
    + '<span class="task-title" data-action="edit-task" data-task="' + t.id + '" data-project="' + p.id + '" role="button" tabindex="0">' + esc(t.title) + '</span>'
    + ghBadge + catChip + claudeChips
    + (t.deadline ? deadlineChip(t.deadline) : '')
    + '<button type="button" class="chip energy-chip small" data-action="cycle-energy" data-task="' + t.id + '" data-project="' + p.id + '" style="--chip-color:var(--energy-' + t.energy + ')"' + (isDone ? ' disabled' : '') + '>' + ENERGY[t.energy].label + '</button>'
    + (!isDone ? '<button type="button" class="link-btn small" data-action="focus-task" data-task="' + t.id + '" data-project="' + p.id + '">Focus →</button>' : '')
    + '<button type="button" class="mini-x" data-action="delete-task" data-task="' + t.id + '" data-project="' + p.id + '" aria-label="Delete task">×</button>'
    + '</div>';
}

export function renderProjectFilterBar(st, ui, visibleProjects) {
  if (!st.projects.length) return '';
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
  const sortOptions = [
    ['name', 'Name (A–Z)'], ['open-tasks', 'Most open tasks'], ['deadline', 'Closest deadline'], ['recent-sync', 'Recently synced'],
  ].map(([value, label]) => '<option value="' + value + '"' + (ui.projectSort === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  const allCollapsed = !!(visibleProjects && visibleProjects.length && visibleProjects.every((p) => ui.projectCollapsed[p.id]));
  const collapseAllBtn = visibleProjects && visibleProjects.length
    ? '<button type="button" class="btn-text small" data-action="toggle-collapse-all">' + (allCollapsed ? 'Expand all' : 'Collapse all') + '</button>'
    : '';
  return '<div class="project-filter-bar">'
    + '<div class="filter-pills">' + pillsHTML + '</div>'
    + '<input type="text" class="project-search" data-action="set-project-query" placeholder="Search projects…" value="' + esc(ui.projectQuery || '') + '">'
    + '<select class="project-sort-select" data-action="set-project-sort">' + sortOptions + '</select>'
    + collapseAllBtn
    + '</div>';
}

export function renderProjectCard(p, ui, categories, projectCategories) {
  const doing = p.tasks.filter((t) => t.status === 'doing');
  const next = p.tasks.filter((t) => t.status === 'next');
  const done = p.tasks.filter((t) => t.status === 'done');
  const total = p.tasks.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const doneOpen = !!ui.doneOpen[p.id];
  const pendingRemove = !!ui.pendingRemove[p.id];
  const collapsed = !!ui.projectCollapsed[p.id];
  const ghBadge = p.source === 'github' ? '<a class="chip gh-chip small" href="' + esc(p.htmlUrl || '#') + '" target="_blank" rel="noopener">' + (p.private ? '🔒 ' : '') + 'GitHub ↗</a>' : '';
  const projCat = projectCategories.find((c) => c.id === p.categoryId);
  const editingCat = ui.editingProjectCategory === p.id;
  const projCatOptions = projectCategories.map((c) => '<option value="' + c.id + '"' + (p.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  const projCatControl = editingCat
    ? '<span class="project-cat-edit"><select data-action="set-project-category" data-project="' + p.id + '"><option value="">No category</option>' + projCatOptions + '<option value="__new__">+ Add new…</option></select>'
      + '<button type="button" class="mini-x" data-action="cancel-edit-project-category" data-project="' + p.id + '" aria-label="Cancel category edit">×</button></span>'
    : (projCat
        ? '<button type="button" class="chip cat-chip small chip-btn" data-action="edit-project-category" data-project="' + p.id + '" data-cat-id="' + projCat.id + '" data-cat-type="project" title="Left-click to reassign, right-click to change color" style="--chip-color:' + projCat.color + '">' + esc(projCat.name) + '</button>'
        : '<button type="button" class="chip cat-chip small chip-btn chip-placeholder" data-action="edit-project-category" data-project="' + p.id + '">+ Category</button>');
  const collapseBtn = '<button type="button" class="btn-text collapse-toggle" data-action="toggle-project-collapse" data-project="' + p.id + '" aria-label="' + (collapsed ? 'Expand project' : 'Minimize project') + '">' + (collapsed ? '▸' : '▾') + '</button>';
  const rightControls = pendingRemove
    ? '<span class="remove-confirm">Remove' + (total ? (' &amp; ' + total + ' task' + (total === 1 ? '' : 's')) : '') + '? <button type="button" class="btn-text danger" data-action="confirm-remove-project" data-project="' + p.id + '">Yes</button><button type="button" class="btn-text" data-action="cancel-remove-project" data-project="' + p.id + '">No</button></span>'
    : '<button type="button" class="btn-text" data-action="remove-project" data-project="' + p.id + '">Remove</button>';
  return '<section class="card project-card' + (collapsed ? ' is-collapsed' : '') + '" id="proj-' + p.id + '" style="--proj-color:' + p.color + '">'
    + '<div class="project-head">'
      + '<div class="project-title"><span class="dot" data-project-color="' + p.id + '" title="Right-click to set a custom color"></span><h3>' + esc(p.name) + '</h3>' + ghBadge + projCatControl + '</div>'
      + '<div class="project-head-right">' + (p.deadline ? deadlineChip(p.deadline) : '') + collapseBtn + rightControls + '</div>'
    + '</div>'
    + '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
    + (collapsed ? '' : (
      (doing.length ? '<div class="task-group"><h4 class="group-label">In progress</h4>' + doing.map((t) => renderTaskRow(t, p, categories, ui)).join('') + '</div>' : '')
      + (next.length ? '<div class="task-group"><h4 class="group-label">Up next</h4>' + next.map((t) => renderTaskRow(t, p, categories, ui)).join('') + '</div>' : '')
      + (!doing.length && !next.length ? '<p class="muted small">Nothing open — add a task below.</p>' : '')
      + (done.length ? (
          '<button type="button" class="section-toggle small" data-action="toggle-done" data-project="' + p.id + '">' + (doneOpen ? '−' : '+') + ' ' + done.length + ' done</button>'
          + (doneOpen ? '<div class="task-group done-group">' + done.map((t) => renderTaskRow(t, p, categories, ui)).join('') + '</div>' : '')
        ) : '')
      + '<form class="add-task-form" data-action="add-task" data-project="' + p.id + '">'
        + '<input type="text" name="title" placeholder="Add a task…" maxlength="140" required>'
        + '<textarea name="steps" placeholder="Steps (optional, one per line)…" rows="2"></textarea>'
        + '<select name="energy">'
          + '<option value="auto" selected>Auto</option>'
          + '<option value="low">Low</option>'
          + '<option value="medium">Medium</option>'
          + '<option value="high">High</option>'
        + '</select>'
        + '<select name="category">'
          + '<option value="">No category</option>'
          + categories.map((c) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('')
          + '<option value="__new__">+ Add new…</option>'
        + '</select>'
        + '<input type="date" name="deadline">'
        + '<button type="submit" aria-label="Add task">+</button>'
      + '</form>'
    ))
    + '</section>';
}

export function renderAddProjectForm(projectCategories) {
  const catOptions = projectCategories.map((c) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
  return '<form class="add-project-form" data-action="add-project">'
    + '<input type="text" name="name" placeholder="New project name…" maxlength="60" required>'
    + '<select name="category"><option value="">No category</option>' + catOptions + '<option value="__new__">+ Add new…</option></select>'
    + '<button type="submit">+ Add project</button>'
    + '</form>'
    + '<form class="add-project-form" data-action="add-repo" style="margin-top:8px;">'
    + '<input type="text" name="repo" placeholder="owner/repo or a GitHub URL…" maxlength="200" required>'
    + '<button type="submit">+ Track repo</button>'
    + '</form>';
}
