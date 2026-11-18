// api/results.js — Resultados NBA en Neon + lectura por día/rango + CSV
// GET ?date=YYYY-MM-DD           → un día (Neon; si vacío, balldontlie + upsert)
// GET ?from=&to=                 → rango solo desde Neon
// GET ?from=&to=&format=csv      → CSV del rango (Neon)
// POST { date } o { from, to }   → sync forzado desde balldontlie (un día por request recomendado)

import { getSql, ensureResultsTable, upsertGameResults } from "../lib/db.js";

const BDL_BASE = "https://api.balldontlie.io/nba/v1";

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

function rowToGame(r) {
  return {
    gameId: r.game_id,
    final: true,
    status: r.status || "Final",
    gameDate: r.game_datetime || r.game_date,
    home: {
      name: r.home_name,
      abbreviation: r.home_abbr,
      score: r.home_score,
    },
    away: {
      name: r.away_name,
      abbreviation: r.away_abbr,
      score: r.away_score,
    },
    winner: r.winner,
    totalPoints: r.total_points,
    margin: r.margin,
  };
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function fetchDayFromBdl(date, apiKey) {
  const response = await fetch(`${BDL_BASE}/games?dates[]=${date}&per_page=100`, {
    headers: { Authorization: apiKey },
  });
  if (response.status === 429) {
    const err = new Error("Too many requests (429). Espera e intenta de nuevo.");
    err.status = 429;
    throw err;
  }
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`balldontlie ${response.status}: ${text.slice(0, 120)}`);
    err.status = response.status;
    throw err;
  }
  const data = await response.json();
  const raw = data.data || [];
  return raw.filter(isFinal).map(enrichFinal);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = getSql();
  const apiKey = process.env.BALLDONTLIE_API_KEY || null;

  try {
    if (sql) await ensureResultsTable(sql);

    // --- POST: sync un día desde BDL → Neon ---
    if (req.method === "POST") {
      const body = req.body || {};
      const date = body.date || req.query.date;
      if (!date) return res.status(400).json({ error: "Falta date (YYYY-MM-DD)" });
      if (!apiKey) {
        return res.status(503).json({ error: "Falta BALLDONTLIE_API_KEY" });
      }
      const games = await fetchDayFromBdl(date, apiKey);
      let saved = 0;
      if (sql) saved = await upsertGameResults(sql, games, date);
      return res.status(200).json({
        date,
        totalFinal: games.length,
        savedToNeon: saved,
        configured: !!sql,
        games,
      });
    }

    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const date = req.query.date || null;
    const from = req.query.from || null;
    const to = req.query.to || null;
    const format = (req.query.format || "").toLowerCase();
    const force = req.query.force === "1" || req.query.force === "true";

    // --- Un día ---
    if (date && !from && !to) {
      if (sql && !force) {
        const rows = await sql`
          SELECT * FROM game_results
          WHERE game_date = ${date}::date
          ORDER BY game_datetime ASC NULLS LAST, game_id ASC
        `;
        if (rows.length > 0) {
          return res.status(200).json({
            date,
            source: "neon",
            totalFinal: rows.length,
            games: rows.map(rowToGame),
          });
        }
      }
      if (!apiKey) {
        return res.status(200).json({
          date,
          games: [],
          warning: sql
            ? "Sin datos en Neon y falta BALLDONTLIE_API_KEY"
            : "Falta DATABASE_URL y/o BALLDONTLIE_API_KEY",
        });
      }
      const games = await fetchDayFromBdl(date, apiKey);
      if (sql) await upsertGameResults(sql, games, date);
      return res.status(200).json({
        date,
        source: "balldontlie",
        totalFinal: games.length,
        savedToNeon: !!sql,
        games,
      });
    }

    // --- Rango: solo Neon ---
    if (from && to) {
      if (!sql) {
        return res.status(503).json({
          error: "Sin DATABASE_URL. Configura Neon para exportar rangos.",
          configured: false,
        });
      }
      const rows = await sql`
        SELECT * FROM game_results
        WHERE game_date >= ${from}::date AND game_date <= ${to}::date
        ORDER BY game_date ASC, game_datetime ASC NULLS LAST, game_id ASC
      `;

      if (format === "csv") {
        const headers = [
          "date",
          "game_id",
          "status",
          "away",
          "away_abbr",
          "away_score",
          "home",
          "home_abbr",
          "home_score",
          "winner",
          "winner_name",
          "total_points",
          "margin",
          "game_datetime",
        ];
        const lines = [headers.join(",")];
        for (const r of rows) {
          const winnerName =
            r.winner === "home"
              ? r.home_name
              : r.winner === "away"
                ? r.away_name
                : r.winner === "tie"
                  ? "Empate"
                  : "";
          lines.push(
            [
              r.game_date,
              r.game_id,
              r.status,
              r.away_name,
              r.away_abbr,
              r.away_score,
              r.home_name,
              r.home_abbr,
              r.home_score,
              r.winner,
              winnerName,
              r.total_points,
              r.margin,
              r.game_datetime,
            ]
              .map(csvEscape)
              .join(",")
          );
        }
        const fname = `nba-results-${from}_${to}.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
        return res.status(200).send("\uFEFF" + lines.join("\n"));
      }

      const countByDate = {};
      for (const r of rows) {
        const d = String(r.game_date).slice(0, 10);
        countByDate[d] = (countByDate[d] || 0) + 1;
      }
      return res.status(200).json({
        from,
        to,
        source: "neon",
        totalFinal: rows.length,
        daysWithData: Object.keys(countByDate).length,
        countByDate,
        games: rows.map(rowToGame),
      });
    }

    return res.status(400).json({
      error: "Usa ?date=YYYY-MM-DD o ?from=YYYY-MM-DD&to=YYYY-MM-DD",
    });
  } catch (err) {
    console.error("results api error:", err);
    const status = err.status === 429 ? 429 : 500;
    return res.status(status).json({
      error: err.message || "Error resultados",
      details: String(err.message || err),
    });
  }
}
