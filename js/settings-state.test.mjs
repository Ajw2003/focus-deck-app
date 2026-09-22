// focus-deck-app/js/settings-state.test.mjs — run with: node js/settings-state.test.mjs
//
// Regression test for a stale-state bug found while investigating a user report of "credentials
// and Gist ID disappearing." The report itself turned out to be explained by Chrome's "Desktop
// site" mode (unrelated to app code), but auditing settings.html's Gist-sync scripts during that
// investigation turned up a real, separate bug: the "Create sync Gist" handler read state via
// `loadState()` once at page-load time instead of using the shared `state` singleton. Since
// `loadState()` re-parses localStorage into a brand-new object, that snapshot goes stale the
// moment anything else on the page (e.g. the category-color editor further down the same page)
// mutates the shared `state` singleton and persists — and clicking "Create sync Gist" would then
// silently overwrite localStorage with the stale snapshot, reverting those edits. See
// docs/systems/gist-sync.md and the "Uses the shared `state` singleton" comment already on the
// category-color script block in settings.html, which documents this exact trap.
//
// Static text analysis only, matching every other test in this repo (node:test + node:assert, no
// framework, no headless browser) — it doesn't execute settings.html, it checks that the
// "Create sync Gist" script block is wired to the live shared state, not a disconnected copy.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const html = fs.readFileSync(path.join(root, 'settings.html'), 'utf8');

// Pull out the <script type="module">...</script> block that wires up the "Create sync Gist"
// button (identified by its ghFetch('/gists' POST call, which is unique to this block).
const scriptBlocks = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const createGistBlock = scriptBlocks.find((b) => b.includes("ghFetch('/gists'"));

assert.ok(createGistBlock, 'could not find the "Create sync Gist" script block in settings.html at all');

assert.ok(
  /import\s*\{[^}]*\bstate\b[^}]*\}\s*from\s*['"]\.\/js\/state\.js['"]/.test(createGistBlock),
  'the "Create sync Gist" block must import the shared `state` singleton from js/state.js, not ' +
    'call loadState() to make its own disconnected copy -- a copy taken at page-load time goes ' +
    'stale the instant anything else on the Settings page (e.g. the category-color editor) ' +
    'mutates the real state and persists, and clicking "Create sync Gist" would silently revert ' +
    'those edits by saving the stale copy over them'
);

// Strip comments before checking for an actual loadState() call -- a comment explaining *why*
// the block avoids loadState() (as this fix adds) would otherwise trip a naive text match.
const withoutComments = createGistBlock
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

assert.ok(
  !/\bloadState\s*\(/.test(withoutComments),
  'the "Create sync Gist" block must not call loadState() -- it should read/write the shared ' +
    '`state` singleton imported from js/state.js instead, so it always sees the same live data ' +
    'every other script block on the page sees'
);

console.log('SETTINGS STATE TESTS PASSED');
