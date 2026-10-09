// focus-deck-app/js/format-label-name.test.mjs — run with: node --test app/js/format-label-name.test.mjs
//
// Display-only auto-formatting of label (task category) names (Q7b). Never touches the stored
// name or anything sent to GitHub — see docs/4-systems/styling.md.
import test from 'node:test';
import assert from 'node:assert';
import { formatLabelName } from './state.js';

test('formatLabelName formats the plan\'s worked examples', () => {
  const cases = [
    ['ui', 'UI'],
    ['bug', 'Bug'],
    ['docs', 'Docs'],
    ['good first issue', 'Good First Issue'],
    ['qol', 'QoL'],
    ['Qol', 'QoL'],
    ['help-wanted', 'Help Wanted'],
    ['GitHub', 'GitHub'],
    ['ios', 'iOS'],
  ];
  for (const [input, expected] of cases) {
    assert.strictEqual(formatLabelName(input), expected, `formatLabelName(${JSON.stringify(input)})`);
  }
});

test('formatLabelName never mutates the input and handles empty/underscore input', () => {
  const input = 'good_first_issue';
  assert.strictEqual(formatLabelName(input), 'Good First Issue');
  assert.strictEqual(input, 'good_first_issue'); // unchanged
  assert.strictEqual(formatLabelName(''), '');
});
