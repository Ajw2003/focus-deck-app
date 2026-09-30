#!/usr/bin/env node
// Checks the due-stage chip colours in css/app.css (#106): chip text on its tinted background must
// reach WCAG AA (4.5:1) in light and dark, and reports how far the stage tokens sit from the
// priority tokens they could be mistaken for. Run: node scripts/check-due-contrast.mjs
// Exits 1 on a failure. See docs/4-systems/due-dates.md and docs/4-systems/styling.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'css', 'app.css'), 'utf8');

// The three token blocks in css/app.css, in file order: light :root, the dark media query, and
// :root[data-theme="dark"] (the last two must agree; both are checked).
const starts = [...css.matchAll(/:root(?::not\(\[data-theme="light"\]\))?(?:\[data-theme="dark"\])?\s*\{/g)].map((m) => m.index);
const blocks = starts.slice(0, 3).map((i) => css.slice(i, css.indexOf('}', i)));
const themes = { light: blocks[0], 'dark (system)': blocks[1], 'dark (chosen)': blocks[2] };
const tok = (block, name) => {
  const m = block.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'));
  if (!m) throw new Error('no --' + name + ' in a theme block');
  return m[1];
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg, pct, bg) => fg.map((v, i) => v * pct / 100 + bg[i] * (1 - pct / 100));
// the tint the chip CSS uses, read from the stylesheet so this cannot drift from it
const tintPct = (token) => {
  const m = css.match(new RegExp('\\.due-(?:yellow|red)[^{]*\\{[^}]*background:color-mix\\(in srgb, var\\(--' + token + '\\) (\\d+)%'));
  if (!m) throw new Error('no chip rule tinting --' + token + ' found in css/app.css');
  return Number(m[1]);
};
const hue = (c) => {
  const [r, g, b] = c.map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };

let failed = false;
for (const [theme, block] of Object.entries(themes)) {
  const surfaces = { surface: rgb(tok(block, 'surface')), 'surface-2': rgb(tok(block, 'surface-2')), bg: rgb(tok(block, 'bg')) };
  console.log('\n' + theme);
  for (const [token, stage] of [['due-soon', 'yellow'], ['due-now', 'red']]) {
    const fg = rgb(tok(block, token));
    for (const [sname, surf] of Object.entries(surfaces)) {
      const bg = mix(fg, tintPct(token), surf);
      const r = ratio(fg, bg);
      const ok = r >= 4.5;
      if (!ok) failed = true;
      console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + stage + ' chip text ' + tok(block, token) + ' on its tint over ' + sname + ': ' + r.toFixed(2) + ':1 (need 4.5)');
    }
    const near = ['prio-high', 'prio-urgent', 'prio-medium'].map((p) => p + ' ' + tok(block, p) + ' hue gap ' + hueGap(fg, rgb(tok(block, p))).toFixed(0) + ' deg').join(', ');
    console.log('       ' + stage + ' vs priority chips: ' + near);
  }
}
const dueTokens = (block) => JSON.stringify(['due-soon', 'due-now'].map((t) => tok(block, t)));
if (dueTokens(themes['dark (system)']) !== dueTokens(themes['dark (chosen)'])) {
  failed = true;
  console.log('\nFAIL the two dark blocks disagree on a due token');
}
console.log(failed ? '\nCONTRAST CHECK FAILED' : '\nCONTRAST CHECK PASSED');
process.exit(failed ? 1 : 0);
