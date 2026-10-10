// focus-deck-app/js/focus-complete.test.mjs — run with: node --test app/js/focus-complete.test.mjs
//
// The "I've done it" sequence (#119): tick, cross out, peel, THEN complete — once. Timers and the
// DOM are injected, so this runs without either.
import test from 'node:test';
import assert from 'node:assert';
import { startComplete, phaseClasses, PHASE_MS } from './focus-complete.js';

// a fake clock: wait() queues, run() fires the next queued callback and reports the delay it asked for
function harness(over) {
  const queue = [], log = [], ui = { completing: null };
  const deps = Object.assign({
    reduceMotion: false,
    setPhase: (p) => log.push('phase:' + p),
    isCurrent: () => true,
    complete: () => log.push('complete'),
    finish: () => log.push('finish'),
    wait: (ms, fn) => queue.push({ ms, fn }),
  }, over);
  const run = () => { const next = queue.shift(); next.fn(); return next.ms; };
  return { ui, deps, queue, log, run };
}

test('animates first and completes exactly once, last', () => {
  const h = harness();
  assert.strictEqual(startComplete(h.ui, 't1', h.deps), true);
  assert.deepStrictEqual(h.log, ['phase:ticked'], 'ticking starts at once and nothing is completed yet');
  assert.strictEqual(h.run(), PHASE_MS.ticked);
  assert.strictEqual(h.run(), PHASE_MS.crossed);
  assert.deepStrictEqual(h.log, ['phase:ticked', 'phase:crossed', 'phase:peeling'], 'still not completed while the note peels');
  assert.strictEqual(h.run(), PHASE_MS.peeling);
  assert.deepStrictEqual(h.log, ['phase:ticked', 'phase:crossed', 'phase:peeling', 'complete']);
  assert.strictEqual(h.ui.completing, null, 'the sequence is over');
  assert.strictEqual(h.queue.length, 0);
});

test('a second tap during the sequence does nothing', () => {
  const h = harness();
  startComplete(h.ui, 't1', h.deps);
  assert.strictEqual(startComplete(h.ui, 't1', h.deps), false);
  assert.strictEqual(h.queue.length, 1, 'no second timer chain');
  while (h.queue.length) h.run();
  assert.strictEqual(h.log.filter((x) => x === 'complete').length, 1, 'completed once');
});

test('the phase is kept in ui so a repaint can redraw it', () => {
  const h = harness();
  startComplete(h.ui, 't1', h.deps);
  assert.deepStrictEqual(h.ui.completing, { taskId: 't1', phase: 'ticked' });
  h.run();
  assert.deepStrictEqual(h.ui.completing, { taskId: 't1', phase: 'crossed' });
});

test('reduced motion completes at once, with no phases and no timers', () => {
  const h = harness({ reduceMotion: true });
  assert.strictEqual(startComplete(h.ui, 't1', h.deps), true);
  assert.deepStrictEqual(h.log, ['complete']);
  assert.strictEqual(h.queue.length, 0);
  assert.strictEqual(h.ui.completing, null);
});

test('if the focus moved on during the sequence, nothing is completed and the page repaints', () => {
  let current = true;
  const h = harness({ isCurrent: () => current });
  startComplete(h.ui, 't1', h.deps);
  h.run(); h.run();
  current = false; // someone tapped "Not this one" or a sync cleared the focus
  h.run();
  assert.ok(!h.log.includes('complete'), 'a task that is no longer the focus is not completed');
  assert.strictEqual(h.log[h.log.length - 1], 'finish');
  assert.strictEqual(h.ui.completing, null);
});

test('phases add classes cumulatively', () => {
  assert.deepStrictEqual(phaseClasses(null), { button: '', note: '' });
  assert.deepStrictEqual(phaseClasses('ticked'), { button: ' is-ticked', note: '' });
  assert.deepStrictEqual(phaseClasses('crossed'), { button: ' is-ticked', note: ' is-crossed' });
  assert.deepStrictEqual(phaseClasses('peeling'), { button: ' is-ticked', note: ' is-crossed is-peeling' });
});
