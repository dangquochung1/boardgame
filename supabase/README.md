# Supabase setup (MVP for Tokaido-style game)

## 1) Create the tables

Using Supabase CLI (recommended):

```bash
supabase init
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

Put the SQL migration files under `supabase/migrations/` and ensure `0001_init.sql`
is included (this repo already contains it).

## 2) Configure the client keys

After creating a project and pushing migrations:
- `SUPABASE_URL`: from Dashboard -> API
- `SUPABASE_ANON_KEY`: from Dashboard -> API

These will be used by the Angular frontend to:
- create/join rooms
- subscribe to realtime `game_room_state`

## 3) Realtime behavior

Supabase Realtime listens to Postgres changes.
When `game_room_state` is updated by the host, clients subscribed to that room will receive updates.

