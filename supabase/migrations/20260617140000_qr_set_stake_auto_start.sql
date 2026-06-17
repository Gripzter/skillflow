-- set_stake: host picks amount → hold + match starts immediately (no opponent confirmation)

CREATE OR REPLACE FUNCTION public.set_stake(
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
  v_match_id uuid;
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
    RAISE EXCEPTION 'QR_NOT_READY: %', v_qr.status;
  END IF;

  IF v_qr.match_id IS NOT NULL THEN
    RAISE EXCEPTION 'MATCH_ALREADY_STARTED';
  END IF;

  SELECT public._qr_available_balance(v_qr.host_user_id) INTO v_available;
  IF v_available < p_amount_sk THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %, need %', v_available, p_amount_sk;
  END IF;

  UPDATE public.profiles
  SET balance_sp_held = balance_sp_held + p_amount_sk
  WHERE id = v_qr.host_user_id;

  UPDATE public.qr_matches
  SET stake_sk = p_amount_sk,
      hold_sk = p_amount_sk,
      stake_status = 'accepted'
  WHERE id = p_qr_match_id;

  SELECT * INTO v_qr FROM public.qr_matches WHERE id = p_qr_match_id;
  v_match_id := public._qr_start_match_from_negotiation(v_qr);

  RETURN jsonb_build_object(
    'match_id', v_match_id,
    'stake_sk', p_amount_sk,
    'status', 'in_progress'
  );
END;
$$;

-- Guest match read for anonymous QR opponents (bypasses matches RLS)
CREATE OR REPLACE FUNCTION public.get_qr_guest_match(
  p_match_id uuid,
  p_anonymous_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_match public.matches;
BEGIN
  IF p_anonymous_session_token IS NULL OR length(trim(p_anonymous_session_token)) < 16 THEN
    RAISE EXCEPTION 'ANONYMOUS_TOKEN_REQUIRED';
  END IF;

  SELECT * INTO v_qr
  FROM public.qr_matches
  WHERE match_id = p_match_id
    AND opponent_is_anonymous = true
    AND anonymous_session_token = p_anonymous_session_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'match', to_jsonb(v_match)
  );
END;
$$;

-- Simplify negotiation state (no propose/accept flow)
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
  v_host_username text;
  v_host_avatar_url text;
  v_opp_username text;
  v_opp_avatar_url text;
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

  SELECT username, avatar_url
  INTO v_host_username, v_host_avatar_url
  FROM public.profiles
  WHERE id = v_qr.host_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HOST_PROFILE_NOT_FOUND: %', v_qr.host_user_id;
  END IF;

  IF v_qr.opponent_is_anonymous OR v_qr.opponent_user_id IS NULL THEN
    v_opp_username := 'Anonymous Player';
    v_opp_avatar_url := NULL;
  ELSE
    SELECT username, avatar_url
    INTO v_opp_username, v_opp_avatar_url
    FROM public.profiles
    WHERE id = v_qr.opponent_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'OPPONENT_PROFILE_NOT_FOUND: %', v_qr.opponent_user_id;
    END IF;

    v_opp_username := COALESCE(v_opp_username, 'Player');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'role', v_role,
    'id', v_qr.id,
    'game', v_qr.game,
    'status', v_qr.status,
    'stake_sk', v_qr.stake_sk,
    'match_id', v_qr.match_id,
    'opponent_is_anonymous', v_qr.opponent_is_anonymous,
    'host_username', COALESCE(v_host_username, 'Player'),
    'host_avatar_url', v_host_avatar_url,
    'opponent_username', v_opp_username,
    'opponent_avatar_url', v_opp_avatar_url
  );
END;
$$;

DROP FUNCTION IF EXISTS public.respond_to_stake(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.propose_stake(uuid, integer);

REVOKE ALL ON FUNCTION public.set_stake(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_stake(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_qr_guest_match(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_qr_guest_match(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
