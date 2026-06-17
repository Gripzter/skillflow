-- Anonymous QR display names and guest-facing match identity.

ALTER TABLE public.qr_matches
  ADD COLUMN IF NOT EXISTS anonymous_display_name text;

CREATE OR REPLACE FUNCTION public._qr_generate_anonymous_display_name()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_adjectives text[] := ARRAY[
    'swift', 'night', 'iron', 'quiet', 'rookie',
    'turbo', 'silver', 'wild', 'sharp', 'ghost',
    'crimson', 'lucky', 'rapid', 'steady', 'final',
    'midnight', 'electric', 'grit', 'solar', 'velvet'
  ];
  v_nouns text[] := ARRAY[
    'falcon', 'rider', 'wolf', 'storm', 'driver',
    'racer', 'comet', 'viper', 'titan', 'ace',
    'pilot', 'charger', 'phantom', 'engine', 'maverick',
    'sparrow', 'striker', 'blazer', 'outlaw', 'lap'
  ];
  v_adj text;
  v_noun text;
BEGIN
  v_adj := v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::int];
  v_noun := v_nouns[1 + floor(random() * array_length(v_nouns, 1))::int];
  RETURN initcap(v_adj || ' ' || v_noun);
END;
$$;

DROP FUNCTION IF EXISTS public.accept_qr_match(text, text, uuid);
DROP FUNCTION IF EXISTS public.accept_qr_match(text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.accept_qr_match(
  p_token text,
  p_anonymous_session_token text DEFAULT NULL,
  p_opponent_user_id uuid DEFAULT NULL,
  p_anonymous_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr public.qr_matches;
  v_guest_id uuid;
  v_display_name text;
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
    v_display_name := COALESCE(NULLIF(trim(p_anonymous_display_name), ''), public._qr_generate_anonymous_display_name());
  END IF;

  UPDATE public.qr_matches
  SET status = 'accepted',
      accepted_at = now(),
      opponent_user_id = p_opponent_user_id,
      opponent_is_anonymous = (p_opponent_user_id IS NULL),
      anonymous_session_token = COALESCE(p_anonymous_session_token, anonymous_session_token),
      anonymous_guest_id = COALESCE(v_guest_id, anonymous_guest_id),
      anonymous_display_name = CASE
        WHEN p_opponent_user_id IS NULL THEN COALESCE(anonymous_display_name, v_display_name)
        ELSE NULL
      END,
      stake_status = 'pending'
  WHERE id = v_qr.id;

  RETURN jsonb_build_object(
    'qr_match_id', v_qr.id,
    'game', v_qr.game,
    'host_user_id', v_qr.host_user_id,
    'opponent_is_anonymous', (p_opponent_user_id IS NULL),
    'anonymous_guest_id', v_guest_id,
    'anonymous_display_name', v_display_name,
    'status', 'accepted'
  );
END;
$$;

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
  v_guest_name text;
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
    v_guest_name := COALESCE(NULLIF(p_qr.anonymous_display_name, ''), 'Guest Driver');

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
      v_guest_name,
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
    v_opp_username := COALESCE(NULLIF(v_qr.anonymous_display_name, ''), 'Guest Driver');
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
    'anonymous_display_name', v_qr.anonymous_display_name,
    'host_username', COALESCE(v_host_username, 'Player'),
    'host_avatar_url', v_host_avatar_url,
    'opponent_username', v_opp_username,
    'opponent_avatar_url', v_opp_avatar_url
  );
END;
$$;

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
    'qr_token', v_qr.qr_token,
    'anonymous_display_name', v_qr.anonymous_display_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_qr_match(text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_qr_match(text, text, uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
