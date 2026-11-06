// api/odds.js — GET líneas NBA (The Odds API)
import { fetchOddsForMatchup, fetchAllNbaOdds } from "../lib/oddsHelper.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Sin ODDS_API_KEY" });

  try {
    const home = req.query.home || null;
    const away = req.query.away || null;
    if (home && away) {
      const result = await fetchOddsForMatchup(home, away, apiKey);
      return res.status(200).json(result);
    }
    const all = await fetchAllNbaOdds(apiKey);
    return res.status(200).json(all);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
