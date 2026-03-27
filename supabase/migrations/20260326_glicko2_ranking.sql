-- ============================================================
-- Glicko-2 Ranking System Migration
-- ============================================================

-- 1. Add skillflow_score to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skillflow_score float DEFAULT 1000;

-- 2. Create player_ratings table
CREATE TABLE IF NOT EXISTS player_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  game_type text NOT NULL,
  rating float DEFAULT 1000 NOT NULL,
  rating_deviation float DEFAULT 350 NOT NULL,
  volatility float DEFAULT 0.06 NOT NULL,
  matches_played integer DEFAULT 0 NOT NULL,
  is_placed boolean DEFAULT false NOT NULL,
  tier text DEFAULT 'bronze' NOT NULL,
  last_match_at timestamptz,
  last_rated_match_id uuid,  -- idempotency: tracks last match whose rating was processed
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT player_ratings_user_game_unique UNIQUE (user_id, game_type)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_player_ratings_user_id ON player_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_game_type ON player_ratings(game_type);
CREATE INDEX IF NOT EXISTS idx_player_ratings_rating ON player_ratings(rating DESC);
CREATE INDEX IF NOT EXISTS idx_player_ratings_game_rating ON player_ratings(game_type, rating DESC);

-- 4. Updated-at trigger
CREATE OR REPLACE FUNCTION update_player_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS player_ratings_updated_at ON player_ratings;
CREATE TRIGGER player_ratings_updated_at
  BEFORE UPDATE ON player_ratings
  FOR EACH ROW EXECUTE FUNCTION update_player_ratings_updated_at();

-- 5. Row Level Security
ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings (for leaderboard/profile display)
CREATE POLICY "player_ratings_read_all" ON player_ratings
  FOR SELECT USING (true);

-- Authenticated users can insert their own rows (on first play)
CREATE POLICY "player_ratings_insert_own" ON player_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow any authenticated user to update any row
-- This is needed because after a match, player1 computes and writes BOTH players' new ratings
-- The API route (/api/ranking/update-match) uses the service role key and bypasses RLS
CREATE POLICY "player_ratings_update_authenticated" ON player_ratings
  FOR UPDATE USING (auth.role() = 'authenticated');
