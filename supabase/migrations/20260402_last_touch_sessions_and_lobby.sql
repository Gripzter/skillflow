-- Server-authoritative Last Touch lobby/session synchronization.

CREATE TABLE IF NOT EXISTS public.last_touch_sessions (
  id text PRIMARY KEY,
  game_start_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'lobby',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.last_touch_lobby_entries (
  session_id text NOT NULL REFERENCES public.last_touch_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  username text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_last_touch_lobby_entries_session_last_seen
  ON public.last_touch_lobby_entries(session_id, last_seen_at DESC);

CREATE OR REPLACE FUNCTION public.touch_last_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_last_touch_sessions_updated_at ON public.last_touch_sessions;
CREATE TRIGGER trg_last_touch_sessions_updated_at
BEFORE UPDATE ON public.last_touch_sessions
FOR EACH ROW
EXECUTE FUNCTION public.touch_last_touch_updated_at();

DROP TRIGGER IF EXISTS trg_last_touch_lobby_entries_updated_at ON public.last_touch_lobby_entries;
CREATE TRIGGER trg_last_touch_lobby_entries_updated_at
BEFORE UPDATE ON public.last_touch_lobby_entries
FOR EACH ROW
EXECUTE FUNCTION public.touch_last_touch_updated_at();

ALTER TABLE public.last_touch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.last_touch_lobby_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "last_touch_sessions_read" ON public.last_touch_sessions;
CREATE POLICY "last_touch_sessions_read"
ON public.last_touch_sessions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "last_touch_sessions_write" ON public.last_touch_sessions;
CREATE POLICY "last_touch_sessions_write"
ON public.last_touch_sessions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "last_touch_lobby_entries_read" ON public.last_touch_lobby_entries;
CREATE POLICY "last_touch_lobby_entries_read"
ON public.last_touch_lobby_entries
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "last_touch_lobby_entries_write" ON public.last_touch_lobby_entries;
CREATE POLICY "last_touch_lobby_entries_write"
ON public.last_touch_lobby_entries
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
      AND c.relname = 'last_touch_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.last_touch_sessions;
  END IF;
END
$$;

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
      AND c.relname = 'last_touch_lobby_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.last_touch_lobby_entries;
  END IF;
END
$$;

INSERT INTO public.last_touch_sessions(id, game_start_time, status)
VALUES ('global', timezone('utc', now()) + interval '60 seconds', 'lobby')
ON CONFLICT (id) DO NOTHING;
