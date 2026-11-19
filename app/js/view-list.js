// The checklist: one row per trophy with its tick box, grade medal, official name and description, and flags.

import { h, formatCount } from './dom.js';
import { isConcealed, KIND_LABELS } from './filters.js';

export function gradeMedal(grade) {
  return h('span', { class: `medal medal-${grade}`, title: grade, 'aria-label': grade });
}

export function missableBadge(trophy) {
  if (trophy.missable === 'missable') return h('span', { class: 'badge badge-miss', text: 'Missable' });
  if (trophy.missable === 'caution') return h('span', { class: 'badge badge-caution', text: 'Caution' });
  return null;
}

export function trophyTitle(trophy, concealed) {
  if (!concealed) return trophy.name;
  return trophy.kind === 'story' ? 'Hidden story trophy' : 'Hidden trophy';
}

export function trophyDescription(trophy, concealed) {
  return concealed ? `${trophy.chapter}. Earn it or change the spoiler setting to reveal.` : trophy.description;
}

export function renderList(container, trophies, ctx) {
  container.replaceChildren();
  if (trophies.length === 0) {
    const online = ctx.filters.filter === 'online';
    container.append(
      h('li', { class: 'empty' }, online ? 'No online trophies: the PS5 list is single-player only (KeenGamer, GTABase, Output Lag).' : 'No trophy matches these filters.'),
    );
    return;
  }
  for (const t of trophies) container.append(renderRow(t, ctx));
}

function renderRow(t, ctx) {
  const earned = ctx.isEarned(t.id);
  const concealed = isConcealed(t, ctx.spoiler, earned);
  const label = concealed ? `Hidden story trophy ${t.id}` : t.name;
  const box = h('input', {
    type: 'checkbox',
    class: 'tick',
    'aria-label': `Earned: ${label}`,
    onchange: (e) => ctx.onToggle(t.id, e.target.checked),
    onclick: (e) => e.stopPropagation(),
  });
  box.checked = earned;
  const count = t.count && t.id !== 1 ? progressText(t, ctx) : null;
  return h(
    'li',
    {
      class: `row${earned ? ' is-earned' : ''}${ctx.selected === t.id ? ' is-selected' : ''}${concealed ? ' is-concealed' : ''}`,
      dataset: { id: t.id },
      tabindex: 0,
      onclick: () => ctx.onSelect(t.id),
      onkeydown: (e) => { if (e.key === 'Enter') ctx.onSelect(t.id); },
    },
    box,
    gradeMedal(t.grade),
    h(
      'div',
      { class: 'row-main' },
      h('div', { class: 'row-title' }, h('span', { class: 'row-name', text: trophyTitle(t, concealed) }), missableBadge(t), t.verified === 'unconfirmed' ? h('span', { class: 'badge badge-unconf', text: 'Unconfirmed' }) : null),
      h('div', { class: 'row-desc', text: trophyDescription(t, concealed) }),
    ),
    h('div', { class: 'row-meta' }, h('span', { class: 'kind', text: KIND_LABELS[t.kind] }), count ? h('span', { class: 'count', text: count }) : null),
  );
}

function progressText(t, ctx) {
  const n = ctx.isEarned(t.id) ? t.count : ctx.getCount(t.id);
  return `${formatCount(n)}/${formatCount(t.count)}`;
}
