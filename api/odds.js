// api/odds.js — GET líneas NBA vivas (The Odds API)
// ?home=Philadelphia 76ers&away=Cleveland Cavaliers  → un partido
// sin query → listado de próximos
import { fetchOddsForMatchup, fetchAllNbaOdds } from "./oddsHelper.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.ODDS_API_KEY;
    const home = req.query.home;
    const away = req.query.away;

    if (home && away) {
      const result = await fetchOddsForMatchup(home, away, apiKey);
      return res.status(200).json({
        home,
        away,
        lines: result.lines,
        warning: result.warning || null,
        matched: result.matched || null,
        remainingRequests: result.remainingRequests || null,
        available: result.available || null,
      });
    }

    const all = await fetchAllNbaOdds(apiKey);
    return res.status(200).json({
      games: all.games || [],
      warning: all.warning || null,
      remainingRequests: all.remainingRequests || null,
    });
  } catch (err) {
    console.error("odds error:", err);
    return res.status(500).json({ error: "Error al obtener odds", details: err.message });
  }
}
