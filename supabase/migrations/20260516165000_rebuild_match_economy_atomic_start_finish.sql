-- Rebuild match economy as single-transaction operations.
-- start_match: creates + escrows in one transaction
-- finish_match: settles + pays out in one transaction
-- void_match: refunds stuck active matches

DROP FUNCTION IF EXISTS public.escrow_match CASCADE;
DROP FUNCTION IF EXISTS public.settle_match CASCADE;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS stake_sp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player_a uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS player_b uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS player_a_is_bot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS player_b_is_bot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_idempotency_key text,
  ADD COLUMN IF NOT EXISTS loser_id uuid REFERENCES public.profiles(id);

-- Normalize legacy states before adding stricter constraints.
UPDATE public.matches
SET state = 'active'
WHERE state IS NULL OR state NOT IN ('active', 'settled', 'voided');

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_state_check,
  DROP CONSTRAINT IF EXISTS matches_settled_consistency;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_state_check
  CHECK (state IN ('active', 'settled', 'voided'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_idempotency
  ON public.matches (settlement_idempotency_key)
  WHERE settlement_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_active
  ON public.matches (state)
  WHERE state = 'active';

CREATE OR REPLACE FUNCTION public.start_match(
  p_game text,
  p_player_a uuid,
  p_player_b uuid,
  p_stake_sp integer,
  p_player_b_is_bot boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id uuid;
  v_a_balance integer;
  v_b_balance integer;
BEGIN
  IF p_stake_sp < 50 OR p_stake_sp > 5000 THEN
    RAISE EXCEPTION 'INVALID_STAKE: %', p_stake_sp;
  END IF;

  IF p_game IS NULL OR length(p_game) < 1 OR length(p_game) > 50 THEN
    RAISE EXCEPTION 'INVALID_GAME';
  END IF;

  SELECT balance_sp INTO v_a_balance FROM public.profiles WHERE id = p_player_a FOR UPDATE;
  IF v_a_balance IS NULL THEN
    RAISE EXCEPTION 'PLAYER_A_NOT_FOUND';
  END IF;
  IF v_a_balance < p_stake_sp THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE_A: have %, need %', v_a_balance, p_stake_sp;
  END IF;

  IF NOT p_player_b_is_bot THEN
    IF p_player_b IS NULL THEN
      RAISE EXCEPTION 'PLAYER_B_MISSING_FOR_HUMAN_MATCH';
    END IF;
    SELECT balance_sp INTO v_b_balance FROM public.profiles WHERE id = p_player_b FOR UPDATE;
    IF v_b_balance IS NULL THEN
      RAISE EXCEPTION 'PLAYER_B_NOT_FOUND';
    END IF;
    IF v_b_balance < p_stake_sp THEN
      RAISE EXCEPTION 'INSUFFICIENT_BALANCE_B: have %, need %', v_b_balance, p_stake_sp;
    END IF;
  END IF;

  UPDATE public.profiles SET balance_sp = balance_sp - p_stake_sp WHERE id = p_player_a;
  IF NOT p_player_b_is_bot THEN
    UPDATE public.profiles SET balance_sp = balance_sp - p_stake_sp WHERE id = p_player_b;
  END IF;

  INSERT INTO public.matches (
    game_type,
    player_a,
    player_b,
    stake_sp,
    stake_amount,
    player_a_is_bot,
    player_b_is_bot,
    player1_id,
    player2_id,
    status,
    state
  )
  VALUES (
    p_game,
    p_player_a,
    CASE WHEN p_player_b_is_bot THEN NULL ELSE p_player_b END,
    p_stake_sp,
    p_stake_sp,
    false,
    p_player_b_is_bot,
    p_player_a,
    CASE WHEN p_player_b_is_bot THEN NULL ELSE p_player_b END,
    'in_progress',
    'active'
  )
  RETURNING id INTO v_match_id;

  INSERT INTO public.sp_transactions (user_id, amount, type, description)
  VALUES (
    p_player_a,
    -p_stake_sp,
    'match_stake',
    format('Match stake debit match:%s', v_match_id)
  );

  IF NOT p_player_b_is_bot THEN
    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      p_player_b,
      -p_stake_sp,
      'match_stake',
      format('Match stake debit match:%s', v_match_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'match_id', v_match_id,
    'stake_sp', p_stake_sp,
    'player_a_balance_after', v_a_balance - p_stake_sp,
    'player_b_balance_after', CASE WHEN p_player_b_is_bot THEN NULL ELSE v_b_balance - p_stake_sp END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_match(text, uuid, uuid, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_match(text, uuid, uuid, integer, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_caller_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match record;
  v_payout integer;
  v_winner_is_bot boolean;
  v_loser_id uuid;
  v_caller_new_balance integer;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 16 THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_match.state = 'settled' AND v_match.settlement_idempotency_key = p_idempotency_key THEN
    SELECT balance_sp INTO v_caller_new_balance FROM public.profiles WHERE id = p_caller_id;
    RETURN jsonb_build_object(
      'status', 'already_settled',
      'match_id', p_match_id,
      'winner_id', v_match.winner_id,
      'winner_is_bot', (v_match.winner_id IS NULL),
      'caller_won', (v_match.winner_id = p_caller_id),
      'payout', 0,
      'caller_balance', v_caller_new_balance
    );
  END IF;

  IF v_match.state = 'settled' THEN
    RAISE EXCEPTION 'ALREADY_SETTLED_DIFFERENT_KEY';
  END IF;
  IF v_match.state != 'active' THEN
    RAISE EXCEPTION 'MATCH_NOT_ACTIVE: state=%', v_match.state;
  END IF;

  IF p_caller_id != v_match.player_a AND p_caller_id != v_match.player_b THEN
    RAISE EXCEPTION 'FORBIDDEN_NOT_PARTICIPANT';
  END IF;

  IF p_winner_id IS NULL THEN
    IF NOT (v_match.player_a_is_bot OR v_match.player_b_is_bot) THEN
      RAISE EXCEPTION 'NULL_WINNER_BUT_NO_BOT';
    END IF;
    v_winner_is_bot := true;
    v_loser_id := CASE WHEN v_match.player_a_is_bot THEN v_match.player_b ELSE v_match.player_a END;
  ELSE
    IF p_winner_id != v_match.player_a AND p_winner_id != v_match.player_b THEN
      RAISE EXCEPTION 'WINNER_NOT_IN_MATCH';
    END IF;
    v_winner_is_bot := false;
    IF p_winner_id = v_match.player_a THEN
      v_loser_id := CASE WHEN v_match.player_b_is_bot THEN NULL ELSE v_match.player_b END;
    ELSE
      v_loser_id := CASE WHEN v_match.player_a_is_bot THEN NULL ELSE v_match.player_a END;
    END IF;
  END IF;

  v_payout := v_match.stake_sp * 2;

  IF NOT v_winner_is_bot AND p_winner_id IS NOT NULL THEN
    UPDATE public.profiles
    SET balance_sp = balance_sp + v_payout,
        lifetime_sp = lifetime_sp + 100
    WHERE id = p_winner_id;

    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      p_winner_id,
      v_payout,
      'match_payout',
      format('Match payout match:%s', p_match_id)
    );

    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      p_winner_id,
      100,
      'match_win_bonus',
      format('Match win bonus match:%s', p_match_id)
    );
  END IF;

  IF v_loser_id IS NOT NULL THEN
    UPDATE public.profiles
    SET lifetime_sp = lifetime_sp + 25
    WHERE id = v_loser_id;

    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      v_loser_id,
      25,
      'match_loss_consolation',
      format('Match loss consolation match:%s', p_match_id)
    );
  END IF;

  UPDATE public.matches
  SET state = 'settled',
      winner_id = p_winner_id,
      loser_id = v_loser_id,
      result = CASE WHEN p_winner_id IS NULL THEN 'bot_win' ELSE 'win' END,
      status = 'completed',
      completed_at = now(),
      settled_at = now(),
      settlement_idempotency_key = p_idempotency_key
  WHERE id = p_match_id;

  SELECT balance_sp INTO v_caller_new_balance FROM public.profiles WHERE id = p_caller_id;

  RETURN jsonb_build_object(
    'status', 'settled',
    'match_id', p_match_id,
    'winner_id', p_winner_id,
    'winner_is_bot', v_winner_is_bot,
    'caller_won', (p_winner_id = p_caller_id),
    'payout', CASE WHEN v_winner_is_bot THEN 0 ELSE v_payout END,
    'caller_balance', v_caller_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finish_match(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_match(uuid, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.void_match(
  p_match_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match record;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;
  IF v_match.state != 'active' THEN
    RAISE EXCEPTION 'CANNOT_VOID_NON_ACTIVE: state=%', v_match.state;
  END IF;

  IF NOT v_match.player_a_is_bot AND v_match.player_a IS NOT NULL THEN
    UPDATE public.profiles SET balance_sp = balance_sp + v_match.stake_sp WHERE id = v_match.player_a;
    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      v_match.player_a,
      v_match.stake_sp,
      'match_void_refund',
      format('Match void refund (%s) match:%s', coalesce(p_reason, 'n/a'), p_match_id)
    );
  END IF;

  IF NOT v_match.player_b_is_bot AND v_match.player_b IS NOT NULL THEN
    UPDATE public.profiles SET balance_sp = balance_sp + v_match.stake_sp WHERE id = v_match.player_b;
    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      v_match.player_b,
      v_match.stake_sp,
      'match_void_refund',
      format('Match void refund (%s) match:%s', coalesce(p_reason, 'n/a'), p_match_id)
    );
  END IF;

  UPDATE public.matches SET state = 'voided', settled_at = now() WHERE id = p_match_id;
  RETURN jsonb_build_object('status', 'voided', 'match_id', p_match_id);
END;
$$;

REVOKE ALL ON FUNCTION public.void_match(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_match(uuid, text) TO service_role;
