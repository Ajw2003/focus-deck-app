// focus-deck-app/js/github-sync.js
import { state, uid, nextHue } from './state.js';
import { validateToken, listRepos, listIssues, ghFetch } from './github.js';
import { persist } from './sync.js';
import { parseChecklistItems, wordCount, estimateComplexity, tierFromScore } from './complexity.js';

function normLabel(s) { return String(s).toLowerCase().replace(/[\s_-]+/g, ''); }

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
  const labeled = issues.filter((iss) => iss.labels && iss.labels.length > 0);
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
    } else {
      project.tasks.push({ id: uid('t'), title: iss.title, energy: resolveIssueEnergy(iss), status: statusFromLabels(iss.labels), deadline: null, categoryId: null, source: 'github', issueNumber: iss.number, url: repo.html_url + '/issues/' + iss.number, updatedAt: Date.now() });
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

    state.githubSync = { user: username, lastSyncedAt: Date.now() };
    ui.syncing = false;
    ui.syncError = skipped.length ? ('Synced, but couldn’t reach: ' + skipped.join(', ') + '.') : null;
    persist();
  } catch (err) {
    ui.syncing = false;
    ui.syncError = err.message || 'Couldn’t sync GitHub.';
  }
}
