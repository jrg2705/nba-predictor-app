// api/h2h.js — Head-to-head temporada entre dos equipos

const BDL_BASE = "https://api.balldontlie.io/nba/v1";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body = req.method === "POST" ? req.body : req.query;
    const homeId = body.homeId || body.home_team_id;
    const awayId = body.awayId || body.visitor_team_id;
    const season = body.season || new Date().getFullYear();

    if (!homeId || !awayId) {
      return res.status(400).json({ error: "Se requieren homeId y awayId" });
    }

    const apiKey = process.env.BALLDONTLIE_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        season,
        games: [],
        homeWins: 0,
        awayWins: 0,
        warning: "Falta BALLDONTLIE_API_KEY",
      });
    }

    // Obtener juegos de ambos equipos y filtrar H2H
    const params = new URLSearchParams({
      "team_ids[]": homeId,
      "seasons[]": season,
      per_page: "100",
    });
    // balldontlie acepta múltiples team_ids; hacemos dos requests o uno con ambos
    const url = `${BDL_BASE}/games?team_ids[]=${homeId}&team_ids[]=${awayId}&seasons[]=${season}&per_page=100`;
    const response = await fetch(url, { headers: { Authorization: apiKey } });

    if (!response.ok) {
      return res.status(200).json({
        season,
        games: [],
        homeWins: 0,
        awayWins: 0,
        warning: `Error ${response.status} al obtener H2H`,
      });
    }

    const data = await response.json();
    const raw = (data.data || []).filter((g) => {
      const ids = [g.home_team?.id, g.visitor_team?.id];
      return ids.includes(Number(homeId)) && ids.includes(Number(awayId));
    });

    let homeWins = 0;
    let awayWins = 0;
    const games = raw.map((g) => {
      const isFinal = g.status === "Final" || (g.home_team_score != null && g.visitor_team_score != null && g.period >= 4);
      const homeIsOurHome = g.home_team?.id === Number(homeId);
      const ourHomeScore = homeIsOurHome ? g.home_team_score : g.visitor_team_score;
      const ourAwayScore = homeIsOurHome ? g.visitor_team_score : g.home_team_score;
      let winner = null;
      if (isFinal && ourHomeScore != null && ourAwayScore != null) {
        if (ourHomeScore > ourAwayScore) {
          homeWins++;
          winner = "home";
        } else if (ourAwayScore > ourHomeScore) {
          awayWins++;
          winner = "away";
        }
      }
      return {
        gameId: g.id,
        date: (g.date || g.datetime || "").slice(0, 10),
        home: {
          name: g.home_team?.full_name || g.home_team?.name,
          score: g.home_team_score,
        },
        away: {
          name: g.visitor_team?.full_name || g.visitor_team?.name,
          score: g.visitor_team_score,
        },
        isFinal,
        winner,
        status: g.status,
      };
    });

    return res.status(200).json({
      season,
      games,
      homeWins,
      awayWins,
      totalGames: games.length,
      finalGames: games.filter((g) => g.isFinal).length,
    });
  } catch (err) {
    console.error("h2h error:", err);
    return res.status(500).json({ error: "Error H2H", details: err.message });
  }
}
