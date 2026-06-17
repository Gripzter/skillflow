-- Fix v_opp unassigned for anonymous opponents; accept short codes in join URLs

-- ---------------------------------------------------------------------------
-- Helper: resolve qr_token or short_code to qr_matches row
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._qr_resolve_by_token_or_code(p_token text)
RETURNS public.qr_matches
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_input text := trim(p_token);
BEGIN
  IF v_input IS NULL OR length(v_input) < 4 THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  IF length(v_input) < 16 THEN
    SELECT * INTO v_qr
    FROM public.qr_matches
    WHERE short_code = upper(v_input);
  ELSE
    SELECT * INTO v_qr
    FROM public.qr_matches
    WHERE qr_token = v_input;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR_MATCH_NOT_FOUND';
  END IF;

  RETURN v_qr;
END;
$$;

-- ---------------------------------------------------------------------------
-- accept_qr_match — resolve short_code URLs
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
  IF p_token IS NULL OR length(trim(p_token)) < 4 THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  IF length(trim(p_token)) < 16 THEN
    SELECT * INTO v_qr FROM public.qr_matches WHERE short_code = upper(trim(p_token)) FOR UPDATE;
  ELSE
    SELECT * INTO v_qr FROM public.qr_matches WHERE qr_token = p_token FOR UPDATE;
  END IF;

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
-- get_qr_match_by_token — resolve short_code URLs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_qr_match_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_host_username text;
  v_host_avatar_url text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 4 THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  IF length(trim(p_token)) < 16 THEN
    SELECT * INTO v_qr FROM public.qr_matches WHERE short_code = upper(trim(p_token));
  ELSE
    SELECT * INTO v_qr FROM public.qr_matches WHERE qr_token = p_token;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_qr.status = 'pending' AND v_qr.expires_at <= now() THEN
    PERFORM public.expire_qr_match(v_qr.id);
    v_qr.status := 'expired';
  END IF;

  SELECT username, avatar_url
  INTO v_host_username, v_host_avatar_url
  FROM public.profiles WHERE id = v_qr.host_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HOST_PROFILE_NOT_FOUND: %', v_qr.host_user_id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_qr.id,
    'game', v_qr.game,
    'stake_sk', v_qr.stake_sk,
    'status', v_qr.status,
    'stake_status', v_qr.stake_status,
    'expires_at', v_qr.expires_at,
    'host_username', COALESCE(v_host_username, 'Player'),
    'host_avatar_url', v_host_avatar_url,
    'short_code', v_qr.short_code,
    'match_id', v_qr.match_id,
    'qr_token', v_qr.qr_token
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_qr_negotiation_state — fix v_opp for anonymous opponents
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
    'stake_status', v_qr.stake_status,
    'stake_sk', v_qr.stake_sk,
    'proposed_stake_sk', v_qr.proposed_stake_sk,
    'match_id', v_qr.match_id,
    'opponent_is_anonymous', v_qr.opponent_is_anonymous,
    'host_username', COALESCE(v_host_username, 'Player'),
    'host_avatar_url', v_host_avatar_url,
    'opponent_username', v_opp_username,
    'opponent_avatar_url', v_opp_avatar_url
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
