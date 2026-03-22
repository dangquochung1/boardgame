import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { getSupabaseClient } from '../supabase/supabase-client';
import { SupabaseService } from '../supabase/supabase.service';

function generateRoomCode(len = 6): string {
  // Simple code: uppercase letters + digits.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

@Component({
  standalone: true,
  selector: 'app-host-lobby',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 gap-4">
      <h1 class="text-3xl font-bold text-amber-500">Tokaido - Host</h1>

      <div class="w-full max-w-md bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <label class="text-sm text-slate-300">Room code</label>
        <input
          class="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100"
          [(ngModel)]="roomCode"
          placeholder="(auto)"
        />

        <button
          class="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 disabled:opacity-50"
          [disabled]="isCreating"
          (click)="createRoom()"
        >
          {{ isCreating ? 'Creating...' : 'Create room' }}
        </button>

        <div *ngIf="error" class="text-red-300 text-sm whitespace-pre-wrap">
          {{ error }}
        </div>
      </div>
    </div>
  `
})
export class HostLobbyComponent {
  private readonly router = inject(Router);
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = getSupabaseClient();

  roomCode = '';
  isCreating = false;
  error: string | null = null;

  async createRoom() {
    this.error = null;
    this.isCreating = true;
    try {
      const userId = await this.supabaseService.getUserId();
      const customCode = this.roomCode.trim();

      let roomRow: { id: string; room_code: string } | null = null;
      let lastErr: any = null;

      // Retry up to 5 times if there's a code collision (409 unique conflict).
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = customCode || generateRoomCode();
        const { data, error: roomErr } = await this.supabase
          .from('game_rooms')
          .insert({
            room_code: code,
            host_id: userId,
            status: 'waiting',
            max_players: 99
          })
          .select('id,room_code')
          .single();

        if (!roomErr) {
          roomRow = data;
          break;
        }

        // 23505 = unique_violation (room_code collision) → only retry if auto-generated
        const isCollision = (roomErr as any)?.code === '23505';
        if (isCollision && !customCode) {
          lastErr = roomErr;
          continue;
        }
        throw roomErr;
      }

      if (!roomRow) throw lastErr ?? new Error('Room not created after retries.');


      const roomId: string = roomRow.id;

      // Host joins the room as player 1.
      const { error: playerErr } = await this.supabase.from('game_room_players').insert({
        room_id: roomId,
        player_id: userId,
        display_name: 'Host',
        character_id: null,
        character_price: null,
        coins: 0,
        score: 0
      });
      if (playerErr) throw playerErr;

      // Initial room state for MVP.
      const initialState = {
        phase: 'character_pick',
        createdBy: userId,
        board: {
          // Gameplay engine will populate this later.
          lines: [[], [], [], []],
          players: {}
        },
        innQueues: [[], [], [], [], []],
        version: 1
      };

      const { error: stateErr } = await this.supabase.from('game_room_state').insert({
        room_id: roomId,
        version: 1,
        state: initialState
      });
      if (stateErr) throw stateErr;

      await this.router.navigate(['/room', roomRow.room_code]);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.isCreating = false;
    }
  }
}

