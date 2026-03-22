-- Allow authenticated room participants (players) and the host to read room metadata
-- regardless of the current room.status (waiting/in_progress/ended).
--
-- Without this, RoomComponent can’t fetch `game_rooms.id/host_id/status` once the host
-- starts the game (status != 'waiting'), resulting in HTTP 406/empty state.

-- Idempotent: policy may already exist if you ran this SQL manually in the Dashboard.
drop policy if exists "game_rooms_select_player_or_host_any_status" on public.game_rooms;

create policy "game_rooms_select_player_or_host_any_status" on public.game_rooms
for select to authenticated
using (public.is_room_player(id) or host_id = auth.uid());

