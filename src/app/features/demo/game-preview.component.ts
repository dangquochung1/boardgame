import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BoardMovePick, GameBoardUiComponent } from '../board/game-board-ui.component';
import { GameEngineError, GameEngineService, type GameRuntimeState } from '../game/game-engine.service';

export type DemoCharacter = {
  id: string;
  name: string;
  effectLine: string;
  hex: string;
  /** Giá cố định 1..6 — xu lúc vào bàn = đúng bằng giá này. */
  price: number;
};

export type PendingSeat = {
  player_id: string;
  display_name: string;
  hex: string;
  /** Giá nhân vật 1..6 (trùng với xu khởi đầu). */
  character_price: number;
  /** Xu lúc bắt đầu (= giá nhân vật). */
  coins: number;
  /** Thứ tự chọn ghế: 0 đầu tiên, cao hơn = chọn sau (hòa xu thì sau → trước). */
  join_order: number;
};

/** 10 nhân vật — mỗi màu có giá cố định 1..6; xu ban đầu = giá (không nhập tay). */
export const DEMO_CHARACTERS: DemoCharacter[] = [
  { id: 'c1', name: 'Đỏ', effectLine: 'Hiệu ứng: sắc đỏ', hex: '#e53935', price: 3 },
  { id: 'c2', name: 'Cam', effectLine: 'Hiệu ứng: sắc cam', hex: '#fb8c00', price: 5 },
  { id: 'c3', name: 'Vàng', effectLine: 'Hiệu ứng: sắc vàng', hex: '#fdd835', price: 2 },
  { id: 'c4', name: 'Lục', effectLine: 'Hiệu ứng: sắc lục', hex: '#43a047', price: 6 },
  { id: 'c5', name: 'Lam', effectLine: 'Hiệu ứng: sắc lam', hex: '#1e88e5', price: 1 },
  { id: 'c6', name: 'Chàm', effectLine: 'Hiệu ứng: sắc chàm', hex: '#5e35b1', price: 4 },
  { id: 'c7', name: 'Tím', effectLine: 'Hiệu ứng: sắc tím', hex: '#8e24aa', price: 6 },
  { id: 'c8', name: 'Hồng', effectLine: 'Hiệu ứng: sắc hồng', hex: '#ec407a', price: 2 },
  { id: 'c9', name: 'Nâu', effectLine: 'Hiệu ứng: sắc nâu', hex: '#6d4c41', price: 5 },
  { id: 'c10', name: 'Xám', effectLine: 'Hiệu ứng: sắc xám', hex: '#78909c', price: 1 }
];

const DEMO_PLAYER_COUNT = 5;

@Component({
  standalone: true,
  selector: 'app-game-preview',
  imports: [CommonModule, RouterLink, GameBoardUiComponent],
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6">
      <div class="max-w-[1600px] mx-auto flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 shrink-0">
          <div class="flex flex-col">
            <h1 class="text-xl md:text-2xl font-bold text-amber-500">Tokaido — xem thử (offline)</h1>
            <p class="text-sm text-slate-400">Luật MVP, không cần phòng.</p>
            <p *ngIf="pickDone" class="text-sm text-slate-300 mt-1">
              Phase: <span class="text-amber-400 font-semibold">{{ phase }}</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-3 text-xs text-slate-500">
            <a routerLink="/host" class="underline hover:text-slate-300">Multiplayer: Host</a>
            <span aria-hidden="true">•</span>
            <a routerLink="/join" class="underline hover:text-slate-300">Join</a>
          </div>
        </div>

        <section
          *ngIf="!pickDone"
          class="rounded-xl border border-slate-700 bg-slate-800/90 p-4 md:p-6 w-full max-w-[1200px] xl:max-w-[1280px] mx-auto"
        >
          <div class="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
            <div class="flex-1 min-w-0 w-full">
              <h2 class="text-lg font-bold text-amber-400 mb-1">Thiết lập {{ DEMO_PLAYER_COUNT }} người (test một mình)</h2>
              <p class="text-sm text-slate-400 mb-3 leading-relaxed">
                Mỗi màu có <span class="text-slate-200 font-semibold">giá cố định 1–6</span> (ghi trên thẻ). Khi vào bàn,
                <span class="text-slate-200 font-semibold">xu ban đầu = đúng bằng giá</span> (ví dụ giá 6 → 6 xu).
                <br />
                <span class="text-slate-300"
                  >Thứ tự lượt đầu: <strong>xu nhiều → đi trước</strong>; cùng xu →
                  <strong>ai chọn sau → đi trước</strong>.</span
                >
              </p>

              <div *ngIf="pendingSeats.length < DEMO_PLAYER_COUNT" class="flex flex-col gap-4">
                <p class="text-sm font-semibold text-slate-200">
                  Người {{ pendingSeats.length + 1 }} / {{ DEMO_PLAYER_COUNT }}
                </p>

                <div>
                  <p class="text-xs text-slate-500 mb-2">Nhân vật (màu + giá cố định)</p>
                  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    <button
                      *ngFor="let c of demoCharacters"
                      type="button"
                      class="rounded-lg border-2 p-2 flex flex-col items-center gap-1 transition-colors text-left hover:bg-slate-700/50 relative"
                      [class.border-amber-400]="selectedCharacter?.id === c.id"
                      [class.border-slate-600]="selectedCharacter?.id !== c.id"
                      (click)="selectedCharacter = c"
                    >
                      <span
                        class="absolute top-1 right-1 text-[10px] font-bold bg-slate-950/85 text-amber-400 px-1.5 py-0.5 rounded border border-amber-600/50"
                      >
                        Giá {{ c.price }}
                      </span>
                      <span
                        class="w-9 h-9 rounded-full border-2 border-slate-600 shrink-0 mt-3"
                        [style.background]="c.hex"
                      ></span>
                      <span class="font-bold text-xs text-slate-100">{{ c.name }}</span>
                      <span class="text-[9px] text-slate-500 leading-tight text-center">{{ c.effectLine }}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  class="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 w-fit disabled:opacity-40"
                  [disabled]="!selectedCharacter"
                  (click)="addPendingSeat()"
                >
                  Thêm người này
                </button>
              </div>

              <div *ngIf="pendingSeats.length === DEMO_PLAYER_COUNT" class="flex flex-col gap-4">
                <p class="text-sm text-slate-300 font-semibold">Đã đủ {{ DEMO_PLAYER_COUNT }} người</p>
                <ol class="list-decimal list-inside text-sm text-slate-300 space-y-1 lg:hidden">
                  <li *ngFor="let s of pendingSeats">
                    <span class="inline-flex items-center gap-2 align-middle">
                      <span class="w-3 h-3 rounded-full border border-slate-500" [style.background]="s.hex"></span>
                      {{ s.display_name }} — giá {{ s.character_price }} → {{ s.coins }} xu lúc vào
                    </span>
                  </li>
                </ol>
                <p class="text-xs text-slate-500">
                  Thứ tự lượt đầu (đi trước → sau):
                  <span class="text-amber-300 font-medium">{{ turnOrderPreviewLabel() }}</span>
                </p>
                <button
                  type="button"
                  class="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-6 py-3 w-fit"
                  (click)="beginGame()"
                >
                  Vào bàn chơi
                </button>
              </div>
            </div>

            <!-- Danh sách đã thêm — luôn hiện bên phải (desktop) -->
            <aside class="w-full lg:w-[280px] xl:w-[300px] shrink-0 lg:sticky lg:top-4">
              <div
                class="rounded-xl border-2 border-slate-600 bg-slate-950/60 p-4 shadow-lg"
              >
                <h3 class="text-sm font-bold text-amber-400 mb-1">Đã thêm vào bàn</h3>
                <p class="text-[11px] text-slate-500 mb-3 leading-snug">
                  Theo thứ tự bạn bấm “Thêm người này” — vào game sẽ là những người này.
                </p>
                <p class="text-xs text-slate-400 mb-2">
                  <span class="font-mono text-amber-300/90">{{ pendingSeats.length }}</span> /
                  {{ DEMO_PLAYER_COUNT }} người
                </p>

                <ul *ngIf="pendingSeats.length > 0; else setupEmptyList" class="flex flex-col gap-2">
                  <li
                    *ngFor="let s of pendingSeats; let idx = index"
                    class="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2.5 flex gap-3 items-center"
                  >
                    <span
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-amber-400 border border-slate-600"
                    >
                      {{ idx + 1 }}
                    </span>
                    <span
                      class="h-9 w-9 shrink-0 rounded-full border-2 border-slate-600"
                      [style.background]="s.hex"
                    ></span>
                    <div class="min-w-0 flex-1">
                      <div class="font-semibold text-sm text-slate-100 truncate">{{ s.display_name }}</div>
                      <div class="text-[11px] text-slate-500">
                        Giá {{ s.character_price }} • {{ s.coins }} xu •
                        <span class="font-mono text-slate-600">{{ s.player_id }}</span>
                      </div>
                    </div>
                  </li>
                </ul>
                <ng-template #setupEmptyList>
                  <p class="text-sm text-slate-500 italic py-6 text-center border border-dashed border-slate-700 rounded-lg">
                    Chưa có ai — chọn màu và bấm “Thêm người này”.
                  </p>
                </ng-template>
              </div>
            </aside>
          </div>
        </section>

        <ng-container *ngIf="pickDone">
          <div class="flex flex-col lg:flex-row gap-6 items-start">
            <aside
              class="w-full lg:w-[300px] xl:w-[320px] shrink-0 flex flex-col gap-4 order-1 lg:order-none lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pr-1"
            >
              <div
                class="rounded-xl border-4 border-[#2e7d32] bg-[#1b5e20] p-3 shadow-[4px_4px_0_rgba(0,0,0,0.35),inset_2px_2px_0_#4caf50,inset_-2px_-2px_0_#0d3d10]"
              >
                <div class="text-[10px] uppercase tracking-wide text-[#c8e6c9]/90 mb-1">Lượt hiện tại</div>
                <div class="flex items-center gap-3" *ngIf="state?.expectedPlayerId as ep">
                  <span
                    class="w-10 h-10 rounded-full border-2 border-[#c8e6c9] shrink-0"
                    [style.background]="pawnColors[ep] || '#2e7d32'"
                  ></span>
                  <div class="min-w-0">
                    <div class="text-sm font-bold text-[#e8f5e9] leading-snug">
                      {{ state?.players?.[ep]?.displayName ?? '—' }}
                    </div>
                    <div class="text-xs text-[#a5d6a7] mt-1">
                      Xu: {{ state?.players?.[ep]?.coins ?? '—' }} • Điểm:
                      {{ state?.players?.[ep]?.score ?? '—' }}
                    </div>
                  </div>
                </div>
                <p *ngIf="!state?.expectedPlayerId" class="text-xs text-[#a5d6a7]">—</p>
              </div>

              <div class="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <h2 class="text-base font-bold mb-3 text-slate-100">Người chơi</h2>
                <p class="text-[10px] text-slate-500 mb-2">Sắp xếp: thứ tự lượt đầu (đi trước → sau)</p>
                <div class="flex flex-col gap-2">
                  <div
                    *ngFor="let p of runtimePlayersView()"
                    class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex flex-row gap-2 items-center"
                  >
                    <span
                      class="w-6 h-6 rounded-full border border-slate-600 shrink-0"
                      [style.background]="pawnColors[p.player_id] || '#455a64'"
                    ></span>
                    <div class="flex flex-col min-w-0">
                      <div class="font-semibold text-sm">{{ p.display_name }}</div>
                      <div class="text-xs text-slate-300">
                        xu: {{ p.coins }} • điểm: {{ p.score }} • giá: {{ p.character_price }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-slate-800 rounded-xl p-4 flex flex-col gap-3 border border-slate-700">
                <h2 class="text-base font-bold text-slate-100">Luồng chơi</h2>

                <div *ngIf="phase === 'turns'" class="flex flex-col gap-3">
                  <div class="text-sm text-slate-300 leading-relaxed" *ngIf="state?.expectedPlayerId as ep">
                    Lượt:
                    <span class="text-amber-300 font-mono text-xs break-all">{{ ep }}</span
                    ><br />
                    Ô hiện tại:
                    <span class="font-bold text-amber-400">{{ state?.players?.[ep]?.cellPos ?? '—' }}</span>
                  </div>

                  <div *ngIf="state?.expectedPlayerId" class="flex flex-col gap-2">
                    <h3 class="text-sm font-bold text-amber-500">Chọn ô đích</h3>
                    <p class="text-xs text-slate-400 leading-relaxed">
                      Bạn đang test một mình — bấm ô
                      <span class="text-sky-300 font-semibold">nhấp nháy xanh</span> để đi giúp người đang tới lượt.
                    </p>
                  </div>

                  <div *ngIf="!state?.expectedPlayerId" class="text-sm text-slate-400">Không có lượt hợp lệ.</div>
                </div>

                <div *ngIf="phase === 'inn_pick'" class="flex flex-col gap-3">
                  <div class="text-sm text-slate-300">
                    Quán nước {{ innIndexLabel() }} • Tiến độ: {{ innPickIndexLabel() }}
                  </div>

                  <div *ngIf="state?.expectedPlayerId as ep" class="flex flex-col gap-3">
                    <div class="text-sm text-slate-300">
                      Coins: {{ state?.players?.[ep]?.coins ?? '—' }} • Đồ ăn:
                      {{ state?.players?.[ep]?.foods?.join(', ') || '—' }}
                    </div>

                    <div class="flex flex-wrap gap-2">
                      <button
                        *ngFor="let card of state?.innSelection?.cards ?? []"
                        type="button"
                        class="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-2 py-2 text-xs disabled:opacity-50"
                        [disabled]="
                          (state?.players?.[ep]?.foods?.includes(card.foodTypeId) ?? false) ||
                          (state?.innSelection?.arrivalOrder?.[0] !== ep &&
                            (state?.players?.[ep]?.coins ?? 0) < card.cost)
                        "
                        (click)="chooseInnCard(card.cardId)"
                      >
                        {{ card.foodTypeId }} • {{ card.points }}đ •
                        {{
                          state?.innSelection?.arrivalOrder?.[0] === ep ? '0' : card.cost
                        }}
                      </button>
                    </div>

                    <button
                      type="button"
                      class="rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold px-4 py-2 w-fit text-sm"
                      (click)="chooseInnCard(null)"
                    >
                      Skip
                    </button>
                  </div>
                </div>

                <div *ngIf="phase === 'ended'">
                  <h3 class="text-sm font-bold text-amber-500 mb-2">Kết thúc (demo)</h3>
                  <div class="flex flex-col gap-2">
                    <div
                      *ngFor="let r of getRanking()"
                      class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2"
                    >
                      <div class="text-sm font-semibold">#{{ r.rank }} - {{ r.display_name }}</div>
                      <div class="text-xs text-slate-300">score: {{ r.score }}</div>
                    </div>
                  </div>
                </div>

                <details class="text-xs text-slate-500">
                  <summary class="cursor-pointer text-slate-400 hover:text-slate-300">State (debug JSON)</summary>
                  <pre
                    class="text-[10px] overflow-auto max-h-40 bg-slate-950 border border-slate-700 rounded-lg p-2 mt-2 font-mono"
                  >{{ state | json }}</pre>
                </details>

                <div *ngIf="error" class="text-red-300 text-sm whitespace-pre-wrap">{{ error }}</div>
              </div>
            </aside>

            <div class="w-full min-w-0 flex-1 order-2 lg:order-none">
              <app-game-board-ui
                [state]="state"
                [highlightPlayerId]="state?.expectedPlayerId ?? null"
                [moveTick]="moveTick"
                [interactionActive]="boardInteractionActive()"
                [validTargets]="validMoveTargets()"
                [pawnColors]="pawnColors"
                pawnColorHex="#78909c"
                (moveTargetPick)="onBoardMove($event)"
              />
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `
})
export class GamePreviewComponent {
  private readonly gameEngine = inject(GameEngineService);

  readonly DEMO_PLAYER_COUNT = DEMO_PLAYER_COUNT;
  readonly demoCharacters = DEMO_CHARACTERS;

  state: GameRuntimeState | null = null;
  phase = '';
  error: string | null = null;
  pickDone = false;

  pendingSeats: PendingSeat[] = [];
  selectedCharacter: DemoCharacter | null = null;

  pawnColors: Record<string, string> = {};

  moveTick = 0;

  addPendingSeat(): void {
    const c = this.selectedCharacter;
    if (!c || this.pendingSeats.length >= DEMO_PLAYER_COUNT) return;
    const join_order = this.pendingSeats.length;
    const price = c.price;
    this.pendingSeats = [
      ...this.pendingSeats,
      {
        player_id: `demo-p${this.pendingSeats.length + 1}`,
        display_name: c.name,
        hex: c.hex,
        character_price: price,
        coins: price,
        join_order
      }
    ];
    this.selectedCharacter = null;
  }

  turnOrderPreviewLabel(): string {
    const sorted = [...this.pendingSeats].sort((a, b) => {
      if (b.coins !== a.coins) return b.coins - a.coins;
      return b.join_order - a.join_order;
    });
    return sorted.map((s) => s.display_name).join(' → ');
  }

  beginGame(): void {
    if (this.pendingSeats.length !== DEMO_PLAYER_COUNT) return;
    this.pawnColors = Object.fromEntries(this.pendingSeats.map((s) => [s.player_id, s.hex]));
    this.state = this.gameEngine.initializeTurnsState({
      players: this.pendingSeats.map((s) => ({
        player_id: s.player_id,
        display_name: s.display_name,
        coins: s.coins,
        score: 0,
        character_price: s.character_price,
        join_order: s.join_order
      }))
    });
    this.phase = String(this.state.phase ?? '');
    this.pickDone = true;
    this.error = null;
  }

  boardInteractionActive(): boolean {
    return !!(this.state && this.state.phase === 'turns' && this.state.expectedPlayerId);
  }

  validMoveTargets() {
    const pid = this.state?.expectedPlayerId;
    if (!this.state || !pid) return [];
    return this.gameEngine.getValidMoveTargets(this.state, pid);
  }

  onBoardMove(ev: BoardMovePick): void {
    const pid = this.state?.expectedPlayerId;
    const me = pid ? this.state?.players?.[pid] : undefined;
    if (!pid || !me || me.status !== 'inLine' || !this.state) return;
    const pos = me.cellPos;
    let steps: number;
    if (ev.kind === 'inn') steps = 14 - pos;
    else steps = (ev.cellNum ?? 0) - pos;
    if (!Number.isFinite(steps) || steps < 1) return;
    this.chooseStepsFor(pid, steps);
  }

  runtimePlayersView(): Array<{
    player_id: string;
    display_name: string;
    coins: number;
    score: number;
    character_price: number;
    cellEnteredAt: number;
  }> {
    if (!this.state) return [];
    const rows = Object.values(this.state.players).map((p) => ({
      player_id: p.playerId,
      display_name: p.displayName,
      coins: p.coins,
      score: p.score,
      character_price: p.characterPrice,
      cellEnteredAt: p.cellEnteredAt
    }));
    rows.sort((a, b) => a.cellEnteredAt - b.cellEnteredAt);
    return rows;
  }

  getRanking(): Array<{ rank: number; display_name: string; score: number }> {
    if (!this.state || this.state.phase !== 'ended') return [];
    const endedOrder = this.state.endedOrder ?? [];
    const endedIndex = new Map<string, number>(endedOrder.map((pid, i) => [pid, i]));
    const rows = Object.values(this.state.players).map((p) => ({
      playerId: p.playerId,
      display_name: p.displayName,
      score: p.score
    }));
    rows.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const ai = endedIndex.get(a.playerId) ?? 99999;
      const bi = endedIndex.get(b.playerId) ?? 99999;
      return ai - bi;
    });
    return rows.map((r, i) => ({ rank: i + 1, display_name: r.display_name, score: r.score }));
  }

  innIndexLabel(): string {
    const idx = this.state?.innSelection?.innIndex;
    return idx == null ? '-' : String(idx + 1);
  }

  innPickIndexLabel(): string {
    const sel = this.state?.innSelection;
    if (!sel) return '-';
    const done = sel.completedPicks?.length ?? 0;
    const total = sel.arrivalOrder?.length ?? 0;
    return `${done}/${total}`;
  }

  innPickTotalLabel(): number {
    return this.state?.innSelection?.arrivalOrder?.length ?? 1;
  }

  chooseStepsFor(playerId: string, steps: number): void {
    this.error = null;
    if (!this.state) return;
    try {
      const prev = snapshotPawn(this.state, playerId);
      this.state = this.gameEngine.processChooseSteps(this.state, playerId, steps);
      this.phase = String(this.state.phase ?? '');
      if (pawnMoved(prev, this.state, playerId)) this.moveTick++;
    } catch (e) {
      this.error = e instanceof GameEngineError ? e.message : String(e);
    }
  }

  chooseInnCard(cardId: string | null): void {
    this.error = null;
    const pid = this.state?.expectedPlayerId;
    if (!pid || !this.state) return;
    try {
      const prev = snapshotPawn(this.state, pid);
      this.state = this.gameEngine.processChooseInnCard(this.state, pid, cardId);
      this.phase = String(this.state.phase ?? '');
      if (pawnMoved(prev, this.state, pid)) this.moveTick++;
    } catch (e) {
      this.error = e instanceof GameEngineError ? e.message : String(e);
    }
  }
}

function snapshotPawn(
  state: GameRuntimeState,
  uid: string
): { stage: number; cell: number; status: string } | null {
  const me = state.players[uid];
  if (!me) return null;
  return { stage: state.stageIndex, cell: me.cellPos, status: me.status };
}

function pawnMoved(
  prev: { stage: number; cell: number; status: string } | null,
  state: GameRuntimeState,
  uid: string
): boolean {
  const next = snapshotPawn(state, uid);
  if (!prev || !next) return false;
  return prev.stage !== next.stage || prev.cell !== next.cell || prev.status !== next.status;
}
