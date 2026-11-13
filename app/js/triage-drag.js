// focus-deck-app/js/triage-drag.js -- moving a Triage row from the keyboard: Alt+Up / Alt+Down on a focused Move row (#266).
// It calls move(taskId, toIndex) with the 0-based place the task should end at in the whole ranked list, and app.js saves it.
// On a computer (>= 1100px) a row also drags with the mouse by its grip, beside the up and down keys.
// shortcut: mouse and pen only, rows of the Move window only (no touch drag, no auto-scroll); a phone uses the keys.
const SLOP = 4;
let press = null;
export function initTriageDrag(app, move) {
  app.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest && e.target.closest('.tr-grip');
    if (!grip || e.pointerType === 'touch' || e.button !== 0 || !matchMedia('(min-width:1100px)').matches) return;
    const row = grip.closest('.tr-row');
    press = { id: row.getAttribute('data-task-id'), from: Number(row.getAttribute('data-n')) - 1, x: e.clientX, y: e.clientY, row, on: false };
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (press && !press.on && Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) { press.on = true; press.row.classList.add('is-dragging'); }
  });
  document.addEventListener('pointerup', (e) => {
    if (!press) return;
    const p = press; press = null;
    p.row.classList.remove('is-dragging');
    if (!p.on) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), over = el && el.closest('.tr-row');
    const to = over ? Number(over.getAttribute('data-n')) - 1 : null;
    if (to !== null && to !== p.from) move(p.id, to);
  });
  app.addEventListener('keydown', (e) => {
    const row = e.target.classList && e.target.classList.contains('tr-row') ? e.target : null;
    if (!row || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const from = Number(row.getAttribute('data-n')) - 1;
    move(row.getAttribute('data-task-id'), from + (e.key === 'ArrowUp' ? -1 : 1));
  });
}
