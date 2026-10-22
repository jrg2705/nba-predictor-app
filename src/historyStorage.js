export const HISTORY_KEY = "nba_predictor_history";
export const MAX_HISTORY = 40;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function sameDay(isoA, isoB) {
  try {
    return new Date(isoA).toDateString() === new Date(isoB).toDateString();
  } catch {
    return false;
  }
}

/**
 * Guarda un análisis. Si ya existe el mismo matchup (home+away) el mismo día,
 * lo REEMPLAZA (el más reciente queda arriba) en lugar de duplicar.
 */
export function saveToHistory(entry) {
  const list = loadHistory();
  const filtered = list.filter(
    (e) =>
      !(
        e.home === entry.home &&
        e.away === entry.away &&
        sameDay(e.date, entry.date)
      )
  );
  const next = [entry, ...filtered].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
