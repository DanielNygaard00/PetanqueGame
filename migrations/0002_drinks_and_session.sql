-- migrations/0002_drinks_and_session.sql
ALTER TABLE matches ADD COLUMN time TEXT;
ALTER TABLE matches ADD COLUMN opponent_points INTEGER;

ALTER TABLE matches DROP COLUMN drink_type;
ALTER TABLE matches DROP COLUMN drink_category;
ALTER TABLE matches DROP COLUMN drink_brand;
ALTER TABLE matches DROP COLUMN drink_country;
ALTER TABLE matches DROP COLUMN drink_name;
ALTER TABLE matches DROP COLUMN wine_region;

CREATE TABLE match_drinks (
  id             TEXT PRIMARY KEY,
  match_id       TEXT NOT NULL,
  drink_type     TEXT,
  drink_category TEXT,
  drink_brand    TEXT,
  drink_name     TEXT,
  drink_country  TEXT,
  wine_region    TEXT,
  count          INTEGER NOT NULL DEFAULT 1,
  volume_cl      REAL,
  position       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_match_drinks_match_id ON match_drinks(match_id);
