import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { normalizeView, viewProjects, viewState, defaultFor, renderViewSwitch, VIEW_ALL } from './view-switch.js';
import { boardList } from './board.js';
import { renderRoadmap } from './roadmap-view.js';
import { folderCards } from './in-tray.js';
import { renderInTrayCard } from './in-tray-view.js';

const t = (id, extra = {}) => ({ id, title: id, status: 'next', categoryIds: [], sortOrder: 1, ...extra });
const st = () => ({
  projectCategories: [{ id: 'pcat_home', name: 'Home', color: '#a50' }, { id: 'pcat_work', name: 'Work', color: '#05a' }, { id: 'pcat_unsorted', name: 'Unsorted', color: '#888' }],
  categories: [],
  projects: [
    { id: 'a', name: 'Shed', color: '#111', categoryId: 'pcat_home', tasks: [t('t1'), t('t2')] },
    { id: 'b', name: 'Garden', color: '#222', categoryId: 'pcat_home', tasks: [t('t3')] },
    { id: 'c', name: 'Report', color: '#333', categoryId: 'pcat_work', tasks: [t('t4')] },
    { id: 'd', name: 'Loose', color: '#444', tasks: [t('t5')] }, // no area = Unsorted
    { id: 'e', name: 'Ghost', color: '#555', categoryId: 'pcat_gone', tasks: [t('t6')] }, // gone area = Unsorted
  ],
  inbox: [{ id: 'i1', text: 'thought', createdAt: 1 }],
});
const NOW = Date.now();
const ids = (v) => boardList(st(), { tab: 'next', view: v }, NOW).tasks.map((x) => x.id);
const AREA = (id) => ({ mode: 'area', id });

test('normalizeView: junk, gone area and gone project are All; Unsorted is an area', () => {
  assert.deepStrictEqual(normalizeView(null, st()), VIEW_ALL);
  assert.deepStrictEqual(normalizeView({ mode: 'area', id: 'nope' }, st()), VIEW_ALL);
  assert.deepStrictEqual(normalizeView({ mode: 'project', id: 'nope' }, st()), VIEW_ALL);
  assert.deepStrictEqual(normalizeView({ mode: 'bogus' }, st()), VIEW_ALL);
  assert.deepStrictEqual(normalizeView(AREA('pcat_unsorted'), st()), AREA('pcat_unsorted'));
  assert.deepStrictEqual(normalizeView({ mode: 'project', id: 'c' }, st()), { mode: 'project', id: 'c' });
  assert.deepStrictEqual(normalizeView(AREA('pcat_unsorted'), { projects: [] }), AREA('pcat_unsorted'), 'Unsorted exists even if the list lacks it');
});

test('Board data: All, Area, Project, Unsorted', () => {
  assert.deepStrictEqual(ids(VIEW_ALL), ['t1', 't2', 't3', 't4', 't5', 't6'], 'All includes Unsorted');
  assert.deepStrictEqual(ids(AREA('pcat_home')), ['t1', 't2', 't3']);
  assert.deepStrictEqual(ids(AREA('pcat_unsorted')), ['t5', 't6'], 'no area and a gone area both count as Unsorted');
  assert.deepStrictEqual(ids({ mode: 'project', id: 'c' }), ['t4']);
  assert.strictEqual(boardList(st(), { tab: 'next', view: AREA('pcat_work') }, NOW).counts.next, 1, 'counts follow the view');
});

test('Focus data (viewState) and Projects (viewProjects)', () => {
  const s = st(); s._ui = { view: AREA('pcat_home') };
  assert.deepStrictEqual(viewState(s).projects.map((p) => p.id), ['a', 'b']);
  assert.strictEqual(s.projects.length, 5, 'the real state is not touched');
  assert.deepStrictEqual(viewProjects(s, { mode: 'project', id: 'd' }).map((p) => p.id), ['d']);
  assert.strictEqual(viewProjects(s, VIEW_ALL).length, 5);
  assert.strictEqual(viewState(st()).projects.length, 5, 'no view = everything');
});

test('Sort: project choices follow the view, thoughts are not filtered', () => {
  const s = st(); s._ui = { view: AREA('pcat_work') };
  assert.deepStrictEqual(folderCards(viewState(s)).map((f) => f.id), ['c']);
  const html = renderInTrayCard(s, { unsorted: { later: [], selected: [], step: 1, sub: null }, inboxOpen: true });
  assert.ok(html.includes('thought'), 'the thought is still in the tray');
  assert.ok(html.includes('Report') && !html.includes('Garden'), 'only the area\'s projects are offered');
});

test('Roadmap group view: only the view\'s projects, in the Find box\'s narrowing', () => {
  const h = renderRoadmap(st(), { view: AREA('pcat_work') }, false);
  assert.ok(h.includes('Report') && !h.includes('Shed') && !h.includes('Garden'));
});

test('defaultFor: tapping a mode picks something real, keeps the current pick', () => {
  assert.deepStrictEqual(defaultFor('all', AREA('pcat_home'), st()), VIEW_ALL);
  assert.deepStrictEqual(defaultFor('area', VIEW_ALL, st()), AREA('pcat_home'), 'first area with projects');
  assert.deepStrictEqual(defaultFor('area', AREA('pcat_work'), st()), AREA('pcat_work'));
  assert.deepStrictEqual(defaultFor('project', VIEW_ALL, st()), { mode: 'project', id: 'b' }, 'first by name');
  assert.deepStrictEqual(defaultFor('project', VIEW_ALL, { projects: [], projectCategories: [] }), VIEW_ALL, 'no projects: stays All');
});

test('markup: one tape naming the view in caps, a drawer of index cards, areas and projects listed, search over 8 projects', () => {
  const s = st();
  const all = renderViewSwitch(s, VIEW_ALL, false);
  assert.ok(all.includes('vs-tape') && all.includes('>Everything<') && !all.includes('vs-pop') && !all.includes('vs-seg'), 'a tape, no switch, drawer shut');
  const menu = renderViewSwitch(s, VIEW_ALL, 'menu');
  assert.ok(menu.includes('role="dialog"') && menu.includes('>Everything</button>') && menu.includes('One area ›') && menu.includes('One project ›'), 'the drawer: Everything, One area, One project');
  const area = renderViewSwitch(s, AREA('pcat_home'), 'area');
  assert.ok(area.includes('vs-pick-name">Home<') && area.includes('vs-dot') && area.includes('view-step'), 'the tape names the area; the list has a back corner');
  assert.strictEqual((area.match(/data-action="view-pick"/g) || []).length, 3, 'every area');
  assert.ok(!renderViewSwitch(s, { mode: 'project', id: 'a' }, 'project').includes('vs-search'), 'no search for 5 projects');
  for (let i = 0; i < 4; i++) s.projects.push({ id: 'x' + i, name: 'X' + i, color: '#000', tasks: [] });
  const many = renderViewSwitch(s, { mode: 'project', id: 'a' }, 'project');
  assert.ok(many.includes('vs-search') && many.includes('vs-group">Home'), 'search and grouped by area');
});

test('persistence: the view is a localStorage key, not synced state', () => {
  assert.deepStrictEqual(normalizeView(JSON.parse(JSON.stringify(AREA('pcat_home'))), st()), AREA('pcat_home'), 'a stored view reads back');
  const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("'focusdeck-view'") && app.includes('localStorage.setItem(VIEW_KEY'));
  const mut = readFileSync(new URL('./mutations.js', import.meta.url), 'utf8');
  assert.ok(!/state\.view\b/.test(mut), 'nothing writes the view into state');
});
