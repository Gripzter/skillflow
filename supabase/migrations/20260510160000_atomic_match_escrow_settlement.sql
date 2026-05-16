-- Atomic, server-authoritative wager lifecycle:
-- pending -> escrowed -> settled|voided

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS stake_sp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loser_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS player_a uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS player_b uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS player_a_is_bot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS player_b_is_bot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'escrowed', 'settled', 'voided')),
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_idempotency_key text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_matches_state
  ON public.matches(state)
  WHERE state IN ('pending', 'escrowed');

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_settled_consistency;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_settled_consistency
  CHECK (
    state != 'settled'
    OR (
      (winner_id IS NOT NULL AND loser_id IS NOT NULL AND winner_id != loser_id)
      OR (winner_id IS NULL)
    )
  );

CREATE OR REPLACE FUNCTION public.escrow_match(
  p_match_id uuid,
  p_player_a uuid,
  p_player_b uuid,
  p_stake_sp integer,
  p_player_a_is_bot boolean,
  p_player_b_is_bot boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match record;
  v_a_balance integer;
  v_b_balance integer;
BEGIN
  IF p_stake_sp < 50 OR p_stake_sp > 5000 THEN
    RAISE EXCEPTION 'Invalid stake: %', p_stake_sp;
  END IF;

  SELECT id, state
    INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found: %', p_match_id;
  END IF;

  IF v_match.state = 'escrowed' THEN
    RETURN jsonb_build_object('status', 'already_escrowed', 'match_id', p_match_id);
  END IF;

  IF v_match.state <> 'pending' THEN
    RAISE EXCEPTION 'Match not in pending state, current: %', v_match.state;
  END IF;

  IF NOT p_player_a_is_bot THEN
    SELECT balance_sp INTO v_a_balance
    FROM public.profiles
    WHERE id = p_player_a
    FOR UPDATE;

    IF v_a_balance IS NULL THEN
      RAISE EXCEPTION 'Player A profile missing: %', p_player_a;
    END IF;
    IF v_a_balance < p_stake_sp THEN
      RAISE EXCEPTION 'Player A insufficient balance: % < %', v_a_balance, p_stake_sp;
    END IF;

    UPDATE public.profiles
    SET balance_sp = balance_sp - p_stake_sp
    WHERE id = p_player_a;

    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      p_player_a,
      -p_stake_sp,
      'match_stake_escrow',
      format('Escrow stake for match:%s', p_match_id)
    );
  END IF;

  IF NOT p_player_b_is_bot THEN
    IF p_player_b IS NULL THEN
      RAISE EXCEPTION 'Player B is human but id is null';
    END IF;

    SELECT balance_sp INTO v_b_balance
    FROM public.profiles
    WHERE id = p_player_b
    FOR UPDATE;

    IF v_b_balance IS NULL THEN
      RAISE EXCEPTION 'Player B profile missing: %', p_player_b;
    END IF;
    IF v_b_balance < p_stake_sp THEN
      RAISE EXCEPTION 'Player B insufficient balance: % < %', v_b_balance, p_stake_sp;
    END IF;

    UPDATE public.profiles
    SET balance_sp = balance_sp - p_stake_sp
    WHERE id = p_player_b;

    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      p_player_b,
      -p_stake_sp,
      'match_stake_escrow',
      format('Escrow stake for match:%s', p_match_id)
    );
  END IF;

  UPDATE public.matches
  SET
    state = 'escrowed',
    player_a = p_player_a,
    player_b = p_player_b,
    stake_sp = p_stake_sp,
    player_a_is_bot = p_player_a_is_bot,
    player_b_is_bot = p_player_b_is_bot
  WHERE id = p_match_id
    AND state = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not in pending state, cannot escrow';
  END IF;

  RETURN jsonb_build_object('status', 'escrowed', 'match_id', p_match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match record;
  v_stake integer;
  v_payout integer;
  v_loser_id uuid;
  v_result text;
BEGIN
  SELECT *
    INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found: %', p_match_id;
  END IF;

  IF v_match.state = 'settled' OR v_match.state = 'voided' THEN
    RETURN jsonb_build_object(
      'status',
      CASE WHEN v_match.state = 'settled' THEN 'already_settled' ELSE 'already_voided' END,
      'match_id',
      p_match_id
    );
  END IF;

  IF v_match.state <> 'escrowed' THEN
    RAISE EXCEPTION 'Match not in escrowed state, current: %', v_match.state;
  END IF;

  v_stake := COALESCE(NULLIF(v_match.stake_sp, 0), (v_match.stake_amount)::integer, 0);

  IF p_winner_id IS NULL THEN
    IF COALESCE(v_match.player_a_is_bot, false) = true OR COALESCE(v_match.player_b_is_bot, false) = true THEN
      v_loser_id := CASE
        WHEN COALESCE(v_match.player_a_is_bot, false) = true THEN v_match.player_b
        ELSE v_match.player_a
      END;
      v_result := CASE
        WHEN COALESCE(v_match.player_a_is_bot, false) = true THEN 'player1_win'
        ELSE 'player2_win'
      END;

      UPDATE public.profiles
      SET lifetime_sp = lifetime_sp + 25
      WHERE id = v_loser_id;

      IF FOUND THEN
        INSERT INTO public.sp_transactions (user_id, amount, type, description)
        VALUES (
          v_loser_id,
          25,
          'match_loss_consolation',
          format('Loss consolation for match:%s', p_match_id)
        );
      END IF;

      UPDATE public.matches
      SET
        state = 'settled',
        result = v_result,
        winner_id = NULL,
        loser_id = v_loser_id,
        status = 'completed',
        completed_at = now(),
        settled_at = now(),
        settlement_idempotency_key = p_idempotency_key
      WHERE id = p_match_id;

      RETURN jsonb_build_object(
        'status', 'settled',
        'match_id', p_match_id,
        'winner_id', NULL,
        'payout', 0
      );
    END IF;

    -- draw / void: refund any human participants
    IF v_match.player_a IS NOT NULL AND COALESCE(v_match.player_a_is_bot, false) = false THEN
      UPDATE public.profiles
      SET balance_sp = balance_sp + v_stake
      WHERE id = v_match.player_a;

      INSERT INTO public.sp_transactions (user_id, amount, type, description)
      VALUES (
        v_match.player_a,
        v_stake,
        'match_refund',
        format('Draw refund for match:%s', p_match_id)
      );
    END IF;

    IF v_match.player_b IS NOT NULL AND COALESCE(v_match.player_b_is_bot, false) = false THEN
      UPDATE public.profiles
      SET balance_sp = balance_sp + v_stake
      WHERE id = v_match.player_b;

      INSERT INTO public.sp_transactions (user_id, amount, type, description)
      VALUES (
        v_match.player_b,
        v_stake,
        'match_refund',
        format('Draw refund for match:%s', p_match_id)
      );
    END IF;

    UPDATE public.matches
    SET
      state = 'voided',
      result = 'draw',
      winner_id = NULL,
      loser_id = NULL,
      settled_at = now(),
      settlement_idempotency_key = p_idempotency_key
    WHERE id = p_match_id;

    RETURN jsonb_build_object(
      'status', 'voided',
      'match_id', p_match_id,
      'payout', 0
    );
  END IF;

  IF p_winner_id <> v_match.player_a AND p_winner_id <> v_match.player_b THEN
    RAISE EXCEPTION 'Winner % is not a player in this match', p_winner_id;
  END IF;

  v_loser_id := CASE
    WHEN p_winner_id = v_match.player_a THEN v_match.player_b
    ELSE v_match.player_a
  END;
  v_payout := v_stake * 2;
  v_result := CASE
    WHEN p_winner_id = v_match.player1_id THEN 'player1_win'
    WHEN p_winner_id = v_match.player2_id THEN 'player2_win'
    ELSE 'draw'
  END;

  IF COALESCE(v_match.player_a_is_bot, false) = true OR COALESCE(v_match.player_b_is_bot, false) = true THEN
    IF v_result = 'draw' THEN
      v_result := CASE
        WHEN p_winner_id = v_match.player_a THEN 'player1_win'
        ELSE 'player2_win'
      END;
    END IF;
  END IF;

  -- Credit winner if winner is a human profile.
  UPDATE public.profiles
  SET
    balance_sp = balance_sp + v_payout,
    lifetime_sp = lifetime_sp + 100
  WHERE id = p_winner_id;

  IF FOUND THEN
    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      p_winner_id,
      v_payout,
      'match_win_payout',
      format('Winner payout for match:%s', p_match_id)
    );
    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      p_winner_id,
      100,
      'match_win_bonus',
      format('Winner lifetime bonus for match:%s', p_match_id)
    );
  END IF;

  -- Consolation only if loser is a human profile.
  UPDATE public.profiles
  SET lifetime_sp = lifetime_sp + 25
  WHERE id = v_loser_id;

  IF FOUND THEN
    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      v_loser_id,
      25,
      'match_loss_consolation',
      format('Loss consolation for match:%s', p_match_id)
    );
  END IF;

  UPDATE public.matches
  SET
    state = 'settled',
    winner_id = p_winner_id,
    loser_id = v_loser_id,
    result = v_result,
    status = 'completed',
    completed_at = now(),
    settled_at = now(),
    settlement_idempotency_key = p_idempotency_key
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'status', 'settled',
    'match_id', p_match_id,
    'winner_id', p_winner_id,
    'payout', v_payout
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_match(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_match(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.escrow_match(uuid, uuid, uuid, integer, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escrow_match(uuid, uuid, uuid, integer, boolean, boolean) TO service_role;
