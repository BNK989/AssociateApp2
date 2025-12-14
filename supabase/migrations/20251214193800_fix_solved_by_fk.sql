-- Fix missing FK constraint for messages.solved_by
-- Error caught: update or delete on table "users" violates foreign key constraint "messages_solved_by_fkey" on table "messages"

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_solved_by_fkey;

ALTER TABLE public.messages
ADD CONSTRAINT messages_solved_by_fkey 
FOREIGN KEY (solved_by) REFERENCES auth.users(id) 
ON DELETE SET NULL;
