-- scripts/backfill_participants.sql
-- One-time backfill of the six seeded games onto the participant model.
-- Idempotent: clears any prior participant rows for these matches first.

-- Helper CTE-free approach: delete then re-insert per (date,time) match.
DELETE FROM match_players WHERE match_id IN (SELECT id FROM matches WHERE date IN ('2026-04-12','2026-04-22'));

-- 2026-04-12 18:00  Daniel 22 vs Rasmus 5
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 22, 0 FROM matches m WHERE m.date='2026-04-12' AND m.time='18:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 1, 5, 1 FROM matches m WHERE m.date='2026-04-12' AND m.time='18:00';

-- 2026-04-12 18:30  Daniel 22 vs Rasmus 10
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 22, 0 FROM matches m WHERE m.date='2026-04-12' AND m.time='18:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 1, 10, 1 FROM matches m WHERE m.date='2026-04-12' AND m.time='18:30';

-- 2026-04-12 19:00  Daniel 22 vs Rasmus 12
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 22, 0 FROM matches m WHERE m.date='2026-04-12' AND m.time='19:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 1, 12, 1 FROM matches m WHERE m.date='2026-04-12' AND m.time='19:00';

-- 2026-04-22 18:00  Daniel+Rasmus 18 vs Marcus+Søren 21
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 18, 0 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 0, 18, 1 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Marcus'), 1, 21, 2 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:00';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Søren'), 1, 21, 3 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:00';

-- 2026-04-22 18:45  Daniel 11 vs Marcus 0 vs Rasmus 5 (three-way)
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 11, 0 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:45';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Marcus'), 1, 0, 1 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:45';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 2, 5, 2 FROM matches m WHERE m.date='2026-04-22' AND m.time='18:45';

-- 2026-04-22 19:30  Daniel+Marcus 11 vs Rasmus+Søren+Will 4
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Daniel'), 0, 11, 0 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Marcus'), 0, 11, 1 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Rasmus'), 1, 4, 2 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Søren'), 1, 4, 3 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';
INSERT INTO match_players (id, match_id, player_id, team, score, position)
SELECT lower(hex(randomblob(16))), m.id, (SELECT id FROM players WHERE name='Will'), 1, 4, 4 FROM matches m WHERE m.date='2026-04-22' AND m.time='19:30';

-- Drink attribution by (match, position)
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Daniel')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-12' AND time='18:00') AND position=0;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Rasmus')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-12' AND time='18:00') AND position=1;

UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Daniel')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='18:00') AND position IN (0,1);

UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Daniel')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='18:45') AND position=0;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Marcus')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='18:45') AND position=1;

UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Daniel')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position=0;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Marcus')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position=1;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Rasmus')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position=2;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Søren')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position=3;
UPDATE match_drinks SET player_id = (SELECT id FROM players WHERE name='Will')
  WHERE match_id = (SELECT id FROM matches WHERE date='2026-04-22' AND time='19:30') AND position IN (4,5);
