-- SkillFlow Database Schema (run in Supabase SQL Editor)
-- Reference only — run manually in your Supabase project

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  date_of_birth DATE,
  avatar_url TEXT,
  skill_rating INTEGER DEFAULT 1000,
  total_matches INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets table
CREATE TABLE wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0.00,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'match_entry', 'match_win', 'match_refund', 'platform_fee')),
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches table (we'll need this soon)
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_type TEXT NOT NULL,
  player1_id UUID REFERENCES auth.users(id) NOT NULL,
  player2_id UUID REFERENCES auth.users(id),
  stake_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0.00,
  winner_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'in_progress', 'completed', 'cancelled', 'disputed')),
  match_start_time TIMESTAMP WITH TIME ZONE,
  time_limit_ms INTEGER,
  player1_remaining_time_ms INTEGER,
  player2_remaining_time_ms INTEGER,
  active_turn TEXT CHECK (active_turn IN ('player1', 'player2', NULL)),
  turn_started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);
