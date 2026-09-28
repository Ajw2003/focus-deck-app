// focus-deck-app/js/render.js
import { state, esc, relTime, deadlineChip, formatLabelName, PRIORITY, PRIORITY_ORDER, UNLABELLED, TASK_KINDS } from './state.js';
import { ICON_SYNC } from './icons.js';

// A label (task category) colour, muted toward the app's palette rather than shown at its raw
// GitHub saturation (Q4b) — see docs/4-systems/styling.md#colour. Applied everywhere a label colour
// paints something except the project-identity uses of --proj-color, which stay full strength.
function mutedChip(color) { return 'color-mix(in oklab, ' + color + ' 65%, var(--ink-soft))'; }

// A project pill/chip, neutral (Q4b — a project's colour is identity only: its dot and its card
// edge), carrying a small colour dot before the name instead of a tint.
function projectDot(color) { return '<span class="proj-dot" style="--dot:' + color + '"></span>'; }

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

// The focus pick: one big card per label (task type), narrowed by project pills. One tap on a card
// picks a random open task from it. Cards reuse the old energy buttons' look (colour on the top
// edge). A Project mode (cards = projects) existed briefly and was removed on 2026-09-26.
// See docs/4-systems/styling.md#focus-picker
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
  const card = (item) => '<button type="button" class="energy-btn" data-action="pick-focus" data-category="' + item.id + '" data-project="' + (projectId || '') + '" style="--chip-color:' + mutedChip(item.color) + '">'
    + '<span class="energy-label">' + esc(formatLabelName(item.name)) + '</span>'
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
  const pill = (id, label, color) => '<button type="button" class="filter-pill' + ((id || null) === projectId ? ' active' : '') + '" data-action="set-focus-scope" data-scope="' + id + '">' + (color ? projectDot(color) : '') + esc(label) + '</button>';
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
  if (!st.focus) return renderFocusPicker(st, ui);
  const found = findTaskWithProject(st.focus.taskId);
  if (!found) { state.focus = null; return renderFocus(st, findTaskWithProject, ui); }
  const t = found.task, p = found.project;
  const deadlineHTML = t.deadline ? deadlineChip(t.deadline) : '';
  const canReroll = st.focus.pool && st.focus.pool.length > 1;
  return '<section class="card focus-card focus-active">'
    + '<div class="focus-tags">'
      + '<button type="button" class="chip proj-chip" data-action="scroll-project" data-project="' + p.id + '" title="Go to ' + esc(p.name) + '">' + projectDot(p.color) + esc(p.name) + ' ↓</button>'
      + focusReasonChip(st.focus)
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

// Says why this task is showing: the label it was picked from, or a random pick.
function focusReasonChip(focus) {
  if (focus.filter && focus.filter.categoryId === UNLABELLED) return '<span class="chip">Unlabelled</span>';
  const cat = focus.filter && focus.filter.categoryId && state.categories.find((c) => c.id === focus.filter.categoryId);
  if (cat) return '<span class="chip cat-chip" style="--chip-color:' + mutedChip(cat.color) + '">' + esc(formatLabelName(cat.name)) + '</span>';
  return focus.pool ? '<span class="chip">Random pick</span>' : '';
}

// The Unsorted queue: captured thoughts (oldest first), then every open task with no labels, in
// project order then task order. Computed live off state every render, so a new capture or a task
// labelled elsewhere (or from another device) simply drops out or in on the next paint — nothing
// here is stored except which keys this session has skipped (ui.unsorted.skipped).
// See docs/4-systems/styling.md#unsorted
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
    return '<button type="button" class="energy-btn' + (isOn(token) ? ' selected' : '') + '" data-action="sort-toggle" data-token="' + token + '" aria-pressed="' + isOn(token) + '" style="--chip-color:' + mutedChip(cat ? cat.color : k.color) + '">'
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
  const others = shownOthers.map((c) => '<button type="button" class="filter-pill tint-pill' + (isOn(c.id) ? ' active' : '') + '" data-action="sort-toggle" data-token="' + c.id + '" aria-pressed="' + isOn(c.id) + '" style="--chip-color:' + mutedChip(c.color) + '">' + esc(formatLabelName(c.name)) + '</button>').join('') + morePill;
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
  const pill = (p) => '<button type="button" class="filter-pill" data-action="unsorted-project" data-project="' + p.id + '">' + projectDot(p.color) + esc(p.name) + '</button>';
  const morePill = projects.length > UNSORTED_PROJECTS_SHOWN
    ? '<button type="button" class="filter-pill focus-more-pill" data-action="unsorted-more-projects">' + (showAll ? 'Show fewer' : '+' + (projects.length - shown.length) + ' more') + '</button>'
    : '';
  return '<div class="filter-pills sort-labels">' + shown.map(pill).join('') + morePill + '</div>';
}

// The Unsorted card: one queue item at a time, guiding it to a project (thoughts only), then
// labels, then filed/saved — or completed, skipped or deleted outright. See
// docs/4-systems/styling.md#unsorted
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
            + (project ? '<button type="button" class="chip proj-chip" data-action="unsorted-change-project">' + projectDot(project.color) + esc(project.name) + ' · change</button>' : '')
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
            + '<span class="chip proj-chip">' + projectDot(p.color) + esc(p.name) + '</span>'
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
    + '<button type="button" class="section-toggle" data-action="toggle-inbox">Unsorted <span class="count">' + count + '</span><span class="chev">' + (ui.inboxOpen ? '−' : '+') + '</span></button>'
    + (ui.inboxOpen ? '<div class="unsorted-body">' + body + '</div>' : '')
    + '</section>';
}

// A task can carry several labels (categories), so both task forms pick them with checkboxes in a
// collapsible list, plus a field for new ones. The summary's count is kept current by app.js.
export function renderLabelPicker(categories, selectedIds) {
  const selected = selectedIds || [];
  const options = categories.map((c) => '<label class="label-option" style="--chip-color:' + mutedChip(c.color) + '">'
    + '<input type="checkbox" name="categoryIds" value="' + c.id + '"' + (selected.includes(c.id) ? ' checked' : '') + '>'
    + '<span>' + esc(formatLabelName(c.name)) + '</span></label>').join('');
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

export function renderTaskRow(t, p, categories, ui) {
  if (ui.editingTask && ui.editingTask.taskId === t.id) return renderTaskEditForm(t, p, categories);
  const isDone = t.status === 'done';
  // Tapping the title always opens the editor now, linked or not (Q14a) -- the row itself carries
  // no GitHub badge, Edit link, Focus → or delete button any more; those moved into the editor's
  // own action row. See docs/4-systems/github-sync.md#where-the-github-controls-live
  const catChips = (t.categoryIds || []).map((id) => categories.find((c) => c.id === id)).filter(Boolean)
    .map((cat) => '<span class="chip cat-chip small" data-cat-id="' + cat.id + '" data-cat-type="task" title="' + esc(formatLabelName(cat.name)) + '" aria-label="' + esc(formatLabelName(cat.name)) + '" style="--chip-color:' + mutedChip(cat.color) + '">' + esc(formatLabelName(cat.name)) + '</span>').join('');
  const priorityChip = t.priority && PRIORITY[t.priority]
    ? '<button type="button" class="chip priority-chip small" data-action="cycle-priority" data-task="' + t.id + '" title="Priority — tap to change" style="--chip-color:var(--prio-' + t.priority + ')"' + (isDone ? ' disabled' : '') + '>' + PRIORITY[t.priority].label + '</button>'
    : '';
  return '<div class="task-row' + (isDone ? ' is-done' : '') + '" data-task="' + t.id + '" data-project="' + p.id + '" style="--chips-max:' + chipsMaxPct(t.title) + '%">'
    + '<input type="checkbox" data-action="toggle-task" data-task="' + t.id + '" data-project="' + p.id + '"' + (isDone ? ' checked' : '') + '>'
    // two zones beside the checkbox: the title in the left 75%, the chips right-anchored in the
    // right 25% (kept even when there are no chips, so the title never grows into it) -- #97, #92
    + '<span class="task-title" data-action="edit-task" data-task="' + t.id + '" data-project="' + p.id + '" role="button" tabindex="0">' + esc(t.title) + '</span>'
    + '<div class="task-chips">' + priorityChip + catChips
    + (t.deadline ? deadlineChip(t.deadline) : '')
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
    return '<li><button type="button" class="sidebar-project' + (isSelected ? ' is-selected' : '') + '" data-action="scroll-project" data-project="' + p.id + '" style="--dot:' + p.color + '"' + (isSelected ? ' aria-current="true"' : '') + '>'
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
  const removeControl = pendingRemove
    ? '<span class="remove-confirm">Remove' + (total ? (' &amp; ' + total + ' task' + (total === 1 ? '' : 's')) : '') + '? <button type="button" class="btn-text danger" data-action="confirm-remove-project" data-project="' + p.id + '">Yes</button><button type="button" class="btn-text" data-action="cancel-remove-project" data-project="' + p.id + '">No</button></span>'
    : '<button type="button" class="btn-text danger" data-action="remove-project" data-project="' + p.id + '">Remove project</button>';
  // A project already tracking a repo has nothing new here -- unlinking is out of scope (Q30c).
  const linkRow = (p.source !== 'github' && hasToken)
    ? '<button type="button" class="link-btn small" data-action="toggle-link-panel" data-project="' + p.id + '">Link to GitHub repo</button>' + renderLinkRepoPanel(p, ui)
    : '';
  return '<div class="project-edit-panel">' + catSelect + removeControl
    + '<button type="button" class="btn-text" data-action="close-project-edit" data-project="' + p.id + '">Done</button>' + linkRow + '</div>';
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
      + '<div class="project-title"><span class="dot" data-project-color="' + p.id + '" title="Right-click to set a custom color"></span><h3>' + esc(p.name) + '</h3></div>'
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
      + (doing.length ? '<div class="task-group"><h4 class="group-label">In progress</h4>' + doing.map((t) => renderTaskRow(t, p, categories, ui)).join('') + '</div>' : '')
      + (next.length ? '<div class="task-group"><h4 class="group-label">Up next</h4>' + next.map((t) => renderTaskRow(t, p, categories, ui)).join('') + '</div>' : '')
      + (!doing.length && !next.length ? '<p class="muted small">Nothing open — add a task below.</p>' : '')
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
