// focus-deck-app/js/in-tray.js
// The Unsorted in-tray's decisions, with no DOM: the order of the tray (Later sends a slip to the
// back), which category flags are on offer and in what order, and what "File it" does. render.js
// draws it and app.js wires the clicks; the mutations are the same ones the old Unsorted pills
// used (M.fileInboxItem, M.updateTaskFields). Tested in in-tray.test.mjs.
// See docs/4-systems/in-tray.md
import { TASK_KINDS, formatLabelName } from './state.js';

// The tray in order: everything not sent to the back, in queue order, then the slips sent to the
// back, in the order they were sent. `later` is a list of queue keys; keys no longer in the queue
// are ignored.
export function orderTray(queue, later) {
  const sent = later || [];
  const front = queue.filter((x) => !sent.includes(x.key));
  const back = sent.map((k) => queue.find((x) => x.key === k)).filter(Boolean);
  return front.concat(back);
}

// "Later": the key goes to the end of the list (and only once).
export function sendToBack(later, key) {
  return (later || []).filter((k) => k !== key).concat(key);
}

// Choosing a card again undoes it.
export function toggleToken(list, token) {
  return list.includes(token) ? list.filter((x) => x !== token) : list.concat(token);
}

// The folder a slip is going to after a choose: choosing the chosen folder clears it.
export function toggleFolder(current, key) {
  return current === key ? null : key;
}

// The category flags on offer: the three task kinds first (an existing label of that name, else a
// "kind:<key>" token whose label is created on first use), then every other label ranked for the
// chosen project: that project's labels first (busiest first), then by use across every project,
// then by name. Same ranking the old "Other labels" pills had. Colours are raw (render.js mutes them).
export function flagCards(st, project) {
  const kindCat = (k) => st.categories.find((c) => c.name.toLowerCase() === k.key);
  const kindIds = new Set(TASK_KINDS.map(kindCat).filter(Boolean).map((c) => c.id));
  const kinds = TASK_KINDS.map((k) => {
    const cat = kindCat(k);
    return { token: cat ? cat.id : 'kind:' + k.key, name: k.label, color: cat ? cat.color : k.color };
  });
  const useIn = (tasks) => {
    const n = {};
    tasks.forEach((x) => (x.categoryIds || []).forEach((id) => { n[id] = (n[id] || 0) + 1; }));
    return n;
  };
  const here = useIn(project ? project.tasks : []);
  const everywhere = useIn(st.projects.flatMap((proj) => proj.tasks));
  const others = st.categories.filter((c) => !kindIds.has(c.id))
    .sort((a, b) => (here[b.id] || 0) - (here[a.id] || 0) || (everywhere[b.id] || 0) - (everywhere[a.id] || 0) || a.name.localeCompare(b.name))
    .map((c) => ({ token: c.id, name: formatLabelName(c.name), color: c.color }));
  return kinds.concat(others);
}

// The folders on offer for a thought: busiest (most open tasks) first, then by name.
export function folderCards(st) {
  const open = (p) => p.tasks.filter((t) => t.status !== 'done').length;
  return st.projects.map((p) => ({ id: p.id, name: p.name, color: p.color, open: open(p) }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

// The picks as label ids: chosen flags, kind tokens (their label is created on first use, through
// `labelIdByName(name, color)`), and anything typed in "New labels" (comma-separated).
export function selectionToIds(selected, newLabels, labelIdByName) {
  const ids = [];
  const add = (id) => { if (!ids.includes(id)) ids.push(id); };
  selected.forEach((token) => {
    const kind = token.startsWith('kind:') && TASK_KINDS.find((k) => 'kind:' + k.key === token);
    add(kind ? labelIdByName(kind.key, kind.color) : token);
  });
  String(newLabels || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((name) => add(labelIdByName(name)));
  return ids;
}

// "File it in <folder> →" for a thought, and "Save" for a task that is already in a project.
// `cur` is the top of the tray; `pick` is { projectId, selected, newLabels }; `deps` are the
// mutations (M.fileInboxItem, M.updateTaskFields), createIssue(task, projectId) (the GitHub issue
// for a repo-linked project) and labelIdByName. Returns what happened:
//   { outcome: 'filed', task, projectId }   a thought became a task in the chosen project
//   { outcome: 'saved', taskId }            a task got its flags
//   { outcome: 'later' }                    a task with no flags: nothing to save, to the back of the tray
//   { outcome: 'none' }                     a thought with no folder chosen: nothing happens
export function fileSlip(cur, pick, deps) {
  if (cur.kind === 'thought' && !pick.projectId) return { outcome: 'none' };
  const ids = selectionToIds(pick.selected, pick.newLabels, deps.labelIdByName);
  if (cur.kind === 'thought') {
    const task = deps.fileInboxItem(cur.item.id, pick.projectId, ids);
    deps.createIssue(task, pick.projectId);
    return { outcome: 'filed', task, projectId: pick.projectId };
  }
  if (ids.length) { deps.updateTaskFields(cur.task.id, { categoryIds: ids }); return { outcome: 'saved', taskId: cur.task.id }; }
  return { outcome: 'later' };
}
