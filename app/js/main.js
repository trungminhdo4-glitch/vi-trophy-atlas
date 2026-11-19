// VI Trophy Atlas: loads the trophy and roadmap data, keeps progress in the store, and routes between
// the checklist, the roadmap and the missables view (#/list, #/roadmap, #/missables, #/trophy/<id>).

import { byId, h } from './dom.js';
import { FILTERS, GRADE_ORDER, countFor, filterTrophies } from './filters.js';
import { exportFile, getCount, isEarned, loadState, parseImport, saveState, setCount, setEarned } from './store.js';
import { renderDetail } from './view-detail.js';
import { renderList } from './view-list.js';
import { renderMissables, renderRoadmap } from './view-roadmap.js';

const [doc, roadmap] = await Promise.all([loadJson('data/trophies.json'), loadJson('data/roadmap.json')]);
const trophies = doc.trophies;
const state = loadState();
const ui = { view: 'list', selected: 17, filter: 'all', grade: 'all', status: 'all', query: '', revealed: new Set() };

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

const ctx = {
  sources: doc.sources,
  get spoiler() { return state.prefs.spoiler; },
  get selected() { return ui.selected; },
  get filters() { return ui; },
  get revealed() { return ui.revealed; },
  isEarned: (id) => isEarned(state, id),
  getCount: (id) => getCount(state, id),
  onToggle(id, on) {
    setEarned(state, id, on);
    autoPlatinum();
    commit();
  },
  onCount(id, value) {
    const t = trophies.find((x) => x.id === id);
    const n = setCount(state, t, value);
    if (n >= t.count && !isEarned(state, id)) setEarned(state, id, true);
    autoPlatinum();
    commit();
  },
  onSelect(id) {
    ui.selected = id;
    location.hash = `#/trophy/${id}`;
  },
  onOpen(id) {
    ui.selected = id;
    location.hash = `#/trophy/${id}`;
  },
  onReveal(id) {
    ui.revealed.add(id);
    render();
  },
};

function autoPlatinum() {
  const others = trophies.filter((t) => t.id !== 1);
  setEarned(state, 1, others.every((t) => isEarned(state, t.id)));
}

function commit() {
  if (!saveState(state)) toast('Could not save: browser storage is blocked.');
  render();
}

function toast(text) {
  const el = byId('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function renderSummary() {
  const earned = trophies.filter((t) => isEarned(state, t.id));
  const pct = Math.round((earned.length / trophies.length) * 100);
  byId('ring').style.setProperty('--pct', pct);
  byId('ring-text').textContent = `${pct}%`;
  byId('earned-count').textContent = `${earned.length} / ${trophies.length} earned`;
  byId('grade-stats').replaceChildren(
    ...GRADE_ORDER.map((g) => {
      const all = trophies.filter((t) => t.grade === g).length;
      const got = earned.filter((t) => t.grade === g).length;
      return h('span', { class: `gstat grade-${g}` }, h('span', { class: `medal medal-${g}` }), `${got}/${all}`);
    }),
  );
}

function renderFilters() {
  byId('chips').replaceChildren(
    ...FILTERS.map((f) => h('button', { type: 'button', class: `fchip${ui.filter === f.id ? ' on' : ''}`, 'aria-pressed': String(ui.filter === f.id), onclick: () => { ui.filter = f.id; render(); } }, f.label, h('small', { text: countFor(trophies, f.id) }))),
  );
  byId('spoiler').value = state.prefs.spoiler;
}

function renderTabs() {
  for (const tab of document.querySelectorAll('[data-view]')) tab.classList.toggle('on', tab.dataset.view === ui.view);
  byId('list-view').hidden = ui.view !== 'list';
  byId('roadmap-view').hidden = ui.view !== 'roadmap';
  byId('missables-view').hidden = ui.view !== 'missables';
}

function render() {
  renderSummary();
  renderFilters();
  renderTabs();
  const shown = filterTrophies(trophies, ui, (id) => isEarned(state, id), state.prefs.spoiler);
  byId('shown').textContent = `${shown.length} shown`;
  renderList(byId('rows'), shown, ctx);
  if (ui.view === 'roadmap') renderRoadmap(byId('roadmap-view'), roadmap, trophies, ctx);
  if (ui.view === 'missables') renderMissables(byId('missables-view'), trophies, ctx);
  renderDetail(byId('detail'), trophies.find((t) => t.id === ui.selected), ctx);
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'trophy' && trophies.some((t) => t.id === Number(parts[1]))) {
    ui.selected = Number(parts[1]);
    ui.view = ui.view === 'roadmap' || ui.view === 'missables' ? ui.view : 'list';
  } else if (['list', 'roadmap', 'missables'].includes(parts[0])) {
    ui.view = parts[0];
  }
  render();
  if (parts[0] === 'trophy' && ui.view === 'list') scrollRowIntoList(ui.selected);
}

function scrollRowIntoList(id) {
  const list = byId('rows');
  const row = list.querySelector(`.row[data-id="${id}"]`);
  if (!row) return;
  const top = row.offsetTop - list.offsetTop;
  if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) {
    list.scrollTop = Math.max(0, top - list.clientHeight / 3);
  }
}

function wireControls() {
  byId('search').addEventListener('input', (e) => { ui.query = e.target.value.trim(); render(); });
  byId('grade').addEventListener('change', (e) => { ui.grade = e.target.value; render(); });
  byId('status').addEventListener('change', (e) => { ui.status = e.target.value; render(); });
  byId('spoiler').addEventListener('change', (e) => { state.prefs.spoiler = e.target.value; ui.revealed.clear(); commit(); });
  for (const tab of document.querySelectorAll('[data-view]')) tab.addEventListener('click', () => { location.hash = `#/${tab.dataset.view}`; ui.view = tab.dataset.view; render(); });
  byId('export').addEventListener('click', () => { exportFile(state, trophies); toast('Progress exported.'); });
  byId('import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const next = parseImport(await file.text(), trophies);
      Object.assign(state, next);
      commit();
      toast(`Imported: ${Object.keys(state.earned).length} trophies earned.`);
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    }
  });
  byId('reset').addEventListener('click', () => {
    if (!confirm('Clear all progress on this device? Export first if you want a backup.')) return;
    state.earned = {};
    state.counts = {};
    commit();
  });
  window.addEventListener('hashchange', route);
}

wireControls();
route();
