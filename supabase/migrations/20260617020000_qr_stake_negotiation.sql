-- QR stake negotiation: no stake at generation, propose/accept after join

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.qr_matches
  ALTER COLUMN stake_sk DROP NOT NULL;

ALTER TABLE public.qr_matches
  ADD COLUMN IF NOT EXISTS proposed_stake_sk integer,
  ADD COLUMN IF NOT EXISTS stake_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stake_proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS stake_responded_at timestamptz;

ALTER TABLE public.qr_matches
  DROP CONSTRAINT IF EXISTS qr_matches_stake_status_check;

ALTER TABLE public.qr_matches
  ADD CONSTRAINT qr_matches_stake_status_check
  CHECK (stake_status IN ('pending', 'proposed', 'accepted', 'declined'));

-- Realtime for negotiation screen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'qr_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_matches;
  END IF;
END $$;

-- Opponent can read row for realtime (signed-in)
DROP POLICY IF EXISTS qr_matches_opponent_read ON public.qr_matches;
CREATE POLICY qr_matches_opponent_read ON public.qr_matches
  FOR SELECT
  USING (auth.uid() = opponent_user_id OR auth.uid() = host_user_id);

-- ---------------------------------------------------------------------------
-- create_qr_match(game only) — no stake, no hold
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_qr_match(text, integer);
DROP FUNCTION IF EXISTS public.create_qr_match(text);

CREATE OR REPLACE FUNCTION public.create_qr_match(p_game text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid := auth.uid();
  v_game text;
  v_token text;
  v_short_code text;
  v_id uuid;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  v_game := public._qr_validate_game(p_game);

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_short_code := public._qr_generate_short_code();

  INSERT INTO public.qr_matches (
    host_user_id,
    game,
    stake_sk,
    qr_token,
    short_code,
    expires_at,
    hold_sk,
    stake_status
  )
  VALUES (
    v_host,
    v_game,
    NULL,
    v_token,
    v_short_code,
    now() + interval '5 minutes',
    0,
    'pending'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'qr_token', v_token,
    'short_code', v_short_code,
    'game', v_game,
    'expires_at', (SELECT expires_at FROM public.qr_matches WHERE id = v_id)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- accept_qr_match — join only, no match record yet
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
  v_guest_id uuid;
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

  IF p_opponent_user_id IS NULL THEN
    IF p_anonymous_session_token IS NULL OR length(trim(p_anonymous_session_token)) < 16 THEN
      RAISE EXCEPTION 'ANONYMOUS_TOKEN_REQUIRED';
    END IF;
    v_guest_id := gen_random_uuid();
  END IF;

  UPDATE public.qr_matches
  SET status = 'accepted',
      accepted_at = now(),
      opponent_user_id = p_opponent_user_id,
      opponent_is_anonymous = (p_opponent_user_id IS NULL),
      anonymous_session_token = COALESCE(p_anonymous_session_token, anonymous_session_token),
      anonymous_guest_id = COALESCE(v_guest_id, anonymous_guest_id),
      stake_status = 'pending'
  WHERE id = v_qr.id;

  RETURN jsonb_build_object(
    'qr_match_id', v_qr.id,
    'game', v_qr.game,
    'host_user_id', v_qr.host_user_id,
    'opponent_is_anonymous', (p_opponent_user_id IS NULL),
    'anonymous_guest_id', v_guest_id,
    'status', 'accepted'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Internal: start match after stake agreed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._qr_start_match_from_negotiation(p_qr public.qr_matches)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
  v_host_username text;
  v_opp_balance integer;
BEGIN
  SELECT username INTO v_host_username FROM public.profiles WHERE id = p_qr.host_user_id;

  IF NOT p_qr.opponent_is_anonymous AND p_qr.opponent_user_id IS NOT NULL THEN
    SELECT balance_sp INTO v_opp_balance FROM public.profiles WHERE id = p_qr.opponent_user_id FOR UPDATE;
    IF v_opp_balance IS NULL THEN
      RAISE EXCEPTION 'OPPONENT_NOT_FOUND';
    END IF;
    IF v_opp_balance < p_qr.stake_sk THEN
      RAISE EXCEPTION 'INSUFFICIENT_BALANCE_OPPONENT: have %, need %', v_opp_balance, p_qr.stake_sk;
    END IF;

    UPDATE public.profiles
    SET balance_sp_held = balance_sp_held - p_qr.hold_sk,
        balance_sp = balance_sp - p_qr.stake_sk
    WHERE id = p_qr.host_user_id;

    UPDATE public.profiles SET balance_sp = balance_sp - p_qr.stake_sk WHERE id = p_qr.opponent_user_id;

    INSERT INTO public.matches (
      game_type, player_a, player_b, stake_sp, stake_amount,
      player_a_is_bot, player_b_is_bot, player1_id, player2_id,
      player1_username, player2_username, status, state, qr_match_id
    )
    VALUES (
      p_qr.game,
      p_qr.host_user_id,
      p_qr.opponent_user_id,
      p_qr.stake_sk,
      p_qr.stake_sk,
      false,
      false,
      p_qr.host_user_id,
      p_qr.opponent_user_id,
      v_host_username,
      (SELECT username FROM public.profiles WHERE id = p_qr.opponent_user_id),
      'in_progress',
      'active',
      p_qr.id
    )
    RETURNING id INTO v_match_id;

    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES
      (p_qr.host_user_id, -p_qr.stake_sk, 'match_stake', format('QR match stake match:%s', v_match_id)),
      (p_qr.opponent_user_id, -p_qr.stake_sk, 'match_stake', format('QR match stake match:%s', v_match_id));

  ELSE
    -- Anonymous opponent: host-funded
    UPDATE public.profiles
    SET balance_sp_held = GREATEST(0, balance_sp_held - p_qr.hold_sk),
        balance_sp = balance_sp - p_qr.stake_sk
    WHERE id = p_qr.host_user_id;

    INSERT INTO public.matches (
      game_type, player_a, player_b, stake_sp, stake_amount,
      player_a_is_bot, player_b_is_bot, player1_id, player2_id,
      player1_username, player2_username, status, state, qr_match_id
    )
    VALUES (
      p_qr.game,
      p_qr.host_user_id,
      NULL,
      p_qr.stake_sk,
      p_qr.stake_sk,
      false,
      true,
      p_qr.host_user_id,
      NULL,
      v_host_username,
      'Guest',
      'in_progress',
      'active',
      p_qr.id
    )
    RETURNING id INTO v_match_id;

    INSERT INTO public.sp_transactions (user_id, amount, type, description)
    VALUES (
      p_qr.host_user_id,
      -p_qr.stake_sk,
      'match_stake',
      format('QR match stake (host-funded) match:%s', v_match_id)
    );
  END IF;

  UPDATE public.qr_matches
  SET status = 'in_progress',
      match_id = v_match_id,
      hold_sk = 0
  WHERE id = p_qr.id;

  RETURN v_match_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- propose_stake
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.propose_stake(
  p_qr_match_id uuid,
  p_amount_sk integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_available integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_amount_sk < 5 OR p_amount_sk > 1000 THEN
    RAISE EXCEPTION 'INVALID_STAKE: %', p_amount_sk;
  END IF;

  SELECT * INTO v_qr FROM public.qr_matches WHERE id = p_qr_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR_MATCH_NOT_FOUND';
  END IF;

  IF v_qr.host_user_id != auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN_NOT_HOST';
  END IF;

  IF v_qr.status != 'accepted' THEN
    RAISE EXCEPTION 'QR_NOT_IN_NEGOTIATION: %', v_qr.status;
  END IF;

  IF v_qr.stake_status NOT IN ('pending', 'declined', 'proposed') THEN
    RAISE EXCEPTION 'STAKE_NOT_NEGOTIABLE: %', v_qr.stake_status;
  END IF;

  SELECT public._qr_available_balance(v_qr.host_user_id) INTO v_available;
  IF v_available < p_amount_sk THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %, need %', v_available, p_amount_sk;
  END IF;

  UPDATE public.qr_matches
  SET proposed_stake_sk = p_amount_sk,
      stake_status = 'proposed',
      stake_proposed_at = now(),
      stake_responded_at = NULL
  WHERE id = p_qr_match_id;

  RETURN jsonb_build_object(
    'qr_match_id', p_qr_match_id,
    'proposed_stake_sk', p_amount_sk,
    'stake_status', 'proposed'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- respond_to_stake
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_stake(
  p_qr_match_id uuid,
  p_accept boolean,
  p_anonymous_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_match_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  SELECT * INTO v_qr FROM public.qr_matches WHERE id = p_qr_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR_MATCH_NOT_FOUND';
  END IF;

  IF v_qr.status != 'accepted' THEN
    RAISE EXCEPTION 'QR_NOT_IN_NEGOTIATION';
  END IF;

  IF v_qr.stake_status != 'proposed' THEN
    RAISE EXCEPTION 'NO_PROPOSAL_TO_RESPOND';
  END IF;

  -- Authorize opponent
  IF v_caller IS NOT NULL THEN
    IF v_qr.opponent_user_id IS NULL OR v_caller != v_qr.opponent_user_id THEN
      RAISE EXCEPTION 'FORBIDDEN_NOT_OPPONENT';
    END IF;
  ELSIF v_qr.opponent_is_anonymous THEN
    IF p_anonymous_session_token IS NULL
       OR p_anonymous_session_token != v_qr.anonymous_session_token THEN
      RAISE EXCEPTION 'FORBIDDEN_ANON_TOKEN';
    END IF;
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.qr_matches
    SET stake_status = 'pending',
        proposed_stake_sk = NULL,
        stake_responded_at = now()
    WHERE id = p_qr_match_id;

    RETURN jsonb_build_object('stake_status', 'pending', 'accepted', false);
  END IF;

  -- Accept: place hold on host, set stake, start match
  UPDATE public.profiles
  SET balance_sp_held = balance_sp_held + v_qr.proposed_stake_sk
  WHERE id = v_qr.host_user_id;

  UPDATE public.qr_matches
  SET stake_sk = proposed_stake_sk,
      stake_status = 'accepted',
      stake_responded_at = now(),
      hold_sk = proposed_stake_sk
  WHERE id = p_qr_match_id;

  SELECT * INTO v_qr FROM public.qr_matches WHERE id = p_qr_match_id;
  v_match_id := public._qr_start_match_from_negotiation(v_qr);

  RETURN jsonb_build_object(
    'stake_status', 'accepted',
    'accepted', true,
    'match_id', v_match_id,
    'stake_sk', v_qr.stake_sk
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_qr_negotiation_state — for polling (anonymous) and initial load
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_qr_negotiation_state(
  p_qr_match_id uuid,
  p_anonymous_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_host record;
  v_opp record;
  v_role text;
BEGIN
  SELECT * INTO v_qr FROM public.qr_matches WHERE id = p_qr_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF auth.uid() = v_qr.host_user_id THEN
    v_role := 'host';
  ELSIF auth.uid() = v_qr.opponent_user_id THEN
    v_role := 'opponent';
  ELSIF p_anonymous_session_token IS NOT NULL
        AND p_anonymous_session_token = v_qr.anonymous_session_token THEN
    v_role := 'opponent';
  ELSE
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT username, avatar_url INTO v_host FROM public.profiles WHERE id = v_qr.host_user_id;
  IF v_qr.opponent_user_id IS NOT NULL THEN
    SELECT username, avatar_url INTO v_opp FROM public.profiles WHERE id = v_qr.opponent_user_id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'role', v_role,
    'id', v_qr.id,
    'game', v_qr.game,
    'status', v_qr.status,
    'stake_status', v_qr.stake_status,
    'stake_sk', v_qr.stake_sk,
    'proposed_stake_sk', v_qr.proposed_stake_sk,
    'match_id', v_qr.match_id,
    'opponent_is_anonymous', v_qr.opponent_is_anonymous,
    'host_username', COALESCE(v_host.username, 'Player'),
    'host_avatar_url', v_host.avatar_url,
    'opponent_username', CASE
      WHEN v_qr.opponent_is_anonymous THEN 'Anonymous Player'
      ELSE COALESCE(v_opp.username, 'Player')
    END,
    'opponent_avatar_url', v_opp.avatar_url
  );
END;
$$;

-- Update get_qr_match_by_token public fields
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
  FROM public.profiles WHERE id = v_qr.host_user_id;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_qr.id,
    'game', v_qr.game,
    'stake_sk', v_qr.stake_sk,
    'status', v_qr.status,
    'stake_status', v_qr.stake_status,
    'expires_at', v_qr.expires_at,
    'host_username', COALESCE(v_host.username, 'Player'),
    'host_avatar_url', v_host.avatar_url,
    'short_code', v_qr.short_code,
    'match_id', v_qr.match_id
  );
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.create_qr_match(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_qr_match(text) TO authenticated;

REVOKE ALL ON FUNCTION public.propose_stake(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_stake(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_to_stake(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_stake(uuid, boolean, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_qr_negotiation_state(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_qr_negotiation_state(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
