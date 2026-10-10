// focus-deck-app/js/key-check.js
// Checks a pasted GitHub key (token) the moment it is pasted, and names exactly what is missing in
// words a person can act on, so sync never "just fails later". No DOM; the network goes through a
// `request(path)` function the caller passes in (js/sync-setup.js gives it a fetch to
// api.github.com; tests give it fixture responses). Tested in key-check.test.mjs.
// See docs/4-systems/sync-setup.md

// Fine-grained keys start github_pat_; classic ones ghp_ (other gh?_ prefixes are app/OAuth tokens).
export function looksLikeKey(text) {
  return /^(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})$/.test(String(text || '').trim());
}

const DAY = 86400000;
const EDIT_KEY = 'Open the key on GitHub (Settings → Developer settings → Fine-grained tokens), choose Edit, ';

// `request(path)` resolves { status, headers: { get(name) }, body } for a GET to api.github.com,
// and rejects when GitHub can't be reached. `now` is injectable for the expiry warning.
// Returns { ok, login, findings }: each finding is { id, level, text } with level
// 'ok' | 'warn' (works, but something optional is off) | 'missing' | 'error' (sync won't work).
export async function checkKey(token, request, now = Date.now()) {
  const findings = [];
  const add = (id, level, text) => findings.push({ id, level, text });
  const done = (login) => ({ ok: !findings.some((f) => f.level === 'missing' || f.level === 'error'), login: login || null, findings });

  if (!looksLikeKey(token)) {
    add('format', 'error', 'That doesn’t look like a GitHub key. A new one starts with github_pat_. Copy it again from GitHub, all of it.');
    return done();
  }

  let user;
  try { user = await request('/user'); }
  catch (e) {
    add('unreachable', 'error', 'Couldn’t reach GitHub to check the key. Check you’re online and try again.');
    return done();
  }
  if (user.status === 401) {
    add('rejected', 'error', 'GitHub doesn’t accept this key. It may have expired, been deleted, or lost a piece when it was copied. Make a new one (step 3) and paste that.');
    return done();
  }
  if (user.status !== 200) {
    add('unexpected', 'error', 'GitHub answered the check with an error (' + user.status + '). Try again in a minute.');
    return done();
  }
  const login = user.body && user.body.login;
  add('account', 'ok', 'Signed in as @' + login + '.');

  const expires = user.headers.get('github-authentication-token-expiration');
  if (expires) {
    const left = Math.floor((Date.parse(expires.replace(' UTC', 'Z').replace(' ', 'T')) - now) / DAY);
    if (left >= 0 && left <= 14) add('expiry', 'warn', 'This key expires in ' + (left === 0 ? 'less than a day' : left + (left === 1 ? ' day' : ' days')) + '. Sync stops then: make a longer-lasting one when you can.');
  }

  // A classic key lists what it may do in X-OAuth-Scopes; a fine-grained key has to be tried.
  const scopes = user.headers.get('x-oauth-scopes');
  const classic = scopes !== null && scopes !== undefined;
  const scopeList = classic ? scopes.split(',').map((s) => s.trim()) : [];

  let gistsOk;
  if (classic) gistsOk = scopeList.includes('gist');
  else {
    const gists = await request('/gists?per_page=1').catch(() => null);
    gistsOk = !!gists && gists.status === 200;
  }
  if (gistsOk) add('gists', 'ok', 'Can save your sync data (Gists).');
  else add('gists', 'missing', classic
    ? 'This key can’t save sync data, so tick “gist” on the key’s page on GitHub and update it. You don’t need a new key.'
    : 'This key can’t save sync data, so turn on Gists. ' + EDIT_KEY + 'set Account permissions → Gists to “Read and write”, and save. You don’t need a new key.');

  // Issue sync is optional: only a warning when it won't work.
  if (classic) {
    if (scopeList.includes('repo') || scopeList.includes('public_repo')) add('issues', 'ok', 'Can use your repositories’ issues (issue sync works).');
    else add('issues', 'warn', 'Issue sync is off: this key can’t use repositories. That’s fine if you only want sync between devices.');
    return done(login);
  }
  const repos = await request('/user/repos?per_page=1&sort=updated').catch(() => null);
  const repo = repos && repos.status === 200 && Array.isArray(repos.body) ? repos.body[0] : null;
  if (!repo) {
    add('issues', 'warn', 'Issue sync is off: this key can’t see any repositories. That’s fine if you only want sync between devices. To add it later, ' + EDIT_KEY.charAt(0).toLowerCase() + EDIT_KEY.slice(1) + 'and give it your repositories.');
    return done(login);
  }
  const issues = await request('/repos/' + repo.full_name + '/issues?per_page=1').catch(() => null);
  if (issues && issues.status === 200) add('issues', 'ok', 'Can use your repositories’ issues (issue sync works).');
  else add('issues', 'warn', 'Issue sync is off: this key can see your repositories but not their issues. That’s fine if you only want sync between devices. To add it, ' + EDIT_KEY.charAt(0).toLowerCase() + EDIT_KEY.slice(1) + 'set Repository permissions → Issues to “Read and write”, and save.');
  return done(login);
}
