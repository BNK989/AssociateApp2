-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Players can update games they are in." ON public.games;

-- Create a permissive policy for updates for authenticated users
CREATE POLICY "Allow authenticated update games" ON public.games
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
