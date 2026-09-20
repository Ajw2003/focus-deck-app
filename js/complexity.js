// focus-deck-app/js/complexity.js
// Pure, synchronous complexity estimation — no network or DOM, mirroring mergeStates and the
// GitHub label heuristics in being directly unit-testable. Implements the rubric from the
// approved "Project Categories & Auto Focus-Tier" proposal: a 0-100 score built from step
// count, description length, a keyword scan, and (GitHub only) label count, mapped to a
// low/medium/high tier via two tunable thresholds. These starting weights are a first guess
// (see the proposal's "Decisions and next steps"), meant to be retuned once there's real usage
// to look at — retune here, in tierFromScore and the score-band functions below, not by adding
// a second scoring path elsewhere.

const COMPLEXITY_WORDS = ['design', 'architecture', 'migrate', 'refactor', 'investigate', 'research', 'overhaul', 'rewrite'];
const SIMPLICITY_WORDS = ['typo', 'rename', 'bump', 'tweak', 'quick', 'minor'];

export function parseSteps(text) {
  return (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
}

export function parseChecklistItems(body) {
  return (body || '').split('\n').filter((l) => /^\s*[-*]\s*\[[ xX]\]/.test(l));
}

export function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function stepScore(count) {
  if (count >= 9) return 45;
  if (count >= 5) return 30;
  if (count >= 2) return 15;
  return 0;
}

function lengthScore(words) {
  if (words >= 60) return 20;
  if (words >= 15) return 10;
  return 0;
}

function keywordDelta(text) {
  const lower = (text || '').toLowerCase();
  let complexityPoints = 0;
  COMPLEXITY_WORDS.forEach((w) => { if (lower.includes(w)) complexityPoints += 15; });
  complexityPoints = Math.min(complexityPoints, 30);
  let simplicityPoints = 0;
  SIMPLICITY_WORDS.forEach((w) => { if (lower.includes(w)) simplicityPoints += 15; });
  return complexityPoints - simplicityPoints;
}

function labelScore(labelCount) {
  return Math.min(Math.max(labelCount - 1, 0) * 5, 15);
}

export function estimateComplexity({ stepCount = 0, text = '', wordCount: words = 0, labelCount = 0 } = {}) {
  const raw = stepScore(stepCount) + lengthScore(words) + keywordDelta(text) + labelScore(labelCount);
  return Math.max(0, Math.min(100, raw));
}

export function tierFromScore(score) {
  if (score < 25) return 'low';
  if (score < 55) return 'medium';
  return 'high';
}
