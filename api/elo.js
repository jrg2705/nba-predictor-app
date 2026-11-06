// api/elo.js — GET ratings Elo actuales
import { buildCurrentElo, eloMatchupContext, ELO_HOME_ADV } from "../lib/eloHelper.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const bdlKey = process.env.BALLDONTLIE_API_KEY || null;
    const built = await buildCurrentElo(bdlKey, undefined);
    const home = req.query.home || null;
    const away = req.query.away || null;
    let matchup = null;
    if (home && away) {
      matchup = eloMatchupContext(built.ratings, home, away, null);
    }
    return res.status(200).json({
      source: built.source,
      season: built.season,
      gamesApplied: built.gamesApplied,
      warning: built.warning || null,
      homeAdv: ELO_HOME_ADV,
      ratings: built.ratings,
      matchup,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
