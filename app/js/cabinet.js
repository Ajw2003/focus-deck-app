// focus-deck-app/js/cabinet.js -- the filing cabinet (2026-11-14): where Focus, Sort and the Projects tab show projects.
// Each area is a wooden drawer, swiped sideways (Everything first, Unsorted last); inside, the projects hang as files,
// one tab each, all lined up on the left. Scrolling flicks through them (files you pass tip back); a tap opens a file
// and a tap on the open file chooses it. The drawers' contents are decided by the pure cabinetDrawers (tested in
// cabinet.test.mjs); the DOM part only listens and calls the hooks js/app.js passes (the wallets' onFacing / onChoose).
// Design: docs/generated/filing-cabinet.html. See docs/4-systems/wallets.md#the-filing-cabinet
import { esc } from './state.js';

// ---- Decisions (pure) --------------------------------------------------------------------------

// files: [{ key, name, areaId, ... }]; areas: [{ id, name, color }] in the order the drawers stand.
// `lead` files (All projects) go first in Everything only. `sort` orders the files in every drawer
// (A to Z unless the caller says otherwise). Drawers with no files are left out, except Everything.
export function cabinetDrawers(files, areas, { lead = [], sort = (a, b) => a.name.localeCompare(b.name) } = {}) {
  const ordered = files.slice().sort(sort);
  const out = [{ id: 'all', name: 'Everything', files: lead.concat(ordered) }];
  areas.forEach((a) => {
    const mine = ordered.filter((f) => f.areaId === a.id);
    if (mine.length) out.push({ id: a.id, name: a.name, color: a.color, files: mine });
  });
  return out;
}

// The drawer to show: the one open last time on this screen if it still exists, else Everything.
export function startDrawer(drawers, rememberedId) {
  return Math.max(0, drawers.findIndex((d) => d.id === rememberedId));
}

// ---- Markup ------------------------------------------------------------------------------------

// One file. `detail` is the small text on its face ("12 to do"); `pct` (0-100, or null) draws a progress bar.
function file(f, k, facing) {
  const pct = typeof f.pct === 'number' ? Math.max(0, Math.min(100, Math.round(f.pct))) : null;
  const bar = pct === null ? '' : '<span class="cab-bar" role="img" aria-label="' + pct + '% done"><i style="width:' + pct + '%"></i></span><span class="cab-pct">' + pct + '% done</span>';
  return '<button type="button" class="cab-file' + (f.key === facing ? ' is-centre' : '') + (f.picked ? ' is-picked' : '') + '" data-key="' + esc(f.key) + '" data-speak="' + esc(f.speak || f.name) + '" style="--c:' + f.color + ';z-index:' + (k + 1) + '">'
    + '<span class="cab-tab"><b>' + esc(f.name) + '</b>' + (pct === null ? '' : '<s><i style="width:' + pct + '%"></i></s>') + '</span>'
    + '<span class="cab-face"><span class="cab-row"><span class="cab-name">' + esc(f.name) + '</span><span class="cab-n">' + esc(f.detail || '') + '</span></span>' + bar + '</span></button>';
}

// wallet: the name the hooks get ('projects', 'tray-folders', 'projects-tab'). facing: the key of the open file.
export function cabinetInner({ wallet, aria, drawers, facing, remembered }) {
  const start = startDrawer(drawers, remembered);
  const body = drawers.map((d, i) => '<section class="cab-drawer" data-area="' + esc(d.id) + '" aria-label="' + esc(d.name) + ' drawer"' + (i === start ? ' data-start' : '') + '>'
    + '<div class="cab-well"><div class="cab-files">' + d.files.map((f, k) => file(f, k, facing)).join('') + '</div></div>'
    + '<div class="cab-front"><span class="cab-plate"><span>' + esc(d.name) + '<small>' + d.files.length + (d.files.length === 1 ? ' file' : ' files') + '</small></span></span><span class="cab-handle" aria-hidden="true"></span><span class="cab-pos"></span></div></section>').join('');
  const labels = drawers.map((d, i) => '<button type="button" class="cab-label" role="tab" data-drawer="' + i + '" aria-selected="' + (i === start) + '" style="--c:' + (d.color || 'var(--dk-ink)') + '">' + esc(d.name) + '</button>').join('');
  return '<div class="cab" data-wallet="' + esc(wallet) + '" data-facing="' + esc(facing) + '" data-cab="' + esc(wallet) + '" tabindex="0" role="group" aria-label="' + esc(aria) + '">'
    + '<div class="cab-box"><div class="cab-drawers">' + body + '</div></div>'
    + (drawers.length > 1 ? '<div class="cab-labels" role="tablist" aria-label="Drawers">' + labels + '</div>' : '') + '</div>';
}

// ---- DOM ---------------------------------------------------------------------------------------

const remembered = new Map(); // wallet name -> drawer id, for this visit; a repaint opens the same drawer again
export const rememberedDrawer = (wallet) => remembered.get(wallet);
const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Files you've passed tip back and darken, the one at the top of the drawer stands up a little, the ones ahead
// lean toward you. Transform only: it never moves the scroll, so nothing fights the finger.
function flick(files) {
  if (reduce()) return;
  const line = files.scrollTop + 26;
  files.querySelectorAll('.cab-file').forEach((f) => {
    const d = (f.offsetTop - line) / 58;
    const lift = Math.max(0, 1 - Math.abs(d)) * 8;
    let rot, shade;
    if (d < 0) { const a = Math.min(1, -d); rot = a * 58; shade = 1 - a * 0.4; } else { const a = Math.min(1, d / 4); rot = -a * 9; shade = 1 - a * 0.1; }
    f.style.transform = 'translateY(' + (-lift).toFixed(1) + 'px) rotateX(' + rot.toFixed(1) + 'deg)';
    f.style.setProperty('--shade', shade.toFixed(3));
  });
}

function count(drawer) {
  const fs = [...drawer.querySelectorAll('.cab-file')];
  const at = fs.findIndex((f) => f.classList.contains('is-centre'));
  drawer.querySelector('.cab-pos').textContent = at >= 0 ? (at + 1) + ' of ' + fs.length : fs.length ? '' : '0';
}

// Wires every .cab under root that is not wired yet. hooks: { onFacing(name, key), onChoose(name, key), announce(text) }.
export function mountCabinets(root, hooks) {
  root.querySelectorAll('.cab:not([data-mounted])').forEach((cab) => {
    cab.setAttribute('data-mounted', '');
    const name = cab.getAttribute('data-cab');
    const row = cab.querySelector('.cab-drawers'), drawers = [...cab.querySelectorAll('.cab-drawer')], labels = [...cab.querySelectorAll('.cab-label')];
    let current = Math.max(0, drawers.findIndex((d) => d.hasAttribute('data-start')));
    const mark = () => {
      labels.forEach((l, i) => l.setAttribute('aria-selected', i === current));
      const l = labels[current], box = l && l.parentElement;
      if (l && (l.offsetLeft < box.scrollLeft || l.offsetLeft + l.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollTo({ left: l.offsetLeft - 8, behavior: reduce() ? 'auto' : 'smooth' });
      remembered.set(name, drawers[current] && drawers[current].getAttribute('data-area'));
    };
    const go = (i) => { if (i === current || !drawers[i]) return; current = i; row.scrollTo({ left: i * row.clientWidth, behavior: reduce() ? 'auto' : 'smooth' }); mark(); };
    requestAnimationFrame(() => {
      row.scrollLeft = current * row.clientWidth;
      drawers.forEach((d) => {
        const files = d.querySelector('.cab-files'), open = files.querySelector('.is-centre');
        if (open) files.scrollTop = Math.max(0, open.offsetTop - 30);
        flick(files); count(d);
      });
      mark();
    });
    let settle;
    row.addEventListener('scroll', () => { clearTimeout(settle); settle = setTimeout(() => { const i = Math.round(row.scrollLeft / row.clientWidth); if (i !== current && drawers[i]) { current = i; mark(); } }, 80); }, { passive: true });
    let lastW = innerWidth; // a phone's address bar fires resize as the page scrolls; only a width change needs re-aligning
    addEventListener('resize', () => { if (!cab.isConnected || innerWidth === lastW) return; lastW = innerWidth; row.scrollLeft = current * row.clientWidth; });
    labels.forEach((l) => l.addEventListener('click', () => go(Number(l.getAttribute('data-drawer')))));
    drawers.forEach((d) => {
      const files = d.querySelector('.cab-files');
      files.addEventListener('scroll', () => { if (!files._raf) files._raf = requestAnimationFrame(() => { files._raf = 0; flick(files); }); }, { passive: true });
    });
    const open = (btn) => {
      const key = btn.getAttribute('data-key');
      cab.querySelectorAll('.cab-file.is-centre').forEach((f) => f.classList.remove('is-centre'));
      cab.querySelectorAll('.cab-file').forEach((f) => { if (f.getAttribute('data-key') === key) f.classList.add('is-centre'); });
      drawers.forEach(count);
      setTimeout(() => { btn.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' }); flick(btn.parentElement); }, 300);
      hooks.onFacing(name, key);
      if (hooks.announce) hooks.announce(btn.getAttribute('data-speak') + '. Tap again to choose.');
    };
    cab.addEventListener('click', (e) => {
      const btn = e.target.closest('.cab-file');
      if (!btn) return;
      if (btn.classList.contains('is-centre')) hooks.onChoose(name, btn.getAttribute('data-key'));
      else open(btn);
    });
    let typed = '', typedAt = 0;
    cab.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return;
      const fs = [...drawers[current].querySelectorAll('.cab-file')], at = fs.findIndex((f) => f.classList.contains('is-centre'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const to = fs[Math.max(0, Math.min(fs.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]; if (to) open(to); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') go(current + (e.key === 'ArrowRight' ? 1 : -1));
      else if (e.key === 'Enter' && at >= 0) hooks.onChoose(name, fs[at].getAttribute('data-key'));
      else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { // typing a name opens it, as the old strip did
        typed = (Date.now() - typedAt < 700 ? typed : '') + e.key.toLowerCase(); typedAt = Date.now();
        const said = (f) => f.getAttribute('data-speak').toLowerCase();
        const to = fs.find((f) => said(f).startsWith(typed)) || fs.find((f) => said(f).includes(typed));
        if (to && !to.classList.contains('is-centre')) open(to);
      } else return;
      e.preventDefault();
    });
  });
}
