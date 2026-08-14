// api/standings.js — Clasificación NBA
// Fuente: balldontlie (tier superior) o respuesta vacía si no hay key/acceso

const BDL_BASE = "https://api.balldontlie.io/nba/v1";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const season = req.query.season || new Date().getFullYear();
    const apiKey = process.env.BALLDONTLIE_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        season,
        conferences: {},
        warning: "Falta BALLDONTLIE_API_KEY o el endpoint de standings requiere tier superior.",
      });
    }

    // balldontlie standings (puede requerir GOAT/ALL-STAR según tier)
    const response = await fetch(
      `${BDL_BASE}/standings?season=${season}`,
      { headers: { Authorization: apiKey } }
    );

    if (!response.ok) {
      return res.status(200).json({
        season,
        conferences: {},
        warning: `Standings no disponibles (status ${response.status}). Revisa tu tier de balldontlie.`,
      });
    }

    const data = await response.json();
    const teams = data.data || [];

    const conferences = { East: [], West: [] };
    teams.forEach((t) => {
      const conf = t.conference || t.team?.conference || "East";
      const entry = {
        teamId: t.team?.id || t.team_id,
        name: t.team?.full_name || t.team?.name || "—",
        wins: t.wins ?? 0,
        losses: t.losses ?? 0,
        winPct: t.wins && t.losses != null
          ? (t.wins / (t.wins + t.losses)).toFixed(3)
          : "—",
        conferenceRank: t.conference_rank ?? null,
      };
      if (conf === "West" || conf === "Western") conferences.West.push(entry);
      else conferences.East.push(entry);
    });

    conferences.East.sort((a, b) => (a.conferenceRank ?? 99) - (b.conferenceRank ?? 99));
    conferences.West.sort((a, b) => (a.conferenceRank ?? 99) - (b.conferenceRank ?? 99));

    return res.status(200).json({ season, conferences });
  } catch (err) {
    console.error("standings error:", err);
    return res.status(500).json({ error: "Error al cargar posiciones", details: err.message });
  }
}
