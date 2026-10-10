// focus-deck-app/js/wallet.test.mjs -- run with: node --test app/js/wallet.test.mjs
//
// The wallet's decisions (#120), which are pure functions in js/wallet.js: which card faces you,
// what a tap does in each choosing mode, whether an upward drag chooses. The pointer and scroll
// plumbing around them is checked in a real browser (docs/4-systems/wallets.md#checking-it).
import test from 'node:test';
import assert from 'node:assert';
import {
  CHOOSING_MODES, DEFAULT_CHOOSING_MODE, CHOOSING_MODE_INFO, normalizeChoosingMode, cornerHint,
  facingIndex, tiltFor, scrollLeftFor, pointerAxis, tapOutcome, swipeOutcome, shouldDisarm, keyAction, clampIndex,
  SWIPE_DRAW_PX, mountWallets, liveWalletCount,
} from './wallet.js';

test('the modes: two, tap twice by default, unknown values read as the default', () => {
  assert.deepStrictEqual(CHOOSING_MODES, ['tap', 'twice']);
  assert.strictEqual(DEFAULT_CHOOSING_MODE, 'twice');
  CHOOSING_MODES.forEach((m) => {
    assert.strictEqual(normalizeChoosingMode(m), m);
    assert.ok(CHOOSING_MODE_INFO[m].label && CHOOSING_MODE_INFO[m].description && CHOOSING_MODE_INFO[m].hint, m + ' has words');
  });
  for (const bad of [undefined, null, '', 'double', 5, {}]) assert.strictEqual(normalizeChoosingMode(bad), 'twice');
  assert.strictEqual(normalizeChoosingMode('swipe'), 'tap', 'the retired Swipe up mode reads as Tap, which now behaves as it did plus taps (#132)');
});

test('the corner hint follows the mode, and "Tap again" only once armed', () => {
  assert.strictEqual(cornerHint('tap', false), 'Tap to draw');
  assert.strictEqual(cornerHint('twice', false), 'Tap');
  assert.strictEqual(cornerHint('twice', true), 'Tap again');
  assert.strictEqual(cornerHint('tap', true), 'Tap to draw', 'armed means nothing outside tap twice');
});

test('facingIndex: the card nearest the middle, ties to the earlier one, empty is 0', () => {
  assert.strictEqual(facingIndex([-300, -10, 280, 560]), 1);
  assert.strictEqual(facingIndex([0, 300]), 0);
  assert.strictEqual(facingIndex([-150, 150]), 0, 'a dead tie does not flicker');
  assert.strictEqual(facingIndex([310, 20, -270]), 1);
  assert.strictEqual(facingIndex([]), 0);
});

test('tiltFor: the middle card is flat, the others turn away and darken, with a cap', () => {
  const mid = tiltFor(0);
  assert.strictEqual(mid.rotateDeg + 0, 0);
  assert.strictEqual(mid.brightness, 1);
  assert.strictEqual(mid.stack, 20);
  const right = tiltFor(1);
  assert.ok(right.rotateDeg < 0 && tiltFor(-1).rotateDeg > 0, 'cards turn toward the middle from either side');
  assert.ok(right.depthPx < 0 && right.brightness < 1 && right.stack < 20);
  assert.strictEqual(tiltFor(9).rotateDeg, tiltFor(1.6).rotateDeg, 'far cards stop turning');
  assert.ok(tiltFor(9).brightness >= 0.6);
});

test('scrollLeftFor centres a card and never goes below 0', () => {
  assert.strictEqual(scrollLeftFor(300, 200, 400), 200);
  assert.strictEqual(scrollLeftFor(10, 100, 400), 0);
});

test('pointerAxis: still is a tap, otherwise whichever way went further', () => {
  assert.strictEqual(pointerAxis(2, -3), null);
  assert.strictEqual(pointerAxis(20, -5), 'x');
  assert.strictEqual(pointerAxis(-3, -30), 'y');
  assert.strictEqual(pointerAxis(10, 10), 'x', 'a diagonal tie is sideways: flipping is the safe reading');
});

test('tap mode: any tap draws at once, and flips to that card first when it is not facing', () => {
  assert.deepStrictEqual(tapOutcome('tap', { index: 2, facing: 2, armed: null }), { flip: false, arm: null, choose: true, nudge: false, say: null });
  const other = tapOutcome('tap', { index: 3, facing: 1, armed: null });
  assert.ok(other.flip && other.choose && other.arm === null);
});

test('tap twice: first tap arms (and flips if needed), second tap on the same card draws', () => {
  const first = tapOutcome('twice', { index: 3, facing: 1, armed: null });
  assert.deepStrictEqual(first, { flip: true, arm: 3, choose: false, nudge: false, say: 'arm' });
  const second = tapOutcome('twice', { index: 3, facing: 3, armed: 3 });
  assert.deepStrictEqual(second, { flip: false, arm: null, choose: true, nudge: false, say: null });
  const elsewhere = tapOutcome('twice', { index: 0, facing: 3, armed: 3 });
  assert.ok(elsewhere.arm === 0 && !elsewhere.choose, 'tapping another card moves the lift there instead of drawing');
  const facingFirst = tapOutcome('twice', { index: 2, facing: 2, armed: null });
  assert.ok(!facingFirst.flip && facingFirst.arm === 2 && !facingFirst.choose, 'a facing card still needs its second tap');
});

test('a save that still says swipe: a tap draws, never just a nudge (#132)', () => {
  const on = tapOutcome('swipe', { index: 1, facing: 1, armed: null });
  assert.ok(on.choose && !on.nudge && on.say === null);
});

test('swipeOutcome: past the threshold chooses in every mode, a little up is "short", only the facing card', () => {
  const up = (dy, extra) => swipeOutcome({ dy, index: 2, facing: 2, ...extra });
  assert.strictEqual(up(-(SWIPE_DRAW_PX + 1)), 'choose');
  assert.strictEqual(up(-SWIPE_DRAW_PX), 'short', 'exactly the threshold is not past it');
  assert.strictEqual(up(-20), 'short');
  assert.strictEqual(up(-3), 'none');
  assert.strictEqual(up(40), 'none', 'a downward drag does nothing');
  assert.strictEqual(up(-200, { index: 1 }), 'none', 'only the card facing you can be pushed up');
});

test('shouldDisarm: flipping away from a lifted card puts it back, flipping to it does not', () => {
  assert.strictEqual(shouldDisarm({ armed: null, nearest: 2, flipTarget: null }), false);
  assert.strictEqual(shouldDisarm({ armed: 3, nearest: 3, flipTarget: null }), false);
  assert.strictEqual(shouldDisarm({ armed: 3, nearest: 2, flipTarget: 3 }), false, 'on its way to the armed card');
  assert.strictEqual(shouldDisarm({ armed: 3, nearest: 2, flipTarget: null }), true);
  assert.strictEqual(shouldDisarm({ armed: 3, nearest: 1, flipTarget: 0 }), true);
});

test('keyAction and clampIndex', () => {
  assert.deepStrictEqual(['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' ', 'a', 'Tab'].map(keyAction), ['next', 'prev', 'first', 'last', 'choose', 'choose', null, null]);
  assert.deepStrictEqual([-3, 0, 2, 9].map((i) => clampIndex(i, 4)), [0, 0, 2, 3]);
});

test('the module can be imported and asked for its count without a DOM', () => {
  assert.strictEqual(typeof mountWallets, 'function');
  assert.strictEqual(liveWalletCount(), 0);
});
