import { Routes } from '@angular/router';
import { GamePreviewComponent } from './features/demo/game-preview.component';
import { HostLobbyComponent } from './features/lobby/host-lobby.component';
import { JoinLobbyComponent } from './features/lobby/join-lobby.component';
import { RoomComponent } from './features/room/room.component';

export const routes: Routes = [
  { path: '', component: GamePreviewComponent },
  { path: 'play', component: GamePreviewComponent },
  { path: 'host', component: HostLobbyComponent },
  { path: 'join', component: JoinLobbyComponent },
  { path: 'room/:roomCode', component: RoomComponent }
];
