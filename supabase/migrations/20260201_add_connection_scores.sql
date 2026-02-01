
alter table "daily_games" 
add column if not exists "connection_scores" jsonb;
