-- Creator dashboard: RLS for match logs, SDK matches, and API key reveal

-- Creators can read sdk_match_log for their registered games
GRANT SELECT ON public.sdk_match_log TO authenticated;

DROP POLICY IF EXISTS sdk_match_log_select_creator ON public.sdk_match_log;
CREATE POLICY sdk_match_log_select_creator ON public.sdk_match_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_games cg
      WHERE cg.game_id = sdk_match_log.game_id
        AND cg.creator_id = auth.uid()
    )
  );

-- Creators can read matches tied to their SDK games (no wallet/player PII beyond stakes)
GRANT SELECT ON public.matches TO authenticated;

DROP POLICY IF EXISTS matches_select_creator_sdk ON public.matches;
CREATE POLICY matches_select_creator_sdk ON public.matches
  FOR SELECT TO authenticated
  USING (
    creator_game_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.creator_games cg
      WHERE cg.game_id = matches.creator_game_id
        AND cg.creator_id = auth.uid()
    )
  );

-- Reveal decrypted API key after client-side reauthentication
CREATE OR REPLACE FUNCTION public.reveal_creator_api_key(p_game_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc bytea;
  v_master text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT cg.api_key_enc INTO v_enc
  FROM public.creator_games cg
  WHERE cg.game_id = p_game_id
    AND cg.creator_id = auth.uid();

  IF v_enc IS NULL THEN
    RAISE EXCEPTION 'GAME_NOT_FOUND';
  END IF;

  v_master := current_setting('app.settings.sdk_master_key', true);
  IF v_master IS NULL OR length(v_master) < 16 THEN
    RAISE EXCEPTION 'SDK_MASTER_KEY_NOT_CONFIGURED';
  END IF;

  RETURN pgp_sym_decrypt(v_enc, v_master);
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_creator_api_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reveal_creator_api_key(text) TO authenticated;
