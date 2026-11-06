// src/historyStorage.js — Historial local (últimos 40) + sync Neon
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
  syncEntryToNeon(entry).catch(() => {});
  return next;
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export async function syncEntryToNeon(entry) {
  try {
    const res = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error || res.statusText, configured: j.configured };
    }
    return { ok: true, ...(await res.json()) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function fetchHistoryFromApi({ limit = 40, from = null, to = null } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await fetch(`/api/history?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      configured: data.configured !== false,
      error: data.error || "Error al cargar historial",
      entries: [],
      total: 0,
    };
  }
  return {
    ok: true,
    configured: data.configured !== false,
    entries: data.entries || [],
    total: data.total ?? (data.entries || []).length,
    count: data.count,
  };
}

export async function migrateLocalToNeon(localList = null) {
  const list = localList || loadHistory();
  let ok = 0;
  let fail = 0;
  for (const entry of list) {
    const r = await syncEntryToNeon(entry);
    if (r.ok) ok += 1;
    else fail += 1;
  }
  return { ok, fail, total: list.length };
}

export function historyExportUrl({ from = null, to = null } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString();
  return `/api/history-export${q ? `?${q}` : ""}`;
}
