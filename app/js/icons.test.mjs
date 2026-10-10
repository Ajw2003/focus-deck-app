// focus-deck-app/js/icons.test.mjs — run with: node --test app/js/icons.test.mjs
//
// The icons module is the app's one source of truth for its hand-drawn SVG line icons (Q19a).
// This is dependency-free static analysis, matching every other test in this repo: it doesn't
// render anything, it just checks each exported icon string is a well-formed, themeable SVG.
import test from 'node:test';
import assert from 'node:assert';
import * as icons from './icons.js';

const names = Object.keys(icons);

test('icons module exports at least the four icons the redesign needs', () => {
  for (const name of ['ICON_SYNC', 'ICON_SETTINGS', 'ICON_PROJECTS', 'ICON_COMPASS']) {
    assert.ok(names.includes(name), name + ' is missing from js/icons.js');
  }
});

test('every exported icon is a well-formed, hand-drawn-style inline SVG', () => {
  for (const name of names) {
    const svg = icons[name];
    assert.strictEqual(typeof svg, 'string', name + ' must be a string');
    assert.ok(/^<svg[\s>]/.test(svg.trim()), name + ' must start with <svg');
    assert.ok(svg.trim().endsWith('</svg>'), name + ' must end with </svg>');
    assert.ok(/viewBox="0 0 \d+ \d+"/.test(svg), name + ' must declare a viewBox');
    assert.ok(svg.includes('stroke="currentColor"'), name + ' must theme via stroke="currentColor"');
    assert.ok(svg.includes('fill="none"'), name + ' must be a line icon (fill="none")');
    assert.ok(svg.includes('aria-hidden="true"'), name + ' is decorative and must be aria-hidden');
    // no emoji ever sneaks into an icon string
    assert.ok(!/\p{Extended_Pictographic}/u.test(svg), name + ' must not contain emoji');
  }
});
