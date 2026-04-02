-- Fix Last Touch aggregate/grouping errors around entry_fee in session rollups.

CREATE OR REPLACE FUNCTION public.last_touch_recompute_prize_pool()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_session_id text;
BEGIN
  target_session_id := COALESCE(NEW.session_id, OLD.session_id);

  WITH totals AS (
    SELECT
      s.id,
      COALESCE(COUNT(p.id), 0)::numeric * COALESCE(s.entry_fee, 1) AS computed_prize_pool
    FROM public.last_touch_sessions s
    LEFT JOIN public.last_touch_players p
      ON p.session_id = s.id
    WHERE s.id = target_session_id
    GROUP BY s.id, s.entry_fee
  )
  UPDATE public.last_touch_sessions s
  SET prize_pool = t.computed_prize_pool
  FROM totals t
  WHERE s.id = t.id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_last_touch_increment_prize_pool ON public.last_touch_players;
DROP TRIGGER IF EXISTS trg_last_touch_recompute_prize_pool ON public.last_touch_players;

CREATE TRIGGER trg_last_touch_recompute_prize_pool
AFTER INSERT OR DELETE ON public.last_touch_players
FOR EACH ROW
EXECUTE FUNCTION public.last_touch_recompute_prize_pool();
