-- Fix the api_usage foreign key to cascade on delete
-- This allows delete_expired_guests() to successfully remove users who have api usage records

ALTER TABLE public.api_usage
DROP CONSTRAINT IF EXISTS api_usage_user_id_fkey;

ALTER TABLE public.api_usage
ADD CONSTRAINT api_usage_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
