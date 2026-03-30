ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS match_start_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS time_limit_ms INTEGER,
  ADD COLUMN IF NOT EXISTS player1_remaining_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS player2_remaining_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS active_turn TEXT CHECK (active_turn IN ('player1', 'player2', NULL)),
  ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_matches_match_start_time
  ON public.matches (match_start_time);
