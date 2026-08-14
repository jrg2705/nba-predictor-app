/**
 * Top Picks: selección mixta con umbral + anti-sesgo.
 * Prioriza alternativa si el track record lo indica y está cerca del #1.
 */

import { isStrongPick } from "./strongPicks.js";

const METHOD_LABELS = {
  ML: "Moneyline",
  SP: "Spread",
  OU: "Total",
  TT_H: "Team Total Local",
  TT_A: "Team Total Visitante",
  "1H": "1ª Mitad",
};

function methodToCandidate(entry, method, usedAlternative = false) {
  if (!method) return null;
  const conf = method.confidence_pct ?? 0;
  return {
    entry,
    market: method.market,
    marketLabel: METHOD_LABELS[method.market] || method.market,
    pickSummary: method.pick_summary || method.pick || "",
    confidence: conf,
    usedAlternative,
    overCap: false,
  };
}

export function buildAllMarketsForEntry(entry, trackRecord, minConfidence, rankFn) {
  const a = entry.analysis;
  if (!a) return [];
  const list = [];

  if (a.best_method) list.push(methodToCandidate(entry, a.best_method, false));
  if (a.alternative_method) list.push(methodToCandidate(entry, a.alternative_method, true));

  // También mercados individuales si existen
  if (a.spread?.confidence_pct != null) {
    list.push({
      entry,
      market: "SP",
      marketLabel: METHOD_LABELS.SP,
      pickSummary: a.spread.pick_summary || `${a.spread.favored === "home" ? entry.home : entry.away} ${a.spread.covers === "SI" ? "cubre" : "no cubre"} ${a.spread.line}`,
      confidence: a.spread.confidence_pct,
      usedAlternative: false,
      overCap: false,
    });
  }
  if (a.total?.confidence_pct != null) {
    list.push({
      entry,
      market: "OU",
      marketLabel: METHOD_LABELS.OU,
      pickSummary: a.total.pick_summary || `${a.total.pick} ${a.total.line}`,
      confidence: a.total.confidence_pct,
      usedAlternative: false,
      overCap: false,
    });
  }

  const filtered = list.filter((c) => c && isStrongPick(c.confidence, minConfidence));
  return rankFn ? rankFn(filtered, trackRecord) : filtered.sort((x, y) => y.confidence - x.confidence);
}

/**
 * Construye N picks del día.
 * - Preferir best_method; si preferAltWhenClose y alt está cerca → usar alt.
 * - Diversificar: máx 2 del mismo mercado.
 */
export function buildTopPicks(todayAnalyzed, count, trackRecord, minConfidence, rankFn, labels = METHOD_LABELS) {
  const cal = rankFn
    ? null
    : null; // rankFn already applies calibration when provided

  const preferAlt = trackRecord?.byRank?.alternative?.total > 0 &&
    trackRecord?.byRank?.best?.total > 0 &&
    (trackRecord.byRank.alternative.correct / trackRecord.byRank.alternative.total) >
      (trackRecord.byRank.best.correct / trackRecord.byRank.best.total) + 0.05;

  const candidates = [];

  todayAnalyzed.forEach((entry) => {
    const a = entry.analysis;
    if (!a?.best_method) return;

    let chosen = a.best_method;
    let usedAlt = false;

    if (
      preferAlt &&
      a.alternative_method &&
      Math.abs((a.best_method.confidence_pct || 0) - (a.alternative_method.confidence_pct || 0)) <= 6
    ) {
      chosen = a.alternative_method;
      usedAlt = true;
    }

    if (!isStrongPick(chosen.confidence_pct, minConfidence)) return;

    candidates.push({
      entry,
      market: chosen.market,
      marketLabel: labels[chosen.market] || chosen.market,
      pickSummary: chosen.pick_summary || "",
      confidence: chosen.confidence_pct || 0,
      usedAlternative: usedAlt,
      overCap: false,
    });
  });

  // Ordenar por confianza desc
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Diversificar: máx 2 por mercado
  const marketCount = {};
  const selected = [];
  for (const c of candidates) {
    if (selected.length >= count) break;
    const n = marketCount[c.market] || 0;
    if (n >= 2) {
      c.overCap = true;
      continue;
    }
    marketCount[c.market] = n + 1;
    selected.push(c);
  }

  // Si faltan, rellenar sin el límite estricto
  if (selected.length < count) {
    for (const c of candidates) {
      if (selected.length >= count) break;
      if (selected.some((s) => s.entry.id === c.entry.id && s.market === c.market)) continue;
      selected.push({ ...c, overCap: true });
    }
  }

  return selected.slice(0, count);
}
