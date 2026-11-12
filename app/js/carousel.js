// focus-deck-app/js/carousel.js -- the one carousel used by Focus (project row, kind-of-work row)
// and Sort (project row). The top half is pure and tested in carousel.test.mjs; the bottom half
// (mountCarousels) only measures and listens. A phone swipes a scroll-snap row (about 1.5 cards);
// a wide screen shows SHOW cards with arrow buttons, a "3 of 27" count, keys, typing and the wheel.
// See docs/4-systems/wallets.md
import { esc } from './state.js';

export const SHOW = 5;
export const DESK_QUERY = '(min-width: 1100px)'; // the same breakpoint as wallet.js SPREAD_QUERY

export const clampIndex = (i, n) => (n ? Math.max(0, Math.min(n - 1, i)) : 0);
// first visible card when `i` is the active one: keep it in the middle of the SHOW cards
export const windowStart = (i, n, show = SHOW) => Math.max(0, Math.min(n - show, i - Math.floor(show / 2)));
export const countText = (i, n) => (n ? (i + 1) + ' of ' + n : '0');

// What a key does on a row: { index } to move, { choose: true } to pick, null for any other key.
export function keyOutcome(key, i, n) {
  if (key === 'ArrowRight') return { index: clampIndex(i + 1, n) };
  if (key === 'ArrowLeft') return { index: clampIndex(i - 1, n) };
  if (key === 'Home') return { index: 0 };
  if (key === 'End') return { index: clampIndex(n - 1, n) };
  if (key === 'Enter') return { choose: true };
  return null;
}

// The cards whose name has every typed word in it (the Find a project box).
export function findFilter(items, q) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  return words.length ? items.filter((x) => words.every((w) => x.name.toLowerCase().includes(w))) : items;
}

// Typing letters on a row: the first card whose name starts with them (else contains them), -1 for none.
export function jumpTo(names, typed) {
  const q = String(typed || '').toLowerCase();
  if (!q) return -1;
  const lower = names.map((n) => n.toLowerCase());
  const at = lower.findIndex((n) => n.startsWith(q));
  return at >= 0 ? at : lower.findIndex((n) => n.includes(q));
}

// A wheel or sideways trackpad scroll: small deltas add up, a step of one card comes at 40.
export function wheelStep(acc, dx, dy) {
  const sum = acc + (Math.abs(dx) > Math.abs(dy) ? dx : dy);
  return Math.abs(sum) >= 40 ? { acc: 0, step: Math.sign(sum) } : { acc: sum, step: 0 };
}

// cards: [{ key, name, color, detail, kind, picked }]; facing is the active key (else the first).
// `before` is markup put above the row (the Find box). noun: "project" names the arrows.
export function carouselHtml({ id, label, aria, noun, cards, facing, before = '' }) {
  const at = Math.max(0, cards.findIndex((c) => c.key === facing));
  const card = (c) => '<div class="car-card" data-key="' + esc(c.key) + '" data-name="' + esc(c.name) + '" data-speak="' + esc(c.name + ', ' + c.detail) + '">'
    + '<button type="button" tabindex="-1" class="icard' + (c.kind ? ' ' + c.kind : '') + (c.picked ? ' is-picked' : '') + '" style="--c:' + c.color + '">'
    + '<span class="nm">' + esc(c.name) + '</span><span class="ct">' + esc(c.detail) + '</span></button></div>';
  return '<div class="car" data-car="' + id + '" data-facing="' + esc(cards.length ? cards[at].key : '') + '">'
    + '<div class="car-h"><div class="q">' + label + '</div><span class="car-count muted small" aria-live="polite">' + countText(at, cards.length) + '</span></div>' + before
    + '<div class="car-body"><button type="button" class="car-arrow" data-car-dir="-1" aria-label="Previous ' + noun + '">&lsaquo;</button>'
    + '<div class="car-row" tabindex="0" role="group" aria-label="' + esc(aria) + '">' + cards.map(card).join('') + '</div>'
    + '<button type="button" class="car-arrow" data-car-dir="1" aria-label="Next ' + noun + '">&rsaquo;</button></div></div>';
}

// hooks.onActive(id, key): the active card changed (arrows, keys, typing, wheel, a swipe).
// hooks.onChoose(id, key): Enter or a click picked it.
export function mountCarousels(root, hooks) {
  const wide = () => typeof matchMedia === 'function' && matchMedia(DESK_QUERY).matches;
  root.querySelectorAll('.car').forEach((car) => {
    const id = car.dataset.car, row = car.querySelector('.car-row');
    const cards = [...row.querySelectorAll('.car-card')], n = cards.length;
    const keys = cards.map((c) => c.dataset.key), names = cards.map((c) => c.dataset.name);
    const arrows = [...car.querySelectorAll('.car-arrow')];
    let idx = clampIndex(keys.indexOf(car.dataset.facing), n), typed = '', typedTimer = 0, acc = 0, settling = false, settleTimer = 0;
    const step = () => (n > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : row.clientWidth);
    const show = (i, { notify = true, scroll = true, instant = false } = {}) => {
      idx = clampIndex(i, n);
      cards.forEach((c, j) => c.classList.toggle('is-active', j === idx));
      car.querySelector('.car-count').textContent = countText(idx, n);
      arrows[0].disabled = idx === 0; arrows[1].disabled = idx >= n - 1;
      if (scroll && n) {
        settling = true; clearTimeout(settleTimer); settleTimer = setTimeout(() => { settling = false; }, 500);
        row.scrollTo({ left: (wide() ? windowStart(idx, n) : idx) * step(), behavior: instant ? 'auto' : 'smooth' });
      }
      if (notify && n) hooks.onActive(id, keys[idx]);
    };
    const choose = (i) => { if (n) hooks.onChoose(id, keys[clampIndex(i, n)]); };
    arrows.forEach((a) => a.addEventListener('click', () => show(idx + +a.dataset.carDir)));
    row.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const out = keyOutcome(e.key, idx, n);
      if (out) { e.preventDefault(); if (out.choose) choose(idx); else show(out.index); return; }
      if (e.key.length === 1 && e.key !== ' ') {
        typed += e.key; clearTimeout(typedTimer); typedTimer = setTimeout(() => { typed = ''; }, 700);
        const at = jumpTo(names, typed);
        if (at >= 0) { e.preventDefault(); show(at); }
      }
    });
    row.addEventListener('wheel', (e) => {
      if (!wide() || n < 2) return;
      e.preventDefault();
      const w = wheelStep(acc, e.deltaX, e.deltaY);
      acc = w.acc;
      if (w.step) show(idx + w.step);
    }, { passive: false });
    cards.forEach((c, i) => c.addEventListener('click', () => { show(i, { notify: false }); choose(i); }));
    // a phone swipe: the card at the left edge is the active one
    row.addEventListener('scroll', () => {
      if (wide() || settling || n < 2) return;
      const at = clampIndex(Math.round(row.scrollLeft / step()), n);
      if (at !== idx) show(at, { scroll: false });
    }, { passive: true });
    show(idx, { notify: false, instant: true });
  });
}
