// focus-deck-app/js/note-face.js -- the "Note writing" setting (#122): which face the writing on
// paper notes uses. The CSS lives in the "Note faces" section of css/app.css; this only picks the
// value and sets data-note-face on <html>. See docs/4-systems/styling.md#note-faces.
export const NOTE_FACES = ['hand', 'print', 'dyslexic'];
export const DEFAULT_NOTE_FACE = 'hand';
export const NOTE_FACE_INFO = {
  hand: { label: 'Handwriting', description: 'Kalam, the pen-on-paper look' },
  print: { label: 'Print', description: 'Atkinson Hyperlegible, plain and easy to tell letters apart' },
  dyslexic: { label: 'OpenDyslexic', description: 'weighted letter bottoms to keep letters from flipping' },
};

// Anything that is not a known face (an old save, a hand-edited one) reads as the default.
export function normalizeNoteFace(value) {
  return NOTE_FACES.includes(value) ? value : DEFAULT_NOTE_FACE;
}

export function applyNoteFace(face) {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-note-face', normalizeNoteFace(face));
}
