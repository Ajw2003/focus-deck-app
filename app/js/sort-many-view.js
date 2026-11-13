// focus-deck-app/js/sort-many-view.js
// "Sort several" (#265): five screens on the same clipboard as the Sort steps (tick the thoughts, one
// project, labels, group under one task, the receipt). What a tap does is onBulkAction in js/app.js;
// what Sort N does is bulkSort in js/in-tray.js. See docs/4-systems/in-tray.md#sort-many-at-once
import { esc, PRIORITY, PRIORITY_ORDER } from './state.js';
import { viewState } from './view-switch.js';
import { flagCards, folderCards, pickedSlips, bulkBlocker } from './in-tray.js';
import { sleeve, walletInner, mutedChip } from './render.js';
import { stamp, foot, dots, why } from './sort-flow-view.js';

export const MANY_LAST = 5;
const TITLES = ['', 'Which ones?', 'Which project?', 'What kind of work?', 'Group under one task?', 'All good?'];
const has = (name, q) => !q || name.toLowerCase().includes(q.toLowerCase());
const back = () => '<button type="button" class="dk-back" data-action="bulk-back">‹ Back</button>';
const skip = () => '<button type="button" class="dk-skip" data-action="bulk-skip">Skip</button>';
const findBox = (b, ph) => '<input type="text" class="sort-find" data-bulk-find value="' + esc(b.find || '') + '" placeholder="' + ph + '" aria-label="' + ph.replace('…', '') + '">';

function tickStep(b, ordered, picked) {
  const rows = ordered.map((x) => {
    const on = picked.includes(x);
    return '<label class="bulk-row' + (on ? ' on' : '') + '"><input type="checkbox" data-bulk-key="' + esc(x.key) + '"' + (on ? ' checked' : '') + '>'
      + '<span class="bulk-body"><span class="bulk-text">' + esc(x.kind === 'thought' ? x.item.text : x.task.title) + '</span></span></label>';
  }).join('');
  return '<div class="many-list">' + (rows || '<p class="muted">Nothing left to sort.</p>') + '</div>'
    + '<div class="sort-row2"><button type="button" class="dk-link" data-action="bulk-all">✓ All</button><button type="button" class="dk-link" data-action="bulk-none"' + (picked.length ? '' : ' disabled') + '>Clear</button></div>';
}

function projectStep(st, b, project, thoughts, mode) {
  const q = b.find || '';
  const folders = folderCards(viewState(st)).filter((f) => has(f.name, q));
  let html = findBox(b, 'Find a project…');
  if (folders.length) {
    const items = folders.map((f) => {
      const picked = !!project && f.id === project.id, detail = picked ? 'chosen' : f.open + ' open';
      return sleeve({ key: f.id, name: f.name, color: f.color, kind: 'project', picked, detail, speak: f.name + ', ' + (picked ? 'chosen. Choose it again to clear.' : detail) });
    });
    const facing = folders.some((f) => f.id === b.facingFolder) ? b.facingFolder : (project && folders.some((f) => f.id === project.id) ? project.id : folders[0].id);
    html += '<div class="wallet" id="tray-folder-wallet">' + walletInner({ wallet: 'tray-folders', label: '', aria: 'Projects. Arrow keys flip, Enter chooses or clears.', items, facing, mode, verb: 'use' }) + '</div>';
  } else html += '<p class="muted find-empty">No project matches “' + esc(q) + '”.</p>';
  // thoughts have no priority yet, and filing needs one (bulkBlocker)
  if (thoughts) html += '<div class="sort-picks sort-flags" role="group" aria-label="Priority">' + PRIORITY_ORDER.map((l) => '<button type="button" class="sort-flag' + (b.priority === l ? ' on' : '') + '" data-level="' + l + '" data-action="pick-set" data-scope="bulk" data-field="priority" data-value="' + l + '" aria-pressed="' + (b.priority === l) + '">' + esc(PRIORITY[l].label) + '</button>').join('') + '</div>';
  return html;
}

function labelsStep(st, b, project, mode) {
  const q = b.find || '';
  const cards = flagCards(st, project, { selected: b.selected, showAll: !!b.showAllFlags || !!q }).filter((x) => q ? !x.more && has(x.name, q) : true);
  let html = findBox(b, 'Find a kind of work…');
  if (cards.length) {
    const items = cards.map((x) => {
      if (x.more) return sleeve({ key: x.token, name: x.name, color: x.color, detail: x.more + ' more', speak: x.more + ' more categories. Choose to show them all.' });
      const picked = b.selected.includes(x.token);
      return sleeve({ key: x.token, name: x.name, color: mutedChip(x.color), picked, detail: '', speak: x.name + (picked ? ', on all of them' : ', not picked') });
    });
    const facing = cards.some((x) => x.token === b.facingFlag) ? b.facingFlag : cards[0].token;
    html += '<div class="wallet" id="tray-flag-wallet">' + walletInner({ wallet: 'tray-flags', label: '', aria: 'Kinds of work. Arrow keys flip, Enter adds or removes.', items, facing, mode, verb: 'use' }) + '</div>';
  } else html += '<p class="muted find-empty">No label matches “' + esc(q) + '”.</p>';
  const all = flagCards(st, project, { selected: b.selected, showAll: true });
  const picked = b.selected.map((t) => all.find((x) => x.token === t)).filter(Boolean);
  return html + '<div class="sort-picked">' + (picked.length ? '📎 ' + picked.map((x) => '<button type="button" class="dk-tag" data-action="bulk-flag" data-token="' + esc(x.token) + '" aria-label="Take off ' + esc(x.name) + '">' + esc(x.name) + ' ×</button>').join('') : '') + '</div>'
    + '<div class="sort-row2"><button type="button" class="dk-link" data-action="bulk-new-label">+ New label</button></div>';
}

function receipt(st, b, picked, project) {
  const all = flagCards(st, project, { selected: b.selected, showAll: true });
  const names = b.selected.map((t) => (all.find((x) => x.token === t) || {}).name).filter(Boolean);
  const n = picked.length;
  const rows = [
    ['☑', n + (n === 1 ? ' item' : ' items'), 1],
    ['📁', project ? project.name : 'Where they are', 2],
    ['🗂', names.join(', ') || '—', 3],
    ['🧩', (b.groupTitle || '').trim() || '—', 4],
  ];
  if (picked.some((x) => x.kind === 'thought')) rows.splice(2, 0, ['🚩', b.priority ? PRIORITY[b.priority].label : '—', 2]);
  return '<div class="dk-summary sort-receipt">' + rows.map(([icon, val, step]) => '<div><span aria-hidden="true">' + icon + '</span><em>' + esc(val) + '</em>'
    + '<button type="button" class="dk-pencil" data-action="bulk-step" data-step="' + step + '" aria-label="Change step ' + step + '">✎</button></div>').join('') + '</div>';
}

export function renderSortMany(st, b, ordered, { mode }) {
  const picked = pickedSlips(ordered, b.picked), n = picked.length;
  const thoughts = picked.some((x) => x.kind === 'thought');
  const project = b.projectId ? st.projects.find((p) => p.id === b.projectId) : null;
  const step = b.step || 1;
  const board = (inner, q) => '<div class="dk-board sort-board"><div class="dk-paper sort-paper"><h2 class="sort-q">' + q + '</h2><div class="sort-body">' + inner + '</div></div></div>';
  const bar = dots(step, MANY_LAST);
  if (b.sub === 'newlabel') {
    const body = '<input type="text" class="sort-find sort-type" data-bulk-newlabel value="' + esc(b.newLabel || '') + '" placeholder="Name the label…" aria-label="New label">';
    return bar + board(body, 'New label') + foot([back(), stamp('Add', { action: 'bulk-new-flag', disabled: !(b.newLabel || '').trim() })]);
  }
  let body = '', next = stamp('Next', { action: 'bulk-next' });
  if (step === 1) { body = tickStep(b, ordered, picked); if (!n) next = stamp('Next', { action: 'bulk-next', disabled: true }); }
  else if (step === 2) {
    body = projectStep(st, b, project, thoughts, mode);
    if (thoughts && (!project || !b.priority)) { next = stamp('Next', { action: 'bulk-next', disabled: true }); }
  } else if (step === 3) body = labelsStep(st, b, project, mode);
  else if (step === 4) body = '<input type="text" class="slip-notes many-group" data-bulk-group value="' + esc(b.groupTitle || '') + '" placeholder="Task name…" aria-label="Task to group them under">';
  else {
    const blocked = !n || !!bulkBlocker(picked, b);
    return bar + board(receipt(st, b, picked, project) + why(b.why), TITLES[5])
      + foot([back(), stamp('Sort ' + n, { action: 'bulk-apply', disabled: blocked })]);
  }
  return bar + board(body + why(b.why) + '<div class="sr-only" id="tray-live" aria-live="polite"></div>', TITLES[step])
    + foot([back()].concat(step === 3 || step === 4 ? [skip()] : [], [next]));
}
