// focus-deck-app/js/move-dialog.js
// The in-app confirmation before a task move that touches GitHub (PR 11). Not `confirm()`: a small
// modal card in the app's own look. It is added to <body>, outside #app, so a repaint mid-question
// can't wipe it. Focus is trapped inside (Tab cycles Cancel/Move), Escape or the backdrop is Cancel,
// and focus goes back to where it was. The markup comes from render.js renderMoveDialog.
// See docs/4-systems/styling.md#dragging-tasks.
import { renderMoveDialog } from './render.js';

// Resolves true for Move, false for Cancel. `returnTo` is a fallback selector for the element to
// refocus if the one focused when the dialog opened is gone after a repaint.
export function confirmMove(message, returnTo) {
  return new Promise((resolve) => {
    const before = document.activeElement;
    const host = document.createElement('div');
    host.innerHTML = renderMoveDialog(message);
    const backdrop = host.firstElementChild;
    document.body.appendChild(backdrop);
    const buttons = Array.from(backdrop.querySelectorAll('button'));
    const move = backdrop.querySelector('[data-dialog="move"]');
    const close = (result) => {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      let target = before && before.isConnected ? before : null;
      if (!target && returnTo) target = document.querySelector(returnTo);
      if (target && target.focus) target.focus();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); return; }
      if (e.key !== 'Tab') return;
      const i = buttons.indexOf(document.activeElement);
      e.preventDefault();
      buttons[(i + (e.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
    };
    document.addEventListener('keydown', onKey, true);
    backdrop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dialog]');
      if (b) close(b.getAttribute('data-dialog') === 'move');
      else if (e.target === backdrop) close(false);
    });
    backdrop.querySelector('[data-dialog="cancel"]').focus(); // the safe default: Enter cancels
  });
}
