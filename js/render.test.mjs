// focus-deck-app/js/render.test.mjs — run with: node js/render.test.mjs
import { renderTaskRow, renderErrorToast } from './render.js';
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

const linked = row({});
assert.ok(/<a class="task-title" href="https:\/\/github.com\/o\/r\/issues\/1"[^>]*target="_blank"/.test(linked), 'a linked task title is a link to its issue');
assert.ok(!/class="task-title"[^>]*data-action="edit-task"/.test(linked), 'a linked task title must not open the edit form');
assert.ok(/data-action="edit-task"[^>]*>Edit</.test(linked), 'a linked task gets a separate Edit button');
const manual = row({ source: 'manual', url: undefined, repoFullName: undefined, issueNumber: undefined });
assert.ok(/<span class="task-title" data-action="edit-task"/.test(manual), 'an unlinked task title still opens the edit form');
assert.ok(!manual.includes('>Edit<'), 'an unlinked task needs no separate Edit button');

assert.strictEqual(renderErrorToast({ syncError: null }), '', 'no error means no toast');
const toast = renderErrorToast({ syncError: 'Could not link <b>' });
assert.ok(toast.includes('class="error-toast"') && toast.includes('role="alert"'), 'an error renders the pinned, announced toast');
assert.ok(toast.includes('Could not link &lt;b&gt;'), 'the error text is escaped');
assert.ok(toast.includes('data-action="dismiss-error"'), 'the toast can be dismissed');

console.log('RENDER CHIP TESTS PASSED');
