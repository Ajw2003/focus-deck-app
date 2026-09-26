// focus-deck-app/js/render.js
import { state, esc, relTime, deadlineChip, ENERGY, ENERGY_UI_ENABLED, PRIORITY, PRIORITY_ORDER, UNLABELLED, TASK_KINDS } from './state.js';

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
  return html;
}

// The one place errors and notices appear, on every page: pinned to the bottom of the viewport
// (see .toast) so it's seen wherever the page is scrolled. kind is 'error' or 'info'.
// See docs/systems/styling.md#how-it-works
export function renderToast(text, kind) {
  if (!text) return '';
  const isError = kind === 'error';
  return '<div class="toast' + (isError ? ' toast-error' : '') + '" role="' + (isError ? 'alert' : 'status') + '">'
    + '<p class="toast-text">' + esc(text) + '</p>'
    + '<button type="button" class="toast-close" data-action="dismiss-toast" aria-label="Dismiss">×</button>'
    + '</div>';
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

// The focus pick: one big card per label (task type), narrowed by project pills. One tap on a card
// picks a random open task from it. Cards reuse the old energy buttons' look (colour on the top
// edge). A Project mode (cards = projects) existed briefly and was removed on 2026-09-26.
// See docs/systems/styling.md#focus-picker
const FOCUS_CARDS_SHOWN = 6;
const FOCUS_PILLS_SHOWN = 6;
function renderFocusPicker(st, ui) {
  const f = (ui && ui.focusFilter) || {};
  // a remembered project that no longer exists counts as "All projects", which is what shows
  const projectId = st.projects.some((p) => p.id === f.projectId) ? f.projectId : null;
  if (!st.projects.some((p) => p.tasks.some((t) => t.status !== 'done'))) {
    return '<section class="card focus-card focus-empty">'
      + '<h2 class="focus-q">What&rsquo;s your focus right now?</h2>'
      + '<p class="muted">Nothing open yet &mdash; add a task to a project below and it can be picked from here.</p>'
      + '</section>';
  }
  const openWhere = (catId, projId) => {
    const out = [];
    st.projects.forEach((p) => {
      if (projId && p.id !== projId) return;
      p.tasks.forEach((t) => { if (t.status !== 'done' && (!catId || (t.categoryIds || []).includes(catId))) out.push({ t, p }); });
    });
    return out;
  };
  const labels = st.categories.map((c) => ({ id: c.id, name: c.name, color: c.color, matches: openWhere(c.id, projectId) }))
    .filter((x) => x.matches.length)
    .sort((a, b) => b.matches.length - a.matches.length || a.name.localeCompare(b.name));
  const showAllLabels = !!(ui && ui.focusShowAll);
  const shownLabels = showAllLabels ? labels : labels.slice(0, FOCUS_CARDS_SHOWN);
  const card = (item) => '<button type="button" class="energy-btn" data-action="pick-focus" data-category="' + item.id + '" data-project="' + (projectId || '') + '" style="--chip-color:' + item.color + '">'
    + '<span class="energy-label">' + esc(item.name) + '</span>'
    + '<span class="energy-desc">' + focusCardDetail(item.matches, !projectId) + '</span></button>';
  // "Surprise me" is a different kind of choice (no type at all), so it is its own element below
  // the cards rather than one more card: an accent button, set apart by space and a divider.
  // Tasks with no label get their own card (neutral colour, always shown), plus a way to sort them.
  const unlabelled = openWhere(null, projectId).filter(({ t }) => !(t.categoryIds || []).length);
  const unlabelledCard = unlabelled.length ? card({ id: UNLABELLED, name: 'Unlabelled', color: 'var(--ink-faint)', matches: unlabelled }) : '';
  const links = [];
  if (labels.length > FOCUS_CARDS_SHOWN) links.push('<button type="button" class="link-btn" data-action="toggle-focus-all">' + (showAllLabels ? 'Show fewer' : 'Show all ' + labels.length + ' labels') + '</button>');
  const surprise = '<div class="focus-surprise">'
    + '<button type="button" class="btn primary" data-action="pick-focus" data-category="" data-project="' + (projectId || '') + '">Surprise me</button>'
    + '<span class="muted small">' + focusCardDetail(openWhere(null, projectId), !projectId) + '</span>'
    + '</div>';

  // Project pills, tinted in each project's colour (.tint-pill), busiest first. Like the label cards,
  // only the busiest few show until "+N more"; the chosen one always shows.
  const projects = st.projects.map((p) => ({ id: p.id, name: p.name, color: p.color, n: openWhere(null, p.id).length }))
    .filter((x) => x.n || x.id === projectId)
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const showAllProjects = !!(ui && ui.focusShowAllProjects);
  const shownProjects = showAllProjects ? projects : projects.filter((x, i) => i < FOCUS_PILLS_SHOWN || x.id === projectId);
  const pill = (id, label, color) => '<button type="button" class="filter-pill' + (color ? ' tint-pill' : '') + ((id || null) === projectId ? ' active' : '') + '" data-action="set-focus-scope" data-scope="' + id + '"' + (color ? ' style="--chip-color:' + color + '"' : '') + '>' + esc(label) + '</button>';
  const hidden = projects.length - shownProjects.length;
  const morePill = projects.length > FOCUS_PILLS_SHOWN
    ? '<button type="button" class="filter-pill focus-more-pill" data-action="toggle-focus-projects">' + (showAllProjects ? 'Show fewer' : '+' + hidden + ' more') + '</button>'
    : '';
  const pills = projects.length > 1
    ? '<div class="filter-pills focus-scope">' + pill('', 'All projects') + shownProjects.map((x) => pill(x.id, x.name, x.color)).join('') + morePill + '</div>'
    : '';

  return '<section class="card focus-card focus-empty">'
    + '<h2 class="focus-q">What&rsquo;s your focus right now?</h2>'
    + '<p class="muted">Pick the kind of work and I&rsquo;ll surface one task.</p>'
    + pills
    + '<div class="energy-grid focus-grid">' + shownLabels.map(card).join('') + unlabelledCard + '</div>'
    + (links.length ? '<div class="focus-links">' + links.join('') + '</div>' : '')
    + surprise
    + '</section>';
}

// "3 open · 1 urgent · 2 projects": the count, the most pressing priority present, and (when not
// narrowed to one project) how many projects the tasks come from.
function focusCardDetail(matches, acrossProjects) {
  const parts = [matches.length + ' open'];
  const top = PRIORITY_ORDER.slice(0, 2).map((lvl) => ({ lvl, n: matches.filter(({ t }) => t.priority === lvl).length })).find(({ n }) => n > 0);
  if (top) parts.push(top.n + ' ' + PRIORITY[top.lvl].label.toLowerCase());
  const projects = new Set(matches.map(({ p }) => p.id)).size;
  if (acrossProjects && projects > 1) parts.push(projects + ' projects');
  return parts.join(' · ');
}

export function renderFocus(st, findTaskWithProject, ui) {
  if (!st.focus && !ENERGY_UI_ENABLED) return renderFocusPicker(st, ui);
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
  if (!found) { state.focus = null; return renderFocus(st, findTaskWithProject, ui); }
  const t = found.task, p = found.project;
  const energyLevel = st.focus.energy;
  const deadlineHTML = t.deadline ? deadlineChip(t.deadline) : '';
  const canReroll = st.focus.pool && st.focus.pool.length > 1;
  return '<section class="card focus-card focus-active">'
    + '<div class="focus-tags">'
      + '<button type="button" class="chip proj-chip" data-action="scroll-project" data-project="' + p.id + '" title="Go to ' + esc(p.name) + '" style="--chip-color:' + p.color + '">' + esc(p.name) + ' ↓</button>'
      + focusReasonChip(st.focus, energyLevel)
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

// Says why this task is showing: the label it was picked from, a random pick, or the old energy pick.
function focusReasonChip(focus, energyLevel) {
  if (focus.filter && focus.filter.categoryId === UNLABELLED) return '<span class="chip">Unlabelled</span>';
  const cat = focus.filter && focus.filter.categoryId && state.categories.find((c) => c.id === focus.filter.categoryId);
  if (cat) return '<span class="chip cat-chip" style="--chip-color:' + cat.color + '">' + esc(cat.name) + '</span>';
  if (energyLevel && ENERGY_UI_ENABLED) return '<span class="chip energy-chip" style="--chip-color:var(--energy-' + energyLevel + ')">' + ENERGY[energyLevel].label + ' energy</span>';
  return focus.pool ? '<span class="chip">Random pick</span>' : '';
}

export function renderDone(st) {
  if (!st.completedLog.length) return '';
  const chips = st.completedLog.slice(0, 8).map((entry) => {
    return '<div class="done-chip" style="--dot:' + entry.color + '"><span class="dot"></span><span class="done-title">' + esc(entry.title) + '</span><span class="done-time">' + relTime(entry.completedAt) + '</span></div>';
  }).join('');
  return '<section class="done-strip"><h3 class="section-label">Recently done</h3><div class="done-list">' + chips + '</div></section>';
}

// The Unsorted queue: captured thoughts (oldest first), then every open task with no labels, in
// project order then task order. Computed live off state every render, so a new capture or a task
// labelled elsewhere (or from another device) simply drops out or in on the next paint — nothing
// here is stored except which keys this session has skipped (ui.unsorted.skipped).
// See docs/systems/styling.md#unsorted
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

// The first queue item this session hasn't skipped, or null when everything left is skipped (or
// the queue is empty).
export function unsortedCurrent(st, u) {
  const queue = unsortedQueue(st);
  return queue.find((x) => !u.skipped.includes(x.key)) || null;
}

// Kind cards + ranked "other labels" pills, shared by a task's label step and a thought's (once its
// project is chosen). Ranking mirrors the old sort flow's: the given project's labels first
// (busiest first), then the rest by use across every project.
const UNSORTED_LABELS_SHOWN = 8;
function unsortedKindsAndLabels(st, project, u) {
  const kindCat = (k) => st.categories.find((c) => c.name.toLowerCase() === k.key);
  const kindIds = new Set(TASK_KINDS.map(kindCat).filter(Boolean).map((c) => c.id));
  const isOn = (token) => u.selected.includes(token);
  const kinds = TASK_KINDS.map((k) => {
    const cat = kindCat(k);
    const token = cat ? cat.id : 'kind:' + k.key;
    return '<button type="button" class="energy-btn' + (isOn(token) ? ' selected' : '') + '" data-action="sort-toggle" data-token="' + token + '" aria-pressed="' + isOn(token) + '" style="--chip-color:' + (cat ? cat.color : k.color) + '">'
      + '<span class="energy-label">' + k.label + '</span><span class="energy-desc">' + k.desc + '</span></button>';
  }).join('');
  const useIn = (tasks) => {
    const n = {};
    tasks.forEach((x) => (x.categoryIds || []).forEach((id) => { n[id] = (n[id] || 0) + 1; }));
    return n;
  };
  const here = useIn(project ? project.tasks : []);
  const everywhere = useIn(st.projects.flatMap((proj) => proj.tasks));
  const ranked = st.categories.filter((c) => !kindIds.has(c.id))
    .sort((a, b) => (here[b.id] || 0) - (here[a.id] || 0) || (everywhere[b.id] || 0) - (everywhere[a.id] || 0) || a.name.localeCompare(b.name));
  const shownOthers = u.showAllLabels ? ranked : ranked.filter((c, i) => i < UNSORTED_LABELS_SHOWN || isOn(c.id));
  const morePill = ranked.length > UNSORTED_LABELS_SHOWN
    ? '<button type="button" class="filter-pill focus-more-pill" data-action="sort-more-labels">' + (u.showAllLabels ? 'Show fewer' : '+' + (ranked.length - shownOthers.length) + ' more') + '</button>'
    : '';
  const others = shownOthers.map((c) => '<button type="button" class="filter-pill tint-pill' + (isOn(c.id) ? ' active' : '') + '" data-action="sort-toggle" data-token="' + c.id + '" aria-pressed="' + isOn(c.id) + '" style="--chip-color:' + c.color + '">' + esc(c.name) + '</button>').join('') + morePill;
  return '<p class="muted small sort-q">What kind of task is this?</p>'
    + '<div class="energy-grid focus-grid sort-kinds">' + kinds + '</div>'
    + (others ? '<p class="muted small sort-q">Other labels</p><div class="filter-pills sort-labels">' + others + '</div>' : '')
    + '<input type="text" class="sort-new" name="sortNewLabels" value="' + esc(u.newLabels || '') + '" placeholder="New labels, comma-separated…" maxlength="120">';
}

// A captured thought's project step: pills tinted in each project's colour, busiest (most open
// tasks) first, full names never shortened.
const UNSORTED_PROJECTS_SHOWN = 8;
function unsortedProjectPills(st, u) {
  const openCount = (p) => p.tasks.filter((t) => t.status !== 'done').length;
  const projects = st.projects.map((p) => ({ id: p.id, name: p.name, color: p.color, n: openCount(p) }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const showAll = !!u.showAllProjects;
  const shown = showAll ? projects : projects.slice(0, UNSORTED_PROJECTS_SHOWN);
  const pill = (p) => '<button type="button" class="filter-pill tint-pill" data-action="unsorted-project" data-project="' + p.id + '" style="--chip-color:' + p.color + '">' + esc(p.name) + '</button>';
  const morePill = projects.length > UNSORTED_PROJECTS_SHOWN
    ? '<button type="button" class="filter-pill focus-more-pill" data-action="unsorted-more-projects">' + (showAll ? 'Show fewer' : '+' + (projects.length - shown.length) + ' more') + '</button>'
    : '';
  return '<div class="filter-pills sort-labels">' + shown.map(pill).join('') + morePill + '</div>';
}

// The Unsorted card: one queue item at a time, guiding it to a project (thoughts only), then
// labels, then filed/saved — or completed, skipped or deleted outright. See
// docs/systems/styling.md#unsorted
export function renderInbox(st, ui) {
  const u = ui.unsorted;
  const queue = unsortedQueue(st);
  const count = queue.length;
  let body = '';
  if (ui.inboxOpen) {
    if (count === 0) {
      body = '<p class="muted small">Nothing to sort — capture a thought above and it lands here.</p>';
    } else {
      const remaining = queue.filter((x) => !u.skipped.includes(x.key));
      if (!remaining.length) {
        body = '<p class="muted small">' + u.skipped.length + ' skipped for now.</p>'
          + '<button type="button" class="link-btn" data-action="unsorted-restart">Go through them again</button>';
      } else {
        const cur = remaining[0];
        const position = '<span class="muted small">1 of ' + remaining.length + '</span>';
        if (cur.kind === 'thought') {
          const item = cur.item;
          const project = u.projectId ? st.projects.find((p) => p.id === u.projectId) : null;
          const head = '<div class="sort-head">' + position
            + '<span class="chip">Thought · ' + relTime(item.createdAt) + '</span>'
            + (project ? '<button type="button" class="chip proj-chip" data-action="unsorted-change-project" style="--chip-color:' + project.color + '">' + esc(project.name) + ' · change</button>' : '')
            + '<button type="button" class="btn-text unsorted-delete" data-action="unsorted-delete" data-inbox="' + item.id + '">Delete</button>'
            + '</div>';
          const title = '<h3 class="sort-title">' + esc(item.text) + '</h3>';
          const stepHtml = !project
            ? '<p class="muted small sort-q">Which project?</p>'
              + (st.projects.length ? unsortedProjectPills(st, u) : '<p class="muted small">Add a project below to file this thought into.</p>')
            : unsortedKindsAndLabels(st, project, u);
          const actions = '<div class="focus-actions">'
            + (project ? '<button type="button" class="btn primary" data-action="unsorted-file" data-inbox="' + item.id + '">File →</button>' : '')
            + '<button type="button" class="btn ghost" data-action="unsorted-complete" data-inbox="' + item.id + '">Done ✓</button>'
            + '<button type="button" class="btn ghost" data-action="unsorted-skip">Skip</button>'
            + '</div>';
          body = head + title + stepHtml + actions;
        } else {
          const t = cur.task, p = cur.project;
          const head = '<div class="sort-head">' + position
            + '<span class="chip proj-chip" style="--chip-color:' + p.color + '">' + esc(p.name) + '</span>'
            + (t.issueNumber != null ? '<span class="chip">#' + t.issueNumber + '</span>' : '')
            + '<button type="button" class="btn-text unsorted-delete" data-action="unsorted-delete" data-task="' + t.id + '" data-project="' + p.id + '">Delete</button>'
            + '</div>';
          const title = '<h3 class="sort-title">' + esc(t.title) + '</h3>';
          const stepHtml = unsortedKindsAndLabels(st, p, u);
          const actions = '<div class="focus-actions">'
            + '<button type="button" class="btn primary" data-action="unsorted-save" data-task="' + t.id + '" data-project="' + p.id + '">Save →</button>'
            + '<button type="button" class="btn ghost" data-action="unsorted-complete" data-task="' + t.id + '" data-project="' + p.id + '">Done ✓</button>'
            + '<button type="button" class="btn ghost" data-action="unsorted-skip">Skip</button>'
            + '</div>';
          body = head + title + stepHtml + actions;
        }
      }
    }
  }
  return '<section class="card inbox-card">'
    + '<button type="button" class="section-toggle" data-action="toggle-inbox">📥 Unsorted <span class="count">' + count + '</span><span class="chev">' + (ui.inboxOpen ? '−' : '+') + '</span></button>'
    + (ui.inboxOpen ? '<div class="unsorted-body">' + body + '</div>' : '')
    + '</section>';
}

// A task can carry several labels (categories), so both task forms pick them with checkboxes in a
// collapsible list, plus a field for new ones. The summary's count is kept current by app.js.
export function renderLabelPicker(categories, selectedIds) {
  const selected = selectedIds || [];
  const options = categories.map((c) => '<label class="label-option" style="--chip-color:' + c.color + '">'
    + '<input type="checkbox" name="categoryIds" value="' + c.id + '"' + (selected.includes(c.id) ? ' checked' : '') + '>'
    + '<span>' + esc(c.name) + '</span></label>').join('');
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
    + btn('link-github-issue', '🔗 Link to an existing issue', 'Link this task to an issue that already exists') + '</div>';
}

export function renderTaskEditForm(t, p, categories) {
  const energyValue = t.energyAuto ? 'auto' : t.energy;
  return '<form class="task-edit-form" data-action="save-task-edit" data-task="' + t.id + '" data-project="' + p.id + '">'
    + '<input type="text" name="title" value="' + esc(t.title) + '" maxlength="280" required autofocus>'
    + '<textarea name="steps" placeholder="Steps (optional, one per line)…" rows="2">' + esc((t.steps || []).join('\n')) + '</textarea>'
    + (ENERGY_UI_ENABLED ? '<select name="energy">'
      + '<option value="auto"' + (energyValue === 'auto' ? ' selected' : '') + '>Auto</option>'
      + ['low', 'medium', 'high'].map((lvl) => '<option value="' + lvl + '"' + (energyValue === lvl ? ' selected' : '') + '>' + ENERGY[lvl].label + '</option>').join('')
    + '</select>' : '')
    + renderPrioritySelect(t.priority)
    + '<input type="date" name="deadline" value="' + (t.deadline || '') + '">'
    + renderLabelPicker(categories, t.categoryIds)
    + renderTaskGithubLine(t, p)
    + '<button type="submit">Save</button>'
    + '<button type="button" data-action="cancel-task-edit">Cancel</button>'
    + '</form>';
}

export function renderTaskRow(t, p, categories, ui) {
  if (ui.editingTask && ui.editingTask.taskId === t.id) return renderTaskEditForm(t, p, categories);
  const isDone = t.status === 'done';
  // A task linked to an issue opens that issue from its title (see docs/systems/github-sync.md).
  const isLinked = t.source === 'github' && !!t.url;
  // Linking controls (Unlink, Link, + Issue) live in the edit form; the row only shows the issue
  // number. See docs/systems/github-sync.md#where-the-github-controls-live
  const ghBadge = t.source === 'github'
    ? '<a class="chip gh-chip small" href="' + esc(t.url || '#') + '" target="_blank" rel="noopener">#' + (t.issueNumber != null ? t.issueNumber : '') + '</a>'
    : '';
  const catChips = (t.categoryIds || []).map((id) => categories.find((c) => c.id === id)).filter(Boolean)
    .map((cat) => '<span class="chip cat-chip small" data-cat-id="' + cat.id + '" data-cat-type="task" title="Right-click to change color" style="--chip-color:' + cat.color + '">' + esc(cat.name) + '</span>').join('');
  const priorityChip = t.priority && PRIORITY[t.priority]
    ? '<button type="button" class="chip priority-chip small" data-action="cycle-priority" data-task="' + t.id + '" title="Priority — tap to change" style="--chip-color:var(--prio-' + t.priority + ')"' + (isDone ? ' disabled' : '') + '>' + PRIORITY[t.priority].label + '</button>'
    : (isDone ? '' : '<button type="button" class="chip priority-chip small chip-placeholder" data-action="cycle-priority" data-task="' + t.id + '" title="Set a priority">+ Priority</button>');
  const claudeChips = (t.claudeCreated ? '<span class="chip claude-chip claude-created-chip small" title="Claude opened this issue">Claude created</span>' : '')
    + (t.claudeCompleted && isDone ? '<span class="chip claude-chip claude-completed-chip small" title="Claude closed this issue">Claude completed</span>' : '');
  return '<div class="task-row' + (isDone ? ' is-done' : '') + '" data-task="' + t.id + '" data-project="' + p.id + '">'
    + '<input type="checkbox" data-action="toggle-task" data-task="' + t.id + '" data-project="' + p.id + '"' + (isDone ? ' checked' : '') + '>'
    + (isLinked
      ? '<a class="task-title" href="' + esc(t.url) + '" target="_blank" rel="noopener" title="Open the GitHub issue">' + esc(t.title) + '</a>'
      : '<span class="task-title" data-action="edit-task" data-task="' + t.id + '" data-project="' + p.id + '" role="button" tabindex="0">' + esc(t.title) + '</span>')
    + ghBadge
    + (isLinked ? '<button type="button" class="link-btn small" data-action="edit-task" data-task="' + t.id + '" data-project="' + p.id + '" title="Edit this task">Edit</button>' : '')
    + priorityChip + catChips + claudeChips
    + (t.deadline ? deadlineChip(t.deadline) : '')
    + (ENERGY_UI_ENABLED ? '<button type="button" class="chip energy-chip small" data-action="cycle-energy" data-task="' + t.id + '" data-project="' + p.id + '" style="--chip-color:var(--energy-' + t.energy + ')"' + (isDone ? ' disabled' : '') + '>' + ENERGY[t.energy].label + '</button>' : '')
    + (!isDone ? '<button type="button" class="link-btn small" data-action="focus-task" data-task="' + t.id + '" data-project="' + p.id + '">Focus →</button>' : '')
    + '<button type="button" class="mini-x" data-action="delete-task" data-task="' + t.id + '" data-project="' + p.id + '" aria-label="Delete task">×</button>'
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
    ['name', 'Name (A–Z)'], ['open-tasks', 'Most open tasks'], ['deadline', 'Closest deadline'], ['recent-sync', 'Recently synced'],
  ].map(([value, label]) => '<option value="' + value + '"' + (ui.projectSort === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  return '<select class="project-sort-select" data-action="set-project-sort" aria-label="Sort projects">' + sortOptions + '</select>';
}
function collapseAllButton(ui, visibleProjects) {
  const allCollapsed = !!(visibleProjects && visibleProjects.length && visibleProjects.every((p) => ui.projectCollapsed[p.id]));
  const collapseAllBtn = visibleProjects && visibleProjects.length
    ? '<button type="button" class="btn-text small" data-action="toggle-collapse-all">' + (allCollapsed ? 'Expand all' : 'Collapse all') + '</button>'
    : '';
  return collapseAllBtn;
}

export function renderProjectFilterBar(st, ui, visibleProjects) {
  if (!st.projects.length) return '';
  return '<div class="project-filter-bar">'
    + '<div class="filter-pills">' + projectFilterPills(st, ui) + '</div>'
    + '<input type="text" class="project-search" data-action="set-project-query" placeholder="Search projects…" value="' + esc(ui.projectQuery || '') + '">'
    + projectSortSelect(ui)
    + collapseAllButton(ui, visibleProjects)
    + '</div>';
}

// Wide screens only (CSS shows it from 1100px): a sticky column listing every project that matches the
// search and category, each jumping to its card. It replaces the filter bar and the project pills there.
// See docs/systems/styling.md#project-sidebar
export function renderProjectSidebar(st, ui, visibleProjects) {
  if (!st.projects.length) return '';
  const open = (p) => p.tasks.filter((t) => t.status !== 'done').length;
  const rows = visibleProjects.map((p) => '<li><button type="button" class="sidebar-project" data-action="scroll-project" data-project="' + p.id + '" style="--dot:' + p.color + '">'
    + '<span class="dot"></span><span class="sidebar-name">' + esc(p.name) + '</span><span class="sidebar-count" title="Open tasks">' + open(p) + '</span></button></li>').join('');
  return '<aside class="project-sidebar" aria-label="Projects">'
    + '<div class="sidebar-head"><h2 class="sidebar-title">Projects</h2><span class="muted small">' + visibleProjects.length + '</span></div>'
    + '<input type="text" class="project-search sidebar-search" data-action="set-project-query" placeholder="Search projects…" value="' + esc(ui.projectQuery || '') + '">'
    + '<div class="filter-pills sidebar-pills">' + projectFilterPills(st, ui) + '</div>'
    + '<div class="sidebar-tools">' + projectSortSelect(ui) + collapseAllButton(ui, visibleProjects) + '</div>'
    + '<ul class="sidebar-list">' + (rows || '<li class="muted small">No projects match.</li>') + '</ul>'
    + '</aside>';
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
        + '<input type="text" name="title" placeholder="Add a task…" maxlength="280" required>'
        + '<textarea name="steps" placeholder="Steps (optional, one per line)…" rows="2"></textarea>'
        + (ENERGY_UI_ENABLED ? '<select name="energy">'
          + '<option value="auto" selected>Auto</option>'
          + '<option value="low">Low</option>'
          + '<option value="medium">Medium</option>'
          + '<option value="high">High</option>'
        + '</select>' : '')
        + renderPrioritySelect(null)
        + '<input type="date" name="deadline">'
        + renderLabelPicker(categories, [])
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
