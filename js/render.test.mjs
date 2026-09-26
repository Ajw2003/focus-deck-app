// focus-deck-app/js/render.test.mjs — run with: node js/render.test.mjs
import { renderTaskRow, renderToast, renderFocus } from './render.js';
import assert from 'node:assert';

const p = { id: 'p1', name: 'P' };
const cats = [{ id: 'cat_bug', name: 'Bug', color: 'hsl(4 70% 55%)' }];
const ui = { editingTask: null };
const base = { id: 't1', title: 'T', energy: 'low', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 1, url: 'https://github.com/o/r/issues/1', categoryIds: ['cat_bug'] };
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

const multi = renderTaskRow({ ...base, categoryIds: ['cat_bug', 'cat_art'] }, p, cats.concat([{ id: 'cat_art', name: 'Art', color: '#fbca04' }]), ui);
assert.ok(multi.includes('>Bug<') && multi.includes('>Art<'), 'every label on a task gets its own chip');
assert.ok(row({ priority: 'urgent' }).includes('class="chip priority-chip small" data-action="cycle-priority"') && row({ priority: 'urgent' }).includes('>Urgent<'), 'a task with a priority shows it as a chip');
assert.ok(row({ priority: null }).includes('>+ Priority<'), 'an open task with no priority offers to set one');
assert.ok(!row({}).includes('energy-chip'), 'the energy chip is hidden while ENERGY_UI_ENABLED is off');

// focus picker: one card per label with open tasks, busiest first, plus "Anything"; project pills narrow it
{
  const task = (id, cats, extra) => ({ id, title: id, status: 'next', categoryIds: cats, ...extra });
  const st = {
    focus: null,
    categories: [{ id: 'c_art', name: 'art', color: '#d000ff' }, { id: 'c_chore', name: 'chore', color: '#888888' }, { id: 'c_idle', name: 'idle', color: '#123456' }],
    projects: [
      { id: 'pA', name: 'PlunderSpell', tasks: [task('a1', ['c_art'], { priority: 'urgent' }), task('a2', ['c_art']), task('a3', ['c_idle'], { status: 'done' })] },
      { id: 'pB', name: 'Chores', tasks: [task('b1', ['c_chore', 'c_art'])] },
    ],
  };
  const html = renderFocus(st, () => null, { focusFilter: {} });
  const cards = [...html.matchAll(/data-action="pick-focus" data-category="([^"]*)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(cards, ['c_art', 'c_chore', ''], 'label cards busiest first, labels with nothing open left out, "Anything" last');
  assert.ok(html.includes('>3 open · 1 urgent · 2 projects<'), 'a card says how many are open, the most pressing priority, and across how many projects');
  assert.ok(html.includes('class="filter-pill active" data-action="set-focus-scope" data-scope="">All projects<'), '"All projects" is chosen by default');
  assert.ok(html.includes('class="focus-mode-btn active" data-action="set-focus-mode" data-mode="type"'), 'Type is the default mode');
  assert.ok(!html.includes('<select'), 'no dropdowns in the picker');
  const narrowed = renderFocus(st, () => null, { focusFilter: { projectId: 'pB' } });
  assert.ok(narrowed.includes('>1 open<') && !narrowed.includes('2 projects'), 'a chosen project narrows the counts');
  assert.ok(renderFocus(st, () => null, { focusFilter: { projectId: 'gone' } }).includes('class="filter-pill active" data-action="set-focus-scope" data-scope="">All projects<'), 'a remembered project that no longer exists falls back to All projects');

  // Project mode: the cards are projects and the pills are labels
  const byProj = renderFocus(st, () => null, { focusFilter: { mode: 'project' } });
  const projCards = [...byProj.matchAll(/data-action="pick-focus" data-category="([^"]*)" data-project="([^"]*)"/g)].map((m) => m[2]);
  assert.deepStrictEqual(projCards, ['pA', 'pB', ''], 'project cards busiest first, then Anything');
  assert.ok(byProj.includes('>PlunderSpell<') && byProj.includes('>2 open · 1 urgent<'), 'a project card shows its open count and most pressing priority');
  assert.ok(byProj.includes('data-scope="">All labels<') && byProj.includes('data-scope="c_art"'), 'the pills are labels in Project mode');
  const artOnly = renderFocus(st, () => null, { focusFilter: { mode: 'project', categoryId: 'c_chore' } });
  const narrowedCards = [...artOnly.matchAll(/data-action="pick-focus" data-category="([^"]*)" data-project="([^"]*)"/g)].map((m) => m[1] + '/' + m[2]);
  assert.deepStrictEqual(narrowedCards, ['c_chore/pB', 'c_chore/'], 'a label pill narrows the project cards, and every card carries that label');
}

assert.strictEqual(renderToast(null, 'error'), '', 'no message means no toast');
const toast = renderToast('Could not link <b>', 'error');
assert.ok(toast.includes('class="toast toast-error"') && toast.includes('role="alert"'), 'an error renders the pinned toast in its error style, announced');
assert.ok(toast.includes('Could not link &lt;b&gt;'), 'the message text is escaped');
assert.ok(toast.includes('data-action="dismiss-toast"'), 'the toast can be dismissed');
const info = renderToast('Linked instead', 'info');
assert.ok(info.includes('class="toast"') && info.includes('role="status"'), 'a notice uses the plain toast style and a polite announcement');

console.log('RENDER CHIP TESTS PASSED');
