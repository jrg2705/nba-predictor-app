// api/analyze.js — Análisis de partido NBA con stats balldontlie + Groq
import { buildRealStats } from "./nbaStats.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b"; // llama-3.3-70b-versatile retirado 16-ago-2026 (free/dev)

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

  return `Eres un analista profesional de NBA. Analiza el partido:
VISITANTE: ${away}
LOCAL: ${home}

${statsBlock}
${linesBlock}

Responde SOLO con un JSON válido (sin markdown) con esta estructura exacta:
{
  "home_win_pct": number,
  "away_win_pct": number,
  "best_method": {
    "market": "ML" | "SP" | "OU" | "TT_H" | "TT_A" | "1H",
    "pick_summary": string,
    "confidence_pct": number,
    "line": number | null,
    "reasoning": string
  },
  "alternative_method": {
    "market": "ML" | "SP" | "OU" | "TT_H" | "TT_A" | "1H",
    "pick_summary": string,
    "confidence_pct": number,
    "line": number | null,
    "reasoning": string
  },
  "spread": {
    "favored": "home" | "away",
    "line": number,
    "covers": "SI" | "NO",
    "confidence_pct": number,
    "reasoning": string
  },
  "total": {
    "pick": "OVER" | "UNDER",
    "line": number,
    "confidence_pct": number,
    "reasoning": string
  },
  "team_total_home": {
    "pick": "OVER" | "UNDER",
    "line": number,
    "confidence_pct": number,
    "reasoning": string
  },
  "team_total_away": {
    "pick": "OVER" | "UNDER",
    "line": number,
    "confidence_pct": number,
    "reasoning": string
  },
  "first_half": {
    "winner": "home" | "away",
    "confidence_pct": number,
    "reasoning": string
  },
  "first_half_total": {
    "pick": "OVER" | "UNDER",
    "line": number,
    "confidence_pct": number,
    "reasoning": string
  },
  "analyst_take": string,
  "pace_note": string,
  "h2h_note": string
}

REGLAS DE pick_summary (OBLIGATORIO formato concreto):
- ML: "CLE ML" o "PHI ML" (abreviación del equipo)
- SP: "CLE -4.5 CUBRE" o "PHI +4.5 CUBRE"
- OU: "OVER 224.5" o "UNDER 224.5"
- TT: "CLE TT OVER 112.5" / "PHI TT UNDER 110"
- 1H: "CLE 1H" o "OVER 1H 110.5"
best_method y alternative_method deben ser mercados DISTINTOS.
confidence_pct entre 50 y 78. Sé realista, no inventes certeza extrema.
Usa stats reales cuando existan; si no, dilo en reasoning.
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
      let msg = "Error de Groq";
      try {
        const j = JSON.parse(errText);
        msg = j?.error?.message || j?.message || msg;
      } catch (_) {
        if (errText) msg = errText.slice(0, 200);
      }
      if (/model|deprecat|not found|does not exist/i.test(msg)) {
        msg = `Modelo no disponible (${GROQ_MODEL}). ${msg}`;
      }
      return res.status(502).json({
        error: msg,
        details: errText.slice(0, 400),
        model: GROQ_MODEL,
        status: groqRes.status,
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
