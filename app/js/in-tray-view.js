// focus-deck-app/js/in-tray-view.js
// The Unsorted in-tray's markup: torn-off jotter slips on a small stack in a tray. The top slip
// shows the folder it is going in and the category flags stuck on its edge; below it a folder wallet
// (a thought only; a task is already in its project) and an index-card wallet of flags, then
// "File it". The wallets are js/wallet.js's, so they follow the "Choosing a card" setting. What each
// action does is in js/in-tray.js and js/app.js. See docs/4-systems/in-tray.md
import { esc, relTime } from './state.js';
import { CHOOSING_MODE_INFO, wording } from './wallet.js';
import { orderTray, flagCards, folderCards } from './in-tray.js';
import { sleeve, walletInner, mutedChip, focusChoosingMode, unsortedQueue } from './render.js';

function slipFlags(cards, selected) {
  return selected.map((token) => cards.find((c) => c.token === token)).filter(Boolean)
    .map((c) => '<span class="slip-flag" title="' + esc(c.name) + '" style="--c:' + mutedChip(c.color) + '">' + esc(c.name) + '</span>').join('');
}

const has = (name, q) => !q || name.toLowerCase().includes(q.toLowerCase());

// The step bar: three tabs, the finished ones can be tapped to go back, later ones are off.
function stepBar(step, folder, flagNames) {
  const tab = (n, label, summary) => '<button type="button" class="step-tab' + (n === step ? ' now' : n < step ? ' done' : '') + '" data-action="sort-step" data-step="' + n + '"' + (n > step ? ' disabled' : '') + '><b>' + n + '. ' + label + '</b><small>' + (n <= step ? esc(summary) : '') + '</small></button>';
  return '<div class="step-bar">' + tab(1, 'Which folder?', folder ? folder.name : '') + tab(2, 'Stick on flags', flagNames.join(', ')) + tab(3, 'Tie to tasks', 'optional') + '</div>';
}

function trayWallets(st, u, project, step, allCards, mode) {
  const hint = wording(CHOOSING_MODE_INFO[mode].hint, 'use');
  const q = u.find || '';
  let html = '';
  if (step === 1) {
    const folders = folderCards(st).filter((f) => has(f.name, q));
    if (!st.projects.length) {
      html += '<p class="muted small">Add a project below to file this thought into.</p>';
    } else {
      html += '<input type="text" class="sort-find" value="' + esc(q) + '" placeholder="Find a folder…" aria-label="Find a folder">';
      if (folders.length) {
        const items = folders.map((f) => {
          const picked = !!project && f.id === project.id;
          const detail = picked ? 'chosen' : f.open + ' open';
          return sleeve({ key: f.id, name: f.name, color: f.color, kind: 'project', picked, detail, speak: f.name + ', ' + (picked ? 'chosen. Choose it again to clear.' : detail) });
        });
        const facing = folders.some((f) => f.id === u.facingFolder) ? u.facingFolder : (project && folders.some((f) => f.id === project.id) ? project.id : folders[0].id);
        html += '<div class="wallet" id="tray-folder-wallet">' + walletInner({ wallet: 'tray-folders', label: 'Which folder?', aria: 'Folders. Arrow keys flip, Enter chooses or clears.', items, facing, mode, verb: 'use' }) + '</div>';
      } else {
        html += '<p class="muted small find-empty">No folder matches “' + esc(q) + '”.</p>';
      }
    }
  } else if (step === 2) {
    const cards = flagCards(st, project, { selected: u.selected, showAll: !!u.showAllFlags || !!q }).filter((c) => q ? !c.more && has(c.name, q) : true);
    const exact = st.categories.some((c) => c.name.toLowerCase() === q.trim().toLowerCase());
    html += '<input type="text" class="sort-find" value="' + esc(q) + '" placeholder="Find a flag, or type a new one…" aria-label="Find a flag">';
    if (q.trim() && !exact) html += '<button type="button" class="new-flag" data-action="sort-new-flag">+ New flag “' + esc(q.trim()) + '”</button>';
    if (cards.length) {
      const items = cards.map((c) => {
        if (c.more) return sleeve({ key: c.token, name: c.name, color: c.color, detail: c.more + ' more', speak: c.more + ' more categories. Choose to show them all.' });
        const picked = u.selected.includes(c.token);
        const detail = picked ? 'flag on the slip' : 'no flag yet';
        return sleeve({ key: c.token, name: c.name, color: mutedChip(c.color), picked, detail, speak: c.name + ', ' + detail });
      });
      const facing = cards.some((c) => c.token === u.facingFlag) ? u.facingFlag : cards[0].token;
      html += '<div class="wallet" id="tray-flag-wallet">' + walletInner({ wallet: 'tray-flags', label: 'Stick on category flags', aria: 'Category flags. Arrow keys flip, Enter adds or removes.', items, facing, mode, verb: 'use' }) + '</div>';
    }
  } else {
    html += '<p class="muted small">Links arrive in the next update.</p>';
  }
  return '<div class="wallet-root tray-wallets">' + stepBar(step, project, u.selected.map((t) => (allCards.find((c) => c.token === t) || {}).name).filter(Boolean)) + html + '<div class="flip-hint">' + hint + '</div><div class="sr-only" id="tray-live" aria-live="polite"></div></div>';
}

function renderTray(st, u, ordered, mode) {
  const lip = '<div class="tray-lip"><span>In-tray</span></div>';
  const cur = ordered[0];
  if (!cur) {
    return '<p class="tray-count muted small">0 in the tray</p>'
      + '<div class="tray"><div class="tray-stack"><div class="tray-empty"><p>The tray is empty. Everything has a home.</p><p class="muted small">Jot a thought above and it lands here.</p></div></div>' + lip + '</div>';
  }
  const isThought = cur.kind === 'thought';
  const step = u.step || 1;
  // a task slip's folder is its own project until another is chosen
  const project = u.projectId ? st.projects.find((p) => p.id === u.projectId) : (isThought ? null : cur.project);
  const allCards = flagCards(st, project, { selected: u.selected, showAll: true });
  const editable = isThought || cur.task.issueNumber == null;
  const text = u.title != null ? u.title : (isThought ? cur.item.text : cur.task.title);
  const notes = u.notes != null ? u.notes : (isThought ? '' : cur.task.notes || '');
  const chip = (p) => '<span class="folder-chip" style="--c:' + p.color + '">' + esc(p.name) + '</span>';
  const dest = (project ? (isThought ? 'Going in ' : 'In ') + chip(project) : 'No folder yet')
    + (!isThought && cur.task.issueNumber != null ? ' <span class="slip-issue">#' + cur.task.issueNumber + '</span>' : '');
  const when = isThought ? '<div class="slip-when">Thought · ' + relTime(cur.item.createdAt) + '</div>' : '';
  const noteBox = u.notesOpen || notes
    ? '<textarea class="slip-notes" name="slipNotes" placeholder="Notes…">' + esc(notes) + '</textarea>'
    : '<button type="button" class="slip-notes-link" data-action="sort-add-notes">+ Add notes</button>';
  const n = ordered.length;
  const ids = isThought ? 'data-inbox="' + cur.item.id + '"' : 'data-task="' + cur.task.id + '" data-project="' + cur.project.id + '"';
  const main = step === 1
    ? (project ? '<button type="button" class="file-btn" data-action="sort-next">Next: flags →</button>' : '<button type="button" class="file-btn" disabled>Choose a folder first</button>')
    : step === 2 ? '<button type="button" class="file-btn" data-action="sort-next">Next: tie to tasks →</button>'
    : isThought
      ? '<button type="button" class="file-btn" data-action="unsorted-file" data-inbox="' + cur.item.id + '">File it in ' + esc(project.name) + ' →</button>'
      : '<button type="button" class="file-btn" data-action="unsorted-save" ' + ids + '>Save in ' + esc(project.name) + ' →</button>';
  // .tray-side holds the slip and its buttons: on a wide Sort screen it stays in view beside the
  // choices; on a phone it dissolves (display:contents) so the buttons come after the choices
  return '<div class="tray-side"><p class="tray-count muted small">' + (n === 1 ? '1 in the tray' : n + ' in the tray') + '</p>'
    + '<div class="tray"><div class="tray-stack">'
    + (n >= 2 ? '<div class="slip-behind"></div>' : '') + (n >= 3 ? '<div class="slip-behind two"></div>' : '')
    + '<div class="jot-slip"><div class="slip-flags">' + slipFlags(allCards, u.selected) + '</div>'
    + '<p class="slip-text"' + (editable ? ' contenteditable="true" spellcheck="false" data-slip-title' : '') + '>' + esc(text) + '</p><div class="slip-dest">' + dest + '</div>' + when + noteBox + '</div>'
    + '</div>' + lip + '</div>'
    + '<div class="sort-acts">' + main
    + '<div class="sort-small">' + (step > 1 ? '<button type="button" data-action="sort-back">← Back</button>' : '')
    + '<button type="button" data-action="unsorted-complete" ' + ids + '>Already done</button>'
    + '<button type="button" data-action="unsorted-skip">Later</button>'
    + '<button type="button" data-action="unsorted-delete" ' + ids + '>Bin it</button></div></div></div>'
    + trayWallets(st, u, project, step, allCards, mode);
}

// The top slip: the queue in tray order (slips sent to the back by "Later" come last), or null
// when the tray is empty. app.js uses its key to reset the per-slip scratch.
export function unsortedCurrent(st, u) {
  return orderTray(unsortedQueue(st), u.later)[0] || null;
}

// The whole Unsorted card (the replacement for render.js's renderInbox). `ui.unsorted.later` is the
// list of slips sent to the back.
export function renderInTrayCard(st, ui) {
  const u = ui.unsorted;
  const queue = unsortedQueue(st);
  const body = ui.inboxOpen ? renderTray(st, u, orderTray(queue, u.later), focusChoosingMode(st)) : '';
  return '<section class="card inbox-card">'
    + '<button type="button" class="section-toggle" data-action="toggle-inbox">Unsorted <span class="count">' + queue.length + '</span><span class="chev">' + (ui.inboxOpen ? '−' : '+') + '</span></button>'
    + (ui.inboxOpen ? '<div class="unsorted-body">' + body + '</div>' : '')
    + '</section>';
}
