// Progress store: which trophies are earned, the counters of count-based trophies and the reader's settings.
// Saved in localStorage under one key; exported to and imported from a JSON file.

const KEY = 'vi-trophy-atlas/v1';
const FORMAT = 'vi-trophy-atlas-progress';

export const SPOILER_MODES = ['story', 'hidden', 'off'];

function emptyState() {
  return { earned: {}, counts: {}, prefs: { spoiler: 'story' } };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    return normaliseState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function normaliseState(input) {
  const state = emptyState();
  if (input && typeof input === 'object') {
    for (const [id, when] of Object.entries(input.earned ?? {})) {
      if (/^\d+$/.test(id)) state.earned[id] = typeof when === 'string' ? when : '';
    }
    for (const [id, n] of Object.entries(input.counts ?? {})) {
      const value = Number(n);
      if (/^\d+$/.test(id) && Number.isFinite(value) && value >= 0) state.counts[id] = Math.floor(value);
    }
    if (SPOILER_MODES.includes(input.prefs?.spoiler)) state.prefs.spoiler = input.prefs.spoiler;
  }
  return state;
}

export function isEarned(state, id) {
  return Object.hasOwn(state.earned, String(id));
}

export function setEarned(state, id, on) {
  if (on) state.earned[String(id)] = new Date().toISOString().slice(0, 10);
  else delete state.earned[String(id)];
}

export function getCount(state, id) {
  return state.counts[String(id)] ?? 0;
}

export function setCount(state, trophy, value) {
  const n = Math.max(0, Math.min(trophy.count, Math.floor(Number(value) || 0)));
  state.counts[String(trophy.id)] = n;
  return n;
}

export function exportFile(state, trophies) {
  const earnedNames = trophies.filter((t) => isEarned(state, t.id)).map((t) => t.name);
  const payload = { format: FORMAT, version: 1, exported: new Date().toISOString(), ...state, earnedNames };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `vi-trophy-progress-${payload.exported.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Accepts this app's export, or a plain array of trophy names (the starter checklist's format).
export function parseImport(text, trophies) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    const state = emptyState();
    for (const name of data) {
      const t = trophies.find((x) => x.name === name);
      if (t) state.earned[String(t.id)] = '';
    }
    return state;
  }
  if (!data || data.format !== FORMAT) throw new Error('Not a VI Trophy Atlas progress file.');
  return normaliseState(data);
}
