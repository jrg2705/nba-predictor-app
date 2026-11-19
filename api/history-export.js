// api/history-export.js — Export CSV historial Neon (+ Elo / edge)
import { getSql, ensureHistoryTable } from "../lib/db.js";

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Extrae bloque Elo guardado en game_context / real_stats / analysis */
function extractElo(r, analysis) {
  const gc = r.game_context || {};
  const rs = r.real_stats || {};
  const elo =
    gc.elo ||
    rs.elo ||
    analysis.elo ||
    gc.eloContext ||
    null;

  const eloHome =
    elo?.eloHome ?? elo?.elo_home ?? gc.eloHome ?? null;
  const eloAway =
    elo?.eloAway ?? elo?.elo_away ?? gc.eloAway ?? null;
  const edgeHome =
    elo?.edgeHomePct ?? elo?.edge_home ?? elo?.edgeHome ?? null;
  const edgeAway =
    elo?.edgeAwayPct ?? elo?.edge_away ?? elo?.edgeAway ?? null;
  const pHome =
    elo?.pHome ?? elo?.p_home ?? elo?.winProbHome ?? null;
  const pAway =
    elo?.pAway ?? elo?.p_away ?? elo?.winProbAway ?? null;

  return { eloHome, eloAway, edgeHome, edgeAway, pHome, pAway };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const sql = getSql();
  if (!sql) {
    return res.status(503).json({
      error: "Sin DATABASE_URL. Configura Neon en Vercel.",
      configured: false,
    });
  }

  try {
    await ensureHistoryTable(sql);
    const from = req.query.from || null;
    const to = req.query.to || null;
    const limit = Math.min(parseInt(req.query.limit || "5000", 10) || 5000, 10000);

    let rows;
    if (from && to) {
      rows = await sql`
        SELECT * FROM analysis_history
        WHERE (analyzed_at AT TIME ZONE 'UTC')::date >= ${from}::date
          AND (analyzed_at AT TIME ZONE 'UTC')::date <= ${to}::date
        ORDER BY analyzed_at DESC
        LIMIT ${limit}
      `;
    } else if (from) {
      rows = await sql`
        SELECT * FROM analysis_history
        WHERE (analyzed_at AT TIME ZONE 'UTC')::date >= ${from}::date
        ORDER BY analyzed_at DESC
        LIMIT ${limit}
      `;
    } else if (to) {
      rows = await sql`
        SELECT * FROM analysis_history
        WHERE (analyzed_at AT TIME ZONE 'UTC')::date <= ${to}::date
        ORDER BY analyzed_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM analysis_history
        ORDER BY analyzed_at DESC
        LIMIT ${limit}
      `;
    }

    const headers = [
      "id",
      "date",
      "home",
      "away",
      "game_id",
      "home_win_pct",
      "away_win_pct",
      "best_market",
      "best_pick",
      "best_confidence",
      "alt_market",
      "alt_pick",
      "alt_confidence",
      "spread_favored",
      "spread_line",
      "spread_covers",
      "total_pick",
      "total_line",
      "first_half_winner",
      "elo_home",
      "elo_away",
      "elo_edge_home_pct",
      "elo_edge_away_pct",
      "elo_win_prob_home",
      "elo_win_prob_away",
      "analyst_take",
      "verified",
    ];

    const lines = [headers.join(",")];
    for (const r of rows) {
      const a = r.analysis || {};
      const best = a.best_method || {};
      const alt = a.alternative_method || {};
      const spread = a.spread || {};
      const total = a.total || {};
      const fh = a.first_half || {};
      const elo = extractElo(r, a);

      lines.push(
        [
          r.id,
          r.analyzed_at,
          r.home,
          r.away,
          r.game_id,
          a.home_win_pct,
          a.away_win_pct,
          best.market,
          best.pick_summary,
          best.confidence_pct,
          alt.market,
          alt.pick_summary,
          alt.confidence_pct,
          spread.favored,
          spread.line,
          spread.covers,
          total.pick,
          total.line,
          fh.winner,
          elo.eloHome,
          elo.eloAway,
          elo.edgeHome,
          elo.edgeAway,
          elo.pHome,
          elo.pAway,
          a.analyst_take,
          r.verified,
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    const csv = lines.join("\n");
    const fname = `nba-history-${from || "all"}-${to || "all"}.csv`.replace(/all-all/, "full");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    return res.status(200).send("\uFEFF" + csv);
  } catch (err) {
    console.error("history-export error:", err);
    return res.status(500).json({ error: "Error export CSV", details: err.message });
  }
}
