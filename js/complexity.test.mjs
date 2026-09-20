// focus-deck-app/js/complexity.test.mjs — run with: node js/complexity.test.mjs
import { parseSteps, parseChecklistItems, wordCount, estimateComplexity, tierFromScore } from './complexity.js';
import assert from 'node:assert';

// parseSteps: splits on newlines, trims, drops blank lines
assert.deepStrictEqual(parseSteps('Step one\n  Step two  \n\nStep three'), ['Step one', 'Step two', 'Step three'], 'parseSteps should trim and drop blanks');
assert.deepStrictEqual(parseSteps(''), [], 'parseSteps of empty text should be []');
assert.deepStrictEqual(parseSteps(undefined), [], 'parseSteps of undefined should be []');

// parseChecklistItems: counts markdown checklist lines, checked or unchecked, - or *, tolerant of leading space
assert.strictEqual(parseChecklistItems('- [ ] one\n- [x] two\n  * [X] three\nnot a step').length, 3, 'parseChecklistItems should count checklist lines regardless of check state or bullet char');
assert.strictEqual(parseChecklistItems('').length, 0, 'parseChecklistItems of empty body should be 0');
assert.strictEqual(parseChecklistItems(undefined).length, 0, 'parseChecklistItems of undefined body should be 0');

// wordCount
assert.strictEqual(wordCount('one two three'), 3, 'wordCount should count whitespace-separated words');
assert.strictEqual(wordCount('  '), 0, 'wordCount of blank text should be 0');
assert.strictEqual(wordCount(''), 0, 'wordCount of empty text should be 0');

// estimateComplexity: step count bands (0-1 +0, 2-4 +15, 5-8 +30, 9+ +45)
assert.strictEqual(estimateComplexity({ stepCount: 0 }), 0, '0 steps should score +0');
assert.strictEqual(estimateComplexity({ stepCount: 1 }), 0, '1 step should score +0');
assert.strictEqual(estimateComplexity({ stepCount: 2 }), 15, '2 steps should score +15');
assert.strictEqual(estimateComplexity({ stepCount: 4 }), 15, '4 steps should score +15');
assert.strictEqual(estimateComplexity({ stepCount: 5 }), 30, '5 steps should score +30');
assert.strictEqual(estimateComplexity({ stepCount: 8 }), 30, '8 steps should score +30');
assert.strictEqual(estimateComplexity({ stepCount: 9 }), 45, '9 steps should score +45');
assert.strictEqual(estimateComplexity({ stepCount: 20 }), 45, 'step score should not exceed +45');

// estimateComplexity: description length bands (<15 +0, 15-60 +10, 60+ +20)
assert.strictEqual(estimateComplexity({ wordCount: 5 }), 0, '<15 words should score +0');
assert.strictEqual(estimateComplexity({ wordCount: 15 }), 10, '15 words should score +10');
assert.strictEqual(estimateComplexity({ wordCount: 60 }), 20, '60 words should score +20');
assert.strictEqual(estimateComplexity({ wordCount: 200 }), 20, 'length score should not exceed +20');

// estimateComplexity: keyword scan — complexity words add +15 each, capped at +30
assert.strictEqual(estimateComplexity({ text: 'Design the new onboarding flow' }), 15, 'one complexity word should score +15');
assert.strictEqual(estimateComplexity({ text: 'Design and migrate and refactor the pipeline' }), 30, 'three complexity words should cap at +30');

// estimateComplexity: simplicity words subtract 15 each, total floored at 0 (never negative)
assert.strictEqual(estimateComplexity({ text: 'Fix a typo' }), 0, 'a simplicity word alone should not push the score negative');
assert.strictEqual(estimateComplexity({ text: 'Design something, but actually just a quick tweak' }), 0, 'simplicity words should cancel a complexity word rather than go negative');

// estimateComplexity: GitHub-only label bonus — beyond the first, +5 each capped at +15
assert.strictEqual(estimateComplexity({ labelCount: 0 }), 0, '0 labels should score +0');
assert.strictEqual(estimateComplexity({ labelCount: 1 }), 0, 'the first label should score +0');
assert.strictEqual(estimateComplexity({ labelCount: 2 }), 5, 'a second label should score +5');
assert.strictEqual(estimateComplexity({ labelCount: 4 }), 15, 'a fourth label should score +15');
assert.strictEqual(estimateComplexity({ labelCount: 10 }), 15, 'label score should not exceed +15');

// estimateComplexity: signals combine, overall clamped to 100
assert.strictEqual(estimateComplexity({ stepCount: 9, wordCount: 60, text: 'Design and overhaul the sync layer', labelCount: 4 }), 100, 'combined max signals (45+20+30+15=110) should clamp at 100');

// tierFromScore
assert.strictEqual(tierFromScore(0), 'low', 'score 0 should be low');
assert.strictEqual(tierFromScore(24), 'low', 'score 24 should be low');
assert.strictEqual(tierFromScore(25), 'medium', 'score 25 should be medium');
assert.strictEqual(tierFromScore(54), 'medium', 'score 54 should be medium');
assert.strictEqual(tierFromScore(55), 'high', 'score 55 should be high');
assert.strictEqual(tierFromScore(100), 'high', 'score 100 should be high');

console.log('COMPLEXITY RUBRIC TESTS PASSED');
