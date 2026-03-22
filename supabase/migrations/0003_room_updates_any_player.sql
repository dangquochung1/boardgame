-- Dev / solo UX: any authenticated player in the room can update room + state
-- (e.g. "Start game" from a joiner tab). Host-only updates were too restrictive for testing UI.

drop policy if exists "game_rooms_update_any_player" on public.game_rooms;

create policy "game_rooms_update_any_player" on public.game_rooms
for update to authenticated
using (public.is_room_player(id));

drop policy if exists "game_room_state_update_host" on public.game_room_state;
drop policy if exists "game_room_state_update_any_player" on public.game_room_state;

create policy "game_room_state_update_any_player" on public.game_room_state
for update to authenticated
using (public.is_room_player(room_id));
