-- Check if tables are in the publication
select * from pg_publication_tables where pubname = 'supabase_realtime';
