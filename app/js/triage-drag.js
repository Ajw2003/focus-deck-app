// focus-deck-app/js/triage-drag.js -- moving a Triage row from the keyboard: Alt+Up / Alt+Down on a focused Move row (#266).
// It calls move(taskId, toIndex) with the 0-based place the task should end at in the whole ranked list, and app.js saves it.
// (The mouse drag by a grip went with the new Move screen: every row has its own up and down key.)
export function initTriageDrag(app, move) {
  app.addEventListener('keydown', (e) => {
    const row = e.target.classList && e.target.classList.contains('tr-row') ? e.target : null;
    if (!row || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const from = Number(row.getAttribute('data-n')) - 1;
    move(row.getAttribute('data-task-id'), from + (e.key === 'ArrowUp' ? -1 : 1));
  });
}
