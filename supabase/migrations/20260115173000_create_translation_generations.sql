-- Create a table to track translation generation events
CREATE TABLE IF NOT EXISTS public.translation_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES public.daily_games(id) ON DELETE CASCADE,
    locale TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Optional: add who generated it (admin vs user) if we had that context, but mostly anon
    meta JSONB DEFAULT '{}'::jsonb
);

-- Index for fast lookup by game and locale
CREATE INDEX IF NOT EXISTS idx_translation_generations_game_locale ON public.translation_generations(game_id, locale);

-- Enable RLS
ALTER TABLE public.translation_generations ENABLE ROW LEVEL SECURITY;

-- Allow service role (server-side) full access
-- Allow specific users read access if needed
CREATE POLICY "Allow public read access" ON public.translation_generations FOR SELECT USING (true);
