// focus-deck-app/js/carousel.test.mjs -- run with: node --test app/js/carousel.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { clampIndex, windowStart, countText, keyOutcome, findFilter, jumpTo, wheelStep, carouselHtml } from './carousel.js';

test('index, window and count', () => {
  assert.equal(clampIndex(-3, 27), 0);
  assert.equal(clampIndex(99, 27), 26);
  assert.equal(clampIndex(4, 0), 0);
  assert.equal(windowStart(0, 27), 0);
  assert.equal(windowStart(13, 27), 11);
  assert.equal(windowStart(26, 27), 22);
  assert.equal(windowStart(1, 3), 0); // fewer cards than the window
  assert.equal(countText(2, 27), '3 of 27');
});

test('keys', () => {
  assert.deepEqual(keyOutcome('ArrowRight', 2, 5), { index: 3 });
  assert.deepEqual(keyOutcome('ArrowRight', 4, 5), { index: 4 });
  assert.deepEqual(keyOutcome('ArrowLeft', 0, 5), { index: 0 });
  assert.deepEqual(keyOutcome('End', 0, 5), { index: 4 });
  assert.deepEqual(keyOutcome('Enter', 1, 5), { choose: true });
  assert.equal(keyOutcome('a', 1, 5), null);
});

test('find filter and typing jump', () => {
  const items = [{ name: 'Garden shed' }, { name: 'Taxes' }, { name: 'Shed roof' }];
  const names = items.map((x) => x.name);
  assert.deepEqual(findFilter(items, 'shed').map((x) => x.name), ['Garden shed', 'Shed roof']);
  assert.deepEqual(findFilter(items, 'gar shed').map((x) => x.name), ['Garden shed']);
  assert.equal(findFilter(items, '  ').length, 3);
  assert.equal(jumpTo(names, 't'), 1);
  assert.equal(jumpTo(names, 'shed'), 2); // a name that starts with it wins
  assert.equal(jumpTo(names, 'oof'), 2);
  assert.equal(jumpTo(names, 'zz'), -1);
});

test('wheel steps one card per 40', () => {
  assert.deepEqual(wheelStep(0, 0, 10), { acc: 10, step: 0 });
  assert.deepEqual(wheelStep(30, 0, 15), { acc: 0, step: 1 });
  assert.deepEqual(wheelStep(0, -50, 3), { acc: 0, step: -1 }); // sideways beats vertical
});

test('markup: count, facing, labelled row, arrows', () => {
  const html = carouselHtml({ id: 'projects', label: 'Project', aria: 'Projects', noun: 'project', facing: 'b',
    cards: [{ key: 'a', name: 'A', color: '#fff', detail: '1 open' }, { key: 'b', name: 'B', color: '#fff', detail: '2 open' }] });
  assert.match(html, /2 of 2/);
  assert.match(html, /data-facing="b"/);
  assert.match(html, /role="group" aria-label="Projects"/);
  assert.match(html, /aria-label="Next project"/);
});
