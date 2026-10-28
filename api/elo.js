// api/elo.js — GET ratings Elo actuales (priors + replay temporada)
import { buildCurrentElo, eloMatchupContext, ELO_HOME_ADV } from "./eloHelper.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.BALLDONTLIE_API_KEY || null;
    const season = req.query.season ? Number(req.query.season) : undefined;
    const built = await buildCurrentElo(apiKey, season);

    const home = req.query.home;
    const away = req.query.away;
    let matchup = null;
    if (home && away) {
      matchup = eloMatchupContext(built.ratings, home, away, {
        mlHome: req.query.mlHome != null ? Number(req.query.mlHome) : null,
        mlAway: req.query.mlAway != null ? Number(req.query.mlAway) : null,
      });
    }

    const table = Object.entries(built.ratings)
      .filter(([name]) => name !== "Los Angeles Clippers")
      .map(([team, elo]) => ({ team, elo: Math.round(elo * 10) / 10 }))
      .sort((a, b) => b.elo - a.elo);

    return res.status(200).json({
      season: built.season,
      source: built.source,
      gamesApplied: built.gamesApplied,
      warning: built.warning,
      homeAdvantage: ELO_HOME_ADV,
      table,
      matchup,
    });
  } catch (err) {
    console.error("elo error:", err);
    return res.status(500).json({ error: "Error Elo", details: err.message });
  }
}
