// focus-deck-app/js/board-swipe.js -- the phone's way to move a Board card (#145, part of #140): a
// horizontal swipe on a card moves it one column, left toward Up next, right toward Done. The card
// follows the finger; past SWIPE_FRACTION of its width it moves (through the same opts.moveTask the
// drag and the arrow keys use), short of that it snaps back.
// Scroll versus gesture is settled the way the wallets do it (wallet.js): the card is `touch-action:
// pan-y`, so the browser keeps vertical scrolling for itself (and cancels the pointer when it takes
// over), while a horizontal move reaches us; pointerAxis() reads the first move past a small slop.
// Touch only -- a mouse uses the grip. See docs/4-systems/styling.md#the-board-144
import { pointerAxis } from './wallet.js';
import { boardStepRequest } from './project-drag.js';

export const SWIPE_FRACTION = 0.3;
const WIDE = '(min-width:1100px)'; // the Board's three-column layout (CSS); no swipe there

// 'left' | 'right' | null for a finished swipe of dx px on a card width px wide
export function swipeDirection(dx, width, fraction = SWIPE_FRACTION) {
  if (!width || Math.abs(dx) < width * fraction) return null;
  return dx < 0 ? 'left' : 'right';
}

export function initBoardSwipe(app, opts) {
  let press = null;
  const reset = (card, animate) => {
    if (!card) return;
    card.style.transition = animate ? 'transform .18s ease-out' : '';
    card.style.transform = '';
    card.classList.remove('is-swiping');
    if (animate) setTimeout(() => { card.style.transition = ''; }, 220);
  };

  app.addEventListener('pointerdown', (e) => {
    if (press || e.pointerType !== 'touch' || window.matchMedia(WIDE).matches) return;
    const card = e.target.closest && e.target.closest('.board-card');
    if (!card || e.target.closest('input, button, a')) return;
    press = { card, id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, dx: 0 };
  });

  window.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!press.axis) press.axis = pointerAxis(dx, dy);
    if (press.axis === 'y') { reset(press.card, false); press = null; return; } // a scroll: the page's, not ours
    if (press.axis !== 'x') return;
    press.dx = dx;
    press.card.classList.add('is-swiping');
    press.card.style.transform = 'translateX(' + dx + 'px)';
  });

  const end = (cancelled) => {
    if (!press) return;
    const { card, dx, axis } = press;
    press = null;
    if (axis !== 'x') return;
    const dir = cancelled ? null : swipeDirection(dx, card.getBoundingClientRect().width);
    if (!dir) { reset(card, true); return; }
    const step = boardStepRequest(card, dir === 'left' ? -1 : 1);
    reset(card, false);
    if (!step) { opts.announce(card.querySelector('.board-card-title').textContent.trim() + ' is already in ' + (dir === 'left' ? 'Up next' : 'Done')); return; }
    if (opts.moveTask(step.req)) opts.announce(step.title + ' moved to ' + step.label);
  };
  window.addEventListener('pointerup', () => end(false));
  window.addEventListener('pointercancel', () => end(true));
}
