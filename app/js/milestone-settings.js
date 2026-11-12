// focus-deck-app/js/milestone-settings.js -- the Milestone settings dialog (#258): how much a milestone counts
// toward its project (a slider; the other milestones rescale) and how its progress is measured (four radio
// cards). A centred dialog on a wide screen, a bottom sheet on a phone. It works on a draft: nothing changes
// until "Save milestone" (Cancel, Escape, the close control or the backdrop discard it). Like move-dialog.js it
// lives on <body>, outside #app, so a repaint cannot wipe it; focus is trapped inside and goes back to the name.
// The maths is in js/roadmap.js (sharesAfter, applyMilestoneSettings). See docs/4-systems/roadmap.md
import { esc } from './state.js';
import { sharesAfter, SIZE_POINTS } from './roadmap.js';

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
let seq = 0;

// ctx = { project, sub, m (a roadmapOf milestone), others: [{id,name,share}], returnTo (selector) }
export function openMilestoneSettings(ctx, onSave) {
  const m = ctx.m, before = document.activeElement;
  const d = { shares: Object.assign({ [m.id]: m.share }, ...ctx.others.map((o) => ({ [o.id]: o.share }))), measureBy: m.measureBy,
    number: Object.assign({ name: '', current: 0, target: 0 }, m.number), checklist: (m.checklist || []).map((i) => Object.assign({}, i)) };
  const base = Object.assign({}, d.shares), alone = !ctx.others.length; // the slider always rescales from the shares at open, so rounding cannot drift
  const cards = [['tasks', 'Tasks done', m.total ? m.done + ' of ' + m.total + ' tasks' : 'no tasks yet'], ['size', 'Task size', 'small ' + SIZE_POINTS.small + ', medium ' + SIZE_POINTS.medium + ', large ' + SIZE_POINTS.large],
    ['number', 'Your own number', 'a name and a target, like “screens tested” 2 of 4'], ['checklist', 'A checklist', 'tick what done means']];

  const measureHtml = () => cards.map(([k, title, hint]) => {
    const on = d.measureBy === k;
    let more = '';
    if (on && k === 'number') {
      more = '<div class="ms-more ms-number"><label>Name<input type="text" data-ms-num="name" maxlength="60" value="' + esc(d.number.name) + '" placeholder="screens tested"></label>'
        + '<label>Now<input type="number" min="0" inputmode="numeric" data-ms-num="current" value="' + esc(d.number.current) + '"></label>'
        + '<label>Target<input type="number" min="0" inputmode="numeric" data-ms-num="target" value="' + esc(d.number.target) + '"></label></div>';
    }
    if (on && k === 'checklist') {
      more = '<div class="ms-more ms-checklist"><ul class="ms-items">' + d.checklist.map((i, n) => '<li class="ms-item"><input type="checkbox" data-ms-tick="' + n + '"' + (i.done ? ' checked' : '') + ' aria-label="Done: ' + esc(i.text) + '"><input type="text" class="ms-item-text" data-ms-text="' + n + '" maxlength="120" value="' + esc(i.text) + '" aria-label="Checklist item ' + (n + 1) + '"><button type="button" class="btn-text" data-ms-drop="' + n + '" aria-label="Remove ' + esc(i.text) + '">Remove</button></li>').join('')
        + '</ul><div class="ms-additem"><input type="text" data-ms-new maxlength="120" placeholder="Add an item…" aria-label="New checklist item"><button type="button" class="btn ghost" data-ms-add>Add</button></div></div>';
    }
    return '<label class="ms-card' + (on ? ' is-on' : '') + '"><input type="radio" name="ms-measure-' + seq + '" value="' + k + '"' + (on ? ' checked' : '') + '><span class="ms-card-title">' + title + '</span><span class="ms-card-hint">' + esc(hint) + '</span></label>' + more;
  }).join('');
  const sharesHtml = () => {
    const mine = d.shares[m.id];
    return '<p class="ms-sum" aria-live="polite"><span data-ms-mine>' + mine + '% of the project</span><span data-ms-rest>' + (alone ? 'the only one counting' : 'the rest share ' + (100 - mine) + '%') + '</span></p>'
      + '<ul class="ms-others">' + ctx.others.map((o) => '<li data-ms-other="' + esc(o.id) + '"><span>' + esc(o.name) + '</span><b>' + d.shares[o.id] + '%</b></li>').join('') + '</ul>'
      + '<p class="ms-total">Total <b data-ms-total>' + Object.values(d.shares).reduce((a, b) => a + b, 0) + '</b>%</p>';
  };
  const host = document.createElement('div');
  host.innerHTML = '<div class="ms-backdrop"><div class="ms-dialog" role="dialog" aria-modal="true" aria-labelledby="ms-title" data-ms-dialog>'
    + '<div class="ms-top"><div><h2 class="ms-title" id="ms-title">Milestone: ' + esc(m.name) + '</h2><p class="ms-sub">' + esc(ctx.sub) + '</p></div><button type="button" class="x" data-ms-cancel aria-label="Close milestone settings">Close ×</button></div>'
    + '<div class="ms-body"><h3 class="ms-h">How much it counts toward ' + esc(ctx.project.name) + '</h3>'
    + '<input type="range" class="ms-slider" min="0" max="100" step="1" value="' + d.shares[m.id] + '"' + (alone ? ' disabled' : '') + ' aria-label="Share of ' + esc(ctx.project.name) + '"><div data-ms-shares>' + sharesHtml() + '</div>'
    + '<h3 class="ms-h">Measure progress by</h3><div class="ms-measure" role="radiogroup" aria-label="Measure progress by" data-ms-measure>' + measureHtml() + '</div></div>'
    + '<div class="ms-actions"><button type="button" class="btn-text" data-ms-cancel>Cancel</button><button type="button" class="btn primary" data-ms-save>Save milestone</button></div></div></div>';
  seq += 1;
  const backdrop = host.firstElementChild;
  document.body.appendChild(backdrop);
  const q = (s) => backdrop.querySelector(s);
  const close = (save) => {
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (save) onSave(d);
    const back = document.querySelector(ctx.returnTo);
    const target = back || (before && before.isConnected ? before : null);
    if (target) target.focus();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); return; }
    if (e.key !== 'Tab') return;
    const f = Array.from(backdrop.querySelectorAll('button, input, [href]')).filter((x) => !x.disabled && x.type !== 'hidden' && x.offsetParent !== null);
    // radios are one tab stop: only the checked one (or the first) of the group is reachable
    const stops = f.filter((x) => x.type !== 'radio' || x.checked);
    const i = stops.indexOf(document.activeElement);
    if (!stops.length) return;
    if (i < 0 || (e.shiftKey && i === 0) || (!e.shiftKey && i === stops.length - 1)) { e.preventDefault(); stops[e.shiftKey ? stops.length - 1 : 0].focus(); }
  };
  document.addEventListener('keydown', onKey, true);
  const repaintMeasure = (focusSel) => { q('[data-ms-measure]').innerHTML = measureHtml(); if (focusSel) { const f = q(focusSel); if (f) f.focus(); } };
  const addItem = () => {
    const inp = q('[data-ms-new]'), text = inp.value.trim();
    if (!text) return;
    d.checklist.push({ id: 'ck_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, done: false });
    repaintMeasure('[data-ms-new]');
  };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-ms-cancel]')) return close(false);
    if (e.target.closest('[data-ms-save]')) return close(true);
    if (e.target.closest('[data-ms-add]')) return addItem();
    const drop = e.target.closest('[data-ms-drop]');
    if (drop) { d.checklist.splice(Number(drop.getAttribute('data-ms-drop')), 1); repaintMeasure('[data-ms-new]'); }
  });
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-ms-new]')) { e.preventDefault(); addItem(); } });
  backdrop.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('.ms-slider')) {
      d.shares = sharesAfter(base, m.id, t.value);
      q('[data-ms-shares]').innerHTML = sharesHtml();
    } else if (t.matches('[data-ms-num]')) d.number[t.getAttribute('data-ms-num')] = t.getAttribute('data-ms-num') === 'name' ? t.value : num(t.value);
    else if (t.matches('[data-ms-text]')) d.checklist[Number(t.getAttribute('data-ms-text'))].text = t.value;
  });
  backdrop.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('input[type="radio"]')) { d.measureBy = t.value; repaintMeasure('input[type="radio"]:checked'); }
    else if (t.matches('[data-ms-tick]')) d.checklist[Number(t.getAttribute('data-ms-tick'))].done = t.checked;
  });
  q('.ms-slider').focus();
}
