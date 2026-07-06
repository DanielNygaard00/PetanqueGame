CREATE TABLE match_players (
  id        TEXT PRIMARY KEY,
  match_id  TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team      INTEGER NOT NULL,
  score     INTEGER,
  position  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_match_players_match_id ON match_players(match_id);
CREATE INDEX idx_match_players_player_id ON match_players(player_id);

ALTER TABLE match_drinks ADD COLUMN player_id TEXT;

ALTER TABLE matches DROP COLUMN is_group;
ALTER TABLE matches DROP COLUMN group_members;
ALTER TABLE matches DROP COLUMN player;
ALTER TABLE matches DROP COLUMN opponent;
ALTER TABLE matches DROP COLUMN won;
ALTER TABLE matches DROP COLUMN points;
ALTER TABLE matches DROP COLUMN opponent_points;
