-- QR in-person match system: tables, holds, RPCs, settlement hook

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- balance holds (host stake reserved while QR is live)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS balance_sp_held integer NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- qr_matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES auth.users(id),
  game text NOT NULL,
  stake_sk integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'expired', 'cancelled')),
  qr_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  opponent_user_id uuid REFERENCES auth.users(id),
  opponent_is_anonymous boolean NOT NULL DEFAULT true,
  anonymous_session_token text,
  anonymous_guest_id uuid,
  winner_user_id uuid REFERENCES auth.users(id),
  winner_is_anonymous boolean NOT NULL DEFAULT false,
  match_id uuid REFERENCES public.matches(id),
  hold_sk integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_qr_matches_host ON public.qr_matches (host_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_matches_token ON public.qr_matches (qr_token);
CREATE INDEX IF NOT EXISTS idx_qr_matches_status ON public.qr_matches (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_matches_match ON public.qr_matches (match_id) WHERE match_id IS NOT NULL;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS qr_match_id uuid REFERENCES public.qr_matches(id);

-- ---------------------------------------------------------------------------
-- anonymous_pending_payouts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anonymous_pending_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_match_id uuid REFERENCES public.qr_matches(id),
  anonymous_session_token text NOT NULL,
  amount_sk integer NOT NULL,
  claimed boolean NOT NULL DEFAULT false,
  claimed_by_user_id uuid REFERENCES auth.users(id),
  claimed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anon_payouts_token ON public.anonymous_pending_payouts (anonymous_session_token)
  WHERE NOT claimed;
CREATE INDEX IF NOT EXISTS idx_anon_payouts_qr ON public.anonymous_pending_payouts (qr_match_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.qr_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_pending_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qr_matches_host_all ON public.qr_matches;
CREATE POLICY qr_matches_host_all ON public.qr_matches
  FOR ALL
  USING (auth.uid() = host_user_id)
  WITH CHECK (auth.uid() = host_user_id);

DROP POLICY IF EXISTS qr_matches_opponent_read ON public.qr_matches;
CREATE POLICY qr_matches_opponent_read ON public.qr_matches
  FOR SELECT
  USING (auth.uid() = opponent_user_id);

-- No direct client access to anonymous_pending_payouts; RPC only.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._qr_available_balance(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(p.balance_sp, 0) - COALESCE(p.balance_sp_held, 0)
  FROM public.profiles p
  WHERE p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public._qr_release_hold(p_qr public.qr_matches)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_qr.hold_sk <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET balance_sp_held = GREATEST(0, balance_sp_held - p_qr.hold_sk)
  WHERE id = p_qr.host_user_id;

  UPDATE public.qr_matches
  SET hold_sk = 0
  WHERE id = p_qr.id;
END;
$$;

CREATE OR REPLACE FUNCTION public._qr_validate_game(p_game text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_game text := lower(trim(p_game));
BEGIN
  v_game := CASE v_game
    WHEN 'connect4' THEN 'connect-4'
    WHEN 'reaction_duel' THEN 'reaction-duel'
    WHEN 'spelling_bee' THEN 'spelling-bee'
    WHEN 'memory_match' THEN 'memory-match'
    ELSE v_game
  END;

  IF v_game NOT IN ('connect-4', 'chess', 'reaction-duel', 'spelling-bee', 'memory-match', 'checkers') THEN
    RAISE EXCEPTION 'INVALID_GAME: %', p_game;
  END IF;

  RETURN v_game;
END;
$$;

-- ---------------------------------------------------------------------------
-- create_qr_match(game, stake_sk)
-- Host holds 1× stake while QR is live (anonymous opponent side is host-funded,
-- same economics as bot matches — NOT 2× debit; see product note in README).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_qr_match(
  p_game text,
  p_stake_sk integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid := auth.uid();
  v_game text;
  v_token text;
  v_id uuid;
  v_available integer;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  v_game := public._qr_validate_game(p_game);

  IF p_stake_sk < 5 OR p_stake_sk > 1000 THEN
    RAISE EXCEPTION 'INVALID_STAKE: %', p_stake_sk;
  END IF;

  SELECT public._qr_available_balance(v_host) INTO v_available;
  IF v_available < p_stake_sk THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %, need %', v_available, p_stake_sk;
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  UPDATE public.profiles
  SET balance_sp_held = balance_sp_held + p_stake_sk
  WHERE id = v_host;

  INSERT INTO public.qr_matches (
    host_user_id,
    game,
    stake_sk,
    qr_token,
    expires_at,
    hold_sk
  )
  VALUES (
    v_host,
    v_game,
    p_stake_sk,
    v_token,
    now() + interval '5 minutes',
    p_stake_sk
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'qr_token', v_token,
    'game', v_game,
    'stake_sk', p_stake_sk,
    'expires_at', (SELECT expires_at FROM public.qr_matches WHERE id = v_id)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- expire / cancel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_qr_match(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
BEGIN
  SELECT * INTO v_qr FROM public.qr_matches WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR_MATCH_NOT_FOUND';
  END IF;

  IF v_qr.status NOT IN ('pending') THEN
    RETURN jsonb_build_object('status', v_qr.status, 'id', p_id);
  END IF;

  IF v_qr.expires_at > now() AND auth.uid() IS NOT NULL AND auth.uid() != v_qr.host_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM public._qr_release_hold(v_qr);

  UPDATE public.qr_matches
  SET status = 'expired'
  WHERE id = p_id;

  RETURN jsonb_build_object('status', 'expired', 'id', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_qr_match(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT * INTO v_qr FROM public.qr_matches WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR_MATCH_NOT_FOUND';
  END IF;

  IF v_qr.host_user_id != auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_qr.status != 'pending' THEN
    RAISE EXCEPTION 'QR_NOT_CANCELLABLE: %', v_qr.status;
  END IF;

  PERFORM public._qr_release_hold(v_qr);

  UPDATE public.qr_matches
  SET status = 'cancelled'
  WHERE id = p_id;

  RETURN jsonb_build_object('status', 'cancelled', 'id', p_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Public read by token (limited fields)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_qr_match_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_host record;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  SELECT * INTO v_qr FROM public.qr_matches WHERE qr_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_qr.status = 'pending' AND v_qr.expires_at <= now() THEN
    PERFORM public.expire_qr_match(v_qr.id);
    v_qr.status := 'expired';
  END IF;

  SELECT username, avatar_url INTO v_host
  FROM public.profiles
  WHERE id = v_qr.host_user_id;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_qr.id,
    'game', v_qr.game,
    'stake_sk', v_qr.stake_sk,
    'status', v_qr.status,
    'expires_at', v_qr.expires_at,
    'host_username', COALESCE(v_host.username, 'Player'),
    'host_avatar_url', v_host.avatar_url,
    'match_id', v_qr.match_id
  );
END;
$$;

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

-- Patch finish_match to call QR resolver
CREATE OR REPLACE FUNCTION public.finish_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_caller_id uuid,
  p_idempotency_key text,
  p_game_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match record;
  v_game record;
  v_payout integer;
  v_pot integer;
  v_rake_sk integer;
  v_creator_earn_sk numeric;
  v_winner_is_bot boolean;
  v_loser_id uuid;
  v_caller_new_balance integer;
  v_result jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_match.state = 'settled' AND v_match.settlement_idempotency_key = p_idempotency_key THEN
    IF p_caller_id IS NOT NULL THEN
      SELECT balance_sp INTO v_caller_new_balance FROM public.profiles WHERE id = p_caller_id;
    END IF;
    RETURN jsonb_build_object(
      'status', 'already_settled',
      'match_id', p_match_id,
      'winner_id', v_match.winner_id,
      'winner_is_bot', (v_match.winner_id IS NULL),
      'caller_won', (p_caller_id IS NOT NULL AND v_match.winner_id = p_caller_id),
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

  IF p_game_id IS NULL AND p_caller_id IS NOT NULL THEN
    IF p_caller_id != v_match.player_a AND p_caller_id != v_match.player_b
       AND p_caller_id != v_match.player1_id AND p_caller_id != v_match.player2_id THEN
      RAISE EXCEPTION 'FORBIDDEN_NOT_PARTICIPANT';
    END IF;
  END IF;

  IF p_winner_id IS NULL THEN
    IF NOT (v_match.player_a_is_bot OR v_match.player_b_is_bot) THEN
      RAISE EXCEPTION 'NULL_WINNER_BUT_NO_BOT';
    END IF;
    v_winner_is_bot := true;
    v_loser_id := CASE WHEN v_match.player_a_is_bot THEN v_match.player_b ELSE v_match.player_a END;
  ELSE
    IF p_winner_id != v_match.player_a AND p_winner_id != v_match.player_b
       AND p_winner_id != v_match.player1_id AND p_winner_id != v_match.player2_id THEN
      RAISE EXCEPTION 'WINNER_NOT_IN_MATCH';
    END IF;
    v_winner_is_bot := false;
    IF p_winner_id IN (v_match.player_a, v_match.player1_id) THEN
      v_loser_id := CASE
        WHEN v_match.player_b_is_bot THEN NULL
        ELSE COALESCE(v_match.player_b, v_match.player2_id)
      END;
    ELSE
      v_loser_id := CASE
        WHEN v_match.player_a_is_bot THEN NULL
        ELSE COALESCE(v_match.player_a, v_match.player1_id)
      END;
    END IF;
  END IF;

  v_pot := v_match.stake_sp * 2;

  IF p_game_id IS NOT NULL THEN
    SELECT * INTO v_game FROM public.creator_games WHERE game_id = p_game_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CREATOR_GAME_NOT_FOUND';
    END IF;

    v_rake_sk := floor(v_pot * 0.12);
    v_payout := v_pot - v_rake_sk;
    v_creator_earn_sk := floor(v_rake_sk * (v_game.revenue_share_pct / 100.0));

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
        format('SDK match payout (after rake) match:%s game:%s', p_match_id, p_game_id)
      );

      INSERT INTO public.sp_transactions (user_id, amount, type, description)
      VALUES (
        p_winner_id,
        100,
        'match_win_bonus',
        format('Match win bonus match:%s', p_match_id)
      );
    END IF;

    INSERT INTO public.creator_earnings (creator_id, game_id, match_id, earned_sk, earned_usd)
    VALUES (v_game.creator_id, p_game_id, p_match_id, v_creator_earn_sk, v_creator_earn_sk / 80.0);

    UPDATE public.creator_games
    SET total_matches = total_matches + 1,
        total_earned_sk = total_earned_sk + v_creator_earn_sk
    WHERE game_id = p_game_id;

  ELSE
    v_payout := v_pot;
    v_rake_sk := 0;
    v_creator_earn_sk := 0;

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

  -- QR match resolution (anonymous escrow payout, status update)
  PERFORM public.resolve_qr_match_on_settlement(p_match_id, p_winner_id);

  IF p_caller_id IS NOT NULL THEN
    SELECT balance_sp INTO v_caller_new_balance FROM public.profiles WHERE id = p_caller_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'settled',
    'match_id', p_match_id,
    'winner_id', p_winner_id,
    'winner_is_bot', v_winner_is_bot,
    'caller_won', (p_caller_id IS NOT NULL AND p_winner_id = p_caller_id),
    'payout', CASE WHEN v_winner_is_bot THEN 0 ELSE v_payout END,
    'rake_sk', v_rake_sk,
    'creator_earned_sk', COALESCE(v_creator_earn_sk, 0),
    'caller_balance', v_caller_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finish_match(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_match(uuid, uuid, uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- claim_anonymous_payout
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_anonymous_payout(
  p_anonymous_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_payout public.anonymous_pending_payouts;
  v_balance integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_anonymous_session_token IS NULL OR length(trim(p_anonymous_session_token)) < 16 THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  SELECT * INTO v_payout
  FROM public.anonymous_pending_payouts
  WHERE anonymous_session_token = p_anonymous_session_token
    AND NOT claimed
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_PENDING_PAYOUT';
  END IF;

  UPDATE public.profiles
  SET balance_sp = balance_sp + v_payout.amount_sk,
      lifetime_sp = lifetime_sp + 100
  WHERE id = v_user
  RETURNING balance_sp INTO v_balance;

  INSERT INTO public.sp_transactions (user_id, amount, type, description)
  VALUES (
    v_user,
    v_payout.amount_sk,
    'qr_match_win',
    format('QR match win claim qr:%s', v_payout.qr_match_id)
  );

  UPDATE public.anonymous_pending_payouts
  SET claimed = true,
      claimed_by_user_id = v_user,
      claimed_at = now()
  WHERE id = v_payout.id;

  UPDATE public.qr_matches
  SET opponent_user_id = v_user,
      opponent_is_anonymous = false,
      winner_user_id = v_user
  WHERE id = v_payout.qr_match_id;

  RETURN jsonb_build_object(
    'amount_sk', v_payout.amount_sk,
    'balance_sp', v_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_anonymous_pending_payout(p_anonymous_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout public.anonymous_pending_payouts;
BEGIN
  IF p_anonymous_session_token IS NULL OR length(trim(p_anonymous_session_token)) < 16 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_payout
  FROM public.anonymous_pending_payouts
  WHERE anonymous_session_token = p_anonymous_session_token
    AND NOT claimed
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'amount_sk', v_payout.amount_sk,
    'expires_at', v_payout.expires_at,
    'qr_match_id', v_payout.qr_match_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_qr_match(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_qr_match(text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_qr_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_qr_match(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.expire_qr_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_qr_match(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_qr_match_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_qr_match_by_token(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.accept_qr_match(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_qr_match(text, text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.claim_anonymous_payout(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_payout(text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_anonymous_pending_payout(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_anonymous_pending_payout(text) TO anon, authenticated;
