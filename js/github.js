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
    const err = new GithubError('GitHub token is missing a required permission — check Settings for the scopes needed.', 403);
    err.githubMessage = body.message || null;
    throw err;
  }
  if (resp.status === 404) throw new GithubError('Not found on GitHub — check the repo/gist exists and your token can see it.', 404);
  if (resp.status === 422) {
    const body = await resp.json().catch(() => ({}));
    const err = new GithubError(body.message || 'GitHub error (422)', 422);
    err.githubMessage = body.message || null;
    throw err;
  }
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

// Used by the "+ New" panel's "Your repos" tab (PR 7): every repo the token's user owns,
// collaborates on, or belongs to through an organisation -- not just ones they own outright, so a
// work repo someone was added to as a collaborator shows up too. Capped at the first 100 (one
// page); ghFetch doesn't expose response headers, so further pages (the `Link` header) aren't
// followed here.
export async function listYourRepos() {
  return ghFetch('/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=updated');
}

// Requires a token with "Administration: Read and write" (settings.html says so) -- used by the
// "+ New" panel's "Create a new repo" disclosure (Q31a, #39). auto_init:true so the repo isn't
// empty (an empty repo has no default branch, which trips up later API calls).
export async function createRepo(name, isPrivate, description) {
  return ghFetch('/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name, private: !!isPrivate, description: description || undefined, auto_init: true }),
  });
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
// stateReason (optional) is GitHub's close reason: 'completed' or 'not_planned'.
export async function setIssueState(owner, repo, number, issueState, stateReason) {
  return ghFetch('/repos/' + owner + '/' + repo + '/issues/' + number, {
    method: 'PATCH',
    body: JSON.stringify(stateReason ? { state: issueState, state_reason: stateReason } : { state: issueState }),
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

// doc-ref 0c0e docs/4-systems/github-sync.md
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

// Moving a linked task's issue to another repo of the same owner (PR 11) goes through GitHub's
// GraphQL `transferIssue` mutation -- REST has no transfer -- which needs the issue's and the target
// repo's node IDs, read from their REST objects. Requires a token that can write issues in both
// repos. GraphQL reports a refusal as HTTP 200 with an `errors` array, so that is turned into a
// GithubError here. See docs/4-systems/github-sync.md#moving-a-task-to-another-project.
export async function transferIssue(owner, repo, number, targetOwner, targetRepo) {
  const issue = await ghFetch('/repos/' + owner + '/' + repo + '/issues/' + number);
  const target = await ghFetch('/repos/' + targetOwner + '/' + targetRepo);
  const result = await ghFetch('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: 'mutation TransferIssue($issueId: ID!, $repositoryId: ID!) { transferIssue(input: {issueId: $issueId, repositoryId: $repositoryId}) { issue { number url } } }',
      variables: { issueId: issue.node_id, repositoryId: target.node_id },
    }),
  });
  if (result && Array.isArray(result.errors) && result.errors.length) {
    const err = new GithubError(result.errors.map((e) => e.message).filter(Boolean).join('; ') || 'GitHub refused the transfer.', 422);
    err.githubMessage = err.message;
    throw err;
  }
  const moved = result && result.data && result.data.transferIssue && result.data.transferIssue.issue;
  if (!moved) throw new GithubError('GitHub did not say where the issue went.', 422);
  return { number: moved.number, url: moved.url };
}
