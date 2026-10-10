// focus-deck-app/js/focus-complete.js
//
// The sticky note's "I've done it" sequence (#119): the box ticks, a biro line crosses the title out,
// the note peels away, and only then does the task actually complete. The animation is presentation;
// the one state change is the `complete` callback, called once at the end (or at once under reduced
// motion). The phase lives in ui.completing so a repaint mid-sequence (a sync landing) re-renders
// the note in the phase it had reached instead of cutting the sequence off. Kept free of the DOM
// and of timers of its own so it can be tested. See docs/4-systems/styling.md#the-sticky-note

// How long each phase lasts before the next one starts (ms). They match the CSS transitions on
// .check-btn .tick, .note h2 .ink and .note.is-peeling in css/app.css.
export const PHASE_MS = { ticked: 280, crossed: 460, peeling: 400 };
const ORDER = ['ticked', 'crossed', 'peeling'];

// The classes each phase adds, cumulative: a later phase keeps what the earlier ones drew.
export function phaseClasses(phase) {
  const at = ORDER.indexOf(phase);
  return {
    button: at >= 0 ? ' is-ticked' : '',
    note: (at >= 1 ? ' is-crossed' : '') + (at >= 2 ? ' is-peeling' : ''),
  };
}

// Runs the sequence for `taskId`. Returns false (and does nothing) when one is already running, so a
// double tap cannot complete twice. `deps`: reduceMotion (bool), setPhase(phase) draws a phase on the
// live DOM, isCurrent() says whether this task is still the focus, complete() is the real mutation,
// finish() repaints without completing (the task stopped being the focus meanwhile), wait(ms, fn).
export function startComplete(ui, taskId, deps) {
  if (ui.completing) return false;
  if (deps.reduceMotion) { deps.complete(); return true; }
  ui.completing = { taskId, phase: ORDER[0] };
  deps.setPhase(ORDER[0]);
  const step = (i) => {
    deps.wait(PHASE_MS[ORDER[i]], () => {
      if (i + 1 < ORDER.length) {
        ui.completing.phase = ORDER[i + 1];
        deps.setPhase(ORDER[i + 1]);
        step(i + 1);
        return;
      }
      ui.completing = null;
      if (deps.isCurrent()) deps.complete(); else deps.finish();
    });
  };
  step(0);
  return true;
}
