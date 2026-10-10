// focus-deck-app/js/onboarding.test.mjs -- run with: node --test app/js/onboarding.test.mjs
// First-run onboarding (#124): when it shows, the step order, and the category chips.
// See docs/4-systems/onboarding.md
import test from 'node:test';
import assert from 'node:assert';
import { shouldShowOnboarding, nextStep, categoryChips, STEPS } from './onboarding.js';

const empty = { projects: [], inbox: [] };
const base = { st: empty, seen: false, hasToken: false, hasGist: false, forced: false };

test('a fresh device with no data sees the welcome', () => {
  assert.strictEqual(shouldShowOnboarding(base), true);
});

test('existing data means no welcome: a project, or a jotted thought', () => {
  assert.strictEqual(shouldShowOnboarding({ ...base, st: { projects: [{ id: 'p', tasks: [] }], inbox: [] } }), false);
  assert.strictEqual(shouldShowOnboarding({ ...base, st: { projects: [], inbox: [{ id: 'i' }] } }), false);
});

test('a second device (a saved key or sync Gist) never sees it, even before its data arrives', () => {
  assert.strictEqual(shouldShowOnboarding({ ...base, hasToken: true }), false);
  assert.strictEqual(shouldShowOnboarding({ ...base, hasGist: true }), false);
});

test('once seen or skipped on this device, it stays away', () => {
  assert.strictEqual(shouldShowOnboarding({ ...base, seen: true }), false);
});

test('?welcome replays it whatever else is true', () => {
  assert.strictEqual(shouldShowOnboarding({ st: { projects: [{ id: 'p', tasks: [] }], inbox: [] }, seen: true, hasToken: true, hasGist: true, forced: true }), true);
});

test('steps run welcome, folder, tasks, pick, sync, then end', () => {
  assert.deepStrictEqual(STEPS, ['welcome', 'folder', 'tasks', 'pick', 'sync']);
  assert.strictEqual(nextStep('welcome'), 'folder');
  assert.strictEqual(nextStep('pick'), 'sync');
  assert.strictEqual(nextStep('sync'), null);
  assert.strictEqual(nextStep('nonsense'), null);
});

test('category chips: existing labels first, then suggestions not already there (ignoring case)', () => {
  const chips = categoryChips([{ id: 'cat_bug', name: 'Bug' }, { id: 'cat_chore', name: 'chore' }]);
  assert.deepStrictEqual(chips, [
    { name: 'Bug', id: 'cat_bug' }, { name: 'chore', id: 'cat_chore' },
    { name: 'Study', id: null }, { name: 'Art', id: null }, { name: 'Errand', id: null },
  ]);
});
