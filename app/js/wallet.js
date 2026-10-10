// focus-deck-app/js/wallet.js
// The wallet: a sideways strip of cards that turn away from you like CD sleeves, used by the focus
// picker for projects (manila folders) and categories (index cards). The decisions are pure
// functions at the top (tested in wallet.test.mjs, no DOM); the DOM part below only measures,
// listens and calls them. js/render.js writes the markup, js/app.js says what a flip or a choice
// does. Why it is built the way it is, and the repaint rule: docs/4-systems/wallets.md

// ---- The "Choosing a card" setting -------------------------------------------------------------

export const CHOOSING_MODES = ['swipe', 'tap', 'twice'];
export const DEFAULT_CHOOSING_MODE = 'twice';

// label/description are Settings' words; hint is the one line under the wallets.
export const CHOOSING_MODE_INFO = {
  swipe: { label: 'Swipe up', description: 'Flip to a card, then push it up to draw. A tap only flips.', hint: 'Swipe sideways to flip · swipe a card up to draw' },
  tap: { label: 'Tap', description: 'One tap on a card draws a task straight away.', hint: 'Swipe sideways to flip · tap a card to draw' },
  twice: { label: 'Tap twice', description: 'The first tap lifts a card, the second draws. Flipping away cancels.', hint: 'Swipe sideways to flip · tap twice to draw' },
};

// Anything that is not a known mode (an old save, a hand-edited one) reads as the default.
export function normalizeChoosingMode(value) {
  return CHOOSING_MODES.includes(value) ? value : DEFAULT_CHOOSING_MODE;
}

// The small text in a card's corner. `armed` only matters in tap-twice.
export function cornerHint(mode, armed, verb) {
  if (mode === 'swipe') return wording('Draw ↑', verb);
  if (mode === 'twice') return armed ? 'Tap again' : 'Tap';
  return wording('Tap to draw', verb);
}

// The words say "draw" (draw a task). A wallet that does something else with a card (the in-tray's
// folders and flags "use" it) names its own verb in the track's data-verb; no verb leaves the text.
export function wording(text, verb) {
  if (!verb) return text;
  return text.replace(/\b([dD])raw\b/g, (m, first) => (first === 'D' ? verb[0].toUpperCase() + verb.slice(1) : verb));
}

// ---- Decisions (pure) --------------------------------------------------------------------------

export const SWIPE_DRAW_PX = 50; // an upward drag this far draws (swipe mode)
export const SWIPE_TRY_PX = 8; // ...and past this far it was meant, so say "a little further"
export const MOVE_SLOP_PX = 6; // a press that moves less than this is a tap

export function clampIndex(index, count) {
  return Math.max(0, Math.min(count - 1, index));
}

// `offsets` are each card's centre minus the wallet's centre. The card nearest the middle faces
// you; a tie goes to the earlier card so the answer never depends on rounding.
export function facingIndex(offsets) {
  let best = 0;
  offsets.forEach((o, i) => { if (Math.abs(o) < Math.abs(offsets[best])) best = i; });
  return best;
}

// How far a card turns away. `offset` is its distance from the middle in card widths.
export function tiltFor(offset) {
  const clamped = Math.max(-1.6, Math.min(1.6, offset));
  const away = Math.abs(clamped);
  return { rotateDeg: clamped * -52, depthPx: -away * 70, brightness: 1 - Math.min(0.4, away * 0.3), stack: 20 - Math.round(away * 6) };
}

// Where to scroll the track so a card sits in the middle.
export function scrollLeftFor(cardLeft, cardWidth, trackWidth) {
  return Math.max(0, Math.round(cardLeft + cardWidth / 2 - trackWidth / 2));
}

// null until the press has moved past the slop, then whichever way it went further.
export function pointerAxis(dx, dy, slop = MOVE_SLOP_PX) {
  if (Math.hypot(dx, dy) <= slop) return null;
  return Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
}

// What a tap (a press that did not move) does. `armed` is the index lifted by an earlier tap, or null.
//   flip: scroll that card to the middle; arm: the index to lift (null = none);
//   choose: draw from it now; nudge/say: the swipe-mode reminder that a tap only flips.
export function tapOutcome(mode, { index, facing, armed }) {
  const flip = index !== facing;
  if (mode === 'tap') return { flip, arm: null, choose: true, nudge: false, say: null };
  if (mode === 'twice') {
    if (armed === index) return { flip: false, arm: null, choose: true, nudge: false, say: null };
    return { flip, arm: index, choose: false, nudge: false, say: 'arm' };
  }
  if (flip) return { flip: true, arm: null, choose: false, nudge: false, say: null };
  return { flip: false, arm: null, choose: false, nudge: true, say: 'swipe' };
}

// What an upward drag does once it is let go. Only swipe mode, and only the card facing you.
// `dy` is negative going up. 'choose', 'short' (meant it, not far enough) or 'none'.
export function swipeOutcome({ mode, dy, index, facing }) {
  if (mode !== 'swipe' || index !== facing) return 'none';
  if (dy < -SWIPE_DRAW_PX) return 'choose';
  if (dy < -SWIPE_TRY_PX) return 'short';
  return 'none';
}

// Flipping away from a lifted card puts it back, unless the flip is the one its own tap asked for.
export function shouldDisarm({ armed, nearest, flipTarget }) {
  return armed !== null && nearest !== armed && flipTarget !== armed;
}

// null for keys the wallet ignores.
export function keyAction(key) {
  if (key === 'ArrowRight') return 'next';
  if (key === 'ArrowLeft') return 'prev';
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  if (key === 'Enter' || key === ' ') return 'choose';
  return null;
}

// ---- DOM ---------------------------------------------------------------------------------------

// Every mounted wallet, so the one set of window listeners can reach them. A repaint of #app
// replaces the tracks; mountWallets drops the instances whose track left the page, which is the
// whole leak control (the per-track listeners die with their elements).
const live = new Set();
let press = null;
let globalsInstalled = false;
let hintTimer = null;

export function liveWalletCount() {
  return live.size;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Wires every `.flip-track` under `root` that is not wired yet. hooks:
//   onFacing(name, key)  the card facing you changed (by the person; not on mount)
//   onChoose(name, key)  draw from this card; returns false when nothing could be drawn
//   announce(text)       for the screen-reader live region
// The track's data-wallet / data-mode / data-facing and each .sleeve's data-key / data-speak come
// from the markup (render.js), which is how a repaint restores the facing card.
export function mountWallets(root, hooks) {
  live.forEach((w) => { if (!w.track.isConnected) live.delete(w); });
  root.querySelectorAll('.flip-track').forEach((track) => {
    if ([...live].some((w) => w.track === track)) return;
    live.add(mountOne(track, hooks));
  });
  installGlobals();
}

function installGlobals() {
  if (globalsInstalled) return;
  globalsInstalled = true;
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', () => release(false));
  window.addEventListener('pointercancel', () => release(true));
  window.addEventListener('resize', () => live.forEach((w) => { if (w.track.isConnected) w.recentre(); }));
}

function onPointerMove(e) {
  if (!press) return;
  if (!press.w.track.isConnected) { press = null; return; } // repainted away mid-press
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  if (!press.axis) press.axis = pointerAxis(dx, dy);
  const w = press.w;
  // A touch scrolls the track natively; only a mouse needs its drag turned into a scroll.
  if (press.axis === 'x' && press.type === 'mouse') { w.track.style.scrollSnapType = 'none'; w.track.scrollLeft = press.scroll - dx; }
  if (press.axis === 'y' && w.mode === 'swipe' && press.index === w.facing) {
    press.dy = Math.min(0, dy);
    const sleeve = w.sleeves[press.index];
    sleeve.classList.add('is-lifting');
    // The track clips anything taller than itself, so the card rises a short way with resistance;
    // the draw threshold still uses the full finger distance.
    sleeve.style.transform = 'translateY(' + Math.max(-30, press.dy * 0.4) + 'px)';
  }
}

function release(cancelled) {
  if (!press) return;
  const p = press;
  press = null;
  const w = p.w;
  if (!w.track.isConnected) return;
  w.track.style.scrollSnapType = '';
  if (p.axis === 'x' && p.type === 'mouse') { w.flipTo(w.facing); return; }
  if (p.axis === 'y') {
    const sleeve = w.sleeves[p.index];
    const outcome = swipeOutcome({ mode: w.mode, dy: p.dy, index: p.index, facing: w.facing });
    if (!cancelled && outcome === 'choose') { w.choose(p.index, sleeve); return; }
    if (sleeve) { sleeve.classList.remove('is-lifting'); sleeve.style.transform = ''; }
    if (!cancelled && outcome === 'short') w.say('A little further up to draw.');
    return;
  }
  if (!cancelled && !p.axis && p.index >= 0) w.tap(p.index);
}

function mountOne(track, hooks) {
  const name = track.dataset.wallet;
  const mode = normalizeChoosingMode(track.dataset.mode);
  const sleeves = [...track.querySelectorAll('.sleeve')];
  const keys = sleeves.map((s) => s.dataset.key);
  const countEl = track.closest('.wallet') && track.closest('.wallet').querySelector('.wallet-count');
  const root = track.closest('.wallet-root');
  const hintEl = root && root.querySelector('.flip-hint');
  const start = keys.indexOf(track.dataset.facing);
  const verb = track.dataset.verb || '';
  const w = { track, name, mode, sleeves, facing: start >= 0 ? start : 0, armed: null, flipTarget: null };
  let announceTimer = null;

  // A message under the wallets for a moment (then the mode's own hint comes back), and read aloud.
  w.say = (text) => {
    if (hintEl) {
      hintEl.textContent = wording(text, verb);
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { hintEl.textContent = wording(CHOOSING_MODE_INFO[mode].hint, verb); }, 2200);
    }
    hooks.announce(wording(text, verb));
  };

  function paintCorners() {
    sleeves.forEach((sleeve, i) => {
      const go = sleeve.querySelector('.go');
      if (go) go.textContent = cornerHint(mode, w.armed === i, verb);
    });
  }

  function disarm() {
    if (w.armed === null) return;
    sleeves[w.armed].classList.remove('is-armed');
    w.armed = null;
    paintCorners();
  }

  function updateTilt() {
    const box = track.getBoundingClientRect();
    const middle = box.left + box.width / 2;
    const rects = sleeves.map((s) => s.getBoundingClientRect());
    const offsets = rects.map((r) => r.left + r.width / 2 - middle);
    const nearest = facingIndex(offsets);
    const calm = reducedMotion();
    sleeves.forEach((sleeve, i) => {
      const t = tiltFor(offsets[i] / (rects[i].width || 1));
      const card = sleeve.firstElementChild;
      if (calm) { card.style.transform = ''; card.style.filter = ''; } else {
        card.style.transform = 'perspective(600px) rotateY(' + t.rotateDeg + 'deg) translateZ(' + t.depthPx + 'px)';
        card.style.filter = 'brightness(' + t.brightness + ')';
      }
      sleeve.style.zIndex = String(t.stack);
    });
    if (w.flipTarget === nearest) w.flipTarget = null;
    if (shouldDisarm({ armed: w.armed, nearest, flipTarget: w.flipTarget })) disarm();
    const changed = nearest !== w.facing;
    w.facing = nearest;
    sleeves.forEach((s, i) => s.classList.toggle('is-centre', i === nearest));
    if (countEl) countEl.textContent = (nearest + 1) + ' of ' + sleeves.length;
    if (changed) {
      hooks.onFacing(name, keys[nearest]);
      // Only the card it settles on is read out, not each one it passes on the way.
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => hooks.announce(sleeves[w.facing].dataset.speak || ''), 250);
    }
  }

  function scrollTo(index, behavior) {
    const s = sleeves[index];
    track.scrollTo({ left: scrollLeftFor(s.offsetLeft, s.offsetWidth, track.clientWidth), behavior });
  }

  w.flipTo = (index) => {
    const i = clampIndex(index, sleeves.length);
    w.flipTarget = i;
    scrollTo(i, reducedMotion() ? 'auto' : 'smooth');
  };

  // A resize changes the pixel position of the centre; put the facing card back in it.
  w.recentre = () => { scrollTo(w.facing, 'auto'); updateTilt(); };

  w.choose = (index, sleeve) => {
    disarm();
    const drew = hooks.onChoose(name, keys[index]);
    // Drawing repaints the page, so there is nothing to put back unless nothing was drawn.
    if (drew === false && sleeve) { sleeve.classList.remove('is-lifting'); sleeve.style.transform = ''; }
  };

  w.tap = (index) => {
    const out = tapOutcome(mode, { index, facing: w.facing, armed: w.armed });
    if (out.arm === null) disarm();
    if (out.flip) w.flipTo(index);
    if (out.arm !== null) {
      disarm();
      w.armed = out.arm;
      sleeves[out.arm].classList.add('is-armed');
      paintCorners();
    }
    if (out.nudge) {
      const sleeve = sleeves[index];
      sleeve.classList.remove('is-nudge'); void sleeve.offsetWidth; sleeve.classList.add('is-nudge');
    }
    if (out.say === 'arm') w.say('Tap it again to draw.');
    if (out.say === 'swipe') w.say('Swipe the card up to draw.');
    if (out.choose) w.choose(index);
  };

  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const sleeve = e.target.closest('.sleeve');
    press = { w, x: e.clientX, y: e.clientY, scroll: track.scrollLeft, type: e.pointerType, index: sleeve ? sleeves.indexOf(sleeve) : -1, axis: null, dy: 0 };
  });
  track.addEventListener('keydown', (e) => {
    const action = keyAction(e.key);
    if (!action) return;
    e.preventDefault();
    if (action === 'next') w.flipTo(w.facing + 1);
    else if (action === 'prev') w.flipTo(w.facing - 1);
    else if (action === 'first') w.flipTo(0);
    else if (action === 'last') w.flipTo(sleeves.length - 1);
    else w.choose(w.facing, sleeves[w.facing]); // Enter draws at once in every mode: a keyboard has no "tap twice"
  });
  track.addEventListener('scroll', () => requestAnimationFrame(updateTilt), { passive: true });

  // Put the facing card back in the middle without animating, then draw the tilt for it. Setting
  // facing first means the scroll event this causes finds nothing changed and tells nobody.
  scrollTo(w.facing, 'auto');
  paintCorners();
  updateTilt();
  return w;
}
