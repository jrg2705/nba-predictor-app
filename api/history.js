// api/history.js — Historial en Neon
import { getSql, ensureHistoryTable } from "./db.js";

function rowToEntry(r) {
  return {
    id: r.client_id || String(r.id),
    dbId: Number(r.id),
    date: r.analyzed_at,
    home: r.home,
    away: r.away,
    gameId: r.game_id || null,
    analysis: r.analysis,
    realStats: r.real_stats,
    gameContext: r.game_context,
    verified: !!r.verified,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = getSql();
  if (!sql) {
    return res.status(503).json({
      error:
        "Sin DATABASE_URL. Crea un proyecto en neon.tech y añade DATABASE_URL en Vercel → Environment Variables.",
      configured: false,
    });
  }

  try {
    await ensureHistoryTable(sql);

    if (req.method === "GET") {
      const limit = Math.min(Math.max(parseInt(req.query.limit || "40", 10) || 40, 1), 500);
      const from = req.query.from || null;
      const to = req.query.to || null;

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

      const countRows = await sql`SELECT COUNT(*)::int AS n FROM analysis_history`;
      const total = countRows[0]?.n ?? rows.length;

      return res.status(200).json({
        configured: true,
        total,
        count: rows.length,
        entries: rows.map(rowToEntry),
      });
    }

    if (req.method === "POST") {
      const entry = req.body?.entry || req.body;
      if (!entry?.home || !entry?.away) {
        return res.status(400).json({ error: "Falta home/away en entry" });
      }
      const analyzedAt = entry.date ? new Date(entry.date).toISOString() : new Date().toISOString();
      const clientId = entry.id != null ? String(entry.id) : String(Date.now());

      const existing = await sql`
        SELECT id FROM analysis_history
        WHERE home = ${entry.home}
          AND away = ${entry.away}
          AND (analyzed_at AT TIME ZONE 'UTC')::date = (${analyzedAt}::timestamptz AT TIME ZONE 'UTC')::date
        LIMIT 1
      `;

      if (existing.length > 0) {
        const id = existing[0].id;
        await sql`
          UPDATE analysis_history SET
            client_id = ${clientId},
            analyzed_at = ${analyzedAt}::timestamptz,
            game_id = ${entry.gameId || entry.game_id || null},
            analysis = ${JSON.stringify(entry.analysis || null)}::jsonb,
            real_stats = ${JSON.stringify(entry.realStats || entry.real_stats || null)}::jsonb,
            game_context = ${JSON.stringify(entry.gameContext || entry.game_context || null)}::jsonb,
            verified = ${!!entry.verified}
          WHERE id = ${id}
        `;
        return res.status(200).json({ ok: true, action: "updated", id: Number(id) });
      }

      const inserted = await sql`
        INSERT INTO analysis_history (
          client_id, analyzed_at, home, away, game_id, analysis, real_stats, game_context, verified
        ) VALUES (
          ${clientId},
          ${analyzedAt}::timestamptz,
          ${entry.home},
          ${entry.away},
          ${entry.gameId || entry.game_id || null},
          ${JSON.stringify(entry.analysis || null)}::jsonb,
          ${JSON.stringify(entry.realStats || entry.real_stats || null)}::jsonb,
          ${JSON.stringify(entry.gameContext || entry.game_context || null)}::jsonb,
          ${!!entry.verified}
        )
        RETURNING id
      `;
      return res.status(201).json({ ok: true, action: "inserted", id: Number(inserted[0].id) });
    }

    if (req.method === "DELETE") {
      if (req.query.confirm !== "1") {
        return res.status(400).json({ error: "Añade ?confirm=1 para borrar todo el historial en Neon" });
      }
      await sql`DELETE FROM analysis_history`;
      return res.status(200).json({ ok: true, deleted: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("history api error:", err);
    return res.status(500).json({ error: "Error historial Neon", details: err.message });
  }
}
