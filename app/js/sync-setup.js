// focus-deck-app/js/sync-setup.js
// The guided GitHub sync setup (#125), one step per screen on setup.html: why, a GitHub account,
// the access key (what to choose on GitHub's page), paste it, check it (js/key-check.js names
// exactly what's missing), then sync on: the first device makes the sync Gist, a second device
// finds it and pulls its data in. The key only ever goes to api.github.com.
// See docs/4-systems/sync-setup.md
import { esc, state, setGistId } from './state.js';
import { getToken, setToken } from './github.js';
import { findSyncGist, pullFromGist, createSyncGist } from './sync.js';
import { checkKey } from './key-check.js';

export const STEPS = ['why', 'account', 'key', 'paste', 'check', 'on'];

// GitHub can pre-fill a new fine-grained key's form from the link (changelog 2025-08-26), but the
// parameter names were never confirmed against GitHub (see #125), so the step always lists what to
// choose as well: the link is a head start, never the only instruction.
export const TOKEN_PAGE = 'https://github.com/settings/personal-access-tokens/new?name=Focus%20Deck&description=Sync%20between%20devices&gists=write&issues=write';

const root = document.getElementById('setup');
const flow = { step: 'why', key: '', result: null, busy: false, outcome: null, error: null };

function request(path) {
  return fetch('https://api.github.com' + path, {
    headers: { Authorization: 'Bearer ' + flow.key.trim(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  }).then(async (resp) => ({ status: resp.status, headers: resp.headers, body: await resp.json().catch(() => null) }));
}

const btn = (action, label, kind = 'file-btn', extra = '') => '<button type="button" class="' + kind + '" data-step-action="' + action + '"' + extra + '>' + label + '</button>';
const back = (to) => btn('go:' + to, '← Back', 'btn-text');

// A drawing of the GitHub settings to choose, not a screenshot: GitHub's page changes, the choices don't.
function permissionsPicture() {
  const row = (label, value, note) => '<li class="gh-row"><span class="gh-label">' + label + (note ? '<span class="gh-note">' + note + '</span>' : '') + '</span><span class="gh-value">' + value + '</span></li>';
  return '<figure class="gh-picture" aria-label="What to choose on GitHub’s page">'
    + '<ul class="gh-form">'
      + row('Token name', 'Focus Deck')
      + row('Expiration', '1 year (or longer)', 'when it runs out, sync stops until you make a new one')
      + row('Repository access', 'All repositories', 'or “Only select repositories”, for issue sync on just those')
      + row('Account permissions → Gists', 'Read and write', 'needed: this is where your sync data lives')
      + row('Repository permissions → Issues', 'Read and write', 'optional: only for issue sync')
      + row('Repository permissions → Administration', 'Read and write', 'optional: only to make new repos from Focus Deck')
    + '</ul>'
    + '<figcaption class="muted small">Everything else stays as it is. Then <strong>Generate token</strong>, and copy the key it shows you (it starts github_pat_). GitHub shows it only once.</figcaption>'
    + '</figure>';
}

function progress() {
  const n = STEPS.indexOf(flow.step);
  return '<p class="ob-progress" aria-label="Step ' + (n + 1) + ' of ' + STEPS.length + '">' + STEPS.map((s, i) => '<span class="ob-dot' + (i <= n ? ' is-on' : '') + '"></span>').join('') + '</p>';
}

function findingsList(findings) {
  const mark = { ok: '✓', warn: '!', missing: '✗', error: '✗' };
  return '<ul class="key-findings">' + findings.map((f) => '<li class="key-finding is-' + f.level + '" data-finding="' + f.id + '"><span class="key-mark" aria-hidden="true">' + mark[f.level] + '</span><span>' + esc(f.text) + '</span></li>').join('') + '</ul>';
}

function screen() {
  switch (flow.step) {
    case 'why':
      return '<h2 class="ob-title">Your desk on every device</h2>'
        + '<p>Sync keeps your folders, tasks and settings the same on your phone, laptop and anything else you use. Add a task on one and it’s on the others.</p>'
        + '<p>It works through your own GitHub account, which is free. Your data is kept in a private file there that only you can see, and Focus Deck talks only to GitHub.</p>'
        + (getToken() ? '<p class="muted small">This device already has a key saved. Setting up again replaces it.</p>' : '')
        + '<div class="ob-acts">' + btn('go:account', 'Let’s do it') + '<a class="btn-text" href="index.html">Not now</a></div>';
    case 'account':
      return '<h2 class="ob-title">A GitHub account</h2>'
        + '<p>GitHub is a free site that stores files. You need an account to keep your sync data there.</p>'
        + '<div class="ob-acts setup-links"><a class="btn" href="https://github.com/signup" target="_blank" rel="noopener">Make an account ↗</a><a class="btn" href="https://github.com/login" target="_blank" rel="noopener">Sign in ↗</a></div>'
        + '<p class="muted small">They open in a new tab. Come back here when you’re signed in.</p>'
        + '<div class="ob-acts">' + btn('go:key', 'I’m signed in') + back('why') + '</div>';
    case 'key':
      return '<h2 class="ob-title">Your access key</h2>'
        + '<p>A key (GitHub calls it a token) is a password just for Focus Deck. It can only do what you allow it to, and you can delete it on GitHub any time.</p>'
        + '<div class="ob-acts setup-links"><a class="btn primary" id="token-page" href="' + TOKEN_PAGE + '" target="_blank" rel="noopener">Open GitHub’s key page ↗</a></div>'
        + '<p>GitHub may fill some of this in for you. Check each one anyway:</p>'
        + permissionsPicture()
        + '<div class="ob-acts">' + btn('go:paste', 'I’ve copied my key') + back('account') + '</div>';
    case 'paste':
      return '<h2 class="ob-title">Paste it in</h2>'
        + '<p>Paste the key you just copied. It stays in this browser and is only ever sent to GitHub.</p>'
        + '<form class="ob-form" id="paste-form"><label class="sr-only" for="key-input">Your GitHub key</label>'
        + '<input type="password" id="key-input" autocomplete="off" spellcheck="false" placeholder="github_pat_…" value="' + esc(flow.key) + '">'
        + '<div class="ob-acts"><button type="submit" class="file-btn">Check it</button>' + back('key') + '</div></form>';
    case 'check': {
      if (flow.busy) return '<h2 class="ob-title">Checking your key…</h2><p class="muted">Asking GitHub what this key can do.</p>';
      const r = flow.result;
      return '<h2 class="ob-title">' + (r.ok ? 'Your key works' : 'Almost: one thing to fix') + '</h2>'
        + findingsList(r.findings)
        + (r.ok
          ? '<div class="ob-acts">' + btn('turn-on', 'Turn on sync') + back('paste') + '</div>'
          : '<div class="ob-acts">' + btn('recheck', 'I’ve fixed it, check again') + btn('go:paste', 'Paste a different key', 'btn-text') + '</div>');
    }
    case 'on': {
      if (flow.busy) return '<h2 class="ob-title">Turning on sync…</h2><p class="muted">Looking for sync data from your other devices.</p>';
      if (flow.error) return '<h2 class="ob-title">Sync didn’t turn on</h2><p>' + esc(flow.error) + '</p><div class="ob-acts">' + btn('turn-on', 'Try again') + back('check') + '</div>';
      const found = flow.outcome === 'found';
      const already = flow.outcome === 'already';
      return '<h2 class="ob-title">Sync is on</h2>'
        + (already ? '<p>This device was already syncing. Its key is updated.</p>'
          : found ? '<p>Found the sync data from your other device and brought it in: ' + state.projects.length + (state.projects.length === 1 ? ' folder' : ' folders') + ' on this desk now.</p>'
            : '<p>Your desk is saved to your GitHub account and will stay up to date as you work.</p>')
        + '<p><strong>On your other phone or laptop:</strong> open Focus Deck, go to Settings → Set up sync, and paste the same key. Its data is found automatically.</p>'
        + '<div class="ob-acts"><a class="file-btn" href="index.html">Back to my desk</a></div>';
    }
    default: return '';
  }
}

function render() {
  root.innerHTML = '<section class="onboarding setup" data-step="' + flow.step + '">' + progress() + screen() + '</section>';
  const focusable = root.querySelector('#key-input') || root.querySelector('.ob-title');
  if (focusable && focusable.id === 'key-input') focusable.focus();
}

async function runCheck() {
  flow.step = 'check';
  flow.busy = true;
  render();
  flow.result = await checkKey(flow.key, request);
  flow.busy = false;
  // Saved only once it works, so a mistyped key never replaces a working one.
  if (flow.result.ok) setToken(flow.key);
  render();
}

async function turnOn() {
  flow.step = 'on';
  flow.busy = true;
  flow.error = null;
  render();
  try {
    if (state.gistId) {
      flow.outcome = 'already';
    } else {
      const existing = await findSyncGist();
      if (existing) { setGistId(existing); await pullFromGist(); flow.outcome = 'found'; }
      else { await createSyncGist(); flow.outcome = 'created'; }
    }
  } catch (e) {
    flow.error = 'GitHub said: ' + e.message + ' Nothing on this device was lost.';
  }
  flow.busy = false;
  render();
}

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-step-action]');
  if (!el || flow.busy) return;
  const action = el.getAttribute('data-step-action');
  if (action.startsWith('go:')) { flow.step = action.slice(3); render(); }
  else if (action === 'recheck') runCheck();
  else if (action === 'turn-on') turnOn();
});
root.addEventListener('submit', (e) => {
  if (e.target.id !== 'paste-form') return;
  e.preventDefault();
  flow.key = document.getElementById('key-input').value.trim();
  runCheck();
});

render();
