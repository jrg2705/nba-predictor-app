// api/game-result.js — Verificar resultado final de partidos NBA (balldontlie)
// POST { gameIds: number[] }
// Usado para marcar historial como verified y actualizar track record.

const BDL_BASE = "https://api.balldontlie.io/nba/v1";

async function fetchOne(gameId, apiKey) {
  try {
    const res = await fetch(`${BDL_BASE}/games/${gameId}`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return { gameId, final: false };
    const g = await res.json();
    const game = g.data || g;

    const status = (game.status || "").toString();
    const isFinal =
      status.toLowerCase().includes("final") ||
      (game.period >= 4 && game.home_team_score != null && game.visitor_team_score != null);

    if (!isFinal) return { gameId, final: false };

    const homeScore = game.home_team_score;
    const awayScore = game.visitor_team_score;
    if (homeScore == null || awayScore == null) return { gameId, final: false };

    return {
      gameId,
      final: true,
      homeScore,
      awayScore,
      winner: homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "tie",
      margin: Math.abs(homeScore - awayScore),
      totalPoints: homeScore + awayScore,
      home: game.home_team?.full_name || game.home_team?.name,
      away: game.visitor_team?.full_name || game.visitor_team?.name,
      status: game.status,
    };
  } catch {
    return { gameId, final: false };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta BALLDONTLIE_API_KEY en Vercel → Environment Variables",
    });
  }

  const { gameIds, gamePks } = req.body || {};
  const ids = Array.isArray(gameIds) ? gameIds : Array.isArray(gamePks) ? gamePks : null;
  if (!ids || ids.length === 0) {
    return res.status(400).json({ error: "gameIds array is required" });
  }

  try {
    const results = await Promise.all(ids.map((id) => fetchOne(id, apiKey)));
    return res.status(200).json({ results });
  } catch (err) {
    console.error("game-result error:", err);
    return res.status(500).json({ error: "Error al verificar resultados", details: err.message });
  }
}
