// focus-deck-app/js/github-sync.js
import { state, uid, nextHue, findTaskWithProject, cssColorToHex, PRIORITY, PRIORITY_ORDER } from './state.js';
import {
  validateToken, listRepos, listIssues, getIssue, createIssue, ghFetch,
  setIssueState, addLabelsToIssue, removeLabelFromIssue, ensureLabelExists,
} from './github.js';
import { persist } from './sync.js';
import { parseChecklistItems, wordCount, estimateComplexity, tierFromScore } from './complexity.js';

function normLabel(s) { return String(s).toLowerCase().replace(/[\s_-]+/g, ''); }

// Provenance labels — see docs/systems/claude-integration.md
export const CLAUDE_CREATED_LABEL = 'Claude created this';
export const CLAUDE_COMPLETED_LABEL = 'Claude completed this';

// Labels that mean a priority. The canonical "priority: <level>" labels are what Focus Deck writes;
// the others are common conventions it also reads. See docs/systems/github-sync.md#priority--priorityfromlabels-pushprioritytoissue-jsgithub-syncjs
const PRIORITY_ALIASES = {
  urgent: ['urgent', 'critical', 'blocker', 'p0'],
  high: ['highpriority', 'p1'],
  medium: ['mediumpriority', 'p2'],
  low: ['lowpriority', 'p3', 'p4'],
};
const canonicalPriorityForms = (level) => ['priority:' + level, 'priority' + level, 'priority/' + level];
const PRIORITY_LABEL_FORMS = PRIORITY_ORDER.flatMap((level) => canonicalPriorityForms(level).concat(PRIORITY_ALIASES[level]));

// Reserved so priority/status/provenance labels can't be mistaken for a category.
// See docs/systems/github-sync.md#labels-to-categories-priority-and-flags--applylabels-jsgithub-syncjs
const RESERVED_LABELS = PRIORITY_LABEL_FORMS.concat(['inprogress', 'wip', 'doing', normLabel(CLAUDE_CREATED_LABEL), normLabel(CLAUDE_COMPLETED_LABEL)]);

// The issue label that carries a task's priority. A canonical "priority: x" label wins over an alias;
// among several, the most urgent wins. Returns { priority, label } or null.
export function priorityFromLabels(labels) {
  const found = [];
  (labels || []).forEach((label) => {
    const n = normLabel(label);
    PRIORITY_ORDER.forEach((level, rank) => {
      if (canonicalPriorityForms(level).includes(n)) found.push({ priority: level, label, rank, canonical: 0 });
      else if (PRIORITY_ALIASES[level].includes(n)) found.push({ priority: level, label, rank, canonical: 1 });
    });
  });
  found.sort((a, b) => a.canonical - b.canonical || a.rank - b.rank);
  return found.length ? { priority: found[0].priority, label: found[0].label } : null;
}

// Finds or creates the category for each non-reserved label. A new one takes the label's GitHub colour.
function categoryIdsForLabels(labels, labelColors) {
  const ids = [];
  (labels || []).forEach((label) => {
    if (RESERVED_LABELS.includes(normLabel(label))) return;
    let cat = state.categories.find((c) => normLabel(c.name) === normLabel(label));
    if (!cat) {
      const hex = labelColors && labelColors[label];
      cat = { id: uid('cat'), name: label, color: hex ? '#' + hex : 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))' };
      state.categories.push(cat);
    }
    if (!ids.includes(cat.id)) ids.push(cat.id);
  });
  return ids;
}

// Mirrors an issue's labels onto its task: every category label, the priority, and the Claude flags.
// GitHub is the source of truth here, so a label removed there is removed here.
// Callers must set task.status BEFORE calling (claudeCompleted depends on it).
// See docs/systems/github-sync.md#labels-to-categories-priority-and-flags--applylabels-jsgithub-syncjs
export function applyLabels(task, labels, labelColors) {
  labels = labels || [];
  const norm = labels.map(normLabel);
  if (norm.includes(normLabel(CLAUDE_CREATED_LABEL))) task.claudeCreated = true; // sticky: never cleared here
  if (norm.includes(normLabel(CLAUDE_COMPLETED_LABEL)) && task.status === 'done') task.claudeCompleted = true;
  else delete task.claudeCompleted; // live: absent label or reopened task
  task.categoryIds = categoryIdsForLabels(labels, labelColors);
  const prio = priorityFromLabels(labels);
  task.priority = prio ? prio.priority : null;
  task.priorityLabel = prio ? prio.label : null;
}

function reportSyncError(msg) {
  if (state._ui) state._ui.syncError = msg;
  persist(); // re-triggers the registered paint so the error becomes visible
}

// Reopen cleanup: the completed label is "live", so once a task is no longer done, take it off the issue.
// See docs/systems/claude-integration.md
export async function dropStaleCompletedLabel(task, labels) {
  if (task.status === 'done') return;
  if (!(labels || []).some((l) => normLabel(l) === normLabel(CLAUDE_COMPLETED_LABEL))) return;
  const [owner, name] = task.repoFullName.split('/');
  try {
    await removeLabelFromIssue(owner, name, task.issueNumber, CLAUDE_COMPLETED_LABEL);
  } catch (e) {
    reportSyncError('Couldn’t clear the “' + CLAUDE_COMPLETED_LABEL + '” label: ' + e.message);
  }
}

// Newly-closed issues vanish from the open list, so their labels are never seen — fetch them once.
export async function refreshClosedTaskLabels(tasks) {
  for (const t of tasks) {
    try {
      const [owner, name] = t.repoFullName.split('/');
      const iss = await getIssue(owner, name, t.issueNumber);
      if (iss.state === 'closed') applyLabels(t, iss.labels, iss.labelColors);
    } catch (e) { /* best-effort: the chip just won't show */ }
  }
}

const isLinked = (task) => task.source === 'github' && task.repoFullName && task.issueNumber != null;

// Adds the labels for categories the task gained and removes those it lost; others are untouched.
// See docs/systems/github-sync.md#pushing-categories-back-to-github--pushcategoriestoissue-jsgithub-syncjs
export async function pushCategoriesToIssue(task, oldCategoryIds) {
  if (!isLinked(task)) return;
  const [owner, name] = task.repoFullName.split('/');
  const now = task.categoryIds || [];
  const before = oldCategoryIds || [];
  const byId = (id) => state.categories.find((c) => c.id === id);
  const added = now.filter((id) => !before.includes(id)).map(byId).filter(Boolean);
  const removed = before.filter((id) => !now.includes(id)).map(byId).filter(Boolean);
  try {
    for (const cat of added) await ensureLabelExists(owner, name, cat.name, cssColorToHex(cat.color));
    if (added.length) await addLabelsToIssue(owner, name, task.issueNumber, added.map((c) => c.name));
    for (const cat of removed) await removeLabelFromIssue(owner, name, task.issueNumber, cat.name);
  } catch (e) {
    reportSyncError('Couldn’t update the linked issue’s labels: ' + e.message);
  }
}

// Swaps the issue's priority label: removes the one it had (whatever its exact name) and adds the
// canonical "priority: <level>" label, or none. See docs/systems/github-sync.md#priority--priorityfromlabels-pushprioritytoissue-jsgithub-syncjs
export async function pushPriorityToIssue(task) {
  if (!isLinked(task)) return;
  const [owner, name] = task.repoFullName.split('/');
  const want = task.priority ? PRIORITY[task.priority] : null;
  const had = task.priorityLabel || null;
  try {
    if (want && had !== want.githubLabel) {
      await ensureLabelExists(owner, name, want.githubLabel, want.color);
      await addLabelsToIssue(owner, name, task.issueNumber, [want.githubLabel]);
    }
    if (had && (!want || had !== want.githubLabel)) await removeLabelFromIssue(owner, name, task.issueNumber, had);
    task.priorityLabel = want ? want.githubLabel : null;
    persist();
  } catch (e) {
    reportSyncError('Couldn’t update the linked issue’s priority: ' + e.message);
  }
}

// doc-ref fce6 docs/systems/github-sync.md
export async function pushCategoryColorToLinkedIssues(categoryId) {
  const cat = state.categories.find((c) => c.id === categoryId);
  if (!cat) return;
  const hex = cssColorToHex(cat.color);
  const repos = new Set();
  state.projects.forEach((p) => p.tasks.forEach((t) => {
    if (t.source === 'github' && (t.categoryIds || []).includes(categoryId) && t.repoFullName) repos.add(t.repoFullName);
  }));
  for (const repoFullName of repos) {
    const [owner, name] = repoFullName.split('/');
    try {
      await ensureLabelExists(owner, name, cat.name, hex);
    } catch (e) {
      reportSyncError('Couldn’t update the “' + cat.name + '” label color: ' + e.message);
    }
  }
}

// Fire-and-forget; no local rollback on failure. See
// docs/systems/github-sync.md#completion-sync--syncissuecompletion-jsgithub-syncjs90
export async function syncIssueCompletion(task) {
  if (task.source !== 'github' || !task.repoFullName || task.issueNumber == null) return;
  const [owner, name] = task.repoFullName.split('/');
  try {
    await setIssueState(owner, name, task.issueNumber, task.status === 'done' ? 'closed' : 'open');
    if (task.status !== 'done' && task.claudeCompleted) {
      delete task.claudeCompleted;
      await removeLabelFromIssue(owner, name, task.issueNumber, CLAUDE_COMPLETED_LABEL);
      persist();
    }
  } catch (e) {
    reportSyncError('Couldn’t update the linked issue: ' + e.message);
  }
}

export function parseIssueRefInput(input) {
  input = (input || '').trim();
  let m = input.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
  if (m) return { owner: m[1], name: m[2], number: Number(m[3]) };
  m = input.match(/^([^\/\s#]+)\/([^\/\s#]+)#(\d+)$/);
  if (m) return { owner: m[1], name: m[2], number: Number(m[3]) };
  return null;
}

function findTaskByIssue(repoFullName, number) {
  for (const p of state.projects) {
    const t = p.tasks.find((t) => t.source === 'github' && t.repoFullName === repoFullName && t.issueNumber === number);
    if (t) return t;
  }
  return null;
}

// See docs/systems/github-sync.md#linking-a-task-to-an-issue--linktasktoissue-jsgithub-syncjs123
export async function linkTaskToIssue(taskId, input, ui) {
  const found = findTaskWithProject(taskId);
  if (!found) return;
  const task = found.task;
  const ref = parseIssueRefInput(input);
  if (!ref) { ui.syncError = 'Enter it as "owner/repo#123" or a full github.com issue URL.'; return; }
  const repoFullName = ref.owner + '/' + ref.name;
  const already = findTaskByIssue(repoFullName, ref.number);
  if (already && already.id !== task.id) { ui.syncError = 'That issue is already linked to "' + already.title + '".'; return; }

  ui.syncing = true;
  ui.syncError = null;
  try {
    const iss = await getIssue(ref.owner, ref.name, ref.number);
    const categoryIdsBefore = (task.categoryIds || []).slice();
    const priorityBefore = task.priority || null;
    task.source = 'github';
    task.repoFullName = repoFullName;
    task.issueNumber = iss.number;
    task.url = iss.html_url;
    task.title = iss.title;
    task.status = iss.state === 'closed' ? 'done' : statusFromLabels(iss.labels);
    applyLabels(task, iss.labels, iss.labelColors);
    dropStaleCompletedLabel(task, iss.labels); // fire-and-forget
    const exIdx = state.excludedIssues.indexOf(repoFullName + '#' + iss.number);
    if (exIdx !== -1) state.excludedIssues.splice(exIdx, 1);
    ui.syncing = false;
    persist();
    if (!task.categoryIds.length && categoryIdsBefore.length) {
      // the issue had no category labels but the task did, so keep them and push them over (see doc link above)
      task.categoryIds = categoryIdsBefore;
      persist();
      pushCategoriesToIssue(task, []);
    }
    if (!task.priority && priorityBefore) {
      // same for priority: the issue had none, so the task's own priority goes over to it
      task.priority = priorityBefore;
      persist();
      pushPriorityToIssue(task);
    }
  } catch (e) {
    ui.syncing = false;
    ui.syncError = 'Could not link that issue: ' + e.message;
  }
}

// See docs/systems/github-sync.md#unlinking-a-task--unlinktask-jsgithub-syncjs161
export function unlinkTask(taskId) {
  const found = findTaskWithProject(taskId);
  if (!found) return;
  const task = found.task;
  if (task.source !== 'github' || !task.repoFullName || task.issueNumber == null) return;
  const key = task.repoFullName + '#' + task.issueNumber;
  if (!state.excludedIssues.includes(key)) state.excludedIssues.push(key);
  task.source = 'manual';
  delete task.repoFullName;
  delete task.issueNumber;
  delete task.url;
  delete task.priorityLabel;
  persist();
}

// Case- and whitespace-insensitive, so "Fix login" and "fix  login " count as the same issue.
export function sameIssueTitle(a, b) {
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return norm(a) !== '' && norm(a) === norm(b);
}

// See docs/systems/github-sync.md#creating-an-issue-from-a-task--creategithubissuefromtask-jsgithub-syncjs176
export async function createGithubIssueFromTask(taskId, repoInput, ui) {
  const found = findTaskWithProject(taskId);
  if (!found) return;
  const task = found.task;
  if (task.source === 'github') { ui.syncError = 'This task is already linked to a GitHub issue — unlink it first.'; return; }
  const fullName = parseRepoInput(repoInput);
  if (!fullName) { ui.syncError = 'Enter it as "owner/repo" or a full github.com URL.'; return; }
  const [owner, name] = fullName.split('/');

  ui.syncing = true;
  ui.syncError = null;
  try {
    // Pull the repo's open issues first so an issue that already exists on GitHub gets linked,
    // not duplicated. See docs/systems/github-sync.md#creating-an-issue-from-a-task--creategithubissuefromtask-jsgithub-syncjs176
    const existing = (await listIssues(owner, name)).find((iss) => sameIssueTitle(iss.title, task.title));
    if (existing) {
      const linkedElsewhere = findTaskByIssue(fullName, existing.number);
      ui.syncing = false;
      if (linkedElsewhere && linkedElsewhere.id !== task.id) {
        ui.syncError = fullName + '#' + existing.number + ' already exists with this title and is linked to "' + linkedElsewhere.title + '", so no new issue was created.';
        return;
      }
      await linkTaskToIssue(taskId, fullName + '#' + existing.number, ui);
      if (!ui.syncError) ui.notice = fullName + '#' + existing.number + ' already exists with this title, so the task was linked to it instead of creating a duplicate.';
      return;
    }

    const cats = (task.categoryIds || []).map((id) => state.categories.find((c) => c.id === id)).filter(Boolean);
    for (const cat of cats) await ensureLabelExists(owner, name, cat.name, cssColorToHex(cat.color));
    const prio = task.priority ? PRIORITY[task.priority] : null;
    if (prio) await ensureLabelExists(owner, name, prio.githubLabel, prio.color);
    const body = (task.steps && task.steps.length) ? task.steps.map((s) => '- [ ] ' + s).join('\n') : '';
    const iss = await createIssue(owner, name, task.title, body, cats.map((c) => c.name).concat(prio ? [prio.githubLabel] : []));
    task.priorityLabel = prio ? prio.githubLabel : null;
    task.source = 'github';
    task.repoFullName = fullName;
    task.issueNumber = iss.number;
    task.url = iss.html_url;
    ui.syncing = false;
    persist();
    if (task.status === 'done') await setIssueState(owner, name, iss.number, 'closed');
  } catch (e) {
    ui.syncing = false;
    ui.syncError = 'Could not create the issue: ' + e.message;
  }
}

export function energyFromLabels(labels) {
  const norm = (labels || []).map(normLabel);
  const HIGH = ['highpriority', 'critical', 'urgent', 'blocker', 'p0', 'p1'];
  const LOW = ['lowpriority', 'goodfirstissue', 'easy', 'documentation', 'docs', 'chore', 'typo', 'p3', 'p4'];
  if (norm.some((l) => HIGH.includes(l))) return 'high';
  if (norm.some((l) => LOW.includes(l))) return 'low';
  return 'medium';
}

export function resolveIssueEnergy(iss) {
  const labelEnergy = energyFromLabels(iss.labels);
  if (labelEnergy !== 'medium') return labelEnergy; // an explicit priority label always wins
  const body = iss.body || '';
  const text = [iss.title, body].filter(Boolean).join(' ');
  const score = estimateComplexity({
    stepCount: parseChecklistItems(body).length,
    text,
    wordCount: wordCount(body),
    labelCount: (iss.labels || []).length,
  });
  return tierFromScore(score);
}

export function statusFromLabels(labels) {
  const norm = (labels || []).map(normLabel);
  return norm.some((l) => ['inprogress', 'wip', 'doing'].includes(l)) ? 'doing' : 'next';
}

export function parseRepoInput(input) {
  input = input.trim();
  const urlMatch = input.match(/github\.com\/([^\/]+)\/([^\/\s]+?)(?:\.git|\/)?$/);
  if (urlMatch) return urlMatch[1] + '/' + urlMatch[2];
  if (/^[^\/\s]+\/[^\/\s]+$/.test(input)) return input;
  return null;
}

export async function addRepoManually(input, ui) {
  const fullName = parseRepoInput(input);
  if (!fullName) { ui.syncError = 'Enter it as "owner/repo" or a full github.com URL.'; return; }

  ui.syncing = true;
  ui.syncError = null;
  try {
    const [owner, name] = fullName.split('/');
    const repo = await ghFetch('/repos/' + owner + '/' + name);
    if (!state.pinnedRepos.includes(fullName)) state.pinnedRepos.push(fullName);
    const exIdx = state.excludedRepos.indexOf(fullName);
    if (exIdx !== -1) state.excludedRepos.splice(exIdx, 1); // re-adding un-excludes it
    const issues = await listIssues(owner, name);
    const closedNow = upsertRepoProject(repo, issues, ui);
    await refreshClosedTaskLabels(closedNow);
    ui.syncing = false;
    persist();
  } catch (e) {
    ui.syncing = false;
    ui.syncError = 'Could not add that repo: ' + e.message;
  }
}

// See docs/systems/github-sync.md#repo-sync--upsertrepoproject-jsgithub-syncjs
export function upsertRepoProject(repo, issues, ui) {
  const open = issues.filter((iss) => !state.excludedIssues.includes(repo.full_name + '#' + iss.number));
  // only labelled issues become new tasks; an issue already linked to a task counts however it's labelled
  const labeled = open.filter((iss) => iss.labels && iss.labels.length > 0);
  let project = state.projects.find((p) => p.source === 'github' && p.repoFullName === repo.full_name);
  if (!project && labeled.length === 0 && !state.pinnedRepos.includes(repo.full_name)) return [];

  if (!project) {
    project = { id: uid('gh'), name: repo.name, color: 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))', deadline: null, source: 'github', repoFullName: repo.full_name, htmlUrl: repo.html_url, private: !!repo.private, tasks: [] };
    state.projects.push(project);
  } else {
    project.htmlUrl = repo.html_url;
    project.private = !!repo.private;
  }
  project.lastSyncedAt = Date.now();

  const openNumbers = new Set(open.map((iss) => iss.number));
  const isThisRepos = (t) => t.source === 'github' && t.repoFullName === repo.full_name;
  const newlyClosed = [];
  project.tasks.forEach((t) => {
    if (isThisRepos(t) && t.status !== 'done' && !openNumbers.has(t.issueNumber)) {
      t.status = 'done';
      t.updatedAt = Date.now();
      newlyClosed.push(t);
      state.completedLog.unshift({ id: uid('log'), taskId: t.id, title: t.title, projectId: project.id, color: project.color, completedAt: Date.now() });
    }
  });

  open.forEach((iss) => {
    const existing = project.tasks.find((t) => isThisRepos(t) && t.issueNumber === iss.number);
    if (existing) {
      existing.title = iss.title;
      existing.url = repo.html_url + '/issues/' + iss.number;
      existing.repoFullName = repo.full_name;
      // it was marked done locally by an earlier sync (issue closed) but the issue is back in
      // the open set now, so it was reopened on GitHub — reflect that here too
      if (existing.status === 'done') existing.status = statusFromLabels(iss.labels);
      applyLabels(existing, iss.labels, iss.labelColors);
      dropStaleCompletedLabel(existing, iss.labels);
    } else if (iss.labels && iss.labels.length > 0) {
      const task = { id: uid('t'), title: iss.title, energy: resolveIssueEnergy(iss), status: statusFromLabels(iss.labels), deadline: null, categoryIds: [], source: 'github', repoFullName: repo.full_name, issueNumber: iss.number, url: repo.html_url + '/issues/' + iss.number, updatedAt: Date.now() };
      applyLabels(task, iss.labels, iss.labelColors);
      project.tasks.push(task);
    }
  });
  return newlyClosed;
}

export async function syncGithub(ui) {
  if (ui.syncing) return;
  ui.syncing = true;
  ui.syncError = null;

  try {
    const username = await validateToken();
    const repos = await listRepos();

    const byName = {};
    repos.forEach((r) => { if (!r.archived && r.open_issues_count > 0) byName[r.full_name] = r; });
    // pinned repos (Task 8's manual-add feature) and already-synced repos stay candidates
    // even if their open-issue count has since dropped to zero, so closes get reflected
    state.projects.forEach((p) => {
      if (p.source === 'github' && p.repoFullName && !byName[p.repoFullName]) {
        const found = repos.find((r) => r.full_name === p.repoFullName);
        if (found) byName[p.repoFullName] = found;
      }
    });
    state.pinnedRepos.forEach((fullName) => {
      if (!byName[fullName]) {
        const found = repos.find((r) => r.full_name === fullName);
        if (found) byName[fullName] = found;
      }
    });

    const candidates = Object.values(byName).filter((r) => !state.excludedRepos.includes(r.full_name)).slice(0, 20);
    const skipped = [];
    const closedNow = [];
    for (const repo of candidates) {
      try {
        const [owner, name] = repo.full_name.split('/');
        const issues = await listIssues(owner, name);
        closedNow.push(...upsertRepoProject(repo, issues, ui));
      } catch (e) {
        skipped.push(repo.name);
      }
    }

    // See docs/systems/github-sync.md#standalone-linked-tasks-reconciliation-pass--syncgithub-jsgithub-syncjs348-374
    const syncedRepos = new Set(candidates.map((r) => r.full_name));
    const linked = [];
    state.projects.forEach((p) => p.tasks.forEach((t) => {
      if (t.source === 'github' && t.repoFullName && !syncedRepos.has(t.repoFullName)) linked.push({ t, p });
    }));
    for (const { t, p } of linked) {
      try {
        const [owner, name] = t.repoFullName.split('/');
        const iss = await getIssue(owner, name, t.issueNumber);
        t.title = iss.title;
        t.url = iss.html_url;
        const wasDone = t.status === 'done';
        if (iss.state === 'closed' && !wasDone) {
          t.status = 'done';
          state.completedLog.unshift({ id: uid('log'), taskId: t.id, title: t.title, projectId: p.id, color: p.color, completedAt: Date.now() });
          state.completedLog = state.completedLog.slice(0, 12);
        } else if (iss.state === 'open' && wasDone) {
          t.status = statusFromLabels(iss.labels);
          state.completedLog = state.completedLog.filter((e) => e.taskId !== t.id);
        }
        applyLabels(t, iss.labels, iss.labelColors);
        dropStaleCompletedLabel(t, iss.labels);
      } catch (e) {
        skipped.push(t.repoFullName + '#' + t.issueNumber);
      }
    }

    await refreshClosedTaskLabels(closedNow);
    state.githubSync = { user: username, lastSyncedAt: Date.now() };
    ui.syncing = false;
    ui.syncError = skipped.length ? ('Synced, but couldn’t reach: ' + skipped.join(', ') + '.') : null;
    persist();
  } catch (err) {
    ui.syncing = false;
    ui.syncError = err.message || 'Couldn’t sync GitHub.';
  }
}
