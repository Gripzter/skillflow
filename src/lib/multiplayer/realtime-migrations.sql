-- Run this in Supabase SQL Editor to enable real-time matchmaking and match channels.
-- Phase 1: Real multiplayer infrastructure.

-- Enable Realtime for the matches table (for postgres_changes in matchmaking subscription)
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- Index for fast matchmaking queries (find waiting matches by game_type + stake_amount)
CREATE INDEX IF NOT EXISTS idx_matches_matchmaking
  ON matches(game_type, stake_amount, status)
  WHERE status = 'waiting';
