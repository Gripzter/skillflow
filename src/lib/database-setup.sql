-- =============================================
-- SKILLFLOW DATABASE SETUP
-- =============================================
--
-- Run this ENTIRE script in Supabase SQL Editor before using
-- real user accounts. (Dashboard → SQL Editor → New Query → Paste → Run)
--
-- Dev mode (localStorage) will continue to work without this.
-- This script creates: profiles, wallets, transactions, matches,
-- game_stats, user_achievements, RLS policies, triggers, and indexes.
--
-- If you already have a matches table, add practice bot difficulty:
--   ALTER TABLE matches ADD COLUMN IF NOT EXISTS bot_difficulty TEXT DEFAULT 'gamer';
-- =============================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  date_of_birth DATE,
  age_verified BOOLEAN DEFAULT false,
  age_verified_at TIMESTAMP WITH TIME ZONE,
  avatar_url TEXT,
  avatar_color TEXT DEFAULT '#7C5CFC',
  skill_rating INTEGER DEFAULT 1000,
  total_matches INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_draws INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  win_streak INTEGER DEFAULT 0,
  best_win_streak INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. WALLETS TABLE
CREATE TABLE IF NOT EXISTS wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0.00 CHECK (balance >= 0),
  total_deposited DECIMAL(10,2) DEFAULT 0.00,
  total_withdrawn DECIMAL(10,2) DEFAULT 0.00,
  total_wagered DECIMAL(10,2) DEFAULT 0.00,
  total_won DECIMAL(10,2) DEFAULT 0.00,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'match_entry', 'match_win', 'match_refund', 'platform_fee')),
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_type TEXT NOT NULL,
  player1_id UUID REFERENCES auth.users(id) NOT NULL,
  player2_id UUID REFERENCES auth.users(id),
  player1_username TEXT,
  player2_username TEXT,
  player1_rating INTEGER,
  player2_rating INTEGER,
  stake_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0.00,
  total_pot DECIMAL(10,2) DEFAULT 0.00,
  winner_payout DECIMAL(10,2) DEFAULT 0.00,
  winner_id UUID REFERENCES auth.users(id),
  result TEXT CHECK (result IN ('player1_win', 'player2_win', 'draw', NULL)),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'in_progress', 'completed', 'cancelled', 'draw')),
  match_duration INTEGER,
  bot_difficulty TEXT DEFAULT 'gamer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. GAME STATS TABLE (per-game statistics for each player)
CREATE TABLE IF NOT EXISTS game_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_type TEXT NOT NULL,
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  highest_stake_won DECIMAL(10,2) DEFAULT 0.00,
  skill_rating INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, game_type)
);

-- 6. ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_key)
);

-- 7. Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES

-- Profiles: anyone can read, only own user can update
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Wallets: only own user can read and update
CREATE POLICY "Users can view own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can create own wallet" ON wallets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions: only own user can read
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Matches: anyone can read (for leaderboard/spectating), participants can update
CREATE POLICY "Matches are viewable by everyone" ON matches FOR SELECT USING (true);
CREATE POLICY "Users can create matches" ON matches FOR INSERT WITH CHECK (auth.uid() = player1_id);
CREATE POLICY "Participants can update matches" ON matches FOR UPDATE USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Game stats: anyone can read, own user can update
CREATE POLICY "Game stats viewable by everyone" ON game_stats FOR SELECT USING (true);
CREATE POLICY "Users can manage own game stats" ON game_stats FOR ALL USING (auth.uid() = user_id);

-- Achievements: anyone can read, own user can insert
CREATE POLICY "Achievements viewable by everyone" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "Users can unlock achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 9. FUNCTIONS

-- Auto-create profile and wallet when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, date_of_birth)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player_' || LEFT(NEW.id::text, 8)),
    (NEW.raw_user_meta_data->>'date_of_birth')::date
  );

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: run after new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_player1_id ON matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2_id ON matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_game_type ON matches(game_type);
CREATE INDEX IF NOT EXISTS idx_game_stats_user_id ON game_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_skill_rating ON profiles(skill_rating DESC);
