import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { getSupabaseClient } from '../supabase/supabase-client';
import { SupabaseService } from '../supabase/supabase.service';

@Component({
  standalone: true,
  selector: 'app-join-lobby',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 gap-4">
      <h1 class="text-3xl font-bold text-amber-500">Tokaido - Join</h1>

      <div class="w-full max-w-md bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <label class="text-sm text-slate-300">Room code</label>
        <input
          class="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100"
          [(ngModel)]="roomCode"
          placeholder="Enter code from host"
        />

        <label class="text-sm text-slate-300">Display name</label>
        <input
          class="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100"
          [(ngModel)]="displayName"
          placeholder="Your name"
        />

        <button
          class="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 disabled:opacity-50"
          [disabled]="isJoining"
          (click)="joinRoom()"
        >
          {{ isJoining ? 'Joining...' : 'Join room' }}
        </button>

        <div *ngIf="error" class="text-red-300 text-sm whitespace-pre-wrap">
          {{ error }}
        </div>
      </div>
    </div>
  `
})
export class JoinLobbyComponent {
  private readonly router = inject(Router);
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = getSupabaseClient();

  roomCode = '';
  displayName = '';
  isJoining = false;
  error: string | null = null;

  async joinRoom() {
    this.error = null;
    this.isJoining = true;
    try {
      const userId = await this.supabaseService.getUserId();

      const code = this.roomCode.trim().toUpperCase();
      if (!code) throw new Error('Room code is required.');

      // Use maybeSingle() so "no rows" doesn't surface as HTTP 406.
      const { data: roomRow, error: roomErr } = await this.supabase
        .from('game_rooms')
        .select('id,room_code,status')
        .eq('room_code', code)
        .maybeSingle();
      if (roomErr) throw roomErr;
      if (!roomRow) throw new Error('Room not found.');

      if (roomRow.status !== 'waiting') {
        throw new Error('Room is not accepting new players.');
      }

      const name = (this.displayName.trim() || 'Player').slice(0, 40);

      const { error: joinErr } = await this.supabase.from('game_room_players').insert({
        room_id: roomRow.id,
        player_id: userId,
        display_name: name,
        character_id: null,
        character_price: null,
        coins: 0,
        score: 0
      });

      if (joinErr) throw joinErr;

      await this.router.navigate(['/room', code]);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.isJoining = false;
    }
  }
}

