-- Turso / libSQL schema for PharmConsilium level scores
-- Run once against your database, e.g.:
--   turso db shell <your-db-name> < schema.sql

CREATE TABLE IF NOT EXISTS level_scores (
  telegram_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  level TEXT NOT NULL,
  points INTEGER NOT NULL,
  played_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (telegram_id, level)
);

CREATE INDEX IF NOT EXISTS idx_level_scores_played_at
  ON level_scores (played_at DESC);
