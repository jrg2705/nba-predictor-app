// api/today-games.js — Partidos NBA del día (+ modo resultados)
// GET ?date=YYYY-MM-DD
// GET ?date=YYYY-MM-DD&results=1  → finalizados con marcador/total/margen

const BDL_BASE = "https://api.balldontlie.io/nba/v1";

function mapGame(g) {
  return {
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
  };
}

function isFinal(g) {
  const status = (g.status || "").toString().toLowerCase();
  if (status.includes("final")) return true;
  if (
    g.home_team_score != null &&
    g.visitor_team_score != null &&
    (g.period >= 4 || status.includes("end"))
  ) {
    return true;
  }
  return false;
}

function enrichFinal(g) {
  const homeScore = g.home_team_score;
  const awayScore = g.visitor_team_score;
  const homeName = g.home_team?.full_name || g.home_team?.name || "Local";
  const awayName = g.visitor_team?.full_name || g.visitor_team?.name || "Visitante";
  return {
    gameId: g.id,
    final: true,
    status: g.status || "Final",
    gameDate: g.datetime || g.date,
    home: {
      name: homeName,
      abbreviation: g.home_team?.abbreviation,
      score: homeScore,
    },
    away: {
      name: awayName,
      abbreviation: g.visitor_team?.abbreviation,
      score: awayScore,
    },
    winner:
      homeScore == null || awayScore == null
        ? null
        : homeScore > awayScore
          ? "home"
          : awayScore > homeScore
            ? "away"
            : "tie",
    totalPoints:
      homeScore != null && awayScore != null ? homeScore + awayScore : null,
    margin:
      homeScore != null && awayScore != null ? Math.abs(homeScore - awayScore) : null,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const resultsMode =
      req.query.results === "1" ||
      req.query.results === "true" ||
      req.query.results === "yes";
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
    const rawGames = data.data || [];

    if (!resultsMode) {
      const games = rawGames.map(mapGame);
      return res.status(200).json({ date, games });
    }

    const finals = [];
    const pending = [];
    for (const g of rawGames) {
      if (isFinal(g)) finals.push(enrichFinal(g));
      else {
        pending.push({
          gameId: g.id,
          final: false,
          status: g.status || "Scheduled",
          gameDate: g.datetime || g.date,
          home: {
            name: g.home_team?.full_name || g.home_team?.name,
            score: g.home_team_score ?? null,
          },
          away: {
            name: g.visitor_team?.full_name || g.visitor_team?.name,
            score: g.visitor_team_score ?? null,
          },
        });
      }
    }

    finals.sort((a, b) => String(a.gameDate || "").localeCompare(String(b.gameDate || "")));

    return res.status(200).json({
      date,
      totalScheduled: rawGames.length,
      totalFinal: finals.length,
      totalPending: pending.length,
      games: finals,
      pending,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("today-games error:", err);
    return res.status(500).json({
      error: "Error al obtener partidos del día",
      details: err.message,
    });
  }
}
