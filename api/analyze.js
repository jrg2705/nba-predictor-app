// api/analyze.js — Análisis de partido NBA con stats + Groq
// FASE 1: esqueleto. Recibe home/away, intenta stats básicas y llama a Groq.
// Más adelante: OffRtg, DefRtg, Pace, L10, rest, H2H, book lines.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const NBA_TEAMS = [
  "Atlanta Hawks", "Boston Celtics", "Brooklyn Nets", "Charlotte Hornets",
  "Chicago Bulls", "Cleveland Cavaliers", "Dallas Mavericks", "Denver Nuggets",
  "Detroit Pistons", "Golden State Warriors", "Houston Rockets", "Indiana Pacers",
  "LA Clippers", "Los Angeles Lakers", "Memphis Grizzlies", "Miami Heat",
  "Milwaukee Bucks", "Minnesota Timberwolves", "New Orleans Pelicans", "New York Knicks",
  "Oklahoma City Thunder", "Orlando Magic", "Philadelphia 76ers", "Phoenix Suns",
  "Portland Trail Blazers", "Sacramento Kings", "San Antonio Spurs", "Toronto Raptors",
  "Utah Jazz", "Washington Wizards",
];

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

  return `Eres un analista experto de NBA (apuestas deportivas, solo uso estadístico y de referencia).

PARTIDO: ${away} (visitante) @ ${home} (local)
${linesBlock}
CONTEXTO EXTRA: ${JSON.stringify({ gameId: context.gameId || null }).slice(0, 500)}

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
    "reasoning": "1-2 frases"
  },
  "alternative_method": {
    "market": "ML" | "SP" | "OU" | "TT_H" | "TT_A" | "1H",
    "side": "home" | "away" | "combined",
    "pick": "string corto accionable",
    "line": <número o null>,
    "confidence_pct": <número>,
    "pick_summary": "OBLIGATORIO: pick apostable concreto del SEGUNDO mejor mercado (distinto a best_method). Ej: 'UNDER 224.5' o '${away} +3.5 CUBRE' o 'TT ${home} OVER 112.5'. NUNCA una frase vaga tipo 'partido de alto ritmo'.",
    "reasoning": "1-2 frases explicando POR QUÉ ese mercado concreto"
  },
  "spread": {
    "favored": "home" | "away",
    "line": <número típico ej -3.5>,
    "covers": "SI" | "NO",
    "confidence_pct": <número>,
    "reasoning": "..."
  },
  "total": {
    "line": <número típico ej 224.5>,
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
    "line": <número típico ej 112.5>,
    "pick": "OVER" | "UNDER",
    "confidence_pct": <número>,
    "reasoning": "..."
  },
  "pace_note": "nota sobre ritmo esperado",
  "h2h_note": "nota H2H si aplica",
  "analyst_take": "párrafo corto de análisis final"
}

Mercados disponibles (usa estos códigos en market):
- ML = Moneyline (ganador del partido)
- SP = Spread / hándicap
- OU = Total puntos combinados Over/Under
- TT_H = Team total del LOCAL
- TT_A = Team total del VISITANTE
- 1H = Ganador 1ª mitad

Reglas ESTRICTAS:
- home_win_pct + away_win_pct ≈ 100
- best_method y alternative_method DEBEN ser mercados DISTINTOS (ej. si best es SP, alternative puede ser OU, ML, TT_H, TT_A o 1H)
- pick_summary de best y alternative: SIEMPRE un pick concreto apostable, NUNCA frases vagas tipo "partido de alto ritmo" o "ventaja en casa"
  Ejemplos válidos: "${home} -3.5 CUBRE", "OVER 224.5", "UNDER 224.5", "${away} ML", "TT ${home} OVER 114.5", "1H gana ${home}"
- alternative_method.market debe coincidir con el tipo de pick de pick_summary
- Si hay líneas de banca, TODOS los campos "line" deben copiar esas cifras exactamente
- Rellena SIEMPRE todos los bloques: spread, total, team_total_home, team_total_away, first_half, first_half_total
- confidence_pct realista (55-75 típico; raramente >80)
- Usa solo conocimiento general de NBA y el contexto dado; no inventes lesiones concretas si no están en el contexto
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

    // Placeholder de stats reales (fase 2: balldontlie + stats.nba.com)
    const realStats = {
      home: { note: "Stats detalladas en próxima versión" },
      away: { note: "Stats detalladas en próxima versión" },
      h2h: { totalGames: 0, homeWins: 0, awayWins: 0, games: [] },
    };

    const gameContext = {
      gameId: gameId || null,
      bookLinesUsed: bookLines || null,
      season: "2025-26 / 2026-27",
    };

    const prompt = buildPrompt(home, away, {
      bookLines: bookLines || null,
      gameId: gameId || null,
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
        temperature: 0.35,
        max_tokens: 2500,
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
