// focus-deck-app/js/persist-storage.test.mjs — run with: node js/persist-storage.test.mjs
//
// Regression test for a bug found while investigating a user report of losing all local data
// and their sync Gist ID ("the changes made deleted all of my credentials from my local copy and
// the web version got cleared too... with a gist Id that is simply gone now"). The user later
// attributed the symptoms they *saw* to Chrome's "Desktop site" mode, but that only explains a
// rendering/viewport issue -- it can't explain actual data loss, since toggling a browser display
// mode does not touch localStorage. Auditing every saveStateLocal() call site in the app (see
// docs/systems/gist-sync.md) turned up a real, severe, currently-live bug that fits the reported
// symptoms exactly:
//
//   js/mutations.js's persist() calls saveStateLocal() with NO arguments. Every other call site
//   in the app (js/sync.js, settings.html) correctly passes the state object. But state.js's
//   saveStateLocal(state) takes `state` as a parameter -- when called with zero arguments, that
//   parameter shadows the module's `state` singleton and is simply `undefined` inside the
//   function. JSON.stringify(undefined) is the value `undefined`, and localStorage.setItem
//   coerces it to the *string* "undefined" -- so every mutation (adding a task, completing one,
//   editing a category, anything that goes through mutations.js, which is nearly everything the
//   app does) overwrites localStorage['focusdeck-state-v1'] with the literal text "undefined".
//
//   The app doesn't notice immediately because the in-memory `state` singleton is still correct
//   and the UI renders from that -- exactly matching the user's report that it "looked fine" in
//   the moment. But the next time loadState() runs (a page reload, or opening a new tab) it calls
//   JSON.parse("undefined"), which throws a SyntaxError, is silently swallowed, and falls through
//   to defaultState() -- wiping every project, category, and the gistId back to nothing. This
//   reproduces "gist Id that is simply gone now" precisely, without needing any browser-mode
//   explanation.
//
// This test exercises the real module (not a text-pattern check like style-contract.test.mjs)
// because the bug is a runtime data-flow defect, not a static-shape one: it calls a real mutation
// and inspects what actually lands in (mocked) localStorage, plus what loadState() reads back
// afterward -- simulating the reload where the user actually saw their data disappear.
import assert from 'node:assert';

// A minimal localStorage mock that matches the real API's key behavior, including the
// String()-coercion setItem() performs on its value (a plain-object mock without this coercion
// would hide the bug, since it would happily store the raw `undefined` value instead of the
// string "undefined" a real browser stores).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

const { loadState } = await import('./state.js');
const { addProject } = await import('./mutations.js');

const project = addProject('Ship the thing', null);

const rawStored = globalThis.localStorage.getItem('focusdeck-state-v1');
assert.notStrictEqual(
  rawStored,
  'undefined',
  'localStorage now holds the literal string "undefined" instead of serialized state -- this is ' +
    'the exact bug: mutations.js persist() called saveStateLocal() with no argument, so ' +
    'state.js\'s saveStateLocal(state) serialized its own missing parameter instead of the real ' +
    'state singleton'
);

let parsed;
assert.doesNotThrow(() => { parsed = JSON.parse(rawStored); }, 'localStorage value is not valid JSON after a mutation');
assert.ok(
  parsed.projects.some((p) => p.id === project.id),
  'the project just added is missing from what was actually persisted to localStorage'
);

// Simulate the reload the user experienced: re-run loadState() against whatever is now in
// localStorage, exactly as the app does on every page load.
const reloaded = loadState();
assert.ok(
  reloaded.projects.some((p) => p.id === project.id),
  'reloading state (as a real page reload would) lost the project that was just added -- this is ' +
    'the "gist Id / data is simply gone" symptom: a corrupted localStorage value falls through to ' +
    'defaultState(), silently wiping everything'
);

console.log('PERSIST STORAGE TESTS PASSED');
