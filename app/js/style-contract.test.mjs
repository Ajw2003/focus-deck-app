// focus-deck-app/js/style-contract.test.mjs — run with: node app/js/style-contract.test.mjs
//
// A regression test for GitHub issue #17: commit af88e6d replaced almost all of css/app.css with
// a different, smaller draft stylesheet while claiming a one-line fix, and nothing caught it
// because css/app.css had no automated test at all -- only the *shape* of the app (the .html /
// mutations.js / render.js) was under test, never its stylesheet. See docs/4-systems/styling.md.
//
// This file is deliberately dependency-free static text analysis, matching every other test in
// this repo (node:test + node:assert, no framework, no headless browser) -- it doesn't render
// anything, it just checks that the class names the app's own markup relies on are still backed
// by a rule in css/app.css, and that a hand-picked set of the most visually load-bearing rules
// still say what they're supposed to say. It cannot catch every possible visual regression (it
// has no idea what red looks like), but it is specifically shaped to catch the one that already
// happened once.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');

// Markup sources whose class="..." attributes are the app's real contract with the stylesheet.
const MARKUP_SOURCES = ['js/render.js', 'js/app.js', 'index.html', 'settings.html'];

// doc-ref f152 docs/4-systems/styling.md
const ALLOWED_WITHOUT_RULE = new Set([
  'cat-add-form',       // js hook only (settings.html form submit handler)
  'cat-remove-btn',     // js hook only (settings.html: e.target.matches('.cat-remove-btn'))
  'focus-card',   // modifier stacked on .card, which carries the styling
  'focus-active', // pure state marker read by app.js, never styled directly
]);

function extractClassTokens() {
  const tokens = new Set();
  for (const rel of MARKUP_SOURCES) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const re = /class="([a-zA-Z0-9 _-]+)"/g;
    let m;
    while ((m = re.exec(src))) {
      for (const tok of m[1].split(/\s+/)) if (tok) tokens.add(tok);
    }
  }
  return tokens;
}

function extractCssClassNames(cssText) {
  const names = new Set();
  const re = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let m;
  while ((m = re.exec(cssText))) names.add(m[1]);
  return names;
}

// --- Test 1: every class the app's markup uses is either styled or explicitly allowlisted as a
// hook. This is the general regression net: it would have caught .energy-btn, .energy-grid,
// .energy-label, .energy-desc, and .wrap all being deleted outright, since none of those are (or
// should ever need to be) in ALLOWED_WITHOUT_RULE.
const usedClasses = extractClassTokens();
const cssClasses = extractCssClassNames(css);
const unstyled = [...usedClasses].filter((c) => !cssClasses.has(c) && !ALLOWED_WITHOUT_RULE.has(c));
assert.deepStrictEqual(
  unstyled,
  [],
  'every class referenced in render.js/app.js/index.html/settings.html must have a matching ' +
    'css/app.css rule, or be added to ALLOWED_WITHOUT_RULE with a reason'
);

// Guard the guard: if this ever goes stale (a class gets removed from markup but stays
// allowlisted), that's worth noticing too, so the allowlist doesn't quietly grow unused entries.
const usedAllowed = [...ALLOWED_WITHOUT_RULE].filter((c) => usedClasses.has(c));
assert.deepStrictEqual(
  [...ALLOWED_WITHOUT_RULE].sort(),
  usedAllowed.sort(),
  'ALLOWED_WITHOUT_RULE has an entry for a class that is no longer used anywhere -- remove it'
);

// --- Test 2: hand-picked property-level invariants for rules that exist in both the broken and
// the fixed stylesheet, just with different content -- a "the selector exists" check alone can't
// catch this (af88e6d's replacement still had a .card rule, it just quietly dropped the border).
function ruleBody(selector) {
  // Matches "<selector>{...}" allowing the selector to also appear as part of a longer
  // comma/compound list (e.g. "h1,h2,h3,h4{...}" for the `h1` case below).
  const re = new RegExp(
    '(?:^|[,\\s}])' + selector.replace(/[.]/g, '\\.') + '(?:[,{])([^}]*)}',
    'm'
  );
  const m = css.match(re);
  return m ? m[1] : null;
}

const invariants = [
  ['h1', 'Fraunces', "headings must use the 'Fraunces' display serif font"],
  ['.wrap', 'max-width:760px', 'the page must stay constrained to .wrap\'s 760px max width'],
  ['.energy-btn', 'border-top:3px solid var\\(--chip-color\\)', 'focus-picker buttons must show their energy-level color as a top border'],
  ['.card', 'border:1px solid var\\(--line\\)', 'cards must keep a visible border, not just background+shadow'],
  ['.filter-pill', 'border-radius:999px', 'project/category filter pills must render as pills, not bare text'],
  // dragging projects (PR 9): these classes are added by js/project-drag.js (classList, so the
  // class="..." scan above can't see them) -- the drag feels wrong or breaks without these lines
  ['.drag-grip', 'touch-action:none', 'the grip must not let a touch scroll the page, or a touch drag never starts'],
  ['.drag-ghost', 'position:fixed', 'the lifted ghost must follow the pointer, not sit in the layout'],
  ['.drag-ghost', 'pointer-events:none', 'the ghost must not swallow the pointer it follows'],
  ['.drag-placeholder', 'dashed', 'the original\'s place must show as a dashed placeholder'],
  ['.drop-indicator', 'position:fixed', 'the drop indicator is positioned from measured rectangles'],
  // dragging tasks (PR 11)
  ['.task-grip', 'touch-action:none', 'the task grip must not let a touch scroll the page, or a touch drag never starts'],
  ['.task-group.is-empty', 'display:none', 'an empty group stays out of sight until a task is being dragged'],
  ['body.is-dragging-task .task-group.is-empty', 'display:block', 'while a task is dragged the empty groups show their drop zone'],
  ['.drop-zone', 'dashed', 'the empty-group drop zone reads as a dashed target'],
  ['.project-card.drop-target', 'outline', 'a minimised card that would take the drop must show it'],
  ['.move-dialog-backdrop', 'position:fixed', 'the move dialog covers the page'],
  ['.move-dialog', 'border-radius:var\\(--r-control\\)', 'the move dialog uses the control radius'],
];

// the classes js/project-drag.js and the grip markup rely on must each have a rule
for (const cls of ['drag-grip', 'drag-ghost', 'drag-placeholder', 'drop-indicator', 'sr-only', 'task-grip', 'drop-zone', 'drop-target', 'is-dragging-task', 'move-dialog']) {
  assert.ok(cssClasses.has(cls), `css/app.css has no rule for .${cls} (dragging projects and tasks, PR 9 and 11)`);
}

for (const [selector, expectedSubstring, why] of invariants) {
  const body = ruleBody(selector);
  assert.ok(body !== null, `no CSS rule found for ${selector} at all (${why})`);
  const re = new RegExp(expectedSubstring);
  assert.ok(re.test(body), `${selector} rule is missing "${expectedSubstring}" -- ${why}`);
}

console.log('STYLE CONTRACT TESTS PASSED');
