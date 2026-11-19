// The roadmap to the platinum: stages in play order, each with its trophies, warnings and sources;
// plus the missables view, which lists every flagged trophy with the reason it is flagged.

import { h, fill } from './dom.js';
import { isConcealed } from './filters.js';
import { gradeMedal, missableBadge, trophyTitle } from './view-list.js';

export function renderRoadmap(container, roadmap, trophies, ctx) {
  fill(container, 
    h('div', { class: 'facts' }, roadmap.facts.map((f) => h('div', { class: 'fact' }, h('strong', { text: f.value }), h('span', { text: f.label }), h('small', { text: f.sources.map((s) => ctx.sources[s].name.split(' – ')[0]).join(', ') })))),
    h('p', { class: 'muted', text: roadmap.summary }),
    h('ol', { class: 'stages' }, roadmap.stages.map((stage) => renderStage(stage, trophies.filter((t) => t.stage === stage.stage), ctx))),
  );
}

function renderStage(stage, list, ctx) {
  const done = list.filter((t) => ctx.isEarned(t.id)).length;
  return h(
    'li',
    { class: 'stage' },
    h('div', { class: 'stage-num', text: stage.stage }),
    h(
      'div',
      { class: 'stage-body' },
      h('div', { class: 'stage-head' }, h('h3', { text: stage.title }), h('span', { class: 'muted', text: [stage.when, stage.hours].filter(Boolean).join(' · ') }), h('span', { class: 'stage-done', text: `${done}/${list.length}` })),
      h('p', { text: stage.text }),
      stage.warn ? h('p', { class: 'callout callout-miss' }, h('strong', { text: 'Watch out: ' }), stage.warn) : null,
      h('div', { class: 'stage-trophies' }, list.map((t) => trophyChip(t, ctx))),
      h('small', { class: 'muted' }, 'Sources: ', stage.sources.map((s) => ctx.sources[s].name.split(' – ')[0]).join(', ')),
    ),
  );
}

function trophyChip(t, ctx) {
  const earned = ctx.isEarned(t.id);
  const concealed = isConcealed(t, ctx.spoiler, earned);
  return h('button', { type: 'button', class: `tchip${earned ? ' is-earned' : ''}`, onclick: () => ctx.onOpen(t.id) }, gradeMedal(t.grade), trophyTitle(t, concealed), missableBadge(t));
}

export function renderMissables(container, trophies, ctx) {
  const flagged = trophies.filter((t) => t.missable);
  const unconfirmed = trophies.filter((t) => t.verified === 'unconfirmed');
  fill(container, 
    h('p', { class: 'muted' }, 'Built from the official descriptions and the cited guides: one trophy may be missable, a few need care, and every chapter and mission trophy is story-locked and cannot be missed.'),
    h('ul', { class: 'miss-list' }, flagged.map((t) => h('li', { class: `miss-item ${t.missable}` }, h('button', { type: 'button', class: 'link', onclick: () => ctx.onOpen(t.id) }, gradeMedal(t.grade), t.name), missableBadge(t), h('p', { text: t.missNote })))),
    h('h3', { text: 'Story-locked, not missable' }),
    h('div', { class: 'stage-trophies' }, trophies.filter((t) => t.kind === 'story').map((t) => trophyChip(t, ctx))),
    h('h3', { text: 'Method still unconfirmed' }),
    h('div', { class: 'stage-trophies' }, unconfirmed.map((t) => trophyChip(t, ctx))),
  );
}
