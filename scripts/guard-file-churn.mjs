#!/usr/bin/env node
// Guards against the exact failure mode that produced GitHub issue #17: a commit whose message
// describes a small, targeted change but whose diff actually replaces most of an existing file's
// content. See docs/systems/styling.md#traps for the incident this exists to catch, and
// docs/Decisions.md for why a line/ratio heuristic was chosen over something smarter.
//
// Used two ways:
//   - as a git commit-msg hook (.githooks/commit-msg), checking the commit about to be made
//   - as a CI step (.github/workflows/deploy.yml), checking every commit in a push
//
// A file is "flagged" when a large fraction of its pre-change line count was deleted in one
// commit. Flagging is not a hard block on its own -- a genuine full rewrite is a legitimate
// thing to do -- but it requires the commit message to say so explicitly, one line per flagged
// file:
//
//   File-Rewrite-Ack: path/to/file
//
// That forces the person (or Claude) writing the commit to consciously notice "this commit
// replaces most of this file" and say so, instead of the replacement riding along silently
// inside a diff whose stated intent was something much smaller -- which is exactly how af88e6d
// shipped a near-total css/app.css rewrite under the message "give the New Project category
// select a solid background".
import { execFileSync } from 'node:child_process';

const MIN_OLD_LINES = 15; // below this, ratio math is too noisy to mean anything
const DELETED_RATIO_THRESHOLD = 0.4; // >=40% of the file's prior lines deleted in one commit

function run(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function parseArgs(argv) {
  const opts = { base: null, head: 'HEAD', messageFile: null, message: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--head') opts.head = argv[++i];
    else if (a === '--message-file') opts.messageFile = argv[++i];
    else if (a === '--message') opts.message = argv[++i];
    else if (a === '--staged') opts.staged = true;
  }
  return opts;
}

// Returns [{path, added, deleted}] for files that are modified (not added, not deleted) between
// base and head (or staged-vs-HEAD when opts.staged is set).
function getModifiedFileStats(opts) {
  const numstatArgs = ['diff', '--numstat'];
  if (opts.staged) numstatArgs.push('--cached');
  else numstatArgs.push(opts.base, opts.head);
  const numstatOut = run(numstatArgs).trim();
  if (!numstatOut) return [];

  const statusArgs = ['diff', '--name-status'];
  if (opts.staged) statusArgs.push('--cached');
  else statusArgs.push(opts.base, opts.head);
  const statusOut = run(statusArgs).trim();
  const statusByPath = new Map();
  for (const line of statusOut.split('\n')) {
    if (!line) continue;
    const [status, ...rest] = line.split('\t');
    const path = rest[rest.length - 1];
    statusByPath.set(path, status[0]); // 'M', 'A', 'D', 'R100', etc -> first char
  }

  const results = [];
  for (const line of numstatOut.split('\n')) {
    if (!line) continue;
    const [addedStr, deletedStr, path] = line.split('\t');
    if (addedStr === '-' || deletedStr === '-') continue; // binary file, skip
    const status = statusByPath.get(path);
    if (status !== 'M') continue; // only modified files -- adds/deletes/renames are a different question
    results.push({ path, added: Number(addedStr), deleted: Number(deletedStr) });
  }
  return results;
}

function getOldLineCount(opts, path) {
  const ref = opts.staged ? 'HEAD' : opts.base;
  try {
    const content = run(['show', `${ref}:${path}`]);
    if (content.length === 0) return 0;
    return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
  } catch {
    return 0; // file didn't exist at old ref -- shouldn't happen for status 'M', but be safe
  }
}

function readMessage(opts) {
  if (opts.message != null) return opts.message;
  if (opts.messageFile) {
    return execFileSync('cat', [opts.messageFile], { encoding: 'utf8' });
  }
  // fall back to the head commit's message, for CI checking an already-made commit
  if (!opts.staged) return run(['log', '-1', '--format=%B', opts.head]);
  return '';
}

function ackedPaths(message) {
  const acked = new Set();
  const re = /^File-Rewrite-Ack:\s*(.+)$/gim;
  let m;
  while ((m = re.exec(message))) acked.add(m[1].trim());
  return acked;
}

export function checkChurn(opts) {
  const stats = getModifiedFileStats(opts);
  const message = readMessage(opts);
  const acked = ackedPaths(message);

  const flagged = [];
  for (const { path, added, deleted } of stats) {
    const oldLines = getOldLineCount(opts, path);
    if (oldLines < MIN_OLD_LINES) continue;
    const ratio = deleted / oldLines;
    if (ratio >= DELETED_RATIO_THRESHOLD && !acked.has(path)) {
      flagged.push({ path, oldLines, added, deleted, ratio });
    }
  }
  return flagged;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.staged && !opts.base) {
    console.error('guard-file-churn: --base <ref> is required (or pass --staged)');
    process.exit(2);
  }
  const flagged = checkChurn(opts);
  if (flagged.length === 0) {
    console.log('guard-file-churn: OK (no file lost >= ' + Math.round(DELETED_RATIO_THRESHOLD * 100) + '% of its content unacknowledged)');
    process.exit(0);
  }

  console.error('\nguard-file-churn: BLOCKED\n');
  console.error('This commit deletes a large fraction of an existing file\'s content. That\'s');
  console.error('exactly the shape of the bug behind GitHub issue #17: a commit that read like a');
  console.error('small targeted fix but actually replaced most of css/app.css with a different');
  console.error('draft, silently breaking most of the app\'s styling for weeks.\n');
  for (const f of flagged) {
    console.error(`  ${f.path}: ${f.deleted}/${f.oldLines} lines deleted (${Math.round(f.ratio * 100)}%), ${f.added} added`);
  }
  console.error('\nIf this really is an intentional full rewrite, say so explicitly in the commit');
  console.error('message -- one line per file:\n');
  for (const f of flagged) console.error(`  File-Rewrite-Ack: ${f.path}`);
  console.error('\nOtherwise: stop and check whether you meant to touch this many lines at all.');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
