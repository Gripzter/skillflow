-- Age verification and geo compliance
-- Run in Supabase SQL Editor if not using migrations.

-- Profiles: age verification fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMP WITH TIME ZONE;

-- Geo check log for compliance
CREATE TABLE IF NOT EXISTS geo_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  country TEXT,
  state TEXT,
  city TEXT,
  is_restricted BOOLEAN,
  ip_address TEXT,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE geo_checks ENABLE ROW LEVEL SECURITY;

-- Only allow insert for own user or service role; allow read for own user
CREATE POLICY "Users can insert own geo_checks" ON geo_checks FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can read own geo_checks" ON geo_checks FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_geo_checks_user_id ON geo_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_geo_checks_checked_at ON geo_checks(checked_at DESC);
