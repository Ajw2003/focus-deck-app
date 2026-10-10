// focus-deck-app/js/setup-checklist.test.mjs -- run with: node --test app/js/setup-checklist.test.mjs
// The Settings setup checklist (#126). See docs/4-systems/onboarding.md#the-setup-checklist
import test from 'node:test';
import assert from 'node:assert';
import { checklistItems, checklistProgress } from './setup-checklist.js';

const byId = (items) => Object.fromEntries(items.map((i) => [i.id, i]));

test('a brand-new device: nothing done, each item links to the step that does it', () => {
  const items = byId(checklistItems({ st: { projects: [], gistId: null }, hasToken: false }));
  assert.deepStrictEqual(Object.values(items).map((i) => i.done), [false, false, false, false]);
  assert.strictEqual(items.project.href, './?welcome');
  assert.strictEqual(items.tasks.href, './?welcome', 'no folder yet: the welcome makes one and its tasks');
  assert.strictEqual(items.sync.href, 'setup.html');
  assert.strictEqual(items.issues.href, 'setup.html', 'issue sync needs a key first');
  assert.strictEqual(items.issues.optional, true);
});

test('a folder but no tasks: tasks are added on the desk, not by replaying the welcome', () => {
  const items = byId(checklistItems({ st: { projects: [{ id: 'p', tasks: [] }], gistId: null }, hasToken: false }));
  assert.strictEqual(items.project.done, true);
  assert.strictEqual(items.tasks.done, false);
  assert.strictEqual(items.tasks.href, 'index.html');
});

test('sync counts only with both a key and a sync Gist on this device', () => {
  const st = { projects: [], gistId: 'g1' };
  assert.strictEqual(byId(checklistItems({ st, hasToken: false })).sync.done, false);
  assert.strictEqual(byId(checklistItems({ st: { ...st, gistId: null }, hasToken: true })).sync.done, false);
  assert.strictEqual(byId(checklistItems({ st, hasToken: true })).sync.done, true);
});

test('issue sync: done once a project is linked to a repo; with a key, its link opens the repo panel', () => {
  const linked = { projects: [{ id: 'p', tasks: [{ id: 't' }], source: 'github', repoFullName: 'aj/site' }], gistId: 'g' };
  assert.strictEqual(byId(checklistItems({ st: linked, hasToken: true })).issues.done, true);
  const notLinked = { projects: [{ id: 'p', tasks: [] }], gistId: 'g' };
  assert.strictEqual(byId(checklistItems({ st: notLinked, hasToken: true })).issues.href, 'index.html?new=repo');
});

test('progress counts the needed items only', () => {
  const all = checklistItems({ st: { projects: [{ id: 'p', tasks: [{ id: 't' }] }], gistId: 'g' }, hasToken: true });
  assert.deepStrictEqual(checklistProgress(all), { done: 3, of: 3 });
  assert.deepStrictEqual(checklistProgress(checklistItems({ st: { projects: [], gistId: null }, hasToken: false })), { done: 0, of: 3 });
});
