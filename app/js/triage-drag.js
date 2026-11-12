// focus-deck-app/js/triage-drag.js -- moving a Triage row: a mouse drag by its grip, or Alt+Up / Alt+Down on a
// focused row. This file owns the gesture only; it calls move(taskId, toIndex) with the 0-based place the
// task should end at in the whole ranked list (across Now / Next / Later), and app.js saves it.
// shortcut: mouse and pen only (no touch drag, no auto-scroll); a phone uses the row's up/down buttons.
const SLOP = 4;
let press = null;

function target(x, y, from) {
  const el = document.elementFromPoint(x, y);
  const rowEl = el && el.closest('.tr-row');
  if (rowEl) return Number(rowEl.getAttribute('data-n')) - 1;
  const card = el && el.closest('.tr-card');
  if (!card) return null;
  const start = Number(card.getAttribute('data-start'));
  return from < start ? start - 1 : start; // dropped on a list's header: first place in that list
}

export function initTriageDrag(app, move) {
  app.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest && e.target.closest('.tr-grip');
    if (!grip || e.pointerType === 'touch' || e.button !== 0) return;
    const row = grip.closest('.tr-row');
    press = { id: row.getAttribute('data-task-id'), from: Number(row.getAttribute('data-n')) - 1, x: e.clientX, y: e.clientY, row, on: false };
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (!press.on && Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) { press.on = true; press.row.classList.add('is-dragging'); document.body.classList.add('tr-dragging'); }
  });
  document.addEventListener('pointerup', (e) => {
    if (!press) return;
    const p = press; press = null;
    p.row.classList.remove('is-dragging'); document.body.classList.remove('tr-dragging');
    if (!p.on) return;
    const to = target(e.clientX, e.clientY, p.from);
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
