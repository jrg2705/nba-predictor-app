// api/analyze.js — Análisis NBA: stats + Groq + Elo
import { buildRealStats } from "./nbaStats.js";
import { fetchOddsForMatchup } from "./oddsHelper.js";
import { buildCurrentElo, eloMatchupContext, formatEloBlock } from "./eloHelper.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

function toPct(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  let p = n > 0 && n <= 1.5 ? n * 100 : n;
  p = Math.round(p * 10) / 10;
  return Math.max(0, Math.min(100, p));
}

function normalizeAnalysis(a) {
  if (!a || typeof a !== "object") return a;
  const home = toPct(a.home_win_pct);
  const away = toPct(a.away_win_pct);
  if (home != null) a.home_win_pct = home;
  if (away != null) a.away_win_pct = away;
  if (home != null && away != null && home + away > 0) {
    const s = home + away;
    if (Math.abs(s - 100) > 8) {
      a.home_win_pct = Math.round((home / s) * 1000) / 10;
      a.away_win_pct = Math.round((100 - a.home_win_pct) * 10) / 10;
    }
  }
  for (const [obj, key] of [
    ["best_method", "confidence_pct"],
    ["alternative_method", "confidence_pct"],
    ["spread", "confidence_pct"],
    ["total", "confidence_pct"],
    ["first_half", "confidence_pct"],
  ]) {
    if (a[obj] && a[obj][key] != null) {
      const c = toPct(a[obj][key]);
      if (c != null) a[obj][key] = c;
    }
  }
  return a;
}

function formatStatsBlock(realStats) {
  if (!realStats || realStats.warning) {
    return realStats?.warning
      ? `STATS REALES: no disponibles (${realStats.warning}). Usa conocimiento general de NBA.`
      : "STATS REALES: no disponibles. Usa conocimiento general de NBA.";
  }
  const fmt = (s) => {
    if (!s) return "sin datos";
    return [
      `L10: ${s.record_L10 || "n/d"}`,
      `pts/partido: ${s.avg_pts ?? "n/d"}`,
      `pts permitidos: ${s.avg_pts_allowed ?? "n/d"}`,
      `total medio partido: ${s.avg_game_total ?? "n/d"}`,
      `descanso (días desde último): ${s.rest_days ?? "n/d"}`,
      s.recent?.length
        ? `últimos: ${s.recent.map((r) => `${r.result} vs ${r.opp} ${r.score}`).join("; ")}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");
  };
  const h2h =
    realStats.h2h && realStats.h2h.games > 0
      ? `H2H reciente: ${realStats.h2h.homeWins}-${realStats.h2h.awayWins} (muestra ${realStats.h2h.games}). ${
          realStats.h2h.recent?.map((x) => x.score).join(" · ") || ""
        }`
      : "H2H: sin muestra reciente en API.";
  return `STATS REALES (fuente: ${realStats.source}, temporada ${realStats.season ?? "?"}):
LOCAL ${realStats.home?.team || ""}: ${fmt(realStats.home)}
VISITANTE ${realStats.away?.team || ""}: ${fmt(realStats.away)}
${h2h}
Usa estas cifras para pace, totales, L10 y descanso. No inventes números contradictorios.`;
}

function buildPrompt(home, away, context = {}) {
  const bl = context.bookLines;
  const src = bl?.source === "odds-api" ? "ODDS API (mercado vivo)" : "BANCA / líneas cargadas";
  const linesBlock = bl
    ? `
LÍNEAS DE MERCADO — ${src}${bl.bookmaker ? ` · book: ${bl.bookmaker}` : ""}
- ML visitante: ${bl.mlAway ?? "n/d"} | ML local: ${bl.mlHome ?? "n/d"}
- Spread del LOCAL: ${bl.spreadHome ?? "n/d"}
- Total (OU): ${bl.total ?? "n/d"}
Mercados SOLO: ML, SP, OU y 1H.
`
    : `
Sin líneas de mercado. Mercados SOLO: ML, SP, OU y 1H.
`;

  const statsBlock = formatStatsBlock(context.realStats);
  const eloBlock = context.eloBlock || "ELO: no calculado.";

  return `Eres un analista profesional de NBA. Analiza:
VISITANTE: ${away}
LOCAL: ${home}

${statsBlock}

${eloBlock}

${linesBlock}

Responde SOLO JSON válido:
{
  "home_win_pct": number,
  "away_win_pct": number,
  "best_method": { "market": "ML"|"SP"|"OU"|"1H", "pick_summary": string, "confidence_pct": number, "line": number|null, "reasoning": string },
  "alternative_method": { "market": "ML"|"SP"|"OU"|"1H", "pick_summary": string, "confidence_pct": number, "line": number|null, "reasoning": string },
  "spread": { "favored": "home"|"away", "line": number, "covers": "SI"|"NO", "confidence_pct": number, "reasoning": string },
  "total": { "pick": "OVER"|"UNDER", "line": number, "confidence_pct": number, "reasoning": string },
  "first_half": { "winner": "home"|"away", "confidence_pct": number, "reasoning": string },
  "analyst_take": string,
  "pace_note": string,
  "h2h_note": string
}
REGLAS: porcentajes 0-100; solo ML/SP/OU/1H; Elo refuerza ML/spread; confidence 50-78.
`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { home, away, gameId, bookLines } = req.body || {};
    if (!home || !away || home === away) {
      return res.status(400).json({ error: "Selecciona dos equipos diferentes (home y away)." });
    }
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(500).json({ error: "Falta GROQ_API_KEY." });
    }
    const bdlKey = process.env.BALLDONTLIE_API_KEY || null;
    const realStats = await buildRealStats(home, away, bdlKey);

    let resolvedLines = bookLines || null;
    let oddsMeta = null;
    if (!resolvedLines) {
      const oddsKey = process.env.ODDS_API_KEY || null;
      if (oddsKey) {
        try {
          const oddsResult = await fetchOddsForMatchup(home, away, oddsKey);
          if (oddsResult.lines) {
            resolvedLines = oddsResult.lines;
            oddsMeta = { source: "odds-api", bookmaker: oddsResult.lines.bookmaker || null };
          } else {
            oddsMeta = { source: "odds-api", warning: oddsResult.warning || "Sin líneas" };
          }
        } catch (e) {
          oddsMeta = { source: "odds-api", warning: e.message };
        }
      }
    } else {
      oddsMeta = { source: "book-lines-txt" };
    }

    let eloMeta = null;
    let eloCtx = null;
    let eloBlock = "ELO: no calculado.";
    try {
      const eloBuilt = await buildCurrentElo(bdlKey, undefined);
      eloMeta = {
        source: eloBuilt.source,
        season: eloBuilt.season,
        gamesApplied: eloBuilt.gamesApplied,
        warning: eloBuilt.warning || null,
      };
      eloCtx = eloMatchupContext(eloBuilt.ratings, home, away, resolvedLines);
      eloBlock = formatEloBlock(eloCtx, eloMeta);
    } catch (e) {
      eloMeta = { source: "error", warning: e.message };
      eloBlock = `ELO: error (${e.message})`;
    }

    const gameContext = {
      gameId: gameId || null,
      bookLinesUsed: resolvedLines || null,
      linesSource: oddsMeta?.source || null,
      oddsMeta,
      elo: eloCtx,
      eloMeta,
      season: "2026-27",
      statsSource: realStats.source,
      statsWarning: realStats.warning || null,
    };

    const prompt = buildPrompt(home, away, {
      bookLines: resolvedLines || null,
      realStats,
      eloBlock,
    });

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "Solo JSON válido. Porcentajes 0-100. Mercados ML/SP/OU/1H." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2200,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(502).json({ error: "Error de Groq", details: errText.slice(0, 400) });
    }

    const groqData = await groqRes.json();
    const raw = groqData.choices?.[0]?.message?.content || "";
    let analysis;
    try {
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      analysis = normalizeAnalysis(JSON.parse(cleaned));
    } catch {
      return res.status(502).json({ error: "No se pudo parsear la IA", raw: raw.slice(0, 500) });
    }

    if (realStats && typeof realStats === "object") {
      realStats.elo = eloCtx;
      realStats.eloMeta = eloMeta;
    }

    return res.status(200).json({ analysis, realStats, gameContext, teams: { home, away } });
  } catch (err) {
    console.error("analyze error:", err);
    return res.status(500).json({ error: "Error en análisis", details: err.message });
  }
}
