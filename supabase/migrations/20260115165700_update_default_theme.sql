ALTER TABLE public.profiles 
ALTER COLUMN settings 
SET DEFAULT '{"theme": "system", "language": "en", "audio_volume": 1.0}'::jsonb;
