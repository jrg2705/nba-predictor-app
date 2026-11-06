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
