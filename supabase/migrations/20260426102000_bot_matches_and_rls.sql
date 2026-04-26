-- Bot match compatibility: allow null opponent and mark bot rows explicitly.
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player2_id_fkey;
ALTER TABLE public.matches ALTER COLUMN player2_id DROP NOT NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS is_bot boolean DEFAULT false;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS bot_name text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS bot_difficulty text;

-- Ensure authenticated users can insert matches under RLS.
DROP POLICY IF EXISTS "Users can create matches" ON public.matches;
CREATE POLICY "Users can create matches"
ON public.matches
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
