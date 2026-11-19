// The filter chips, the spoiler rule and the search: which trophies the list shows and how.

export const KIND_LABELS = {
  story: 'Story',
  side: 'Side strand',
  activity: 'Activity',
  collectible: 'Collectible',
  crime: 'Crime',
  misc: 'Misc',
};

export const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'story', label: 'Story', test: (t) => t.kind === 'story' },
  { id: 'missable', label: 'Missable', test: (t) => Boolean(t.missable) },
  { id: 'collectible', label: 'Collectibles', test: (t) => t.kind === 'collectible' },
  { id: 'activity', label: 'Activities', test: (t) => t.kind === 'activity' },
  { id: 'side', label: 'Side strands', test: (t) => t.kind === 'side' },
  { id: 'crime', label: 'Crime', test: (t) => t.kind === 'crime' },
  { id: 'unconfirmed', label: 'Unconfirmed', test: (t) => t.verified === 'unconfirmed' },
  { id: 'online', label: 'Online', test: (t) => t.kind === 'online' },
];

export const GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

// The spoiler setting hides the name and description until the trophy is earned:
// "story" covers the story trophies, "hidden" every trophy PlayStation hides, "off" nothing.
export function isConcealed(trophy, spoilerMode, earned) {
  if (earned || spoilerMode === 'off') return false;
  if (spoilerMode === 'hidden') return trophy.hidden;
  return trophy.kind === 'story';
}

export function matchesQuery(trophy, query, concealed) {
  if (!query) return true;
  const q = query.toLowerCase();
  const fields = concealed ? [trophy.chapter] : [trophy.name, trophy.description, trophy.guide, trophy.chapter];
  return fields.some((f) => String(f).toLowerCase().includes(q));
}

export function filterTrophies(trophies, { filter, grade, status, query }, isEarned, spoilerMode) {
  const chip = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  return trophies.filter((t) => {
    const earned = isEarned(t.id);
    if (!chip.test(t)) return false;
    if (grade !== 'all' && t.grade !== grade) return false;
    if (status === 'todo' && earned) return false;
    if (status === 'done' && !earned) return false;
    return matchesQuery(t, query, isConcealed(t, spoilerMode, earned));
  });
}

export function countFor(trophies, filterId) {
  const chip = FILTERS.find((f) => f.id === filterId);
  return trophies.filter(chip.test).length;
}
