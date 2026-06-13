-- SkillFlow Creator SDK: tables, RLS, SDK RPC helpers, finish_match rake extension

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- creator_games
-- api_key stores bcrypt hash (crypt). api_key_enc stores encrypted raw key
-- for HMAC verification (service role / SECURITY DEFINER only).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_name text NOT NULL,
  game_id text NOT NULL UNIQUE,
  api_key text NOT NULL,
  api_key_enc bytea NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended')),
  revenue_share_pct numeric NOT NULL DEFAULT 20
    CHECK (revenue_share_pct >= 0 AND revenue_share_pct <= 100),
  total_matches integer NOT NULL DEFAULT 0,
  total_earned_sk numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_games_creator_id ON public.creator_games(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_games_status ON public.creator_games(status);

-- ---------------------------------------------------------------------------
-- sdk_match_log (service role only — no public policies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sdk_match_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  game_id text NOT NULL REFERENCES public.creator_games(game_id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('init', 'start', 'report_winner', 'end', 'void')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  hmac_valid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdk_match_log_match_id ON public.sdk_match_log(match_id);
CREATE INDEX IF NOT EXISTS idx_sdk_match_log_game_id ON public.sdk_match_log(game_id);

-- ---------------------------------------------------------------------------
-- creator_earnings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id text NOT NULL,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  earned_sk numeric NOT NULL DEFAULT 0,
  earned_usd numeric NOT NULL DEFAULT 0,
  paid_out boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_id ON public.creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_game_id ON public.creator_earnings(game_id);

-- ---------------------------------------------------------------------------
-- SDK columns on matches
-- ---------------------------------------------------------------------------
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS creator_game_id text REFERENCES public.creator_games(game_id),
  ADD COLUMN IF NOT EXISTS sdk_init_at timestamptz,
  ADD COLUMN IF NOT EXISTS sdk_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS sdk_winner_claimed_id uuid,
  ADD COLUMN IF NOT EXISTS sdk_winner_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sdk_winner_hmac text,
  ADD COLUMN IF NOT EXISTS sdk_phase text
    CHECK (sdk_phase IS NULL OR sdk_phase IN (
      'initialized', 'in_progress', 'winner_claimed', 'settled', 'voided'
    ));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.creator_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sdk_match_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_games_select_own ON public.creator_games;
CREATE POLICY creator_games_select_own ON public.creator_games
  FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS creator_games_insert_own ON public.creator_games;
CREATE POLICY creator_games_insert_own ON public.creator_games
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS creator_games_update_own ON public.creator_games;
CREATE POLICY creator_games_update_own ON public.creator_games
  FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS creator_earnings_select_own ON public.creator_earnings;
CREATE POLICY creator_earnings_select_own ON public.creator_earnings
  FOR SELECT USING (auth.uid() = creator_id);

-- sdk_match_log: no policies — only service_role / SECURITY DEFINER access

REVOKE ALL ON public.sdk_match_log FROM anon, authenticated;
GRANT ALL ON public.sdk_match_log TO service_role;

-- ---------------------------------------------------------------------------
-- Helper: decrypt game API key for HMAC verification
-- Uses SDK_MASTER_KEY env var set in Supabase project settings.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdk_get_signing_key(p_game_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc bytea;
  v_master text;
BEGIN
  SELECT api_key_enc INTO v_enc
  FROM public.creator_games
  WHERE game_id = p_game_id AND status = 'active';

  IF v_enc IS NULL THEN
    RETURN NULL;
  END IF;

  v_master := current_setting('app.settings.sdk_master_key', true);
  IF v_master IS NULL OR length(v_master) < 16 THEN
    RAISE EXCEPTION 'SDK_MASTER_KEY_NOT_CONFIGURED';
  END IF;

  RETURN pgp_sym_decrypt(v_enc, v_master);
END;
$$;

REVOKE ALL ON FUNCTION public.sdk_get_signing_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sdk_get_signing_key(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Helper: verify HMAC-SHA256 (hex) against signing key
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdk_verify_hmac(
  p_signing_key text,
  p_message text,
  p_provided_hmac text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_expected text;
BEGIN
  IF p_signing_key IS NULL OR p_provided_hmac IS NULL THEN
    RETURN false;
  END IF;

  v_expected := encode(
    hmac(p_message::bytea, p_signing_key::bytea, 'sha256'),
    'hex'
  );

  RETURN lower(v_expected) = lower(p_provided_hmac);
END;
$$;

REVOKE ALL ON FUNCTION public.sdk_verify_hmac(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sdk_verify_hmac(text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Helper: log SDK event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdk_log_event(
  p_match_id uuid,
  p_game_id text,
  p_event_type text,
  p_payload jsonb,
  p_hmac_valid boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sdk_match_log (match_id, game_id, event_type, payload, hmac_valid)
  VALUES (p_match_id, p_game_id, p_event_type, p_payload, p_hmac_valid);
END;
$$;

REVOKE ALL ON FUNCTION public.sdk_log_event(uuid, text, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sdk_log_event(uuid, text, text, jsonb, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- Helper: auto-void stale SDK matches
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdk_check_void_timeouts(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('voided', false);
  END IF;

  IF v_match.state = 'voided' OR v_match.sdk_phase = 'voided' THEN
    RETURN jsonb_build_object('voided', true, 'reason', 'already_voided');
  END IF;

  IF v_match.state = 'settled' OR v_match.sdk_phase = 'settled' THEN
    RETURN jsonb_build_object('voided', false);
  END IF;

  -- 300s after matchStart without winner claim
  IF v_match.sdk_started_at IS NOT NULL
     AND v_match.sdk_winner_claimed_at IS NULL
     AND now() > v_match.sdk_started_at + interval '300 seconds'
     AND v_match.state = 'active' THEN
    PERFORM public.void_match(p_match_id, 'sdk_timeout_no_winner');
    UPDATE public.matches SET sdk_phase = 'voided' WHERE id = p_match_id;
    IF v_match.creator_game_id IS NOT NULL THEN
      PERFORM public.sdk_log_event(
        p_match_id, v_match.creator_game_id, 'void',
        jsonb_build_object('reason', 'match_start_timeout_300s'), true
      );
    END IF;
    RETURN jsonb_build_object('voided', true, 'reason', 'match_start_timeout_300s');
  END IF;

  -- 30s after reportWinner without matchEnd
  IF v_match.sdk_winner_claimed_at IS NOT NULL
     AND v_match.sdk_phase = 'winner_claimed'
     AND now() > v_match.sdk_winner_claimed_at + interval '30 seconds'
     AND v_match.state = 'active' THEN
    PERFORM public.void_match(p_match_id, 'sdk_timeout_no_match_end');
    UPDATE public.matches SET sdk_phase = 'voided' WHERE id = p_match_id;
    IF v_match.creator_game_id IS NOT NULL THEN
      PERFORM public.sdk_log_event(
        p_match_id, v_match.creator_game_id, 'void',
        jsonb_build_object('reason', 'report_winner_timeout_30s'), true
      );
    END IF;
    RETURN jsonb_build_object('voided', true, 'reason', 'report_winner_timeout_30s');
  END IF;

  RETURN jsonb_build_object('voided', false);
END;
$$;

REVOKE ALL ON FUNCTION public.sdk_check_void_timeouts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sdk_check_void_timeouts(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- SDK RPC: init
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdk_match_init(
  p_game_id text,
  p_match_id uuid,
  p_timestamp bigint,
  p_hmac text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game record;
  v_match record;
  v_key text;
  v_msg text;
  v_valid boolean;
  v_player1 uuid;
  v_player2 uuid;
  v_entry_sk integer;
BEGIN
  SELECT * INTO v_game FROM public.creator_games WHERE game_id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_GAME_ID';
  END IF;
  IF v_game.status != 'active' THEN
    RAISE EXCEPTION 'GAME_NOT_ACTIVE: status=%', v_game.status;
  END IF;

  v_key := public.sdk_get_signing_key(p_game_id);
  v_msg := v_key || p_match_id::text || p_timestamp::text;
  v_valid := public.sdk_verify_hmac(v_key, v_msg, p_hmac);

  PERFORM public.sdk_log_event(
    p_match_id, p_game_id, 'init',
    jsonb_build_object('timestamp', p_timestamp), v_valid
  );

  IF NOT v_valid THEN
    RAISE EXCEPTION 'INVALID_HMAC_SIGNATURE';
  END IF;

  PERFORM public.sdk_check_void_timeouts(p_match_id);

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_match.state NOT IN ('active') THEN
    RAISE EXCEPTION 'MATCH_NOT_AVAILABLE: state=%', v_match.state;
  END IF;

  v_player1 := COALESCE(v_match.player1_id, v_match.player_a);
  v_player2 := COALESCE(v_match.player2_id, v_match.player_b);

  IF v_player1 IS NULL OR v_player2 IS NULL THEN
    RAISE EXCEPTION 'MATCH_MISSING_PLAYERS';
  END IF;

  v_entry_sk := v_match.stake_sp;
  IF v_entry_sk IS NULL OR v_entry_sk <= 0 THEN
    RAISE EXCEPTION 'INVALID_MATCH_STAKE';
  END IF;

  UPDATE public.matches
  SET creator_game_id = p_game_id,
      sdk_init_at = now(),
      sdk_phase = 'initialized'
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'player1Id', v_player1,
    'player2Id', v_player2,
    'entrySK', v_entry_sk,
    'potSK', v_entry_sk * 2
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sdk_match_init(text, uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sdk_match_init(text, uuid, bigint, text) TO service_role;

-- ---------------------------------------------------------------------------
-- SDK RPC: start
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdk_match_start(
  p_game_id text,
  p_match_id uuid,
  p_timestamp bigint,
  p_hmac text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_key text;
  v_msg text;
  v_valid boolean;
BEGIN
  v_key := public.sdk_get_signing_key(p_game_id);
  v_msg := v_key || p_match_id::text || p_timestamp::text;
  v_valid := public.sdk_verify_hmac(v_key, v_msg, p_hmac);

  PERFORM public.sdk_log_event(
    p_match_id, p_game_id, 'start',
    jsonb_build_object('timestamp', p_timestamp), v_valid
  );

  IF NOT v_valid THEN
    RAISE EXCEPTION 'INVALID_HMAC_SIGNATURE';
  END IF;

  PERFORM public.sdk_check_void_timeouts(p_match_id);

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_match.sdk_phase IS NULL OR v_match.sdk_phase != 'initialized' THEN
    IF v_match.sdk_phase = 'in_progress' THEN
      RAISE EXCEPTION 'MATCH_ALREADY_STARTED';
    END IF;
    RAISE EXCEPTION 'CALL_INIT_FIRST: current_phase=%', COALESCE(v_match.sdk_phase, 'none');
  END IF;

  IF v_match.creator_game_id IS DISTINCT FROM p_game_id THEN
    RAISE EXCEPTION 'GAME_ID_MISMATCH';
  END IF;

  UPDATE public.matches
  SET sdk_started_at = now(),
      sdk_phase = 'in_progress',
      status = 'in_progress'
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'started', true,
    'timeoutSeconds', 300
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sdk_match_start(text, uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sdk_match_start(text, uuid, bigint, text) TO service_role;

-- ---------------------------------------------------------------------------
-- SDK RPC: report_winner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdk_report_winner(
  p_game_id text,
  p_match_id uuid,
  p_winner_id uuid,
  p_timestamp bigint,
  p_hmac text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_key text;
  v_msg text;
  v_valid boolean;
  v_player1 uuid;
  v_player2 uuid;
BEGIN
  v_key := public.sdk_get_signing_key(p_game_id);
  v_msg := v_key || p_match_id::text || p_winner_id::text || p_timestamp::text;
  v_valid := public.sdk_verify_hmac(v_key, v_msg, p_hmac);

  PERFORM public.sdk_log_event(
    p_match_id, p_game_id, 'report_winner',
    jsonb_build_object('winner_id', p_winner_id, 'timestamp', p_timestamp), v_valid
  );

  IF NOT v_valid THEN
    RAISE EXCEPTION 'INVALID_HMAC_SIGNATURE';
  END IF;

  PERFORM public.sdk_check_void_timeouts(p_match_id);

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_match.state = 'voided' OR v_match.sdk_phase = 'voided' THEN
    RAISE EXCEPTION 'MATCH_VOIDED';
  END IF;

  IF v_match.sdk_phase IS DISTINCT FROM 'in_progress' THEN
    IF v_match.sdk_phase = 'winner_claimed' THEN
      RAISE EXCEPTION 'WINNER_ALREADY_REPORTED';
    END IF;
    RAISE EXCEPTION 'CALL_MATCH_START_FIRST: current_phase=%', COALESCE(v_match.sdk_phase, 'none');
  END IF;

  v_player1 := COALESCE(v_match.player1_id, v_match.player_a);
  v_player2 := COALESCE(v_match.player2_id, v_match.player_b);

  IF p_winner_id != v_player1 AND p_winner_id != v_player2 THEN
    RAISE EXCEPTION 'WINNER_NOT_IN_MATCH';
  END IF;

  UPDATE public.matches
  SET sdk_winner_claimed_id = p_winner_id,
      sdk_winner_claimed_at = now(),
      sdk_winner_hmac = p_hmac,
      sdk_phase = 'winner_claimed'
  WHERE id = p_match_id;

  RETURN jsonb_build_object('pending', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sdk_report_winner(text, uuid, uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sdk_report_winner(text, uuid, uuid, bigint, text) TO service_role;

-- ---------------------------------------------------------------------------
-- SDK RPC: end (calls finish_match with creator rake)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sdk_match_end(
  p_game_id text,
  p_match_id uuid,
  p_timestamp bigint,
  p_hmac text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_key text;
  v_msg text;
  v_valid boolean;
  v_result jsonb;
  v_pot integer;
  v_rake integer;
  v_creator_earn numeric;
BEGIN
  v_key := public.sdk_get_signing_key(p_game_id);
  v_msg := v_key || p_match_id::text || p_timestamp::text;
  v_valid := public.sdk_verify_hmac(v_key, v_msg, p_hmac);

  PERFORM public.sdk_log_event(
    p_match_id, p_game_id, 'end',
    jsonb_build_object('timestamp', p_timestamp), v_valid
  );

  IF NOT v_valid THEN
    RAISE EXCEPTION 'INVALID_HMAC_SIGNATURE';
  END IF;

  PERFORM public.sdk_check_void_timeouts(p_match_id);

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_match.state = 'voided' OR v_match.sdk_phase = 'voided' THEN
    RAISE EXCEPTION 'MATCH_VOIDED';
  END IF;

  IF v_match.sdk_phase IS DISTINCT FROM 'winner_claimed' THEN
    IF v_match.sdk_phase = 'settled' THEN
      RAISE EXCEPTION 'MATCH_ALREADY_SETTLED';
    END IF;
    RAISE EXCEPTION 'CALL_REPORT_WINNER_FIRST: current_phase=%', COALESCE(v_match.sdk_phase, 'none');
  END IF;

  IF v_match.sdk_winner_claimed_id IS NULL THEN
    RAISE EXCEPTION 'NO_WINNER_CLAIMED';
  END IF;

  v_result := public.finish_match(
    p_match_id,
    v_match.sdk_winner_claimed_id,
    NULL,
    'sdk_end_' || p_match_id::text,
    p_game_id
  );

  UPDATE public.matches SET sdk_phase = 'settled' WHERE id = p_match_id;

  v_pot := v_match.stake_sp * 2;
  v_rake := floor(v_pot * 0.12);

  SELECT COALESCE(earned_sk, 0) INTO v_creator_earn
  FROM public.creator_earnings
  WHERE match_id = p_match_id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'winner', v_match.sdk_winner_claimed_id,
    'potSK', v_pot,
    'rakeSK', v_rake,
    'creatorEarnedSK', COALESCE(v_creator_earn, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sdk_match_end(text, uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sdk_match_end(text, uuid, bigint, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Admin helper: register creator game with hashed + encrypted API key
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_creator_game(
  p_creator_id uuid,
  p_game_name text,
  p_game_id text,
  p_api_key_plain text,
  p_revenue_share_pct numeric DEFAULT 20
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_master text;
BEGIN
  IF length(p_api_key_plain) < 16 THEN
    RAISE EXCEPTION 'API_KEY_TOO_SHORT';
  END IF;

  v_master := current_setting('app.settings.sdk_master_key', true);
  IF v_master IS NULL OR length(v_master) < 16 THEN
    RAISE EXCEPTION 'SDK_MASTER_KEY_NOT_CONFIGURED';
  END IF;

  INSERT INTO public.creator_games (
    creator_id, game_name, game_id, api_key, api_key_enc,
    status, revenue_share_pct
  )
  VALUES (
    p_creator_id,
    p_game_name,
    p_game_id,
    crypt(p_api_key_plain, gen_salt('bf')),
    pgp_sym_encrypt(p_api_key_plain, v_master),
    'active',
    COALESCE(p_revenue_share_pct, 20)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_creator_game(uuid, text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_creator_game(uuid, text, text, text, numeric) TO service_role;

-- ---------------------------------------------------------------------------
-- Update finish_match: optional p_game_id with 12% rake + creator earnings
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.finish_match(uuid, uuid, uuid, text);

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

  -- SDK path: caller_id may be NULL (service role settlement)
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

    INSERT INTO public.creator_earnings (
      creator_id, game_id, match_id, earned_sk, earned_usd
    )
    VALUES (
      v_game.creator_id,
      p_game_id,
      p_match_id,
      v_creator_earn_sk,
      v_creator_earn_sk / 80.0
    );

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
