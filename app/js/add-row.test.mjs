import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAddTaskRow } from './render.js';

const p = { id: 'p1', name: 'Home' };

test('add row, More closed: one line, no extra boxes, no autofocus', () => {
  const h = renderAddTaskRow(p, [], false, '');
  assert.match(h, /<form class="add-task-form add-row" data-action="add-task" data-project="p1">/);
  assert.match(h, /name="title" maxlength="280" required placeholder="Add a task…"/);
  assert.match(h, /data-action="toggle-add-more" data-project="p1" aria-expanded="false">More</);
  assert.match(h, /<button type="submit" class="btn primary">Add</);
  assert.ok(!h.includes('name="steps"') && !h.includes('name="deadline"') && !h.includes('autofocus'));
});

test('add row, More open: steps, priority, date and labels; button reads Less', () => {
  const h = renderAddTaskRow(p, [], true, '');
  assert.match(h, /aria-expanded="true">Less</);
  for (const n of ['name="steps"', 'name="priority"', 'name="deadline"']) assert.ok(h.includes(n), n);
});

test('add row: draft and placeholder are escaped', () => {
  const h = renderAddTaskRow(p, [], false, '"><script>x</script>', 'a<b');
  assert.ok(!h.includes('<script>'));
  assert.ok(h.includes('&lt;script&gt;') && h.includes('placeholder="a&lt;b"'));
});
