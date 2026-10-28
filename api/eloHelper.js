// api/eloHelper.js — Elo NBA como refuerzo del modelo (ML / edge vs mercado)
// - Priors de pretemporada 2026-27
// - Replay de partidos finalizados de la temporada (balldontlie) para calibrar
// - P(win) local con home advantage + edge vs ML americano

export const ELO_K = 20;
export const ELO_HOME_ADV = 100;
export const ELO_BASE = 1500;

export const ELO_PRIORS = {
  "Oklahoma City Thunder": 1680,
  "Boston Celtics": 1665,
  "Denver Nuggets": 1635,
  "New York Knicks": 1620,
  "Cleveland Cavaliers": 1615,
  "Minnesota Timberwolves": 1605,
  "Indiana Pacers": 1595,
  "Los Angeles Lakers": 1585,
  "Dallas Mavericks": 1580,
  "Golden State Warriors": 1575,
  "Phoenix Suns": 1565,
  "Milwaukee Bucks": 1560,
  "LA Clippers": 1555,
  "Los Angeles Clippers": 1555,
  "New Orleans Pelicans": 1545,
  "Philadelphia 76ers": 1540,
  "Miami Heat": 1535,
  "Memphis Grizzlies": 1530,
  "Sacramento Kings": 1525,
  "Orlando Magic": 1520,
  "Houston Rockets": 1515,
  "Atlanta Hawks": 1510,
  "Chicago Bulls": 1495,
  "San Antonio Spurs": 1490,
  "Toronto Raptors": 1485,
  "Brooklyn Nets": 1475,
  "Utah Jazz": 1470,
  "Portland Trail Blazers": 1460,
  "Detroit Pistons": 1455,
  "Charlotte Hornets": 1445,
  "Washington Wizards": 1435,
};

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function updateElo(winnerElo, loserElo, k = ELO_K) {
  const expW = expectedScore(winnerElo, loserElo);
  const expL = expectedScore(loserElo, winnerElo);
  return {
    winner: winnerElo + k * (1 - expW),
    loser: loserElo + k * (0 - expL),
  };
}

export function americanToImpliedProb(ml) {
  if (ml == null || ml === "" || Number.isNaN(Number(ml))) return null;
  const n = Number(ml);
  if (n < 0) return -n / (-n + 100);
  return 100 / (n + 100);
}

export function homeWinProb(eloHome, eloAway, homeAdv = ELO_HOME_ADV) {
  const adjHome = eloHome + homeAdv;
  return expectedScore(adjHome, eloAway);
}

function clonePriors() {
  const o = {};
  for (const [k, v] of Object.entries(ELO_PRIORS)) o[k] = v;
  if (o["LA Clippers"] && !o["Los Angeles Clippers"]) o["Los Angeles Clippers"] = o["LA Clippers"];
  return o;
}

function resolveTeamName(name, ratings) {
  if (!name) return null;
  if (ratings[name] != null) return name;
  const n = name.toLowerCase();
  for (const k of Object.keys(ratings)) {
    if (k.toLowerCase() === n) return k;
  }
  for (const k of Object.keys(ratings)) {
    if (k.toLowerCase().includes(n) || n.includes(k.toLowerCase().split(" ").pop())) return k;
  }
  return name;
}

export function replaySeason(games, priors = null) {
  const ratings = priors ? { ...priors } : clonePriors();
  let applied = 0;
  const sorted = [...(games || [])].sort((a, b) => {
    const da = a.date || a.commence_time || "";
    const db = b.date || b.commence_time || "";
    return String(da).localeCompare(String(db));
  });

  for (const g of sorted) {
    const hs = g.home_score ?? g.homeScore;
    const as_ = g.away_score ?? g.awayScore ?? g.visitor_score;
    if (hs == null || as_ == null || hs === as_) continue;
    const homeName = resolveTeamName(g.home || g.home_team, ratings);
    const awayName = resolveTeamName(g.away || g.away_team || g.visitor_team, ratings);
    if (!homeName || !awayName) continue;

    if (ratings[homeName] == null) ratings[homeName] = ELO_BASE;
    if (ratings[awayName] == null) ratings[awayName] = ELO_BASE;

    if (hs > as_) {
      const u = updateElo(ratings[homeName], ratings[awayName]);
      ratings[homeName] = u.winner;
      ratings[awayName] = u.loser;
    } else {
      const u = updateElo(ratings[awayName], ratings[homeName]);
      ratings[awayName] = u.winner;
      ratings[homeName] = u.loser;
    }
    applied += 1;
  }

  return { ratings, gamesApplied: applied };
}

export async function buildCurrentElo(apiKey, seasonYear) {
  const priors = clonePriors();
  const season =
    seasonYear ||
    (new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1);

  if (!apiKey) {
    return {
      ratings: priors,
      gamesApplied: 0,
      season,
      source: "priors-only",
      warning: "Sin BALLDONTLIE_API_KEY: Elo solo con priors de pretemporada",
    };
  }

  try {
    const games = [];
    let cursor = null;
    let pages = 0;
    const maxPages = 8;

    do {
      const url = new URL("https://api.balldontlie.io/nba/v1/games");
      url.searchParams.set("seasons[]", String(season));
      url.searchParams.set("per_page", "100");
      if (cursor) url.searchParams.set("cursor", String(cursor));

      const res = await fetch(url.toString(), {
        headers: { Authorization: apiKey },
      });
      if (!res.ok) {
        return {
          ratings: priors,
          gamesApplied: 0,
          season,
          source: "priors-only",
          warning: `balldontlie games ${res.status}: Elo con priors`,
        };
      }
      const data = await res.json();
      const batch = data.data || [];
      for (const g of batch) {
        const status = String(g.status || "").toLowerCase();
        if (g.home_team_score == null || g.visitor_team_score == null) continue;
        if (g.home_team_score === g.visitor_team_score) continue;
        if (status.includes("scheduled") || status.includes("tip")) continue;
        // aceptar Final o scores presentes fuera de scheduled
        const looksLive =
          status.includes("1st") ||
          status.includes("2nd") ||
          status.includes("3rd") ||
          status.includes("4th") ||
          status.includes("quarter") ||
          status.includes("halftime") ||
          status.includes("in progress");
        if (looksLive) continue;

        games.push({
          date: g.date || g.datetime,
          home: g.home_team?.full_name || g.home_team?.name,
          away: g.visitor_team?.full_name || g.visitor_team?.name,
          home_score: g.home_team_score,
          away_score: g.visitor_team_score,
        });
      }
      cursor = data.meta?.next_cursor || data.meta?.next_page || null;
      pages += 1;
      if (!batch.length) break;
    } while (cursor && pages < maxPages);

    const { ratings, gamesApplied } = replaySeason(games, priors);
    return {
      ratings,
      gamesApplied,
      season,
      source: gamesApplied > 0 ? "priors+season-replay" : "priors-only",
      warning: gamesApplied === 0 ? "Sin partidos finalizados en replay; usando priors" : null,
    };
  } catch (e) {
    return {
      ratings: priors,
      gamesApplied: 0,
      season,
      source: "priors-only",
      warning: e.message,
    };
  }
}

export function eloMatchupContext(ratings, home, away, bookLines) {
  const r = ratings || clonePriors();
  const homeKey = resolveTeamName(home, r);
  const awayKey = resolveTeamName(away, r);
  const eloHome = r[homeKey] ?? ELO_BASE;
  const eloAway = r[awayKey] ?? ELO_BASE;
  const pHome = homeWinProb(eloHome, eloAway);
  const pAway = 1 - pHome;

  const mlHome = bookLines?.mlHome;
  const mlAway = bookLines?.mlAway;
  const impliedHome = americanToImpliedProb(mlHome);
  const impliedAway = americanToImpliedProb(mlAway);

  let edgeHomePct = null;
  let edgeAwayPct = null;
  if (impliedHome != null) edgeHomePct = Math.round((pHome - impliedHome) * 1000) / 10;
  if (impliedAway != null) edgeAwayPct = Math.round((pAway - impliedAway) * 1000) / 10;

  const favorite = pHome >= pAway ? "home" : "away";
  const edgeSide =
    edgeHomePct != null && edgeAwayPct != null
      ? edgeHomePct >= edgeAwayPct
        ? "home"
        : "away"
      : null;

  return {
    home: homeKey,
    away: awayKey,
    eloHome: Math.round(eloHome * 10) / 10,
    eloAway: Math.round(eloAway * 10) / 10,
    eloDiff: Math.round((eloHome - eloAway) * 10) / 10,
    homeAdv: ELO_HOME_ADV,
    pHomeWin: Math.round(pHome * 1000) / 10,
    pAwayWin: Math.round(pAway * 1000) / 10,
    impliedHomePct: impliedHome != null ? Math.round(impliedHome * 1000) / 10 : null,
    impliedAwayPct: impliedAway != null ? Math.round(impliedAway * 1000) / 10 : null,
    edgeHomePct,
    edgeAwayPct,
    favorite,
    edgeSide,
    mlHome: mlHome ?? null,
    mlAway: mlAway ?? null,
  };
}

export function formatEloBlock(eloCtx, meta) {
  if (!eloCtx) return "ELO: no disponible.";
  const lines = [
    `ELO (refuerzo del modelo · fuente ${meta?.source || "n/d"} · temp ${meta?.season ?? "?"} · partidos calibrados: ${meta?.gamesApplied ?? 0}):`,
    `LOCAL ${eloCtx.home}: Elo ${eloCtx.eloHome} | VISITANTE ${eloCtx.away}: Elo ${eloCtx.eloAway} (diff ${eloCtx.eloDiff >= 0 ? "+" : ""}${eloCtx.eloDiff})`,
    `P(win) Elo con ventaja local (+${eloCtx.homeAdv}): LOCAL ${eloCtx.pHomeWin}% · VISITANTE ${eloCtx.pAwayWin}%`,
  ];
  if (eloCtx.impliedHomePct != null) {
    lines.push(
      `Mercado ML implícito: LOCAL ${eloCtx.impliedHomePct}% (${eloCtx.mlHome}) · VISITANTE ${eloCtx.impliedAwayPct}% (${eloCtx.mlAway})`
    );
    lines.push(
      `EDGE Elo vs ML: LOCAL ${eloCtx.edgeHomePct != null ? (eloCtx.edgeHomePct >= 0 ? "+" : "") + eloCtx.edgeHomePct + "%" : "n/d"} · VISITANTE ${eloCtx.edgeAwayPct != null ? (eloCtx.edgeAwayPct >= 0 ? "+" : "") + eloCtx.edgeAwayPct + "%" : "n/d"}`
    );
    lines.push(
      "Usa el edge como REFUERZO: si |edge| >= 3% y alineado con stats, puedes priorizar ese lado en ML/spread. Si Elo y stats discrepan fuerte, bajar confianza o preferir alternative_method. Elo NO sustituye pace/totales."
    );
  } else {
    lines.push("Sin ML de mercado: usa P(win) Elo solo como prior suave junto a stats.");
  }
  if (meta?.warning) lines.push(`Nota Elo: ${meta.warning}`);
  return lines.join("\n");
}
