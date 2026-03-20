import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { getSupabaseClient } from '../supabase/supabase-client';
import { SupabaseService } from '../supabase/supabase.service';
import { GameEngineError, GameEngineService, type GameRuntimeState } from '../game/game-engine.service';

@Component({
  standalone: true,
  selector: 'app-room',
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div class="max-w-4xl mx-auto flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <h1 class="text-2xl font-bold text-amber-500">Room: {{ roomCode }}</h1>
            <div class="text-sm text-slate-300">
              Status: {{ roomStatus }} • Phase: {{ phase }}
            </div>
          </div>
          <div class="text-sm text-slate-400">
            You are: {{ isHost ? 'Host' : 'Player' }}
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-4">
          <h2 class="text-lg font-semibold mb-3">Players</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div
              *ngFor="let p of runtimePlayersView()"
              class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex flex-col gap-1"
            >
              <div class="font-semibold">{{ p.display_name }}</div>
              <div class="text-xs text-slate-300">
                coins: {{ p.coins }} • score: {{ p.score }}
              </div>
            </div>
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <h2 class="text-lg font-semibold">Room state (debug)</h2>
          <pre class="text-xs overflow-auto max-h-64 bg-slate-900 border border-slate-700 rounded-lg p-3">{{
            state | json
          }}</pre>

          <div *ngIf="phase === 'turns'" class="mt-2 flex flex-col gap-3">
            <div class="text-sm text-slate-300">
              Expected player: {{ state?.expectedPlayerId }} • Your runtime cell:
              {{ state?.players?.[myUserId]?.cellPos ?? '-' }}
            </div>

            <div *ngIf="state?.expectedPlayerId === myUserId" class="flex flex-col gap-2">
              <h3 class="text-base font-semibold text-amber-500">Chọn số bước</h3>
              <div class="flex flex-wrap gap-2">
                <button
                  *ngFor="let s of getAvailableSteps()"
                  class="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-3 py-2 disabled:opacity-50"
                  (click)="chooseSteps(s)"
                >
                  {{ s }}
                </button>
              </div>
            </div>

            <div *ngIf="state?.expectedPlayerId !== myUserId" class="text-sm text-slate-400">
              Chờ người khác chọn bước...
            </div>
          </div>

          <div *ngIf="phase === 'inn_pick'" class="mt-2 flex flex-col gap-3">
            <div class="text-sm text-slate-300">
              Inn pick: Inn {{ innIndexLabel() }} •
              Expected player: {{ state?.expectedPlayerId }} •
              Pick: {{ innPickIndexLabel() }} / {{ innPickTotalLabel() }}
            </div>

            <div *ngIf="state?.expectedPlayerId === myUserId" class="flex flex-col gap-3">
              <div class="text-sm text-slate-300">
                Your runtime coins: {{ state?.players?.[myUserId]?.coins ?? '-' }} •
                Your owned foods: {{ state?.players?.[myUserId]?.foods?.join(', ') ?? '-' }}
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  *ngFor="let card of state?.innSelection?.cards ?? []"
                  class="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-3 py-2 disabled:opacity-50"
                  [disabled]="
                    (state?.players?.[myUserId]?.foods?.includes(card.foodTypeId) ?? false) ||
                    (state?.innSelection?.pickIndex !== 0 &&
                      (state?.players?.[myUserId]?.coins ?? 0) < card.cost)
                  "
                  (click)="chooseInnCard(card.cardId)"
                >
                  {{ card.foodTypeId }} • {{ card.points }}đ • cost:
                  {{ state?.innSelection?.pickIndex === 0 ? '0 (free)' : card.cost }}
                </button>
              </div>

              <button
                class="rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold px-4 py-2 disabled:opacity-50 w-fit"
                (click)="chooseInnCard(null)"
              >
                Skip
              </button>
            </div>

            <div *ngIf="state?.expectedPlayerId !== myUserId" class="text-sm text-slate-400">
              Chờ người khác chọn thẻ...
            </div>
          </div>

          <button
            *ngIf="isHost"
            class="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 disabled:opacity-50 w-fit"
            [disabled]="isStarting"
            (click)="startGameStub()"
          >
            {{ isStarting ? 'Starting...' : 'Start game (stub)' }}
          </button>

          <div *ngIf="phase === 'ended'" class="mt-2">
            <h3 class="text-base font-semibold text-amber-500 mb-2">Ranking (debug)</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                *ngFor="let r of getRanking()"
                class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex flex-col"
              >
                <div class="text-sm font-semibold">
                  #{{ r.rank }} - {{ r.display_name }}
                </div>
                <div class="text-xs text-slate-300">score: {{ r.score }}</div>
              </div>
            </div>
          </div>

          <div *ngIf="error" class="text-red-300 text-sm whitespace-pre-wrap">
            {{ error }}
          </div>
        </div>
      </div>
    </div>
  `
})
export class RoomComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = getSupabaseClient();

  roomCode = '';
  roomId = '';
  roomStatus: string = 'unknown';
  isHost = false;
  isStarting = false;
  error: string | null = null;

  players: Array<{
    player_id: string;
    display_name: string;
    coins: number;
    score: number;
    character_price: number | null;
  }> = [];

  state: GameRuntimeState | null = null;
  phase: string = '';

  private realtimeChannel: any = null;
  myUserId = '';
  private actionQueue: Promise<void> = Promise.resolve();

  async ngOnInit() {
    this.error = null;

    const codeFromRoute = this.route.snapshot.paramMap.get('roomCode') ?? '';
    this.roomCode = codeFromRoute.toUpperCase();

    try {
      const userId = await this.supabaseService.getUserId();
      this.myUserId = userId;

      const { data: roomRow, error: roomErr } = await this.supabase
        .from('game_rooms')
        .select('id,host_id,status')
        .eq('room_code', this.roomCode)
        .single();
      if (roomErr) throw roomErr;
      if (!roomRow) throw new Error('Room not found.');

      this.roomId = roomRow.id;
      this.roomStatus = roomRow.status;
      this.isHost = roomRow.host_id === userId;

      await this.refreshState();
      await this.loadPlayers();
      this.setupRealtime();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  ngOnDestroy(): void {
    try {
      this.realtimeChannel?.unsubscribe();
    } catch {
      // ignore
    }
  }

  private async refreshState() {
    const { data, error } = await this.supabase
      .from('game_room_state')
      .select('state,version,updated_at')
      .eq('room_id', this.roomId)
      .single();
    if (error) throw error;
    if (!data) throw new Error('Room state missing.');

    this.state = (data.state ?? null) as GameRuntimeState | null;
    this.phase = String(this.state?.phase ?? '');
  }

  private async loadPlayers() {
    const { data, error } = await this.supabase
      .from('game_room_players')
      .select('player_id,display_name,coins,score,character_price')
      .eq('room_id', this.roomId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    this.players = (data ?? []).map((p: any) => ({
      player_id: p.player_id,
      display_name: p.display_name,
      coins: p.coins,
      score: p.score,
      character_price: p.character_price
    }));
  }

  constructor() {
    // keep TS happy
  }

  // Angular does not auto-wire GameEngineService via inject() if we use constructor,
  // so we use inject() pattern below.
  private readonly gameEngine = inject(GameEngineService);

  private setupRealtime() {
    // Subscribe to both room state and players list so the lobby updates live.
    this.realtimeChannel = this.supabase
      .channel(`room:${this.roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_room_state',
          filter: `room_id=eq.${this.roomId}`
        },
        async () => {
          try {
            await this.refreshState();
          } catch (e) {
            // ignore: RLS might block a brief window if player list changes.
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_room_players',
          filter: `room_id=eq.${this.roomId}`
        },
        async () => {
          try {
            await this.loadPlayers();
          } catch {
            // ignore
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_room_actions',
          filter: `room_id=eq.${this.roomId}`
        },
        async (payload: any) => {
          if (!this.isHost) return;
          const newRow = payload?.new;
          if (!newRow) return;
          if (newRow.processed_at) return;
          const actionId = newRow.id as string;

          // Serialize processing to reduce race conditions.
          this.actionQueue = this.actionQueue.then(() => this.processRoomAction(actionId)).catch(() => {});
        }
      )
      .subscribe();
  }

  private async fetchRuntimeState(): Promise<GameRuntimeState> {
    const { data, error } = await this.supabase
      .from('game_room_state')
      .select('state,version,updated_at')
      .eq('room_id', this.roomId)
      .single();
    if (error) throw error;
    if (!data?.state) throw new Error('Room state missing.');

    const runtime = data.state as GameRuntimeState;
    return runtime;
  }

  private async markActionProcessed(actionId: string) {
    await this.supabase.from('game_room_actions').update({ processed_at: new Date().toISOString() }).eq('id', actionId);
  }

  private async processRoomAction(actionId: string) {
    try {
      const { data: action, error } = await this.supabase
        .from('game_room_actions')
        .select('id,requested_by,type,payload,processed_at')
        .eq('id', actionId)
        .single();
      if (error) throw error;
      if (!action) return;
      if (action.processed_at) return;

      if (action.type !== 'CHOOSE_STEPS') {
        if (action.type === 'CHOOSE_INN_CARD') {
          const runtimeState = await this.fetchRuntimeState();
          const rawCardId = action.payload?.cardId;
          const cardId = typeof rawCardId === 'string' ? rawCardId : null;
          const next = this.gameEngine.processChooseInnCard(runtimeState, action.requested_by, cardId);

          await this.supabase
            .from('game_room_state')
            .update({
              version: next.version,
              state: next
            })
            .eq('room_id', this.roomId);

          await this.markActionProcessed(actionId);
          return;
        }

        await this.markActionProcessed(actionId);
        return;
      }

      const runtimeState = await this.fetchRuntimeState();
      const steps = Number(action.payload?.steps);
      const next = this.gameEngine.processChooseSteps(runtimeState, action.requested_by, steps);

      // Persist updated state.
      await this.supabase.from('game_room_state').update({
        version: next.version,
        state: next
      }).eq('room_id', this.roomId);

      await this.markActionProcessed(actionId);
    } catch (e) {
      // Even if invalid, mark as processed to prevent infinite retries.
      try {
        await this.markActionProcessed(actionId);
      } catch {
        // ignore
      }
      if (e instanceof GameEngineError) {
        // ignore: invalid move
        return;
      }
      // Unexpected error
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  getAvailableSteps(): number[] {
    const me = this.state?.players?.[this.myUserId];
    if (!me || me.status !== 'inLine') return [];
    const cellPos = Number(me.cellPos ?? 0);
    const maxSteps = 14 - cellPos;
    if (!Number.isFinite(maxSteps) || maxSteps < 1) return [];

    return Array.from({ length: maxSteps }, (_, i) => i + 1);
  }

  runtimePlayersView(): Array<{
    player_id: string;
    display_name: string;
    coins: number;
    score: number;
  }> {
    if (!this.state) return this.players.map((p) => ({ ...p, coins: p.coins, score: p.score }));
    return Object.values(this.state.players).map((p) => ({
      player_id: p.playerId,
      display_name: p.displayName,
      coins: p.coins,
      score: p.score
    }));
  }

  getRanking(): Array<{ rank: number; playerId: string; display_name: string; score: number }> {
    if (!this.state || this.state.phase !== 'ended') return [];
    const endedOrder = this.state.endedOrder ?? [];
    const endedIndex = new Map<string, number>(endedOrder.map((pid, i) => [pid, i]));

    const rows = Object.values(this.state.players).map((p) => ({
      playerId: p.playerId,
      display_name: p.displayName,
      score: p.score
    }));

    rows.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score; // higher score wins
      const ai = endedIndex.get(a.playerId) ?? 99999;
      const bi = endedIndex.get(b.playerId) ?? 99999;
      return ai - bi;
    });

    return rows.map((r, i) => ({
      rank: i + 1,
      playerId: r.playerId,
      display_name: r.display_name,
      score: r.score
    }));
  }

  innIndexLabel(): string {
    const idx = this.state?.innSelection?.innIndex;
    if (idx == null) return '-';
    return String(idx + 1);
  }

  innPickIndexLabel(): string {
    const idx = this.state?.innSelection?.pickIndex;
    if (idx == null) return '-';
    return String(idx + 1);
  }

  innPickTotalLabel(): number {
    return this.state?.innSelection?.arrivalOrder?.length ?? 5;
  }

  async chooseSteps(steps: number) {
    this.error = null;
    try {
      const action = {
        room_id: this.roomId,
        requested_by: this.myUserId,
        type: 'CHOOSE_STEPS',
        payload: { steps }
      };

      const { error } = await this.supabase.from('game_room_actions').insert(action as any);
      if (error) throw error;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  async chooseInnCard(cardId: string | null) {
    this.error = null;
    try {
      const action = {
        room_id: this.roomId,
        requested_by: this.myUserId,
        type: 'CHOOSE_INN_CARD',
        payload: { cardId }
      };

      const { error } = await this.supabase.from('game_room_actions').insert(action as any);
      if (error) throw error;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  async startGameStub() {
    this.error = null;
    this.isStarting = true;
    try {
      if (this.players.length < 1) {
        throw new Error('Need at least 1 player to start this MVP.');
      }

      const initial = this.gameEngine.initializeTurnsState({
        players: this.players.map((p) => ({
          player_id: p.player_id,
          display_name: p.display_name,
          coins: p.coins,
          score: p.score,
          character_price: p.character_price
        }))
      });

      const { error: roomErr } = await this.supabase
        .from('game_rooms')
        .update({ status: 'in_progress' })
        .eq('id', this.roomId);
      if (roomErr) throw roomErr;

      const { error: stateErr } = await this.supabase.from('game_room_state').update({
        version: initial.version,
        state: initial
      });
      if (stateErr) throw stateErr;
      await this.refreshState();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.isStarting = false;
    }
  }
}

