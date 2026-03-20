-- 1. Extensions
create extension if not exists pgcrypto;

-- 2. Clean up (Optional but safe)
drop table if exists public.game_room_actions cascade;
drop table if exists public.game_room_state cascade;
drop table if exists public.game_room_players cascade;
drop table if exists public.game_rooms cascade;

-- 3. Create Tables First
create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  host_id uuid not null,
  status text not null check (status in ('waiting', 'in_progress', 'ended')),
  max_players integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  player_id uuid not null,
  display_name text not null,
  character_id text,
  character_price integer,
  coins integer not null default 0,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  unique(room_id, player_id)
);

create table public.game_room_state (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  version integer not null default 1,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.game_room_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  requested_by uuid not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- 4. Create Functions (Now that tables exist)
create or replace function public.room_player_count(room_id uuid)
returns integer language sql stable as $$
  select count(*)::integer from public.game_room_players where room_id = $1;
$$;

create or replace function public.is_room_player(room_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.game_room_players 
    where room_id = $1 and player_id = auth.uid()
  );
$$;

create or replace function public.is_room_host(room_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.game_rooms 
    where id = $1 and host_id = auth.uid()
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 5. Triggers
create trigger game_rooms_set_updated_at before update on public.game_rooms
for each row execute function public.set_updated_at();

create trigger game_room_state_set_updated_at before update on public.game_room_state
for each row execute function public.set_updated_at();

-- 6. RLS (Row Level Security)
alter table public.game_rooms enable row level security;
alter table public.game_room_players enable row level security;
alter table public.game_room_state enable row level security;
alter table public.game_room_actions enable row level security;

-- Policies for game_rooms
create policy "game_rooms_insert_host" on public.game_rooms for insert to authenticated with check (host_id = auth.uid());
create policy "game_rooms_select_waiting" on public.game_rooms for select to authenticated using (status = 'waiting');
create policy "game_rooms_update_host" on public.game_rooms for update to authenticated using (host_id = auth.uid());

-- Policies for game_room_players
create policy "game_room_players_insert_join" on public.game_room_players for insert to authenticated 
with check (
  player_id = auth.uid() 
  and exists (select 1 from public.game_rooms where id = room_id and status = 'waiting')
  and public.room_player_count(room_id) < (select max_players from public.game_rooms where id = room_id)
);
create policy "game_room_players_select_in_room" on public.game_room_players for select to authenticated using (public.is_room_player(room_id));
create policy "game_room_players_update_self" on public.game_room_players for update to authenticated using (player_id = auth.uid());

-- Policies for game_room_state
create policy "game_room_state_select_in_room" on public.game_room_state for select to authenticated using (public.is_room_player(room_id));
create policy "game_room_state_insert_host" on public.game_room_state for insert to authenticated with check (public.is_room_host(room_id));
create policy "game_room_state_update_host" on public.game_room_state for update to authenticated using (public.is_room_host(room_id));

-- Policies for game_room_actions
create policy "game_room_actions_insert_player" on public.game_room_actions for insert to authenticated with check (requested_by = auth.uid() and public.is_room_player(room_id));
create policy "game_room_actions_select_in_room" on public.game_room_actions for select to authenticated using (public.is_room_player(room_id));

-- 7. Indexes
create index if not exists idx_players_room_id on public.game_room_players(room_id);
create index if not exists idx_actions_room_id on public.game_room_actions(room_id, created_at);