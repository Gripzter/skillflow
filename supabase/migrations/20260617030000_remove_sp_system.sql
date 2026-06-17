-- Remove placeholder SkillPoints/rank/case/inventory economy and move rewards to Skillies wallet.

-- Preserve any remaining profile SP balance in wallets before dropping the profile column.
INSERT INTO public.wallets (user_id, balance, updated_at)
SELECT id, COALESCE(balance_sp, 0), now()
FROM public.profiles
ON CONFLICT (user_id) DO UPDATE
SET balance = GREATEST(public.wallets.balance, EXCLUDED.balance),
    updated_at = now();

-- Daily challenges: keep reward_sk, add reward framing, and credit real Skillies wallet.
ALTER TABLE public.challenge_templates
  ADD COLUMN IF NOT EXISTS bonus_type text NOT NULL DEFAULT 'flat_sk';

ALTER TABLE public.challenge_templates
  DROP CONSTRAINT IF EXISTS challenge_templates_bonus_type_check;

ALTER TABLE public.challenge_templates
  ADD CONSTRAINT challenge_templates_bonus_type_check
  CHECK (bonus_type IN ('flat_sk', 'second_chance'));

ALTER TABLE public.challenge_templates
  DROP CONSTRAINT IF EXISTS challenge_templates_reward_sk_check;

ALTER TABLE public.challenge_templates
  ADD CONSTRAINT challenge_templates_reward_sk_check
  CHECK (reward_sk >= 5 AND reward_sk <= 500);

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check CHECK (
    type IN (
      'deposit',
      'withdrawal',
      'match_entry',
      'match_win',
      'match_refund',
      'platform_fee',
      'referral_bonus',
      'challenge_reward',
      'admin_adjustment'
    )
  );

UPDATE public.challenge_templates
SET bonus_type = 'second_chance',
    reward_sk = 5,
    description = 'Every match counts. Here is a little extra in your pocket for next time.'
WHERE title IN ('Play 3 Memory Match games', 'Play 3 Spelling Bee games');

UPDATE public.challenge_templates
SET bonus_type = 'second_chance',
    reward_sk = 10,
    description = 'Keep showing up. This small second-chance credit is for your next run.'
WHERE title = 'Play 3 Checkers matches';

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
  v_new_balance numeric;
  v_description text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT pcp.* INTO v_progress
  FROM public.player_challenge_progress pcp
  WHERE pcp.user_id = v_user_id
    AND pcp.slot_id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PROGRESS_NOT_FOUND'; END IF;
  IF NOT v_progress.completed THEN RAISE EXCEPTION 'CHALLENGE_NOT_COMPLETED'; END IF;
  IF v_progress.reward_claimed THEN RAISE EXCEPTION 'ALREADY_CLAIMED'; END IF;

  SELECT ct.* INTO v_template
  FROM public.daily_challenge_slots dcs
  JOIN public.challenge_templates ct ON ct.id = dcs.template_id
  WHERE dcs.id = p_slot_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'SLOT_NOT_FOUND'; END IF;

  INSERT INTO public.wallets (user_id, balance, updated_at)
  VALUES (v_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET balance = balance + v_template.reward_sk,
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_new_balance;

  v_description := CASE
    WHEN v_template.bonus_type = 'second_chance'
      THEN format('Daily challenge second-chance credit: %s', v_template.title)
    ELSE format('Daily challenge reward: %s', v_template.title)
  END;

  INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
  VALUES (v_user_id, v_template.reward_sk, 'challenge_reward', v_new_balance, v_description, 'completed');

  UPDATE public.player_challenge_progress
  SET reward_claimed = true,
      reward_claimed_at = now()
  WHERE id = v_progress.id;

  RETURN jsonb_build_object(
    'success', true,
    'reward_sk', v_template.reward_sk,
    'bonus_type', v_template.bonus_type,
    'new_balance', v_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_challenge_reward(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_challenge_reward(uuid) TO authenticated;

-- Match RPCs: Skillies live in wallets/transactions, not profiles/sp_transactions.
CREATE OR REPLACE FUNCTION public.start_match(
  p_game text,
  p_player_a uuid,
  p_player_b uuid,
  p_stake_sp integer,
  p_player_b_is_bot boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
  v_a_balance numeric;
  v_b_balance numeric;
BEGIN
  IF p_stake_sp < 50 OR p_stake_sp > 5000 THEN
    RAISE EXCEPTION 'INVALID_STAKE: %', p_stake_sp;
  END IF;

  INSERT INTO public.wallets (user_id, balance, updated_at)
  VALUES (p_player_a, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_a_balance FROM public.wallets WHERE user_id = p_player_a FOR UPDATE;
  IF v_a_balance < p_stake_sp THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE_A: have %, need %', v_a_balance, p_stake_sp;
  END IF;

  IF NOT p_player_b_is_bot THEN
    IF p_player_b IS NULL THEN RAISE EXCEPTION 'PLAYER_B_MISSING_FOR_HUMAN_MATCH'; END IF;
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (p_player_b, 0, now())
    ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO v_b_balance FROM public.wallets WHERE user_id = p_player_b FOR UPDATE;
    IF v_b_balance < p_stake_sp THEN
      RAISE EXCEPTION 'INSUFFICIENT_BALANCE_B: have %, need %', v_b_balance, p_stake_sp;
    END IF;
  END IF;

  UPDATE public.wallets SET balance = balance - p_stake_sp, updated_at = now() WHERE user_id = p_player_a;
  IF NOT p_player_b_is_bot THEN
    UPDATE public.wallets SET balance = balance - p_stake_sp, updated_at = now() WHERE user_id = p_player_b;
  END IF;

  INSERT INTO public.matches (
    game_type, player_a, player_b, stake_sp, stake_amount,
    player_a_is_bot, player_b_is_bot, player1_id, player2_id, status, state
  )
  VALUES (
    p_game, p_player_a, CASE WHEN p_player_b_is_bot THEN NULL ELSE p_player_b END, p_stake_sp, p_stake_sp,
    false, p_player_b_is_bot, p_player_a, CASE WHEN p_player_b_is_bot THEN NULL ELSE p_player_b END, 'in_progress', 'active'
  )
  RETURNING id INTO v_match_id;

  INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
  VALUES (p_player_a, -p_stake_sp, 'match_entry', v_a_balance - p_stake_sp, format('Match stake debit match:%s', v_match_id), 'completed');

  IF NOT p_player_b_is_bot THEN
    INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
    VALUES (p_player_b, -p_stake_sp, 'match_entry', v_b_balance - p_stake_sp, format('Match stake debit match:%s', v_match_id), 'completed');
  END IF;

  RETURN jsonb_build_object(
    'match_id', v_match_id,
    'stake_sp', p_stake_sp,
    'player_a_balance_after', v_a_balance - p_stake_sp,
    'player_b_balance_after', CASE WHEN p_player_b_is_bot THEN NULL ELSE v_b_balance - p_stake_sp END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_match(text, uuid, uuid, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_match(text, uuid, uuid, integer, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_caller_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_stake integer;
  v_payout integer;
  v_caller_balance numeric := 0;
  v_winner_is_bot boolean := false;
  v_result text;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_FOUND'; END IF;

  IF v_match.status = 'completed' OR v_match.state = 'settled' THEN
    SELECT COALESCE(balance, 0) INTO v_caller_balance FROM public.wallets WHERE user_id = p_caller_id;
    RETURN jsonb_build_object('status', 'already_settled', 'match_id', p_match_id, 'winner_id', v_match.winner_id, 'winner_is_bot', false, 'caller_won', v_match.winner_id = p_caller_id, 'payout', 0, 'caller_balance', COALESCE(v_caller_balance, 0));
  END IF;

  v_stake := COALESCE(v_match.stake_sp, v_match.stake_amount, 0);
  v_payout := COALESCE(v_match.winner_payout, GREATEST(0, (v_stake * 2) - COALESCE(v_match.platform_fee, 0)));
  v_winner_is_bot := p_winner_id IS NULL;
  v_result := CASE
    WHEN p_winner_id IS NULL THEN 'draw'
    WHEN p_winner_id = COALESCE(v_match.player1_id, v_match.player_a) THEN 'player1_win'
    ELSE 'player2_win'
  END;

  IF p_winner_id IS NULL THEN
    IF COALESCE(v_match.player1_id, v_match.player_a) IS NOT NULL THEN
      UPDATE public.wallets SET balance = balance + v_stake, updated_at = now()
      WHERE user_id = COALESCE(v_match.player1_id, v_match.player_a);
      INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
      SELECT COALESCE(v_match.player1_id, v_match.player_a), v_stake, 'match_refund', balance, format('Draw refund match:%s', p_match_id), 'completed'
      FROM public.wallets WHERE user_id = COALESCE(v_match.player1_id, v_match.player_a);
    END IF;
    IF COALESCE(v_match.player2_id, v_match.player_b) IS NOT NULL THEN
      UPDATE public.wallets SET balance = balance + v_stake, updated_at = now()
      WHERE user_id = COALESCE(v_match.player2_id, v_match.player_b);
      INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
      SELECT COALESCE(v_match.player2_id, v_match.player_b), v_stake, 'match_refund', balance, format('Draw refund match:%s', p_match_id), 'completed'
      FROM public.wallets WHERE user_id = COALESCE(v_match.player2_id, v_match.player_b);
    END IF;
  ELSE
    UPDATE public.wallets SET balance = balance + v_payout, updated_at = now()
    WHERE user_id = p_winner_id;
    INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
    SELECT p_winner_id, v_payout, 'match_win', balance, format('Match payout match:%s', p_match_id), 'completed'
    FROM public.wallets WHERE user_id = p_winner_id;
  END IF;

  UPDATE public.matches
  SET status = 'completed',
      state = 'settled',
      winner_id = p_winner_id,
      result = v_result,
      completed_at = COALESCE(completed_at, now()),
      settled_at = COALESCE(settled_at, now())
  WHERE id = p_match_id;

  SELECT COALESCE(balance, 0) INTO v_caller_balance FROM public.wallets WHERE user_id = p_caller_id;

  RETURN jsonb_build_object(
    'status', 'settled',
    'match_id', p_match_id,
    'winner_id', p_winner_id,
    'winner_is_bot', v_winner_is_bot,
    'caller_won', p_winner_id = p_caller_id,
    'payout', CASE WHEN p_winner_id = p_caller_id THEN v_payout ELSE 0 END,
    'caller_balance', COALESCE(v_caller_balance, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finish_match(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_match(uuid, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public._qr_available_balance(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT GREATEST(
    0,
    COALESCE(w.balance, 0)::integer - COALESCE(p.balance_sp_held, 0)
  )
  FROM public.profiles p
  LEFT JOIN public.wallets w ON w.user_id = p.id
  WHERE p.id = p_user_id
$$;

CREATE OR REPLACE FUNCTION public._qr_start_match_from_negotiation(p_qr public.qr_matches)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
  v_opp_balance numeric;
  v_player2_username text;
BEGIN
  IF p_qr.opponent_user_id IS NOT NULL THEN
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (p_qr.opponent_user_id, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance INTO v_opp_balance FROM public.wallets WHERE user_id = p_qr.opponent_user_id FOR UPDATE;
    IF COALESCE(v_opp_balance, 0) < p_qr.stake_sk THEN
      RAISE EXCEPTION 'INSUFFICIENT_OPPONENT_BALANCE';
    END IF;
  END IF;

  UPDATE public.profiles
  SET balance_sp_held = GREATEST(0, balance_sp_held - p_qr.hold_sk)
  WHERE id = p_qr.host_user_id;

  UPDATE public.wallets
  SET balance = balance - p_qr.stake_sk,
      updated_at = now()
  WHERE user_id = p_qr.host_user_id;

  IF p_qr.opponent_user_id IS NOT NULL THEN
    UPDATE public.wallets
    SET balance = balance - p_qr.stake_sk,
        updated_at = now()
    WHERE user_id = p_qr.opponent_user_id;
  END IF;

  v_player2_username := COALESCE(p_qr.anonymous_display_name, p_qr.opponent_username, 'Anonymous Player');

  INSERT INTO public.matches (
    game_type, player1_id, player2_id, player1_username, player2_username,
    stake_amount, platform_fee, total_pot, winner_payout,
    status, state, qr_match_id, player_b_is_bot, created_at
  )
  VALUES (
    p_qr.game_type, p_qr.host_user_id, p_qr.opponent_user_id, p_qr.host_username, v_player2_username,
    p_qr.stake_sk, floor((p_qr.stake_sk * 2) * 0.05)::integer, p_qr.stake_sk * 2,
    (p_qr.stake_sk * 2) - floor((p_qr.stake_sk * 2) * 0.05)::integer,
    'in_progress', 'active', p_qr.id, p_qr.opponent_user_id IS NULL, now()
  )
  RETURNING id INTO v_match_id;

  INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
  SELECT p_qr.host_user_id, -p_qr.stake_sk, 'match_entry', balance, format('QR match stake debit match:%s', v_match_id), 'completed'
  FROM public.wallets
  WHERE user_id = p_qr.host_user_id;

  IF p_qr.opponent_user_id IS NOT NULL THEN
    INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
    SELECT p_qr.opponent_user_id, -p_qr.stake_sk, 'match_entry', balance, format('QR match stake debit match:%s', v_match_id), 'completed'
    FROM public.wallets
    WHERE user_id = p_qr.opponent_user_id;
  END IF;

  UPDATE public.qr_matches
  SET status = 'matched',
      accepted_stake_sk = p_qr.stake_sk,
      match_id = v_match_id,
      updated_at = now()
  WHERE id = p_qr.id;

  RETURN v_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_anonymous_payout(p_anonymous_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_payout public.anonymous_match_payouts%ROWTYPE;
  v_balance numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_payout
  FROM public.anonymous_match_payouts
  WHERE anonymous_session_token = p_anonymous_session_token
    AND claimed_by_user_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'NO_PENDING_PAYOUT'; END IF;

  INSERT INTO public.wallets (user_id, balance, updated_at)
  VALUES (v_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET balance = balance + v_payout.amount_sk,
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
  VALUES (v_user_id, v_payout.amount_sk, 'match_win', v_balance, format('Anonymous QR payout match:%s', v_payout.match_id), 'completed');

  UPDATE public.anonymous_match_payouts
  SET claimed_by_user_id = v_user_id,
      claimed_at = now()
  WHERE id = v_payout.id;

  RETURN jsonb_build_object('amount_sk', v_payout.amount_sk, 'balance_sk', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_anonymous_payout(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_payout(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_player_balance(
  p_user_id uuid,
  p_amount_sk integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;
  INSERT INTO public.wallets (user_id, balance, updated_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET balance = balance + p_amount_sk,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.transactions (user_id, amount, type, balance_after, description, status)
  VALUES (p_user_id, p_amount_sk, 'admin_adjustment', v_new_balance, COALESCE(p_reason, 'Admin balance adjustment'), 'completed');

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Drop placeholder economy storage.
DROP TABLE IF EXISTS public.sp_transactions CASCADE;
DROP TABLE IF EXISTS public.player_inventory CASCADE;
DROP TABLE IF EXISTS public.active_multipliers CASCADE;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS lifetime_sp,
  DROP COLUMN IF EXISTS balance_sp,
  DROP COLUMN IF EXISTS rank_tier,
  DROP COLUMN IF EXISTS matches_since_last_crate,
  DROP COLUMN IF EXISTS free_crates_available;

-- Glicko is intentionally preserved: public.player_ratings and public.profiles.skillflow_score remain in place.
