-- Stripe and withdrawal support for transactions
-- Run this in Supabase SQL Editor if columns don't exist

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS withdrawal_details TEXT;

-- Prevent double-crediting the same Stripe payment
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_stripe_payment_id
  ON transactions(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;
