-- Responsible gaming: deposit limits, cool-off, self-exclusion
-- Run in Supabase SQL Editor if not using migrations.

CREATE TABLE IF NOT EXISTS responsible_gaming (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  daily_deposit_limit NUMERIC DEFAULT NULL,
  weekly_deposit_limit NUMERIC DEFAULT NULL,
  monthly_deposit_limit NUMERIC DEFAULT NULL,
  daily_deposited NUMERIC DEFAULT 0,
  weekly_deposited NUMERIC DEFAULT 0,
  monthly_deposited NUMERIC DEFAULT 0,
  daily_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  weekly_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  monthly_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  self_excluded BOOLEAN DEFAULT false,
  self_exclusion_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  self_exclusion_type TEXT DEFAULT NULL,
  cool_off_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE responsible_gaming DISABLE ROW LEVEL SECURITY;

-- Pending limit changes (24h for increase, 72h for remove)
CREATE TABLE IF NOT EXISTS pending_limit_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  limit_type TEXT NOT NULL CHECK (limit_type IN ('daily', 'weekly', 'monthly')),
  new_value NUMERIC DEFAULT NULL,
  effective_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, limit_type)
);

ALTER TABLE pending_limit_changes DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_responsible_gaming_user_id ON responsible_gaming(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_limit_changes_user_effective ON pending_limit_changes(user_id, effective_at);
