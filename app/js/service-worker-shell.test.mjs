// The app worker's install runs cache.addAll(SHELL_ASSETS), which rejects outright if one file 404s:
// the worker never installs and the app stops working offline. These tests catch that before a
// browser does: every listed file must exist, and every module the pages load must be listed.
// See docs/4-systems/pwa-shell.md#invariants
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, normalize, relative } from 'node:path';

const APP = fileURLToPath(new URL('..', import.meta.url));
const workerSource = readFileSync(join(APP, 'service-worker.js'), 'utf8');

function shellAssets() {
  const block = workerSource.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/);
  assert.ok(block, 'SHELL_ASSETS array not found in app/service-worker.js');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

// App-relative path of each module reachable by static import from a page's module scripts.
function reachableModules() {
  const seen = new Set();
  const visit = (file) => {
    const rel = relative(APP, file);
    if (seen.has(rel)) return;
    seen.add(rel);
    for (const m of readFileSync(file, 'utf8').matchAll(/^\s*import\s[^'"]*?['"](\.[^'"]+)['"]/gm)) {
      visit(normalize(join(dirname(file), m[1])));
    }
  };
  for (const page of ['index.html', 'settings.html', 'setup.html']) {
    const html = readFileSync(join(APP, page), 'utf8');
    for (const m of html.matchAll(/<script type="module" src="([^"]+)"/g)) visit(join(APP, m[1]));
    for (const m of html.matchAll(/import\s[^'"]*?['"](\.[^'"]+)['"]/g)) visit(normalize(join(APP, m[1])));
  }
  return [...seen];
}

// app/icons/ is not committed: the deploy job runs generate_icons.py before publishing
// (.github/workflows/deploy.yml), after this test job. So an icon counts as present when the
// generator writes it, and every other file must be on disk.
const generatedIcons = [...readFileSync(join(APP, '../generate_icons.py'), 'utf8').matchAll(/make_icon\('app\/(icons\/[^']+)'/g)]
  .map((m) => normalize(m[1]));

test('every file the app worker caches exists or is generated at deploy', () => {
  const missing = shellAssets().filter((p) => {
    if (p === './') return false;
    const rel = normalize(p);
    return rel.startsWith('icons/') ? !generatedIcons.includes(rel) : !existsSync(join(APP, rel));
  });
  assert.deepEqual(missing, [], 'listed in SHELL_ASSETS but neither on disk nor made by generate_icons.py');
});

test('every module the pages import is in SHELL_ASSETS', () => {
  const listed = new Set(shellAssets().map((p) => normalize(p)));
  const unlisted = reachableModules().filter((rel) => !listed.has(normalize(rel)));
  assert.deepEqual(unlisted, [], 'imported by the app but not cached for offline');
});
