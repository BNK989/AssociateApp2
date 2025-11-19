-- Drop existing invites table to recreate with correct schema
DROP TABLE IF EXISTS public.invites;

-- Create invites table with sender_id
CREATE TABLE public.invites (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  game_id uuid REFERENCES public.games NOT NULL,
  sender_id uuid REFERENCES public.profiles NOT NULL,
  receiver_id uuid REFERENCES public.profiles NOT NULL,
  status text CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Policies
-- Receivers can view their invites
CREATE POLICY "Receivers can view their invites" ON public.invites
  FOR SELECT USING (auth.uid() = receiver_id);

-- Senders can view invites they sent
CREATE POLICY "Senders can view invites they sent" ON public.invites
  FOR SELECT USING (auth.uid() = sender_id);

-- Authenticated users can create invites
CREATE POLICY "Users can create invites" ON public.invites
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Receivers can update status (accept/decline)
CREATE POLICY "Receivers can update status" ON public.invites
  FOR UPDATE USING (auth.uid() = receiver_id);
