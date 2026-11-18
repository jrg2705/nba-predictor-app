// lib/db.js — Cliente Neon (Postgres serverless)
import { neon } from "@neondatabase/serverless";

let _sql = null;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!_sql) _sql = neon(url);
  return _sql;
}

export async function ensureHistoryTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS analysis_history (
      id BIGSERIAL PRIMARY KEY,
      client_id TEXT,
      analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      home TEXT NOT NULL,
      away TEXT NOT NULL,
      game_id TEXT,
      analysis JSONB,
      real_stats JSONB,
      game_context JSONB,
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS analysis_history_matchup_day
    ON analysis_history (home, away, ((analyzed_at AT TIME ZONE 'UTC')::date))
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS analysis_history_analyzed_at
    ON analysis_history (analyzed_at DESC)
  `;
}

export async function ensureResultsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS game_results (
      id BIGSERIAL PRIMARY KEY,
      game_id TEXT NOT NULL,
      game_date DATE NOT NULL,
      status TEXT,
      home_name TEXT NOT NULL,
      home_abbr TEXT,
      home_score INT,
      away_name TEXT NOT NULL,
      away_abbr TEXT,
      away_score INT,
      winner TEXT,
      total_points INT,
      margin INT,
      game_datetime TIMESTAMPTZ,
      payload JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (game_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS game_results_date
    ON game_results (game_date DESC)
  `;
}

/** Upsert lista de finales (objetos estilo enrichFinal de today-games) */
export async function upsertGameResults(sql, games, dayIso) {
  if (!sql || !Array.isArray(games) || !games.length) return 0;
  let n = 0;
  for (const g of games) {
    const gameId = String(g.gameId ?? g.game_id ?? "");
    if (!gameId) continue;
    const homeName = g.home?.name || g.home_name || "";
    const awayName = g.away?.name || g.away_name || "";
    if (!homeName || !awayName) continue;
    const homeScore = g.home?.score ?? g.home_score ?? null;
    const awayScore = g.away?.score ?? g.away_score ?? null;
    const total =
      g.totalPoints ??
      g.total_points ??
      (homeScore != null && awayScore != null ? homeScore + awayScore : null);
    const margin =
      g.margin ??
      (homeScore != null && awayScore != null ? Math.abs(homeScore - awayScore) : null);
    const gameDate = dayIso || String(g.gameDate || g.game_date || "").slice(0, 10);
    const dt = g.gameDate || g.game_datetime || null;

    await sql`
      INSERT INTO game_results (
        game_id, game_date, status,
        home_name, home_abbr, home_score,
        away_name, away_abbr, away_score,
        winner, total_points, margin, game_datetime, payload, updated_at
      ) VALUES (
        ${gameId},
        ${gameDate}::date,
        ${g.status || "Final"},
        ${homeName},
        ${g.home?.abbreviation || g.home_abbr || null},
        ${homeScore},
        ${awayName},
        ${g.away?.abbreviation || g.away_abbr || null},
        ${awayScore},
        ${g.winner || null},
        ${total},
        ${margin},
        ${dt ? new Date(dt).toISOString() : null}::timestamptz,
        ${JSON.stringify(g)}::jsonb,
        NOW()
      )
      ON CONFLICT (game_id) DO UPDATE SET
        game_date = EXCLUDED.game_date,
        status = EXCLUDED.status,
        home_name = EXCLUDED.home_name,
        home_abbr = EXCLUDED.home_abbr,
        home_score = EXCLUDED.home_score,
        away_name = EXCLUDED.away_name,
        away_abbr = EXCLUDED.away_abbr,
        away_score = EXCLUDED.away_score,
        winner = EXCLUDED.winner,
        total_points = EXCLUDED.total_points,
        margin = EXCLUDED.margin,
        game_datetime = EXCLUDED.game_datetime,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
    n += 1;
  }
  return n;
}
