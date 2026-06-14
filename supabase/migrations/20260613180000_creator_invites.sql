-- Creator invite onboarding system

CREATE TABLE IF NOT EXISTS public.creator_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  game_name_hint text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_invites_token ON public.creator_invites(token);
CREATE INDEX IF NOT EXISTS idx_creator_invites_status ON public.creator_invites(status);
CREATE INDEX IF NOT EXISTS idx_creator_invites_expires_at ON public.creator_invites(expires_at);

ALTER TABLE public.creator_games
  ADD COLUMN IF NOT EXISTS creator_display_name text,
  ADD COLUMN IF NOT EXISTS game_url text,
  ADD COLUMN IF NOT EXISTS game_description text,
  ADD COLUMN IF NOT EXISTS win_condition text,
  ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.creator_invites(id) ON DELETE SET NULL;

ALTER TABLE public.creator_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_invites_admin_all ON public.creator_invites;
CREATE POLICY creator_invites_admin_all ON public.creator_invites
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.creator_invites FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.creator_invites TO authenticated;
GRANT ALL ON public.creator_invites TO service_role;

-- ---------------------------------------------------------------------------
-- Generate invite (admin or service role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invite_token(
  p_email text DEFAULT NULL,
  p_game_hint text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_created_by uuid;
  v_base_url text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_created_by := COALESCE(auth.uid(), 'ff24466d-ee44-4cfe-9f88-54745ddfc324'::uuid);
  v_token := encode(gen_random_bytes(16), 'hex');

  INSERT INTO public.creator_invites (token, created_by, email, game_name_hint)
  VALUES (
    v_token,
    v_created_by,
    NULLIF(trim(p_email), ''),
    NULLIF(trim(p_game_hint), '')
  );

  v_base_url := COALESCE(
    current_setting('app.settings.public_site_url', true),
    'https://skillflow.gg'
  );

  RETURN v_base_url || '/invite/' || v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invite_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_invite_token(text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public invite lookup (no sensitive data)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invite_details(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
BEGIN
  SELECT * INTO v_invite FROM public.creator_invites WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'accepted');
  END IF;

  IF v_invite.status = 'expired' OR v_invite.expires_at < now() THEN
    UPDATE public.creator_invites SET status = 'expired'
    WHERE id = v_invite.id AND status = 'pending';
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invite.email,
    'gameNameHint', v_invite.game_name_hint,
    'expiresAt', v_invite.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_invite_details(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_details(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Revoke invite (admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_invite_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.creator_invites
  SET status = 'expired'
  WHERE token = p_token AND status = 'pending';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_invite_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_invite_token(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Create pending creator game after signup (service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_pending_creator_game(
  p_creator_id uuid,
  p_invite_token text,
  p_creator_display_name text,
  p_game_name text,
  p_game_url text,
  p_game_description text,
  p_win_condition text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_game_id text;
  v_api_key text;
  v_master text;
  v_game_row_id uuid;
BEGIN
  SELECT * INTO v_invite FROM public.creator_invites WHERE token = p_invite_token FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND';
  END IF;

  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'INVITE_NOT_PENDING';
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.creator_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'INVITE_EXPIRED';
  END IF;

  IF EXISTS (SELECT 1 FROM public.creator_games WHERE creator_id = p_creator_id) THEN
    RAISE EXCEPTION 'CREATOR_ALREADY_REGISTERED';
  END IF;

  v_game_id := lower(regexp_replace(trim(p_game_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_game_id := trim(both '-' from v_game_id);
  IF length(v_game_id) < 2 THEN
    v_game_id := 'game';
  END IF;
  v_game_id := v_game_id || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  v_api_key := 'sk_live_' || replace(gen_random_uuid()::text, '-', '');
  v_master := current_setting('app.settings.sdk_master_key', true);
  IF v_master IS NULL OR length(v_master) < 16 THEN
    RAISE EXCEPTION 'SDK_MASTER_KEY_NOT_CONFIGURED';
  END IF;

  INSERT INTO public.creator_games (
    creator_id,
    game_name,
    game_id,
    api_key,
    api_key_enc,
    status,
    revenue_share_pct,
    creator_display_name,
    game_url,
    game_description,
    win_condition,
    invite_id
  )
  VALUES (
    p_creator_id,
    trim(p_game_name),
    v_game_id,
    crypt(v_api_key, gen_salt('bf')),
    pgp_sym_encrypt(v_api_key, v_master),
    'pending',
    20,
    trim(p_creator_display_name),
    trim(p_game_url),
    left(trim(p_game_description), 500),
    left(trim(p_win_condition), 300),
    v_invite.id
  )
  RETURNING id INTO v_game_row_id;

  UPDATE public.creator_invites
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by = p_creator_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'gameId', v_game_id,
    'creatorGameId', v_game_row_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_pending_creator_game(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pending_creator_game(uuid, text, text, text, text, text, text) TO service_role;
