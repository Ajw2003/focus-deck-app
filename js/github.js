const TOKEN_KEY = 'focusdeck-github-token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token) { localStorage.setItem(TOKEN_KEY, token.trim()); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

export class GithubError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function ghFetch(path, options = {}) {
  const token = getToken();
  if (!token) throw new GithubError('No GitHub token saved — add one in Settings.', 0);
  const resp = await fetch('https://api.github.com' + path, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (resp.status === 401) throw new GithubError('GitHub token is invalid or expired — update it in Settings.', 401);
  if (resp.status === 403) {
    const body = await resp.json().catch(() => ({}));
    if (body.message && /rate limit/i.test(body.message)) throw new GithubError('GitHub rate limit hit — try again in a few minutes.', 403);
    throw new GithubError('GitHub token is missing a required permission — check Settings for the scopes needed.', 403);
  }
  if (resp.status === 404) throw new GithubError('Not found on GitHub — check the repo/gist exists and your token can see it.', 404);
  if (!resp.ok) throw new GithubError('GitHub error (' + resp.status + ')', resp.status);
  return resp.status === 204 ? null : resp.json();
}

export async function validateToken() {
  const me = await ghFetch('/user');
  return me.login;
}

export async function listRepos() {
  return ghFetch('/user/repos?per_page=100&affiliation=owner&sort=updated');
}

export async function listIssues(owner, repo) {
  const raw = await ghFetch('/repos/' + owner + '/' + repo + '/issues?state=open&per_page=100');
  // the REST issues endpoint includes pull requests — exclude them (the MCP list_issues tool
  // used earlier in this project did this filtering internally; here it's explicit)
  return raw.filter((i) => !i.pull_request).map(mapIssue);
}

function mapIssue(i) {
  return {
    number: i.number,
    title: i.title,
    labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name)),
    // name -> GitHub's hex colour (no #), so a label first seen on GitHub keeps its colour here
    labelColors: Object.fromEntries(i.labels.filter((l) => typeof l !== 'string' && l.color).map((l) => [l.name, l.color])),
    body: i.body || '',
    state: i.state,
    html_url: i.html_url,
  };
}

export async function getIssue(owner, repo, number) {
  return mapIssue(await ghFetch('/repos/' + owner + '/' + repo + '/issues/' + number));
}

// Requires a token with "Issues: Read and write" — used to turn a Focus Deck task into a new
// GitHub issue.
export async function createIssue(owner, repo, title, body, labels) {
  return mapIssue(await ghFetch('/repos/' + owner + '/' + repo + '/issues', {
    method: 'POST',
    body: JSON.stringify({ title, body, labels: labels && labels.length ? labels : undefined }),
  }));
}

// Requires a token with "Issues: Read and write" — used for the task/issue linking feature.
export async function setIssueState(owner, repo, number, issueState) {
  return ghFetch('/repos/' + owner + '/' + repo + '/issues/' + number, {
    method: 'PATCH',
    body: JSON.stringify({ state: issueState }),
  });
}

export async function addLabelsToIssue(owner, repo, number, labels) {
  return ghFetch('/repos/' + owner + '/' + repo + '/issues/' + number + '/labels', {
    method: 'POST',
    body: JSON.stringify({ labels }),
  });
}

export async function removeLabelFromIssue(owner, repo, number, name) {
  return ghFetch('/repos/' + owner + '/' + repo + '/issues/' + number + '/labels/' + encodeURIComponent(name), { method: 'DELETE' })
    .catch((e) => { if (e.status !== 404) throw e; }); // already off the issue — fine
}

// doc-ref 0c0e docs/systems/github-sync.md
export async function ensureLabelExists(owner, repo, name, color) {
  const hex = color ? color.replace(/^#/, '').toLowerCase() : null;
  try {
    const existing = await ghFetch('/repos/' + owner + '/' + repo + '/labels/' + encodeURIComponent(name));
    if (hex && existing.color && existing.color.toLowerCase() !== hex) {
      await ghFetch('/repos/' + owner + '/' + repo + '/labels/' + encodeURIComponent(name), {
        method: 'PATCH',
        body: JSON.stringify({ color: hex }),
      }).catch(() => {}); // best-effort — a color mismatch is cosmetic, never block the label apply
    }
  } catch (e) {
    if (e.status === 404) {
      await ghFetch('/repos/' + owner + '/' + repo + '/labels', {
        method: 'POST',
        body: JSON.stringify({ name, color: hex || 'ededed' }),
      }).catch(() => {}); // best-effort; a 422 "already exists" race is harmless
    }
  }
}
