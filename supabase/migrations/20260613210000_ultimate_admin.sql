-- Ultimate admin panel: operational tables

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('player', 'creator', 'game')),
  target_id text NOT NULL,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_target ON public.admin_notes(target_type, target_id);

CREATE TABLE IF NOT EXISTS public.admin_balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_sk integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_balance_adjustments_user ON public.admin_balance_adjustments(user_id);

CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved')),
  resolution text,
  resolution_note text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_match ON public.disputes(match_id);

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  cta_text text,
  cta_url text,
  channels text[] NOT NULL DEFAULT '{}',
  delivered_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.platform_settings_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  player_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  reaction_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_events_match ON public.match_events(match_id, created_at);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip text,
  device text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.player_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip text,
  device text,
  browser text,
  country text,
  session_duration_sec integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_sessions_user ON public.player_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cheat_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}',
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cheat_flags_player ON public.cheat_flags(player_id);
CREATE INDEX IF NOT EXISTS idx_cheat_flags_reviewed ON public.cheat_flags(reviewed) WHERE NOT reviewed;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  cta_text text,
  cta_url text,
  read_at timestamptz,
  broadcast_id uuid REFERENCES public.broadcasts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.creator_api_key_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL REFERENCES public.creator_games(game_id) ON DELETE CASCADE,
  rotated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_last4 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspicious boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Seed platform settings
-- ---------------------------------------------------------------------------

INSERT INTO public.platform_settings (key, value) VALUES
  ('min_deposit_usd', '5'),
  ('min_withdrawal_usd', '10'),
  ('max_entry_sk', '50000'),
  ('default_creator_share', '20'),
  ('match_timeout_minutes', '10'),
  ('auto_void_minutes', '10'),
  ('maintenance_mode', 'false'),
  ('fixed_costs_usd', '0')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS: service role only (no anon/authenticated policies)
-- ---------------------------------------------------------------------------

ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_balance_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheat_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_api_key_rotations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_notes FROM anon, authenticated;
REVOKE ALL ON public.admin_balance_adjustments FROM anon, authenticated;
REVOKE ALL ON public.disputes FROM anon, authenticated;
REVOKE ALL ON public.broadcasts FROM anon, authenticated;
REVOKE ALL ON public.platform_settings FROM anon, authenticated;
REVOKE ALL ON public.platform_settings_log FROM anon, authenticated;
REVOKE ALL ON public.match_events FROM anon, authenticated;
REVOKE ALL ON public.admin_sessions FROM anon, authenticated;
REVOKE ALL ON public.player_sessions FROM anon, authenticated;
REVOKE ALL ON public.cheat_flags FROM anon, authenticated;
REVOKE ALL ON public.notifications FROM anon, authenticated;
REVOKE ALL ON public.creator_api_key_rotations FROM anon, authenticated;

GRANT ALL ON public.admin_notes TO service_role;
GRANT ALL ON public.admin_balance_adjustments TO service_role;
GRANT ALL ON public.disputes TO service_role;
GRANT ALL ON public.broadcasts TO service_role;
GRANT ALL ON public.platform_settings TO service_role;
GRANT ALL ON public.platform_settings_log TO service_role;
GRANT ALL ON public.match_events TO service_role;
GRANT ALL ON public.admin_sessions TO service_role;
GRANT ALL ON public.player_sessions TO service_role;
GRANT ALL ON public.cheat_flags TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.creator_api_key_rotations TO service_role;

-- ---------------------------------------------------------------------------
-- Balance adjustment RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_admin_id uuid,
  p_user_id uuid,
  p_amount_sk integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Reason required (min 3 chars)';
  END IF;

  UPDATE public.profiles
  SET balance_sp = balance_sp + p_amount_sk
  WHERE id = p_user_id
  RETURNING balance_sp INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.admin_balance_adjustments (admin_id, user_id, amount_sk, reason)
  VALUES (p_admin_id, p_user_id, p_amount_sk, trim(p_reason));

  INSERT INTO public.sp_transactions (user_id, amount, type, description)
  VALUES (
    p_user_id,
    p_amount_sk,
    'admin_adjustment',
    format('Admin adjustment: %s', trim(p_reason))
  );

  RETURN jsonb_build_object('new_balance_sk', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_balance(uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, uuid, integer, text) TO service_role;
