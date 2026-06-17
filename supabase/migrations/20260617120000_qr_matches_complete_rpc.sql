-- ---------------------------------------------------------------------------
-- accept_qr_match
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_qr_match(
  p_token text,
  p_anonymous_session_token text DEFAULT NULL,
  p_opponent_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_match_id uuid;
  v_guest_id uuid;
  v_host_username text;
  v_opp_username text;
  v_opp_balance integer;
  v_a_balance integer;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  SELECT * INTO v_qr FROM public.qr_matches WHERE qr_token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR_MATCH_NOT_FOUND';
  END IF;

  IF v_qr.status != 'pending' THEN
    RAISE EXCEPTION 'QR_NOT_AVAILABLE: %', v_qr.status;
  END IF;

  IF v_qr.expires_at <= now() THEN
    PERFORM public._qr_release_hold(v_qr);
    UPDATE public.qr_matches SET status = 'expired' WHERE id = v_qr.id;
    RAISE EXCEPTION 'QR_EXPIRED';
  END IF;

  IF p_opponent_user_id IS NOT NULL AND p_opponent_user_id = v_qr.host_user_id THEN
    RAISE EXCEPTION 'CANNOT_PLAY_SELF';
  END IF;

  SELECT username INTO v_host_username FROM public.profiles WHERE id = v_qr.host_user_id;

  IF p_opponent_user_id IS NOT NULL THEN
    -- Signed-in opponent: release host hold, both players stake normally
    SELECT balance_sp INTO v_opp_balance FROM public.profiles WHERE id = p_opponent_user_id FOR UPDATE;
    IF v_opp_balance IS NULL THEN
      RAISE EXCEPTION 'OPPONENT_NOT_FOUND';
    END IF;
    IF v_opp_balance < v_qr.stake_sk THEN
      RAISE EXCEPTION 'INSUFFICIENT_BALANCE_OPPONENT: have %, need %', v_opp_balance, v_qr.stake_sk;
    END IF;

    SELECT balance_sp INTO v_a_balance FROM public.profiles WHERE id = v_qr.host_user_id FOR UPDATE;
    IF public._qr_available_balance(v_qr.host_user_id) < v_qr.stake_sk THEN
      RAISE EXCEPTION 'INSUFFICIENT_BALANCE_HOST';
    END IF;

    PERFORM public._qr_release_hold(v_qr);

    UPDATE public.profiles SET balance_sp = balance_sp - v_qr.stake_sk WHERE id = v_qr.host_user_id;
    UPDATE public.profiles SET balance_sp = balance_sp - v_qr.stake_sk WHERE id = p_opponent_user_id;

    INSERT INTO public.matches (
      game_type, player_a, player_b, stake_sp, stake_amount,
      player_a_is_bot, player_b_is_bot, player1_id, player2_id,
      player1_username, player2_username, status, state, qr_match_id
    )
    VALUES (
      v_qr.game,
      v_qr.host_user_id,
      p_opponent_user_id,
      v_qr.stake_sk,
      v_qr.stake_sk,
      false,
      false,
      v_qr.host_user_id,
      p_opponent_user_id,
      v_host_username,
      (SELECT username FROM public.profiles WHERE id = p_opponent_user_id),
      'in_progress',
      'active',
      v_qr.id
    )
    RETURNING id INTO v_match_id;

    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES
      (v_qr.host_user_id, -v_qr.stake_sk, 'match_stake', format('QR match stake match:%s', v_match_id)),
      (p_opponent_user_id, -v_qr.stake_sk, 'match_stake', format('QR match stake match:%s', v_match_id));

    UPDATE public.qr_matches
    SET status = 'in_progress',
        accepted_at = now(),
        opponent_user_id = p_opponent_user_id,
        opponent_is_anonymous = false,
        match_id = v_match_id,
        hold_sk = 0
    WHERE id = v_qr.id;

  ELSE
    -- Anonymous opponent: host-funded side (1× stake from hold, bot-style match row)
    IF p_anonymous_session_token IS NULL OR length(trim(p_anonymous_session_token)) < 16 THEN
      RAISE EXCEPTION 'ANONYMOUS_TOKEN_REQUIRED';
    END IF;

    v_guest_id := gen_random_uuid();

    UPDATE public.profiles
    SET balance_sp_held = GREATEST(0, balance_sp_held - v_qr.stake_sk),
        balance_sp = balance_sp - v_qr.stake_sk
    WHERE id = v_qr.host_user_id;

    INSERT INTO public.matches (
      game_type, player_a, player_b, stake_sp, stake_amount,
      player_a_is_bot, player_b_is_bot, player1_id, player2_id,
      player1_username, player2_username, status, state, qr_match_id
    )
    VALUES (
      v_qr.game,
      v_qr.host_user_id,
      NULL,
      v_qr.stake_sk,
      v_qr.stake_sk,
      false,
      true,
      v_qr.host_user_id,
      NULL,
      v_host_username,
      'Guest',
      'in_progress',
      'active',
      v_qr.id
    )
    RETURNING id INTO v_match_id;

    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      v_qr.host_user_id,
      -v_qr.stake_sk,
      'match_stake',
      format('QR match stake (host-funded) match:%s', v_match_id)
    );

    UPDATE public.qr_matches
    SET status = 'in_progress',
        accepted_at = now(),
        opponent_is_anonymous = true,
        anonymous_session_token = p_anonymous_session_token,
        anonymous_guest_id = v_guest_id,
        match_id = v_match_id,
        hold_sk = 0
    WHERE id = v_qr.id;
  END IF;

  RETURN jsonb_build_object(
    'match_id', v_match_id,
    'qr_match_id', v_qr.id,
    'game', v_qr.game,
    'stake_sk', v_qr.stake_sk,
    'host_user_id', v_qr.host_user_id,
    'opponent_is_anonymous', (p_opponent_user_id IS NULL),
    'anonymous_guest_id', v_guest_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- QR settlement after match completes (triggered from finish_match)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_qr_match_on_settlement(
  p_match_id uuid,
  p_winner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_payout integer;
BEGIN
  SELECT * INTO v_qr FROM public.qr_matches WHERE match_id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_qr.status = 'completed' THEN
    RETURN;
  END IF;

  v_payout := v_qr.stake_sk * 2;

  IF v_qr.opponent_is_anonymous THEN
    IF p_winner_id IS NULL THEN
      -- Anonymous guest won (finish_match uses null winner / bot-win path)
      INSERT INTO public.anonymous_pending_payouts (
        qr_match_id,
        anonymous_session_token,
        amount_sk
      )
      VALUES (
        v_qr.id,
        v_qr.anonymous_session_token,
        v_payout
      );

      UPDATE public.qr_matches
      SET status = 'completed',
          completed_at = now(),
          winner_is_anonymous = true,
          winner_user_id = NULL
      WHERE id = v_qr.id;
    ELSE
      -- Host beat anonymous guest
      UPDATE public.qr_matches
      SET status = 'completed',
          completed_at = now(),
          winner_user_id = p_winner_id,
          winner_is_anonymous = false
      WHERE id = v_qr.id;
    END IF;
  ELSE
    UPDATE public.qr_matches
    SET status = 'completed',
        completed_at = now(),
        winner_user_id = p_winner_id,
        winner_is_anonymous = false
    WHERE id = v_qr.id;
  END IF;

  -- Release any leftover hold (should be 0)
  PERFORM public._qr_release_hold(v_qr);
END;
$$;

-- Settlement trigger (also applied on remote; complements finish_match hook in base migration)
CREATE OR REPLACE FUNCTION public.trg_match_settled_qr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.state = 'settled' AND (OLD.state IS DISTINCT FROM 'settled') THEN
    PERFORM public.resolve_qr_match_on_settlement(NEW.id, NEW.winner_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_settled_qr ON public.matches;
CREATE TRIGGER match_settled_qr
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_match_settled_qr();
