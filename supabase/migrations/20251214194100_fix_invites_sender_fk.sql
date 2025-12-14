-- Fix missing FK constraint for invites.sender_id
-- Error caught: update or delete on table "profiles" violates foreign key constraint "invites_sender_id_fkey" on table "invites"

ALTER TABLE public.invites
DROP CONSTRAINT IF EXISTS invites_sender_id_fkey;

-- If a sender is deleted, delete their sent invites.
ALTER TABLE public.invites
ADD CONSTRAINT invites_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;
