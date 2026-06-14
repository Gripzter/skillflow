-- Auto-void matches stuck in in_progress for more than 10 minutes.
-- Scheduled via pg_cron every 5 minutes.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.auto_void_stale_matches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_count integer := 0;
  v_player_a uuid;
  v_player_b uuid;
BEGIN
  FOR v_match IN
    SELECT *
    FROM public.matches
    WHERE status = 'in_progress'
      AND created_at < now() - interval '10 minutes'
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_match.state = 'active' THEN
      PERFORM public.void_match(v_match.id, 'stale_match_auto_void_10min');
    ELSE
      v_player_a := COALESCE(v_match.player_a, v_match.player1_id);
      v_player_b := COALESCE(v_match.player_b, v_match.player2_id);

      IF NOT v_match.player_a_is_bot AND v_player_a IS NOT NULL THEN
        UPDATE public.profiles
        SET balance_sp = balance_sp + v_match.stake_sp
        WHERE id = v_player_a;

        INSERT INTO public.sp_transactions (user_id, amount, type, description)
        VALUES (
          v_player_a,
          v_match.stake_sp,
          'match_void_refund',
          format('Stale match auto-void match:%s', v_match.id)
        );
      END IF;

      IF NOT v_match.player_b_is_bot AND v_player_b IS NOT NULL THEN
        UPDATE public.profiles
        SET balance_sp = balance_sp + v_match.stake_sp
        WHERE id = v_player_b;

        INSERT INTO public.sp_transactions (user_id, amount, type, description)
        VALUES (
          v_player_b,
          v_match.stake_sp,
          'match_void_refund',
          format('Stale match auto-void match:%s', v_match.id)
        );
      END IF;

      UPDATE public.matches
      SET state = 'voided', settled_at = now()
      WHERE id = v_match.id;
    END IF;

    UPDATE public.matches
    SET status = 'voided'
    WHERE id = v_match.id;

    IF v_match.creator_game_id IS NOT NULL THEN
      PERFORM public.sdk_log_event(
        v_match.id,
        v_match.creator_game_id,
        'void',
        jsonb_build_object('reason', 'stale_match_auto_void_10min'),
        true
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_void_stale_matches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_void_stale_matches() TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'void-stale-matches' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'void-stale-matches',
  '*/5 * * * *',
  $$SELECT public.auto_void_stale_matches();$$
);
