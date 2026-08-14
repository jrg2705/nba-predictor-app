// api/today-games.js — Partidos NBA del día
// Fuente: balldontlie (requiere BALLDONTLIE_API_KEY) o fallback vacío

const BDL_BASE = "https://api.balldontlie.io/nba/v1";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const apiKey = process.env.BALLDONTLIE_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        date,
        games: [],
        warning: "Falta BALLDONTLIE_API_KEY. Añádela en Vercel → Settings → Environment Variables.",
      });
    }

    const response = await fetch(
      `${BDL_BASE}/games?dates[]=${date}&per_page=100`,
      { headers: { Authorization: apiKey } }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: "Error al obtener partidos de balldontlie",
        details: text.slice(0, 300),
      });
    }

    const data = await response.json();
    const games = (data.data || []).map((g) => ({
      gameId: g.id,
      status: g.status || "Scheduled",
      gameDate: g.datetime || g.date,
      home: {
        id: g.home_team?.id,
        name: g.home_team?.full_name || g.home_team?.name,
        abbreviation: g.home_team?.abbreviation,
        score: g.home_team_score ?? null,
      },
      away: {
        id: g.visitor_team?.id,
        name: g.visitor_team?.full_name || g.visitor_team?.name,
        abbreviation: g.visitor_team?.abbreviation,
        score: g.visitor_team_score ?? null,
      },
      period: g.period,
      time: g.time,
      postseason: g.postseason || false,
    }));

    return res.status(200).json({ date, games });
  } catch (err) {
    console.error("today-games error:", err);
    return res.status(500).json({
      error: "Error al obtener partidos del día",
      details: err.message,
    });
  }
}
