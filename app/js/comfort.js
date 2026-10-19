// focus-deck-app/js/comfort.js -- the Comfort settings (#203): Movement, Softer colours, Card colour,
// Cards at once, Tasks past their date. Each is stamped on its own (state.comfort.<key> =
// { value, updatedAt }, see js/merge.js). This file holds the allowed values, the defaults, the
// normalizers and applyComfort; the setters are in js/mutations.js. Spec: docs/generated/calm-test/index.html.
export const MOTIONS = ['system', 'off', 'on'];
export const CHUNKS = [5, 7, 10];
export const OVERDUE_STYLES = ['amber', 'red'];
export const COLOUR_SOURCES = ['category', 'priority', 'due'];
export const DEFAULT_COMFORT = { motion: 'system', calm: true, chunk: 7, overdue: 'amber', colourBy: ['category', 'priority', 'due'] };
export const COMFORT_KEYS = Object.keys(DEFAULT_COMFORT);

// Anything that is not a known value (an old save, a hand-edited one) reads as the default.
export function normalizeMotion(v) { return MOTIONS.includes(v) ? v : DEFAULT_COMFORT.motion; }
export function normalizeCalm(v) { return typeof v === 'boolean' ? v : DEFAULT_COMFORT.calm; }
export function normalizeChunk(v) { return CHUNKS.includes(Number(v)) ? Number(v) : DEFAULT_COMFORT.chunk; }
export function normalizeOverdue(v) { return OVERDUE_STYLES.includes(v) ? v : DEFAULT_COMFORT.overdue; }
// The list keeps its order and drops unknown or repeated entries; 'label:<categoryId>' is allowed.
// Any of the three built-in sources that is missing is appended, so every task still gets a colour.
export function normalizeColourBy(v) {
  const seen = [];
  (Array.isArray(v) ? v : []).forEach((s) => {
    const ok = COLOUR_SOURCES.includes(s) || (typeof s === 'string' && /^label:.+/.test(s));
    if (ok && !seen.includes(s)) seen.push(s);
  });
  COLOUR_SOURCES.forEach((s) => { if (!seen.includes(s)) seen.push(s); });
  return seen;
}
export const NORMALIZERS = { motion: normalizeMotion, calm: normalizeCalm, chunk: normalizeChunk, overdue: normalizeOverdue, colourBy: normalizeColourBy };

export function defaultComfort() {
  const out = {};
  COMFORT_KEYS.forEach((k) => { out[k] = { value: NORMALIZERS[k](DEFAULT_COMFORT[k]), updatedAt: 0 }; });
  return out;
}
// Reads a saved comfort object (or nothing) into the full shape.
export function normalizeComfort(saved) {
  const out = {};
  COMFORT_KEYS.forEach((k) => {
    const s = saved && typeof saved === 'object' ? saved[k] : null;
    out[k] = s && typeof s === 'object'
      ? { value: NORMALIZERS[k](s.value), updatedAt: Number(s.updatedAt) || 0 }
      : { value: NORMALIZERS[k](DEFAULT_COMFORT[k]), updatedAt: 0 };
  });
  return out;
}
export function comfortValue(st, key) {
  const s = st && st.comfort && st.comfort[key];
  return NORMALIZERS[key](s ? s.value : DEFAULT_COMFORT[key]);
}
export const getMotion = (st) => comfortValue(st, 'motion');
export const getCalm = (st) => comfortValue(st, 'calm');
export const getChunk = (st) => comfortValue(st, 'chunk');
export const getOverdue = (st) => comfortValue(st, 'overdue');
export const getColourBy = (st) => comfortValue(st, 'colourBy');

// Sets body.no-motion (Movement off, or "system" while the device asks for reduced motion) and
// body.calm-colours (Softer colours). Safe to call again after every change or sync.
export function applyComfort(st) {
  if (typeof document === 'undefined' || !document.body) return;
  const motion = getMotion(st);
  const reduce = motion === 'off' || (motion === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.body.classList.toggle('no-motion', reduce);
  document.body.classList.toggle('calm-colours', getCalm(st));
}
