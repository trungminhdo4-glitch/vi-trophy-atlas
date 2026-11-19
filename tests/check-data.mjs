// Checks app/data/trophies.json against the official list the kit's starter carried (commit f2d31b1):
// same 55 names, descriptions and grades, every trophy with a guide and at least one source,
// grade totals 1/2/6/46 and 28 hidden. Run: node tests/check-data.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const official = JSON.parse(execFileSync('git', ['show', 'f2d31b1:app/data/trophies.json'], { encoding: 'utf8' })).trophies;
const data = JSON.parse(readFileSync(new URL('../app/data/trophies.json', import.meta.url), 'utf8'));
const mine = data.trophies;
const errors = [];

if (mine.length !== 55) errors.push(`expected 55 trophies, got ${mine.length}`);
for (const ref of official) {
  const t = mine.find((x) => x.id === ref.id);
  if (!t) { errors.push(`missing id ${ref.id}`); continue; }
  for (const key of ['name', 'description', 'grade']) {
    if (t[key] !== ref[key]) errors.push(`#${ref.id} ${key}: "${t[key]}" != official "${ref[key]}"`);
  }
  if (!t.guide || !t.guide.trim()) errors.push(`#${ref.id} has no guide`);
  if (!Array.isArray(t.sources) || t.sources.length === 0) errors.push(`#${ref.id} has no source`);
  for (const s of t.sources ?? []) if (!data.sources[s]) errors.push(`#${ref.id} unknown source ${s}`);
  if (!(t.stage >= 1 && t.stage <= 7)) errors.push(`#${ref.id} bad stage ${t.stage}`);
}
const grades = {};
for (const t of mine) grades[t.grade] = (grades[t.grade] ?? 0) + 1;
const want = { platinum: 1, gold: 2, silver: 6, bronze: 46 };
for (const [g, n] of Object.entries(want)) if (grades[g] !== n) errors.push(`grade ${g}: ${grades[g]} != ${n}`);
const hidden = mine.filter((t) => t.hidden).length;
if (hidden !== 28) errors.push(`hidden: ${hidden} != 28`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`ok: 55 trophies match the official list; grades ${JSON.stringify(grades)}; ${hidden} hidden`);
