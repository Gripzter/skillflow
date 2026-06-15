-- Admin-controlled daily challenges: templates, daily slots, player progress

DROP TABLE IF EXISTS public.daily_challenges CASCADE;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.challenge_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  game text NOT NULL CHECK (game IN (
    'connect4', 'chess', 'reaction_duel', 'spelling_bee', 'memory_match', 'checkers', 'any'
  )),
  challenge_type text NOT NULL CHECK (challenge_type IN (
    'play_matches', 'win_matches', 'win_streak', 'play_minutes', 'earn_sp'
  )),
  target_value integer NOT NULL CHECK (target_value > 0),
  reward_sk integer NOT NULL CHECK (reward_sk >= 50 AND reward_sk <= 500),
  is_active boolean NOT NULL DEFAULT true,
  difficulty text NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_challenge_templates_active ON public.challenge_templates(is_active) WHERE is_active = true;

CREATE TABLE public.daily_challenge_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date date NOT NULL,
  slot integer NOT NULL CHECK (slot BETWEEN 1 AND 3),
  template_id uuid NOT NULL REFERENCES public.challenge_templates(id) ON DELETE RESTRICT,
  UNIQUE (challenge_date, slot)
);

CREATE INDEX idx_daily_challenge_slots_date ON public.daily_challenge_slots(challenge_date DESC);

CREATE TABLE public.player_challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.daily_challenge_slots(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  reward_claimed boolean NOT NULL DEFAULT false,
  reward_claimed_at timestamptz,
  UNIQUE (user_id, slot_id)
);

CREATE INDEX idx_player_challenge_progress_user ON public.player_challenge_progress(user_id);
CREATE INDEX idx_player_challenge_progress_slot ON public.player_challenge_progress(slot_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.challenge_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenge_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_challenge_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS challenge_templates_select ON public.challenge_templates;
CREATE POLICY challenge_templates_select ON public.challenge_templates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS challenge_templates_admin_write ON public.challenge_templates;
CREATE POLICY challenge_templates_admin_write ON public.challenge_templates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS daily_challenge_slots_select ON public.daily_challenge_slots;
CREATE POLICY daily_challenge_slots_select ON public.daily_challenge_slots
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS daily_challenge_slots_admin_write ON public.daily_challenge_slots;
CREATE POLICY daily_challenge_slots_admin_write ON public.daily_challenge_slots
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS player_challenge_progress_own ON public.player_challenge_progress;
CREATE POLICY player_challenge_progress_own ON public.player_challenge_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.challenge_templates TO authenticated;
GRANT SELECT ON public.daily_challenge_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.player_challenge_progress TO authenticated;
GRANT ALL ON public.challenge_templates TO service_role;
GRANT ALL ON public.daily_challenge_slots TO service_role;
GRANT ALL ON public.player_challenge_progress TO service_role;

-- ---------------------------------------------------------------------------
-- Atomic reward claim
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_challenge_reward(p_slot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_progress public.player_challenge_progress%ROWTYPE;
  v_template public.challenge_templates%ROWTYPE;
  v_new_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT pcp.* INTO v_progress
  FROM public.player_challenge_progress pcp
  WHERE pcp.user_id = v_user_id
    AND pcp.slot_id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRESS_NOT_FOUND';
  END IF;

  IF NOT v_progress.completed THEN
    RAISE EXCEPTION 'CHALLENGE_NOT_COMPLETED';
  END IF;

  IF v_progress.reward_claimed THEN
    RAISE EXCEPTION 'ALREADY_CLAIMED';
  END IF;

  SELECT ct.* INTO v_template
  FROM public.daily_challenge_slots dcs
  JOIN public.challenge_templates ct ON ct.id = dcs.template_id
  WHERE dcs.id = p_slot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLOT_NOT_FOUND';
  END IF;

  UPDATE public.profiles
  SET balance_sp = balance_sp + v_template.reward_sk,
      lifetime_sp = lifetime_sp + v_template.reward_sk
  WHERE id = v_user_id
  RETURNING balance_sp INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  INSERT INTO public.sp_transactions (user_id, amount, type, description)
  VALUES (
    v_user_id,
    v_template.reward_sk,
    'challenge_reward',
    format('Daily challenge reward: %s', v_template.title)
  );

  UPDATE public.player_challenge_progress
  SET reward_claimed = true,
      reward_claimed_at = now()
  WHERE id = v_progress.id;

  RETURN jsonb_build_object(
    'success', true,
    'reward_sk', v_template.reward_sk,
    'new_balance', v_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_challenge_reward(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_challenge_reward(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed templates
-- ---------------------------------------------------------------------------

INSERT INTO public.challenge_templates (title, description, game, challenge_type, target_value, reward_sk, difficulty) VALUES
  ('Play 5 Connect 4 matches', 'Complete five Connect 4 matches today.', 'connect4', 'play_matches', 5, 100, 'normal'),
  ('Play 5 Chess matches', 'Complete five Chess matches today.', 'chess', 'play_matches', 5, 100, 'normal'),
  ('Win 3 Reaction Duel matches', 'Win three Reaction Duel matches today.', 'reaction_duel', 'win_matches', 3, 150, 'normal'),
  ('Win 5 matches in any game', 'Win five matches across any SkillFlow game today.', 'any', 'win_matches', 5, 200, 'hard'),
  ('Play 10 matches in any game', 'Play ten matches across any SkillFlow game today.', 'any', 'play_matches', 10, 150, 'hard'),
  ('Play 3 Memory Match games', 'Complete three Memory Match games today.', 'memory_match', 'play_matches', 3, 75, 'easy'),
  ('Play 3 Spelling Bee games', 'Complete three Spelling Bee games today.', 'spelling_bee', 'play_matches', 3, 75, 'easy'),
  ('Win 2 Chess matches', 'Win two Chess matches today.', 'chess', 'win_matches', 2, 100, 'normal'),
  ('Win 3 Connect 4 matches', 'Win three Connect 4 matches today.', 'connect4', 'win_matches', 3, 100, 'normal'),
  ('Play 3 Checkers matches', 'Complete three Checkers matches today.', 'checkers', 'play_matches', 3, 75, 'easy');
