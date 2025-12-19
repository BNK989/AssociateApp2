-- Fix the check constraint on games.status to include 'archived'
-- The previous migration only updated the ENUM type (if it existed), but the table uses a text column with a check constraint.

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;

ALTER TABLE games 
ADD CONSTRAINT games_status_check 
CHECK (status = ANY (ARRAY['lobby'::text, 'texting'::text, 'active'::text, 'solving'::text, 'completed'::text, 'archived'::text]));
