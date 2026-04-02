-- Scheduled Last Touch sessions + player joins.

ALTER TABLE public.last_touch_sessions
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS prize_pool numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entry_fee numeric(12,2) NOT NULL DEFAULT 1;

UPDATE public.last_touch_sessions
SET scheduled_start_at = COALESCE(scheduled_start_at, game_start_time, timezone('utc', now()) + interval '60 seconds');

ALTER TABLE public.last_touch_sessions
  ALTER COLUMN scheduled_start_at SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'upcoming';

CREATE TABLE IF NOT EXISTS public.last_touch_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES public.last_touch_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  username text NOT NULL,
  status text NOT NULL DEFAULT 'alive',
  joined_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_last_touch_players_session_id ON public.last_touch_players(session_id);
CREATE INDEX IF NOT EXISTS idx_last_touch_sessions_status_start ON public.last_touch_sessions(status, scheduled_start_at);

CREATE OR REPLACE FUNCTION public.last_touch_increment_prize_pool()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.last_touch_sessions
  SET prize_pool = COALESCE(prize_pool, 0) + COALESCE(entry_fee, 1)
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_last_touch_increment_prize_pool ON public.last_touch_players;
CREATE TRIGGER trg_last_touch_increment_prize_pool
AFTER INSERT ON public.last_touch_players
FOR EACH ROW
EXECUTE FUNCTION public.last_touch_increment_prize_pool();

ALTER TABLE public.last_touch_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "last_touch_players_read" ON public.last_touch_players;
CREATE POLICY "last_touch_players_read"
ON public.last_touch_players
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "last_touch_players_write" ON public.last_touch_players;
CREATE POLICY "last_touch_players_write"
ON public.last_touch_players
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'last_touch_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.last_touch_players;
  END IF;
END
$$;
