-- Start Last Touch countdown only after first real join.

ALTER TABLE public.last_touch_sessions
  ADD COLUMN IF NOT EXISTS first_player_joined_at timestamptz;

ALTER TABLE public.last_touch_sessions
  ALTER COLUMN game_start_time DROP NOT NULL;

-- Existing lobby rows should wait for a first join.
UPDATE public.last_touch_sessions
SET game_start_time = NULL
WHERE first_player_joined_at IS NULL;
