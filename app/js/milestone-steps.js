// focus-deck-app/js/milestone-steps.js -- Milestone settings in two steps (#268), drawn on the Roadmap's clipboard:
// 1 "How big a part?" (a ruler slider and its %: the other milestones rescale), 2 "Done means..." (Tasks done / Task size /
// A number / A checklist) and Save. It works on a draft in ui.rmSet; nothing changes until Save (js/app.js calls
// applyMilestoneSettings, js/roadmap.js). Replaces the #258 dialog (js/milestone-settings.js, removed). See docs/4-systems/roadmap.md
import { esc } from './state.js';
import { stamp, foot, dots, choice } from './sort-flow-view.js';
import { board } from './tidy-view.js';

const back = () => '<button type="button" class="dk-back" data-action="rm-set-back">‹ Back</button>';
const scroll = (inner) => '<div class="pj-scroll">' + inner + '</div>';
const field = (attr, value, ph) => '<input type="text" class="pj-field" ' + attr + ' value="' + esc(value) + '" maxlength="120" placeholder="' + esc(ph) + '" aria-label="' + esc(ph) + '" autocomplete="off" spellcheck="false">';

// The draft for milestone `m` (a roadmapOf milestone) among `r.milestones`; `base` is the shares at open, so the slider cannot drift by rounding.
export function settingsDraft(r, m) {
  const shares = Object.fromEntries(r.milestones.map((x) => [x.id, x.share]));
  return { id: m.id, step: 1, sub: null, shares, base: Object.assign({}, shares), alone: r.milestones.length < 2, measureBy: m.measureBy,
    number: Object.assign({ name: '', current: 0, target: 0 }, m.number), checklist: (m.checklist || []).map((i) => Object.assign({}, i)) };
}

export function renderSettings(d) {
  const mine = d.shares[d.id];
  if (d.step === 1) {
    const slider = '<input type="range" class="rm-slider" min="0" max="100" step="1" value="' + mine + '"' + (d.alone ? ' disabled' : '') + ' aria-label="How big a part, in percent" data-rm-slider>';
    return '<div class="pj pj-flow rm-flow">' + dots(1, 2) + board('How big a part?', '<div class="rm-ruler-pick">' + slider + '</div><p class="rm-big" data-rm-pct aria-live="polite">' + mine + '%</p>')
      + foot([back(), stamp('Next', { action: 'rm-set-next' })]) + '</div>';
  }
  const save = stamp('Save', { action: 'rm-set-save' });
  if (d.sub === 'number') {
    const n = d.number, num = (k, label) => '<input type="number" class="pj-field rm-num" min="0" inputmode="numeric" data-rm-num="' + k + '" value="' + esc(n[k]) + '" aria-label="' + label + '">';
    return '<div class="pj pj-flow rm-flow">' + dots(2, 2) + board('A number', field('data-rm-num="name"', n.name, 'Name it, like screens tested') + '<div class="rm-pair">' + num('current', 'Done so far') + '<span class="rm-of">of</span>' + num('target', 'Target') + '</div>')
      + foot([back(), save]) + '</div>';
  }
  if (d.sub === 'checklist') {
    const rows = d.checklist.map((i, k) => '<div class="dk-choice rm-item"><input type="checkbox" class="rm-tick" data-rm-tick="' + k + '"' + (i.done ? ' checked' : '') + ' aria-label="Done: ' + esc(i.text) + '">'
      + '<input type="text" class="rm-item-text" data-rm-text="' + k + '" maxlength="120" value="' + esc(i.text) + '" aria-label="Checklist item ' + (k + 1) + '">'
      + '<button type="button" class="tr-move rm-drop" data-rm-drop="' + k + '" aria-label="Remove ' + esc(i.text) + '">×</button></div>').join('');
    const add = '<div class="rm-additem">' + field('data-rm-new', '', '+ Add') + '<button type="button" class="dk-btn file-btn" data-action="rm-set-add">Add</button></div>';
    return '<div class="pj pj-flow rm-flow">' + dots(2, 2) + board('A checklist', scroll(rows) + add) + foot([back(), save]) + '</div>';
  }
  const pick = (k, label) => choice(label, { action: 'rm-set-measure', attrs: ' data-value="' + k + '"', on: d.measureBy === k });
  return '<div class="pj pj-flow rm-flow">' + dots(2, 2) + board('Done means…', pick('tasks', '✓ Tasks done') + pick('size', '⚖ Task size') + pick('number', '🔢 A number') + pick('checklist', '☑ A checklist'))
    + foot([back(), save]) + '</div>';
}
