// focus-deck-app/js/github-sync.test.mjs — run with: node js/github-sync.test.mjs
import { energyFromLabels, statusFromLabels, parseRepoInput } from './github-sync.js';
import assert from 'node:assert';

// HIGH-priority label variant
assert.strictEqual(energyFromLabels(['bug', 'high-priority']), 'high', 'high-priority label should map to high energy');
assert.strictEqual(energyFromLabels(['P0']), 'high', 'P0 label should map to high energy');

// LOW-priority label variant, including labels-with-spaces/hyphens to prove normLabel works
assert.strictEqual(energyFromLabels(['good first issue']), 'low', '"good first issue" (spaces) should normalize to goodfirstissue -> low');
assert.strictEqual(energyFromLabels(['Good-First-Issue']), 'low', '"Good-First-Issue" (mixed case + hyphens) should normalize to goodfirstissue -> low');
assert.strictEqual(energyFromLabels(['docs']), 'low', 'docs label should map to low energy');

// label matching neither HIGH nor LOW -> medium
assert.strictEqual(energyFromLabels(['enhancement']), 'medium', 'unrecognized label should default to medium energy');
assert.strictEqual(energyFromLabels([]), 'medium', 'no labels should default to medium energy');
assert.strictEqual(energyFromLabels(undefined), 'medium', 'undefined labels should default to medium energy');

// wip / in progress status labels
assert.strictEqual(statusFromLabels(['wip']), 'doing', '"wip" label should map to doing status');
assert.strictEqual(statusFromLabels(['in progress']), 'doing', '"in progress" (spaces) should normalize to inprogress -> doing');
assert.strictEqual(statusFromLabels(['In-Progress']), 'doing', '"In-Progress" (mixed case + hyphen) should normalize to inprogress -> doing');
assert.strictEqual(statusFromLabels(['enhancement']), 'next', 'unrecognized status label should default to next');

// parseRepoInput: owner/repo shorthand, full GitHub URLs, and invalid input
assert.strictEqual(parseRepoInput('owner/repo'), 'owner/repo', 'plain "owner/repo" should parse as-is');
assert.strictEqual(parseRepoInput('https://github.com/owner/repo'), 'owner/repo', 'full github.com URL should parse to owner/repo');
assert.strictEqual(parseRepoInput('https://github.com/owner/repo/'), 'owner/repo', 'URL with a trailing slash should parse to owner/repo');
assert.strictEqual(parseRepoInput('https://github.com/owner/repo.git'), 'owner/repo', 'URL with a .git suffix should parse to owner/repo');
assert.strictEqual(parseRepoInput('not a valid repo input'), null, 'invalid input should return null');

console.log('GITHUB SYNC HEURISTIC TESTS PASSED');
