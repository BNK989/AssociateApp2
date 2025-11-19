-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text,
  avatar_url text,
  settings jsonb default '{"theme": "dark", "language": "en", "audio_volume": 1.0}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. GAMES
create table public.games (
  id uuid default uuid_generate_v4() primary key,
  status text check (status in ('lobby', 'active', 'solving', 'completed')) default 'lobby',
  mode text check (mode in ('free', '100_text')) default 'free',
  current_turn_user_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. GAME_PLAYERS
create table public.game_players (
  game_id uuid references public.games not null,
  user_id uuid references auth.users not null,
  score int default 0,
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (game_id, user_id)
);

-- 4. MESSAGES
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  game_id uuid references public.games not null,
  user_id uuid references auth.users not null,
  content text, -- Raw content for now
  cipher_length int,
  is_solved boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. INVITES
create table public.invites (
  id uuid default uuid_generate_v4() primary key,
  game_id uuid references public.games not null,
  receiver_id uuid references auth.users not null,
  status text check (status in ('pending', 'accepted')) default 'pending'
);

-- RLS POLICIES (Basic setup - allow all for now to get started, refine later)
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

alter table public.games enable row level security;
create policy "Games are viewable by everyone." on public.games for select using (true);
create policy "Authenticated users can create games." on public.games for insert with check (auth.role() = 'authenticated');
create policy "Players can update games they are in." on public.games for update using (auth.role() = 'authenticated'); -- Simplified

alter table public.game_players enable row level security;
create policy "Game players viewable by everyone." on public.game_players for select using (true);
create policy "Authenticated users can join games." on public.game_players for insert with check (auth.role() = 'authenticated');
create policy "Players can update their own score." on public.game_players for update using (auth.uid() = user_id);

alter table public.messages enable row level security;
create policy "Messages viewable by everyone." on public.messages for select using (true);
create policy "Players can insert messages." on public.messages for insert with check (auth.role() = 'authenticated');
create policy "Players can update messages (solve)." on public.messages for update using (auth.role() = 'authenticated');

alter table public.invites enable row level security;
create policy "Invites viewable by receiver." on public.invites for select using (auth.uid() = receiver_id);
create policy "Users can create invites." on public.invites for insert with check (auth.role() = 'authenticated');

-- FUNCTIONS & TRIGGERS
-- Handle new user signup -> create profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
