-- Fix game_players RLS
DROP POLICY IF EXISTS "Game players viewable by everyone." ON public.game_players;
CREATE POLICY "Allow public select game_players" ON public.game_players FOR SELECT USING (true);

-- Fix profiles RLS
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Allow public select profiles" ON public.profiles FOR SELECT USING (true);

-- Fix messages RLS (just in case)
DROP POLICY IF EXISTS "Messages viewable by everyone." ON public.messages;
CREATE POLICY "Allow public select messages" ON public.messages FOR SELECT USING (true);

-- Ensure authenticated users can insert messages
DROP POLICY IF EXISTS "Players can insert messages." ON public.messages;
CREATE POLICY "Allow authenticated insert messages" ON public.messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
