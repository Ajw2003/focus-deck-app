
// The first slip in the tray: the queue in tray order (slips sent to the back by "Later" come
// last), or null when the tray is empty.
export function unsortedCurrent(st, u) {
  return orderTray(unsortedQueue(st), u.later)[0] || null;
}

// The Unsorted in-tray: torn-off jotter slips on a small stack in a tray. The top slip shows the
// folder it is going in and the category flags stuck on its edge; below it a folder wallet (a
// thought only; a task is already in its project) and an index-card wallet of flags, then "File it".
// The wallets are js/wallet.js's, so they follow the "Choosing a card" setting. What each action
// does is in js/in-tray.js and js/app.js. See docs/4-systems/in-tray.md
function slipFlags(cards, selected) {
  return selected.map((token) => cards.find((c) => c.token === token)).filter(Boolean)
    .map((c) => '<span class="slip-flag" title="' + esc(c.name) + '" style="--c:' + mutedChip(c.color) + '">' + esc(c.name) + '</span>').join('');
}

function trayWallets(st, u, cur, project, cards, mode) {
  const isThought = cur.kind === 'thought';
  const hint = CHOOSING_MODE_INFO[mode].hint.replace('draw', 'use');
  let html = '';
  if (isThought) {
    const folders = folderCards(st);
    if (folders.length) {
      const items = folders.map((f) => {
        const picked = f.id === u.projectId;
        const detail = picked ? 'chosen' : f.open + ' open';
        return sleeve({ key: f.id, name: f.name, color: f.color, kind: 'project', picked, detail, speak: f.name + ', ' + (picked ? 'chosen. Choose it again to clear.' : detail) });
      });
      const facing = folders.some((f) => f.id === u.facingFolder) ? u.facingFolder : (folders.some((f) => f.id === u.projectId) ? u.projectId : folders[0].id);
      html += '<div class="wallet" id="tray-folder-wallet">' + walletInner({ wallet: 'tray-folders', label: '1. Which folder?', aria: 'Folders. Arrow keys flip, Enter chooses or clears.', items, facing, mode, verb: 'use' }) + '</div>';
    } else {
      html += '<p class="muted small">Add a project below to file this thought into.</p>';
    }
  }
  const items = cards.map((c) => {
    const picked = u.selected.includes(c.token);
    const detail = picked ? 'flag on the slip' : 'no flag yet';
    return sleeve({ key: c.token, name: c.name, color: mutedChip(c.color), picked, detail, speak: c.name + ', ' + detail });
  });
  const facing = cards.some((c) => c.token === u.facingFlag) ? u.facingFlag : cards[0].token;
  html += '<div class="wallet" id="tray-flag-wallet">' + walletInner({ wallet: 'tray-flags', label: (isThought ? '2. ' : '') + 'Stick on category flags', aria: 'Category flags. Arrow keys flip, Enter adds or removes.', items, facing, mode, verb: 'use' }) + '</div>';
  html += '<input type="text" class="sort-new" name="sortNewLabels" value="' + esc(u.newLabels || '') + '" placeholder="New labels, comma-separated…" maxlength="120">';
  return '<div class="wallet-root tray-wallets">' + html + '<div class="flip-hint">' + hint + '</div><div class="sr-only" id="tray-live" aria-live="polite"></div></div>';
}

function renderTray(st, u, ordered, mode) {
  const lip = '<div class="tray-lip"><span>In-tray</span></div>';
  const cur = ordered[0];
  if (!cur) {
    return '<p class="tray-count muted small">0 in the tray</p>'
      + '<div class="tray"><div class="tray-stack"><div class="tray-empty"><p>The tray is empty. Everything has a home.</p><p class="muted small">Jot a thought above and it lands here.</p></div></div>' + lip + '</div>';
  }
  const isThought = cur.kind === 'thought';
  const project = isThought ? (u.projectId ? st.projects.find((p) => p.id === u.projectId) : null) : cur.project;
  const cards = flagCards(st, project);
  const text = isThought ? cur.item.text : cur.task.title;
  const chip = (p) => '<span class="folder-chip" style="--c:' + p.color + '">' + esc(p.name) + '</span>';
  const dest = isThought
    ? (project ? 'Going in ' + chip(project) : 'No folder yet')
    : 'In ' + chip(project) + (cur.task.issueNumber != null ? ' <span class="slip-issue">#' + cur.task.issueNumber + '</span>' : '');
  const when = isThought ? '<div class="slip-when">Thought · ' + relTime(cur.item.createdAt) + '</div>' : '';
  const n = ordered.length;
  const ids = isThought ? 'data-inbox="' + cur.item.id + '"' : 'data-task="' + cur.task.id + '" data-project="' + cur.project.id + '"';
  const file = isThought
    ? (project ? '<button type="button" class="file-btn" data-action="unsorted-file" data-inbox="' + cur.item.id + '">File it in ' + esc(project.name) + ' →</button>' : '<button type="button" class="file-btn" disabled>Choose a folder first</button>')
    : '<button type="button" class="file-btn" data-action="unsorted-save" ' + ids + '>Save in ' + esc(project.name) + ' →</button>';
  return '<p class="tray-count muted small">' + (n === 1 ? '1 in the tray' : n + ' in the tray') + '</p>'
    + '<div class="tray"><div class="tray-stack">'
    + (n >= 2 ? '<div class="slip-behind"></div>' : '') + (n >= 3 ? '<div class="slip-behind two"></div>' : '')
    + '<div class="jot-slip"><div class="slip-flags">' + slipFlags(cards, u.selected) + '</div>'
    + '<p class="slip-text">' + esc(text) + '</p><div class="slip-dest">' + dest + '</div>' + when + '</div>'
    + '</div>' + lip + '</div>'
    + trayWallets(st, u, cur, project, cards, mode)
    + '<div class="sort-acts">' + file
    + '<div class="sort-small"><button type="button" data-action="unsorted-complete" ' + ids + '>Already done</button>'
    + '<button type="button" data-action="unsorted-skip">Later</button>'
    + '<button type="button" data-action="unsorted-delete" ' + ids + '>Bin it</button></div></div>';
}

export function renderInbox(st, ui) {
  const u = ui.unsorted;
  const queue = unsortedQueue(st);
  const body = ui.inboxOpen ? renderTray(st, u, orderTray(queue, u.later), focusChoosingMode(st)) : '';
  return '<section class="card inbox-card">'
    + '<button type="button" class="section-toggle" data-action="toggle-inbox">Unsorted <span class="count">' + queue.length + '</span><span class="chev">' + (ui.inboxOpen ? '−' : '+') + '</span></button>'
    + (ui.inboxOpen ? '<div class="unsorted-body">' + body + '</div>' : '')
    + '</section>';
}
