-- migrations/0001_init.sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);

CREATE TABLE matches (
  id                TEXT PRIMARY KEY,
  created_by        TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT,
  date              TEXT,
  is_group          INTEGER NOT NULL DEFAULT 0,
  group_members     TEXT,
  consecutive_games INTEGER,
  player            TEXT,
  arena             TEXT,
  opponent          TEXT,
  won               INTEGER NOT NULL DEFAULT 0,
  points            INTEGER,
  drink_type        TEXT,
  drink_category    TEXT,
  drink_brand       TEXT,
  drink_country     TEXT,
  drink_name        TEXT,
  wine_region       TEXT,
  game_items        TEXT
);
CREATE INDEX idx_matches_date ON matches(date);
CREATE INDEX idx_matches_created_by ON matches(created_by);

CREATE TABLE options (
  id         TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_options_collection ON options(collection);
