// api/analyze.js — Análisis de partido NBA con stats balldontlie + Groq
import { buildRealStats } from "./nbaStats.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

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
      ? `H2H reciente: ${realStats.h2h.homeWins}-${realStats.h2h.awayWins} (local-visitante en muestra de ${realStats.h2h.games}). ${
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
  const linesBlock = bl
    ? `
LÍNEAS DE LA BANCA (OBLIGATORIO usar estas cifras en spread.line, total.line, team_total_*.line, first_half_total.line):
- ML visitante: ${bl.mlAway ?? "n/d"} | ML local: ${bl.mlHome ?? "n/d"}
- Spread del LOCAL: ${bl.spreadHome ?? "n/d"} (si es negativo, local favorito)
- Total (OU): ${bl.total ?? "n/d"}
- Team total visitante: ${bl.ttAway ?? "n/d"} | Team total local: ${bl.ttHome ?? "n/d"}
- Total 1ª mitad: ${bl.hTotal ?? "n/d"} | Spread 1H local: ${bl.hSpreadHome ?? "n/d"}
NO inventes otras líneas si estas están presentes.
`
    : `
No hay líneas de banca cargadas: usa líneas de mercado típicas razonables y decláralas en cada campo "line".
`;

  const statsBlock = formatStatsBlock(context.realStats);

  return `Eres un analista experto de NBA (apuestas deportivas, solo uso estadístico y de referencia).

PARTIDO: ${away} (visitante) @ ${home} (local)
${linesBlock}
${statsBlock}

Analiza el partido y responde ÚNICAMENTE con un JSON válido (sin markdown) con esta estructura exacta:

{
  "home_win_pct": <número 0-100>,
  "away_win_pct": <número 0-100>,
  "best_method": {
    "market": "ML" | "SP" | "OU" | "TT_H" | "TT_A" | "1H",
    "side": "home" | "away" | "combined",
    "pick": "string corto accionable (ej: CUBRE, OVER, UNDER, gana LOCAL)",
    "line": <número o null>,
    "confidence_pct": <número>,
    "pick_summary": "DEBE ser un pick apostable concreto, ej: '${home} -3.5 CUBRE' o 'OVER 224.5' o '${away} ML' o '1H gana ${home}'",
    "reasoning": "1-2 frases citando stats si hay (L10, pts, rest)"
  },
  "alternative_method": {
    "market": "ML" | "SP" | "OU" | "TT_H" | "TT_A" | "1H",
    "side": "home" | "away" | "combined",
    "pick": "string corto accionable",
    "line": <número o null>,
    "confidence_pct": <número>,
    "pick_summary": "OBLIGATORIO: pick apostable concreto del SEGUNDO mejor mercado (distinto a best_method). Ej: 'UNDER 224.5' o '${away} +3.5 CUBRE' o 'TT ${home} OVER 112.5'. NUNCA una frase vaga.",
    "reasoning": "1-2 frases"
  },
  "spread": {
    "favored": "home" | "away",
    "line": <número>,
    "covers": "SI" | "NO",
    "confidence_pct": <número>,
    "reasoning": "..."
  },
  "total": {
    "line": <número>,
    "pick": "OVER" | "UNDER",
    "confidence_pct": <número>,
    "reasoning": "..."
  },
  "team_total_home": {
    "line": <número>,
    "pick": "OVER" | "UNDER",
    "confidence_pct": <número>,
    "reasoning": "..."
  },
  "team_total_away": {
    "line": <número>,
    "pick": "OVER" | "UNDER",
    "confidence_pct": <número>,
    "reasoning": "..."
  },
  "first_half": {
    "winner": "home" | "away",
    "line": null,
    "confidence_pct": <número>,
    "reasoning": "..."
  },
  "first_half_total": {
    "line": <número>,
    "pick": "OVER" | "UNDER",
    "confidence_pct": <número>,
    "reasoning": "..."
  },
  "pace_note": "nota sobre ritmo (usa avg_game_total / pts si hay stats)",
  "h2h_note": "nota H2H si hay muestra",
  "analyst_take": "párrafo corto de análisis final"
}

Mercados: ML, SP, OU, TT_H, TT_A, 1H

Reglas ESTRICTAS:
- home_win_pct + away_win_pct ≈ 100
- best_method y alternative_method DEBEN ser mercados DISTINTOS
- pick_summary SIEMPRE pick concreto apostable (nunca "ventaja en casa" o "alto ritmo")
- Si hay líneas de banca, TODOS los "line" copian esas cifras
- Si hay stats reales, priorízalas en reasoning / pace_note / h2h_note
- confidence_pct realista (55-75 típico)
- No inventes lesiones concretas
- Responde SOLO el JSON.`;
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
      return res.status(500).json({
        error: "Falta GROQ_API_KEY. Añádela en Vercel → Environment Variables.",
      });
    }

    const bdlKey = process.env.BALLDONTLIE_API_KEY || null;
    const realStats = await buildRealStats(home, away, bdlKey);

    const gameContext = {
      gameId: gameId || null,
      bookLinesUsed: bookLines || null,
      season: "2025-26 / 2026-27",
      statsSource: realStats.source,
      statsWarning: realStats.warning || null,
    };

    const prompt = buildPrompt(home, away, {
      bookLines: bookLines || null,
      gameId: gameId || null,
      realStats,
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
          { role: "system", content: "Respondes solo con JSON válido, sin markdown ni texto extra." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2800,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(502).json({
        error: "Error de Groq",
        details: errText.slice(0, 400),
      });
    }

    const groqData = await groqRes.json();
    const raw = groqData.choices?.[0]?.message?.content || "";
    let analysis;
    try {
      const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({
        error: "No se pudo parsear la respuesta de la IA",
        raw: raw.slice(0, 500),
      });
    }

    return res.status(200).json({
      analysis,
      realStats,
      gameContext,
      teams: { home, away },
    });
  } catch (err) {
    console.error("analyze error:", err);
    return res.status(500).json({ error: "Error en análisis", details: err.message });
  }
}
