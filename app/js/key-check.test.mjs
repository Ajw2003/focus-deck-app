// focus-deck-app/js/key-check.test.mjs -- run with: node --test app/js/key-check.test.mjs
// The pasted-key check (#125) against fixture GitHub responses. The fixtures follow GitHub's
// documented behaviour (401 "Bad credentials" for an expired or revoked key; 403 "Resource not
// accessible by personal access token" for a fine-grained key missing a permission; X-OAuth-Scopes
// on a classic key; github-authentication-token-expiration on a key with an expiry). They were not
// captured from live GitHub: this sandbox can't reach it. See docs/4-systems/sync-setup.md
import test from 'node:test';
import assert from 'node:assert';
import { checkKey, looksLikeKey } from './key-check.js';

const KEY = 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV';
const CLASSIC = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
const headers = (h = {}) => ({ get: (n) => (n.toLowerCase() in h ? h[n.toLowerCase()] : null) });
const res = (status, body, h) => ({ status, body, headers: headers(h) });
const denied = res(403, { message: 'Resource not accessible by personal access token', documentation_url: 'https://docs.github.com/rest' });

// A fake api.github.com: path -> response (a function for the order of calls to be checked).
function github(routes) {
  const calls = [];
  const request = async (path) => {
    calls.push(path);
    const key = Object.keys(routes).find((p) => path.startsWith(p));
    if (!key) throw new Error('unexpected request ' + path);
    const r = routes[key];
    if (r instanceof Error) throw r;
    return r;
  };
  return { request, calls };
}
const me = res(200, { login: 'aj' }, { 'github-authentication-token-expiration': '2027-10-10 12:00:00 UTC' });
const levels = (out) => Object.fromEntries(out.findings.map((f) => [f.id, f.level]));

test('a good fine-grained key: account, Gists and issues all ok', async () => {
  const gh = github({ '/user/repos': res(200, [{ full_name: 'aj/site' }]), '/user': me, '/gists': res(200, []), '/repos/aj/site/issues': res(200, []) });
  const out = await checkKey(KEY, gh.request, Date.parse('2026-10-10T00:00:00Z'));
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.login, 'aj');
  assert.deepStrictEqual(levels(out), { account: 'ok', gists: 'ok', issues: 'ok' });
});

test('missing Gists: not ok, and it says exactly what to turn on, without a new key', async () => {
  const gh = github({ '/user/repos': res(200, [{ full_name: 'aj/site' }]), '/user': me, '/gists': denied, '/repos/aj/site/issues': res(200, []) });
  const out = await checkKey(KEY, gh.request, Date.parse('2026-10-10T00:00:00Z'));
  assert.strictEqual(out.ok, false);
  const gists = out.findings.find((f) => f.id === 'gists');
  assert.strictEqual(gists.level, 'missing');
  assert.match(gists.text, /can’t save sync data, so turn on Gists/);
  assert.match(gists.text, /Gists to “Read and write”/);
  assert.match(gists.text, /don’t need a new key/);
});

test('missing Issues: still ok for sync, with a warning naming the permission', async () => {
  const gh = github({ '/user/repos': res(200, [{ full_name: 'aj/site' }]), '/user': me, '/gists': res(200, []), '/repos/aj/site/issues': denied });
  const out = await checkKey(KEY, gh.request, Date.parse('2026-10-10T00:00:00Z'));
  assert.strictEqual(out.ok, true);
  const issues = out.findings.find((f) => f.id === 'issues');
  assert.strictEqual(issues.level, 'warn');
  assert.match(issues.text, /Issues to “Read and write”/);
});

test('no repositories at all: sync is fine, issue sync is off and says so', async () => {
  const gh = github({ '/user/repos': res(200, []), '/user': me, '/gists': res(200, []) });
  const out = await checkKey(KEY, gh.request, Date.parse('2026-10-10T00:00:00Z'));
  assert.strictEqual(out.ok, true);
  assert.match(out.findings.find((f) => f.id === 'issues').text, /can’t see any repositories/);
});

test('expired (or revoked) key: GitHub answers 401, and nothing else is tried', async () => {
  const gh = github({ '/user': res(401, { message: 'Bad credentials', documentation_url: 'https://docs.github.com/rest' }) });
  const out = await checkKey(KEY, gh.request);
  assert.strictEqual(out.ok, false);
  assert.deepStrictEqual(levels(out), { rejected: 'error' });
  assert.match(out.findings[0].text, /may have expired/);
  assert.deepStrictEqual(gh.calls, ['/user']);
});

test('the wrong thing pasted: caught before anything is sent to GitHub', async () => {
  for (const wrong of ['', 'hello', 'github_pat_short', 'https://github.com/settings/tokens', KEY.slice(0, 15)]) {
    const gh = github({});
    const out = await checkKey(wrong, gh.request);
    assert.strictEqual(out.ok, false, wrong);
    assert.strictEqual(out.findings[0].id, 'format');
    assert.deepStrictEqual(gh.calls, [], 'no request for ' + JSON.stringify(wrong));
  }
  assert.ok(looksLikeKey('  ' + KEY + '\n'), 'surrounding spaces from a copy are fine');
});

test('a key about to expire works, with a warning', async () => {
  const soon = res(200, { login: 'aj' }, { 'github-authentication-token-expiration': '2026-10-15 09:00:00 UTC' });
  const gh = github({ '/user/repos': res(200, []), '/user': soon, '/gists': res(200, []) });
  const out = await checkKey(KEY, gh.request, Date.parse('2026-10-10T08:00:00Z'));
  assert.strictEqual(out.ok, true);
  assert.match(out.findings.find((f) => f.id === 'expiry').text, /expires in 5 days/);
});

test('a classic key: read from its scopes, no extra requests', async () => {
  const noGist = github({ '/user': res(200, { login: 'aj' }, { 'x-oauth-scopes': 'repo, read:org' }) });
  const out = await checkKey(CLASSIC, noGist.request);
  assert.strictEqual(out.ok, false);
  assert.deepStrictEqual(levels(out), { account: 'ok', gists: 'missing', issues: 'ok' });
  assert.match(out.findings.find((f) => f.id === 'gists').text, /tick “gist”/);
  assert.deepStrictEqual(noGist.calls, ['/user']);
  const good = github({ '/user': res(200, { login: 'aj' }, { 'x-oauth-scopes': 'gist' }) });
  const ok = await checkKey(CLASSIC, good.request);
  assert.deepStrictEqual(levels(ok), { account: 'ok', gists: 'ok', issues: 'warn' });
});

test('GitHub unreachable: says so instead of blaming the key', async () => {
  const gh = github({ '/user': new TypeError('Failed to fetch') });
  const out = await checkKey(KEY, gh.request);
  assert.deepStrictEqual(levels(out), { unreachable: 'error' });
});
