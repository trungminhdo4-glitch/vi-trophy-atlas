// The detail panel: one trophy's official text, our guide in our own words, its steps, counter and cited sources.

import { h, add, formatCount } from './dom.js';
import { isConcealed, KIND_LABELS } from './filters.js';
import { gradeMedal, missableBadge, sourceShortName } from './view-list.js';

export function renderDetail(panel, trophy, ctx) {
  panel.replaceChildren();
  if (!trophy) {
    add(panel, h('p', { class: 'muted' }, 'Pick a trophy to read its guide.'));
    return;
  }
  const earned = ctx.isEarned(trophy.id);
  const concealed = isConcealed(trophy, ctx.spoiler, earned);
  add(panel, 
    h('div', { class: 'detail-head' }, gradeMedal(trophy.grade), h('div', {}, h('h2', { text: concealed ? 'Hidden story trophy' : trophy.name }), h('p', { class: 'official', text: concealed ? 'Spoiler setting is on: name and description stay hidden until you earn it.' : trophy.description }))),
    h(
      'div',
      { class: 'chips' },
      h('span', { class: `chip grade-${trophy.grade}`, text: trophy.grade }),
      h('span', { class: 'chip', text: KIND_LABELS[trophy.kind] }),
      h('span', { class: 'chip', text: trophy.chapter }),
      h('span', { class: 'chip', text: `Roadmap stage ${trophy.stage}` }),
      trophy.hidden ? h('span', { class: 'chip', text: 'Hidden on PSN' }) : null,
      missableBadge(trophy),
    ),
    renderCitedFrom(trophy, ctx),
    trophy.missNote ? h('div', { class: `callout ${trophy.missable === 'missable' ? 'callout-miss' : 'callout-caution'}` }, h('strong', { text: trophy.missable === 'missable' ? 'Missable: ' : 'Caution: ' }), trophy.missNote) : null,
    h(
      'div',
      { class: 'track-line' },
      h('button', { class: `earn-btn${earned ? ' on' : ''}`, type: 'button', onclick: () => ctx.onToggle(trophy.id, !earned) }, earned ? '✓ Earned' : 'Mark as earned'),
      trophy.count && trophy.id !== 1 ? renderCounter(trophy, ctx, earned) : h('span', { class: 'muted saved-note', text: 'Saved in this browser · Export to back up' }),
    ),
  );
  if (concealed && !ctx.revealed.has(trophy.id)) {
    add(panel, h('button', { class: 'ghost', type: 'button', onclick: () => ctx.onReveal(trophy.id) }, 'Show the guide anyway'));
    return;
  }
  if (concealed) add(panel, h('p', { class: 'unconf-note' }, 'Guide shown on request: the trophy name and description stay hidden until you earn it.'));
  add(panel, 
    h('h3', { text: 'Guide' }),
    trophy.verified === 'unconfirmed' ? h('p', { class: 'unconf-note' }, 'Method not fully confirmed by the sources yet: treat the steps as the best current reading.') : null,
    h('p', { class: 'guide', text: trophy.guide }),
    h('ol', { class: 'steps' }, trophy.steps.map((s) => h('li', { text: s }))),
    h('h3', { text: 'Sources' }),
    h('ul', { class: 'sources' }, trophy.sources.map((key) => renderSource(ctx.sources[key]))),
  );
}

function renderCounter(trophy, ctx, earned) {
  const value = earned ? trophy.count : ctx.getCount(trophy.id);
  const pct = Math.round((value / trophy.count) * 100);
  const step = trophy.count >= 10000 ? 10000 : 1;
  const input = h('input', { type: 'number', min: 0, max: trophy.count, step, value, 'aria-label': `Progress: ${trophy.countLabel}`, onchange: (e) => ctx.onCount(trophy.id, e.target.value) });
  return h(
    'div',
    { class: 'counter' },
    h('div', { class: 'counter-top' }, h('span', { text: trophy.countLabel }), h('strong', { text: `${formatCount(value)} / ${formatCount(trophy.count)}` })),
    h('div', { class: 'bar' }, h('span', { style: `width:${pct}%` })),
    h('div', { class: 'counter-ctl' },
      h('button', { type: 'button', 'aria-label': 'Decrease', onclick: () => ctx.onCount(trophy.id, value - step) }, '−'),
      input,
      h('button', { type: 'button', 'aria-label': 'Increase', onclick: () => ctx.onCount(trophy.id, value + step) }, '+'),
    ),
  );
}

// One line under the chips naming every guide this trophy's text draws on, each a link the reader may follow.
function renderCitedFrom(trophy, ctx) {
  const links = trophy.sources.map((key) => h('a', { href: ctx.sources[key].url, target: '_blank', rel: 'noopener noreferrer', text: sourceShortName(ctx.sources[key]) }));
  return h('p', { class: 'cited-from' }, h('span', { class: 'cite-mark', text: `✓ Cited from ${links.length} sources:` }), ...links.flatMap((a, i) => (i ? [' · ', a] : [a])));
}

function renderSource(src) {
  return h('li', {}, h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer', text: src.name }));
}
