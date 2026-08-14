/**
 * Calibración basada en track record (por mercado y best vs alternative).
 * Se usa en Top Picks y Expert Picks para anti-sesgo.
 */

const METHOD_LABELS = {
  ML: "Moneyline",
  SP: "Spread",
  OU: "Total",
  TT_H: "Team Total Local",
  TT_A: "Team Total Visitante",
  "1H": "1ª Mitad",
};

export function getCalibrationSummary(trackRecord) {
  const byMarket = trackRecord?.byMarket || {};
  const byRank = trackRecord?.byRank || {};
  const advice = [];
  const prefer = [];
  const avoid = [];

  const ranked = Object.entries(byMarket)
    .filter(([, d]) => d.total >= 5)
    .map(([m, d]) => ({ market: m, pct: d.correct / d.total, total: d.total }))
    .sort((a, b) => b.pct - a.pct);

  ranked.forEach((r) => {
    const label = METHOD_LABELS[r.market] || r.market;
    if (r.pct >= 0.58) prefer.push(label);
    if (r.pct < 0.48 && r.total >= 8) avoid.push(label);
  });

  if (prefer.length) advice.push(`Priorizar mercados con mejor historial: ${prefer.join(", ")}`);
  if (avoid.length) advice.push(`Evitar o bajar peso: ${avoid.join(", ")}`);

  const bestPct = byRank.best?.total
    ? byRank.best.correct / byRank.best.total
    : null;
  const altPct = byRank.alternative?.total
    ? byRank.alternative.correct / byRank.alternative.total
    : null;

  if (bestPct != null && altPct != null && altPct > bestPct + 0.05) {
    advice.push("La alternativa (#2) acierta más que el #1 → priorizar #2 cuando esté cerca.");
  }

  if (advice.length === 0) {
    advice.push("Aún poca muestra. Usar umbral de confianza y diversificar mercados.");
  }

  return {
    advice,
    preferLabels: prefer,
    avoidLabels: avoid,
    preferMarkets: ranked.filter((r) => r.pct >= 0.58).map((r) => r.market),
    avoidMarkets: ranked.filter((r) => r.pct < 0.48 && r.total >= 8).map((r) => r.market),
    preferAltWhenClose: bestPct != null && altPct != null && altPct > bestPct + 0.05,
    forExpert: {
      preferMarkets: ranked.filter((r) => r.pct >= 0.58).map((r) => r.market),
      avoidMarkets: ranked.filter((r) => r.pct < 0.48 && r.total >= 8).map((r) => r.market),
      preferAltWhenClose: bestPct != null && altPct != null && altPct > bestPct + 0.05,
    },
  };
}

export function rankCalibratedMarkets(markets, trackRecord) {
  const cal = getCalibrationSummary(trackRecord || {});
  return [...markets].sort((a, b) => {
    const aAvoid = cal.avoidMarkets.includes(a.market) ? -20 : 0;
    const bAvoid = cal.avoidMarkets.includes(b.market) ? -20 : 0;
    const aPref = cal.preferMarkets.includes(a.market) ? 8 : 0;
    const bPref = cal.preferMarkets.includes(b.market) ? 8 : 0;
    const scoreA = (a.confidence_pct || 0) + aPref + aAvoid;
    const scoreB = (b.confidence_pct || 0) + bPref + bAvoid;
    return scoreB - scoreA;
  });
}
