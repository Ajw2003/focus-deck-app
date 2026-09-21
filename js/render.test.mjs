// focus-deck-app/js/render.test.mjs — run with: node js/render.test.mjs
import { renderTaskRow } from './render.js';
import assert from 'node:assert';

const p = { id: 'p1', name: 'P' };
const cats = [{ id: 'cat_bug', name: 'Bug', color: 'hsl(4 70% 55%)' }];
const ui = { editingTask: null };
const base = { id: 't1', title: 'T', energy: 'low', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 1, url: 'https://github.com/o/r/issues/1', categoryId: 'cat_bug' };
const row = (over) => renderTaskRow({ ...base, ...over }, p, cats, ui);

assert.ok(!row({}).includes('claude-chip'), 'a plain task shows no Claude chips');

const created = row({ claudeCreated: true });
assert.ok(created.includes('claude-created-chip') && created.includes('>Claude created<'), 'claudeCreated renders the created chip');
assert.ok(!created.includes('claude-completed-chip'), 'created alone does not render the completed chip');

const completed = row({ claudeCompleted: true, status: 'done' });
assert.ok(completed.includes('claude-completed-chip') && completed.includes('>Claude completed<'), 'claudeCompleted on a done task renders the completed chip');

assert.ok(!row({ claudeCompleted: true, status: 'next' }).includes('claude-completed-chip'), 'a reopened task must not show the completed chip even if the flag is stale');

const both = row({ claudeCreated: true, claudeCompleted: true, status: 'done' });
assert.ok(both.includes('claude-created-chip') && both.includes('claude-completed-chip'), 'both chips can show together');
assert.ok(both.indexOf('cat-chip') < both.indexOf('claude-created-chip'), 'Claude chips come after the category chip so they never displace it');
assert.ok(both.indexOf('claude-created-chip') < both.indexOf('claude-completed-chip'), 'created chip precedes completed chip');

console.log('RENDER CHIP TESTS PASSED');
