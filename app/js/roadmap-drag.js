// focus-deck-app/js/roadmap-drag.js -- moving things on the Roadmap (#257): a mouse drag by a grip (.rm-grip),
// or Alt+Arrow on the focused grip (tasks: Left / Right between columns; milestones and sections: Up / Down).
// This file owns the gestures only; `h` gets the result: h.task(id, status), h.taskStep(id, dir),
// h.ms(id, sectionId, index), h.msStep(id, dir), h.sec(id, index), h.secStep(id, dir). app.js saves it.
// shortcut: mouse and pen only (no touch drag, no auto-scroll); a phone uses the up/down and left/right buttons.
const SLOP = 4;
let press = null;

function drop(kind, el) {
  if (!el) return null;
  if (kind === 'task') { const c = el.closest('.rm-col'); return c ? { status: c.getAttribute('data-status') } : null; }
  if (kind === 'ms') {
    const m = el.closest('.rm-ms');
    if (m) return m.closest('.rm-unplanned') ? null : { section: m.getAttribute('data-section-id'), index: Number(m.getAttribute('data-index')) };
    const s = el.closest('.rm-sec');
    return s && !s.classList.contains('rm-unplanned') ? { section: s.getAttribute('data-section-id'), index: 9999 } : null; // on a section: its end
  }
  const s = el.closest('.rm-sec[data-sec-index]');
  return s ? { index: Number(s.getAttribute('data-sec-index')) } : null;
}

export function initRoadmapDrag(app, h) {
  app.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest && e.target.closest('.rm-grip');
    if (!grip || e.pointerType === 'touch' || e.button !== 0) return;
    press = { kind: grip.getAttribute('data-kind'), id: grip.getAttribute('data-id'), x: e.clientX, y: e.clientY, from: grip.closest('.rm-task, .rm-ms, .rm-sec'), on: false };
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (!press.on && Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) { press.on = true; press.from.classList.add('is-dragging'); document.body.classList.add('rm-dragging'); }
  });
  document.addEventListener('pointerup', (e) => {
    if (!press) return;
    const p = press; press = null;
    p.from.classList.remove('is-dragging'); document.body.classList.remove('rm-dragging');
    if (!p.on) return;
    const to = drop(p.kind, document.elementFromPoint(e.clientX, e.clientY));
    if (!to) return;
    if (p.kind === 'task') h.task(p.id, to.status);
    else if (p.kind === 'ms') h.ms(p.id, to.section, to.index);
    else h.sec(p.id, to.index);
  });
  app.addEventListener('keydown', (e) => {
    const grip = e.target.classList && e.target.classList.contains('rm-grip') ? e.target : null;
    if (!grip || !e.altKey) return;
    const kind = grip.getAttribute('data-kind'), id = grip.getAttribute('data-id');
    const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight', vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
    if (kind === 'task' ? !horizontal : !vertical) return;
    e.preventDefault();
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    if (kind === 'task') h.taskStep(id, dir); else if (kind === 'ms') h.msStep(id, dir); else h.secStep(id, dir);
  });
}
