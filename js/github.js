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
  return raw.filter((i) => !i.pull_request).map((i) => ({
    number: i.number,
    title: i.title,
    labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name)),
    body: i.body || '',
  }));
}
