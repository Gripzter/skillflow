-- Admin panel: is_admin helper, banned flag, performance indexes

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = 'ff24466d-ee44-4cfe-9f88-54745ddfc324'::uuid;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_banned ON public.profiles(banned) WHERE banned = true;
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON public.matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_paid_out ON public.creator_earnings(paid_out);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- Admin read policies (owner only via is_admin)
DROP POLICY IF EXISTS admin_select_all_creator_games ON public.creator_games;
CREATE POLICY admin_select_all_creator_games ON public.creator_games
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_update_all_creator_games ON public.creator_games;
CREATE POLICY admin_update_all_creator_games ON public.creator_games
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS admin_select_all_creator_earnings ON public.creator_earnings;
CREATE POLICY admin_select_all_creator_earnings ON public.creator_earnings
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_update_all_creator_earnings ON public.creator_earnings;
CREATE POLICY admin_update_all_creator_earnings ON public.creator_earnings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS admin_select_all_matches ON public.matches;
CREATE POLICY admin_select_all_matches ON public.matches
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_select_all_profiles ON public.profiles;
CREATE POLICY admin_select_all_profiles ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_update_all_profiles ON public.profiles;
CREATE POLICY admin_update_all_profiles ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS admin_select_all_transactions ON public.transactions;
CREATE POLICY admin_select_all_transactions ON public.transactions
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS admin_select_sdk_match_log ON public.sdk_match_log;
CREATE POLICY admin_select_sdk_match_log ON public.sdk_match_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.sdk_match_log TO authenticated;

-- Regenerate creator API key (service role / admin API only)
CREATE OR REPLACE FUNCTION public.admin_regenerate_creator_api_key(p_game_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_key text;
  v_master text;
BEGIN
  v_new_key := 'sk_live_' || replace(gen_random_uuid()::text, '-', '');

  v_master := current_setting('app.settings.sdk_master_key', true);
  IF v_master IS NULL OR length(v_master) < 16 THEN
    RAISE EXCEPTION 'SDK_MASTER_KEY_NOT_CONFIGURED';
  END IF;

  UPDATE public.creator_games
  SET api_key = crypt(v_new_key, gen_salt('bf')),
      api_key_enc = pgp_sym_encrypt(v_new_key, v_master)
  WHERE game_id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAME_NOT_FOUND';
  END IF;

  RETURN v_new_key;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_regenerate_creator_api_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_creator_api_key(text) TO service_role;
