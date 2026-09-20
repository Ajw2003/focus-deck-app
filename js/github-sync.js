// focus-deck-app/js/github-sync.js
import { state, uid, nextHue, findTaskWithProject } from './state.js';
import {
  validateToken, listRepos, listIssues, getIssue, ghFetch,
  setIssueState, addLabelsToIssue, removeLabelFromIssue, ensureLabelExists,
} from './github.js';
import { persist } from './sync.js';
import { parseChecklistItems, wordCount, estimateComplexity, tierFromScore } from './complexity.js';

function normLabel(s) { return String(s).toLowerCase().replace(/[\s_-]+/g, ''); }

// Reserved so priority/status labels can't be mistaken for a category.
// See docs/systems/github-sync.md#category-resolution-from-labels--applycategoryfromlabels-jsgithub-syncjs20
const RESERVED_LABELS = ['highpriority', 'critical', 'urgent', 'blocker', 'p0', 'p1', 'lowpriority', 'goodfirstissue', 'easy', 'p3', 'p4', 'inprogress', 'wip', 'doing'];

// See docs/systems/github-sync.md#category-resolution-from-labels--applycategoryfromlabels-jsgithub-syncjs20
function applyCategoryFromLabels(task, labels) {
  labels = labels || [];
  if (!labels.length) return;
  let match = state.categories.find((c) => labels.some((l) => normLabel(l) === normLabel(c.name)));
  if (!match) {
    const candidate = labels.find((l) => !RESERVED_LABELS.includes(normLabel(l)));
    if (candidate) {
      match = { id: uid('cat'), name: candidate, color: 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))' };
      state.categories.push(match);
    }
  }
  if (match) task.categoryId = match.id;
}

function reportSyncError(msg) {
  if (state._ui) state._ui.syncError = msg;
  persist(); // re-triggers the registered paint so the error becomes visible
}

// See docs/systems/github-sync.md#pushing-a-category-back-to-github--pushcategorytoissue-jsgithub-syncjs42
export async function pushCategoryToIssue(task, oldCategoryId) {
  if (task.source !== 'github' || !task.repoFullName || task.issueNumber == null) return;
  const [owner, name] = task.repoFullName.split('/');
  const oldCat = state.categories.find((c) => c.id === oldCategoryId);
  const newCat = state.categories.find((c) => c.id === task.categoryId);
  try {
    if (newCat) {
      await ensureLabelExists(owner, name, newCat.name);
      await addLabelsToIssue(owner, name, task.issueNumber, [newCat.name]);
    }
    if (oldCat && (!newCat || oldCat.id !== newCat.id)) {
      await removeLabelFromIssue(owner, name, task.issueNumber, oldCat.name);
    }
  } catch (e) {
    reportSyncError('Couldn’t update the linked issue’s labels: ' + e.message);
  }
}

// Fire-and-forget; no local rollback on failure. See
// docs/systems/github-sync.md#completion-sync--syncissuecompletion-jsgithub-syncjs63
export async function syncIssueCompletion(task) {
  if (task.source !== 'github' || !task.repoFullName || task.issueNumber == null) return;
  const [owner, name] = task.repoFullName.split('/');
  try {
    await setIssueState(owner, name, task.issueNumber, task.status === 'done' ? 'closed' : 'open');
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

// See docs/systems/github-sync.md#linking-a-task-to-an-issue--linktasktoissue-jsgithub-syncjs94
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
    const categoryIdBefore = task.categoryId;
    task.source = 'github';
    task.repoFullName = repoFullName;
    task.issueNumber = iss.number;
    task.url = iss.html_url;
    task.title = iss.title;
    task.status = iss.state === 'closed' ? 'done' : statusFromLabels(iss.labels);
    applyCategoryFromLabels(task, iss.labels);
    const exIdx = state.excludedIssues.indexOf(repoFullName + '#' + iss.number);
    if (exIdx !== -1) state.excludedIssues.splice(exIdx, 1);
    ui.syncing = false;
    persist();
    if (categoryIdBefore && task.categoryId === categoryIdBefore) {
      // issue had no matching label; task already had a category, so push it over (see doc link above)
      pushCategoryToIssue(task, null);
    }
  } catch (e) {
    ui.syncing = false;
    ui.syncError = 'Could not link that issue: ' + e.message;
  }
}

// See docs/systems/github-sync.md#unlinking-a-task--unlinktask-jsgithub-syncjs133
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
  persist();
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
    upsertRepoProject(repo, issues, ui);
    ui.syncing = false;
    persist();
  } catch (e) {
    ui.syncing = false;
    ui.syncError = 'Could not add that repo: ' + e.message;
  }
}

function upsertRepoProject(repo, issues, ui) {
  const labeled = issues.filter((iss) => iss.labels && iss.labels.length > 0 && !state.excludedIssues.includes(repo.full_name + '#' + iss.number));
  let project = state.projects.find((p) => p.source === 'github' && p.repoFullName === repo.full_name);
  if (!project && labeled.length === 0 && !state.pinnedRepos.includes(repo.full_name)) return;

  if (!project) {
    project = { id: uid('gh'), name: repo.name, color: 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))', deadline: null, source: 'github', repoFullName: repo.full_name, htmlUrl: repo.html_url, private: !!repo.private, tasks: [] };
    state.projects.push(project);
  } else {
    project.htmlUrl = repo.html_url;
    project.private = !!repo.private;
  }
  project.lastSyncedAt = Date.now();

  const openNumbers = new Set(labeled.map((iss) => iss.number));
  project.tasks.forEach((t) => {
    if (t.source === 'github' && t.status !== 'done' && !openNumbers.has(t.issueNumber)) {
      t.status = 'done';
      t.updatedAt = Date.now();
      state.completedLog.unshift({ id: uid('log'), taskId: t.id, title: t.title, projectId: project.id, color: project.color, completedAt: Date.now() });
    }
  });

  labeled.forEach((iss) => {
    const existing = project.tasks.find((t) => t.source === 'github' && t.issueNumber === iss.number);
    if (existing) {
      existing.title = iss.title;
      existing.url = repo.html_url + '/issues/' + iss.number;
      existing.repoFullName = repo.full_name;
      // it was marked done locally by an earlier sync (issue closed) but the issue is back in
      // the open+labeled set now, so it was reopened on GitHub — reflect that here too
      if (existing.status === 'done') existing.status = statusFromLabels(iss.labels);
      applyCategoryFromLabels(existing, iss.labels);
    } else {
      const task = { id: uid('t'), title: iss.title, energy: resolveIssueEnergy(iss), status: statusFromLabels(iss.labels), deadline: null, categoryId: null, source: 'github', repoFullName: repo.full_name, issueNumber: iss.number, url: repo.html_url + '/issues/' + iss.number, updatedAt: Date.now() };
      applyCategoryFromLabels(task, iss.labels);
      project.tasks.push(task);
    }
  });
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
    for (const repo of candidates) {
      try {
        const [owner, name] = repo.full_name.split('/');
        const issues = await listIssues(owner, name);
        upsertRepoProject(repo, issues, ui);
      } catch (e) {
        skipped.push(repo.name);
      }
    }

    // See docs/systems/github-sync.md#standalone-linked-tasks-reconciliation-pass--syncgithub-jsgithub-syncjs284-311
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
        applyCategoryFromLabels(t, iss.labels);
      } catch (e) {
        skipped.push(t.repoFullName + '#' + t.issueNumber);
      }
    }

    state.githubSync = { user: username, lastSyncedAt: Date.now() };
    ui.syncing = false;
    ui.syncError = skipped.length ? ('Synced, but couldn’t reach: ' + skipped.join(', ') + '.') : null;
    persist();
  } catch (err) {
    ui.syncing = false;
    ui.syncError = err.message || 'Couldn’t sync GitHub.';
  }
}
