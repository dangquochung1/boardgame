import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges
} from '@angular/core';
import {
  getCellDemoCoinBonus,
  getCellDemoScoreBonus,
  getCellType,
  hasUpperLayerCell
} from '../game/cell-types.config';
import type { GameRuntimeState, ValidMoveTarget } from '../game/game-engine.service';
import { cellTypeLabelVi } from './cell-labels';

export type BoardMovePick = { kind: 'cell' | 'inn'; cellNum?: number };

export type BoardRowView = {
  lineIndex: number;
  cellNumbers: number[];
  evenLine: boolean;
};

@Component({
  selector: 'app-game-board-ui',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board-scene">
      <div class="sky" aria-hidden="true"></div>
      <div class="sun" aria-hidden="true"></div>
      <div class="cloud cloud-a" aria-hidden="true"></div>
      <div class="cloud cloud-b" aria-hidden="true"></div>
      <div class="cloud cloud-c" aria-hidden="true"></div>

      <h2 class="board-title">BÀN CHƠI</h2>

      <div class="board-frame">
        <!-- Mỗi người một ô ví (xu runtime) -->
        <div class="wallets-strip" *ngIf="state">
          <div class="wallets-strip-title">Ví</div>
          <div class="wallets-cells">
            <div
              *ngFor="let w of playerWalletsView()"
              class="wallet-cell"
              [style.--wallet-accent]="w.color"
            >
              <span class="wallet-cell-name">{{ w.name }}</span>
              <span class="wallet-cell-coins">{{ w.coins }} xu</span>
            </div>
          </div>
        </div>

        <div class="board-rows">
          <div *ngFor="let row of rows" class="board-line-block">
            <!-- Dòng 1: ghế ngang (xuất phát | quán) — dòng 2: line chơi -->
            <div class="board-hub-row">
              <ng-container *ngIf="row.evenLine">
                <div class="hub-rail hub-rail--horizontal">
                  <div
                    *ngFor="let seat of hubSeatIndices"
                    class="hub-slot-horizontal slot--start"
                    [class.hub-slot--counter]="seat === 4"
                    [class.slot--active]="isTurnHighlightHub(row.lineIndex, 'start', seat)"
                  >
                    <span class="hub-slot-label">{{ hubSeatLabel(seat) }}</span>
                    <div class="hub-pawn-wrap-horizontal">
                      <ng-container *ngIf="pawnAtHub(row.lineIndex, 'start', seat) as pidS">
                        <ng-container
                          *ngTemplateOutlet="pawnTpl; context: { $implicit: pidS, seat: 0, total: 1 }"
                        />
                      </ng-container>
                    </div>
                  </div>
                </div>
                <div class="hub-row-spacer" aria-hidden="true"></div>
                <div class="hub-rail hub-rail--horizontal">
                  <div
                    *ngFor="let seat of hubSeatIndices"
                    class="hub-slot-horizontal slot--inn"
                    [class.hub-slot--counter]="seat === 4"
                    [class.slot--active]="isTurnHighlightHub(row.lineIndex, 'inn', seat)"
                    [class.slot--hint]="isMoveHintInn(row.lineIndex)"
                    [class.slot--clickable]="isClickableInn(row.lineIndex)"
                    [attr.role]="isClickableInn(row.lineIndex) ? 'button' : null"
                    [attr.tabindex]="isClickableInn(row.lineIndex) ? 0 : null"
                    (click)="clickInnHub(row.lineIndex)"
                    (keydown.enter)="clickInnHub(row.lineIndex)"
                    (keydown.space)="$event.preventDefault(); clickInnHub(row.lineIndex)"
                  >
                    <span class="hub-slot-label">{{ hubSeatLabel(seat) }}</span>
                    <div class="hub-pawn-wrap-horizontal">
                      <ng-container *ngIf="pawnAtHub(row.lineIndex, 'inn', seat) as pidI">
                        <ng-container
                          *ngTemplateOutlet="pawnTpl; context: { $implicit: pidI, seat: 0, total: 1 }"
                        />
                      </ng-container>
                    </div>
                  </div>
                </div>
              </ng-container>

              <ng-container *ngIf="!row.evenLine">
                <div class="hub-rail hub-rail--horizontal">
                  <div
                    *ngFor="let seat of hubSeatIndices"
                    class="hub-slot-horizontal slot--inn"
                    [class.hub-slot--counter]="seat === 4"
                    [class.slot--active]="isTurnHighlightHub(row.lineIndex, 'inn', seat)"
                    [class.slot--hint]="isMoveHintInn(row.lineIndex)"
                    [class.slot--clickable]="isClickableInn(row.lineIndex)"
                    [attr.role]="isClickableInn(row.lineIndex) ? 'button' : null"
                    [attr.tabindex]="isClickableInn(row.lineIndex) ? 0 : null"
                    (click)="clickInnHub(row.lineIndex)"
                    (keydown.enter)="clickInnHub(row.lineIndex)"
                    (keydown.space)="$event.preventDefault(); clickInnHub(row.lineIndex)"
                  >
                    <span class="hub-slot-label">{{ hubSeatLabel(seat) }}</span>
                    <div class="hub-pawn-wrap-horizontal">
                      <ng-container *ngIf="pawnAtHub(row.lineIndex, 'inn', seat) as pidI2">
                        <ng-container
                          *ngTemplateOutlet="pawnTpl; context: { $implicit: pidI2, seat: 0, total: 1 }"
                        />
                      </ng-container>
                    </div>
                  </div>
                </div>
                <div class="hub-row-spacer" aria-hidden="true"></div>
                <div class="hub-rail hub-rail--horizontal">
                  <div
                    *ngFor="let seat of hubSeatIndices"
                    class="hub-slot-horizontal slot--start"
                    [class.hub-slot--counter]="seat === 4"
                    [class.slot--active]="isTurnHighlightHub(row.lineIndex, 'start', seat)"
                  >
                    <span class="hub-slot-label">{{ hubSeatLabel(seat) }}</span>
                    <div class="hub-pawn-wrap-horizontal">
                      <ng-container *ngIf="pawnAtHub(row.lineIndex, 'start', seat) as pidS2">
                        <ng-container
                          *ngTemplateOutlet="pawnTpl; context: { $implicit: pidS2, seat: 0, total: 1 }"
                        />
                      </ng-container>
                    </div>
                  </div>
                </div>
              </ng-container>
            </div>

            <div class="board-cell-row">
              <div *ngFor="let n of row.cellNumbers" class="slot-column">
                <div class="slot-marker-zone slot-marker-zone--top" aria-hidden="true">
                  <div *ngIf="upperLayerCell(row.lineIndex, n)" class="slot slot--upper-layer">
                    <span class="slot-label">{{ labelFor(row.lineIndex, n) }}</span>
                  </div>
                </div>
                <div
                  class="slot"
                  [class.slot--active]="isTurnHighlightHere(row.lineIndex, 'cell', n)"
                  [class.slot--hint]="isMoveHint(row.lineIndex, 'cell', n)"
                  [class.slot--clickable]="isClickable(row.lineIndex, 'cell', n)"
                  [attr.role]="isClickable(row.lineIndex, 'cell', n) ? 'button' : null"
                  [attr.tabindex]="isClickable(row.lineIndex, 'cell', n) ? 0 : null"
                  (click)="clickSlot(row.lineIndex, 'cell', n)"
                  (keydown.enter)="clickSlot(row.lineIndex, 'cell', n)"
                  (keydown.space)="$event.preventDefault(); clickSlot(row.lineIndex, 'cell', n)"
                >
                  <span class="slot-label">{{ labelFor(row.lineIndex, n) }}</span>
                  <div class="slot-demo-badges" *ngIf="cellDemoRewards(row.lineIndex, n) as rw">
                    <span class="slot-demo-pt" *ngIf="rw.score">+{{ rw.score }}đ</span>
                    <span class="slot-demo-coin" *ngIf="rw.coins">+{{ rw.coins }} xu</span>
                  </div>
                  <div
                    class="pawn-cluster"
                    *ngIf="pawnsAt(row.lineIndex, 'cell', n) as cellIds"
                  >
                    <ng-container *ngFor="let pid of cellIds; let si = index">
                      <ng-container
                        *ngTemplateOutlet="pawnTpl; context: { $implicit: pid, seat: si, total: cellIds.length }"
                      />
                    </ng-container>
                  </div>
                </div>
                <div class="slot-marker-zone slot-marker-zone--bottom" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Line điểm 0–100 (ẩn số chia, chỉ vị trí + điểm trên đầu) -->
      <div class="score-ruler-wrap" *ngIf="state">
        <div class="score-ruler-title">Điểm</div>
        <div
          class="score-ruler-track"
          role="img"
          aria-label="Thanh điểm từ 0 đến 100, vị trí mỗi nhân vật theo điểm hiện tại"
        >
          <div class="score-ruler-line" aria-hidden="true"></div>
          <div class="score-ruler-markers">
            <div
              *ngFor="let m of scoreLineMarkers()"
              class="score-marker"
              [style.left]="m.leftCss"
              [style.zIndex]="m.z"
            >
              <span class="score-marker-score">{{ m.score }}</span>
              <span
                class="score-marker-dot"
                [style.background]="m.color"
                [title]="m.displayName + ': ' + m.score + ' điểm'"
              ></span>
            </div>
          </div>
        </div>
      </div>

      <ng-template #pawnTpl let-pid let-seat="seat" let-total="total">
        <span class="pawn-wrap pawn-wrap--seat" [ngStyle]="pawnWrapStyle(pid, seat, total)">
          <span class="pawn pawn--cluster" aria-hidden="true">
            <span class="pawn-ground-shadow"></span>
            <span class="pawn-pivot" [class.pawn-pivot--rolling]="rolling">
              <span class="pawn-cube pawn-cube--sm">
                <span class="pawn-face pawn-face--front"></span>
                <span class="pawn-face pawn-face--back"></span>
                <span class="pawn-face pawn-face--right"></span>
                <span class="pawn-face pawn-face--left"></span>
                <span class="pawn-face pawn-face--top"></span>
                <span class="pawn-face pawn-face--bottom"></span>
              </span>
            </span>
          </span>
        </span>
      </ng-template>

      <div class="grass-tufts" aria-hidden="true"></div>
      <div class="ground" aria-hidden="true"></div>
    </div>
  `,
  styleUrl: './game-board-ui.component.css'
})
export class GameBoardUiComponent implements OnChanges, OnDestroy {
  @Input() state: GameRuntimeState | null = null;
  /** Player đang tới lượt — viền cam + ô gợi ý theo lượt này. */
  @Input() highlightPlayerId: string | null = null;

  @Input() moveTick = 0;

  @Input() interactionActive = false;
  @Input() validTargets: ValidMoveTarget[] = [];
  /** Màu mặc định nếu thiếu trong `pawnColors`. */
  @Input() pawnColorHex = '#2e7d32';
  @Input() pawnColors: Record<string, string> = {};

  @Output() moveTargetPick = new EventEmitter<BoardMovePick>();

  rolling = false;

  private rollTimer: ReturnType<typeof setTimeout> | undefined;

  readonly rows: BoardRowView[] = [0, 1, 2, 3].map((lineIndex) => {
    const evenLine = lineIndex % 2 === 0;
    const cellNumbers = evenLine
      ? Array.from({ length: 13 }, (_, i) => i + 1)
      : Array.from({ length: 13 }, (_, i) => 13 - i);
    return { lineIndex, cellNumbers, evenLine };
  });

  /** 4 ghế (0–3) + 1 ô quán nước (4) trong khu hub. */
  readonly hubSeatIndices: readonly number[] = [0, 1, 2, 3, 4];

  hubSeatLabel(seat: number): string {
    return seat < 4 ? 'Ghế ngồi' : 'Quán nước';
  }

  /** Nhãn demo điểm + xu (1–3) cạnh ô — khớp logic engine khi đi vào ô. */
  cellDemoRewards(
    lineIndex: number,
    cellNum: number
  ): { score?: number; coins?: number } | null {
    const s = getCellDemoScoreBonus(lineIndex, cellNum);
    const c = getCellDemoCoinBonus(lineIndex, cellNum);
    if (!s && !c) return null;
    return {
      ...(s ? { score: s } : {}),
      ...(c ? { coins: c } : {})
    };
  }

  playerWalletsView(): Array<{
    playerId: string;
    name: string;
    coins: number;
    color: string;
  }> {
    if (!this.state) return [];
    return Object.values(this.state.players)
      .map((p) => ({
        playerId: p.playerId,
        name: p.displayName,
        coins: p.coins,
        color: this.pawnColors[p.playerId] || this.pawnColorHex || '#78909c',
        cellEnteredAt: p.cellEnteredAt
      }))
      .sort((a, b) => a.cellEnteredAt - b.cellEnteredAt || a.playerId.localeCompare(b.playerId))
      .map(({ playerId, name, coins, color }) => ({ playerId, name, coins, color }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    const mt = changes['moveTick'];
    if (mt && !mt.firstChange && mt.currentValue !== mt.previousValue) {
      this.playRoll();
    }
  }

  ngOnDestroy(): void {
    if (this.rollTimer !== undefined) {
      clearTimeout(this.rollTimer);
    }
  }

  upperLayerCell(line: number, n: number): boolean {
    return hasUpperLayerCell(line, n);
  }

  /**
   * Quân đứng từng “ghế” trong ô (kiểu quán nước — không chồng lên nhau).
   */
  pawnWrapStyle(
    playerId: string,
    seat: number | null | undefined,
    total: number | null | undefined
  ): Record<string, string> {
    const base = this.pawnColors[playerId] || this.pawnColorHex || '#2e7d32';
    const vars = pawnCssVarsFromHex(base);
    const si = seat ?? 0;
    const tot = Math.max(1, total ?? 1);
    const { leftPct, bottomPx } = this.pawnStoolPosition(si, tot);
    return {
      ...vars,
      position: 'absolute',
      left: `${leftPct}%`,
      bottom: `${bottomPx}px`,
      transform: 'translateX(-50%)',
      zIndex: String(20 + si)
    };
  }

  /** Thanh điểm: 0–100% theo score (clamp), hiển thị chấm 2D + số điểm. */
  scoreLineMarkers(): Array<{
    playerId: string;
    displayName: string;
    score: number;
    leftCss: string;
    color: string;
    z: number;
  }> {
    if (!this.state) return [];
    type Row = {
      playerId: string;
      displayName: string;
      score: number;
      base: number;
      color: string;
    };
    const list: Row[] = Object.values(this.state.players).map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      score: p.score,
      base: Math.max(0, Math.min(100, Number(p.score) || 0)),
      color: this.pawnColors[p.playerId] || this.pawnColorHex || '#78909c'
    }));
    list.sort((a, b) => a.base - b.base || a.playerId.localeCompare(b.playerId));
    const groups = new Map<number, Row[]>();
    for (const row of list) {
      const g = groups.get(row.base) ?? [];
      g.push(row);
      groups.set(row.base, g);
    }
    let zi = 20;
    return list.map((row) => {
      const g = groups.get(row.base)!;
      const idx = g.findIndex((x) => x.playerId === row.playerId);
      const spread = g.length > 1 ? (idx - (g.length - 1) / 2) * 10 : 0;
      return {
        playerId: row.playerId,
        displayName: row.displayName,
        score: row.score,
        leftCss: `calc(${row.base}% + ${spread}px)`,
        color: row.color,
        z: zi++
      };
    });
  }

  private pawnStoolPosition(seatIndex: number, total: number): { leftPct: number; bottomPx: number } {
    const layouts: Record<number, [number, number][]> = {
      1: [[50, 5]],
      2: [[32, 7], [68, 7]],
      3: [[22, 10], [50, 4], [78, 10]],
      4: [[18, 11], [38, 5], [62, 5], [82, 11]],
      5: [[12, 13], [30, 7], [50, 3], [70, 7], [88, 13]]
    };
    const n = Math.min(Math.max(total, 1), 5);
    const pts = layouts[n] ?? layouts[5];
    const idx = total <= 5 ? seatIndex : seatIndex % 5;
    const pair = pts[Math.min(Math.max(idx, 0), pts.length - 1)];
    if (total > 5) {
      const jitter = ((seatIndex % 3) - 1) * 1.2;
      return {
        leftPct: pair[0] + jitter,
        bottomPx: pair[1] + (seatIndex % 2) * 3
      };
    }
    return { leftPct: pair[0], bottomPx: pair[1] };
  }

  pawnsAt(lineIndex: number, kind: 'start' | 'cell' | 'inn', cellNum?: number): string[] {
    if (!this.state || this.state.stageIndex !== lineIndex) return [];
    const ids: string[] = [];
    for (const p of Object.values(this.state.players)) {
      const pl = this.placementForPid(p.playerId);
      if (!pl || pl.line !== lineIndex || pl.kind !== kind) continue;
      if (kind === 'cell' && pl.cellNum !== cellNum) continue;
      ids.push(p.playerId);
    }
    ids.sort((a, b) => {
      const pa = this.state!.players[a];
      const pb = this.state!.players[b];
      return pa.cellEnteredAt - pb.cellEnteredAt;
    });
    return ids;
  }

  /** Tối đa một quân mỗi ghế trong khu xuất phát / quán nước. */
  pawnAtHub(lineIndex: number, side: 'start' | 'inn', seat: number): string | null {
    const kind = side;
    if (!this.state || this.state.stageIndex !== lineIndex) return null;
    for (const p of Object.values(this.state.players)) {
      const pl = this.placementForPid(p.playerId);
      if (!pl || pl.line !== lineIndex || pl.kind !== kind) continue;
      if (pl.seat === seat) return p.playerId;
    }
    return null;
  }

  isTurnHighlightHub(lineIndex: number, side: 'start' | 'inn', seat: number): boolean {
    const hp = this.highlightPlayerId;
    if (!hp || !this.state) return false;
    const pl = this.placementForPid(hp);
    if (!pl || pl.line !== lineIndex) return false;
    const kind = side;
    return pl.kind === kind && pl.seat === seat;
  }

  isMoveHintInn(lineIndex: number): boolean {
    if (!this.state || this.state.stageIndex !== lineIndex) return false;
    return this.validTargets.some((t) => t.kind === 'inn');
  }

  isClickableInn(lineIndex: number): boolean {
    return this.interactionActive && this.isMoveHintInn(lineIndex);
  }

  clickInnHub(lineIndex: number): void {
    if (!this.isClickableInn(lineIndex)) return;
    this.moveTargetPick.emit({ kind: 'inn' });
  }

  isTurnHighlightHere(lineIndex: number, kind: 'start' | 'cell' | 'inn', cellNum?: number): boolean {
    const hp = this.highlightPlayerId;
    if (!hp || !this.state) return false;
    const pl = this.placementForPid(hp);
    if (!pl || pl.line !== lineIndex || pl.kind !== kind) return false;
    if (kind === 'cell' && cellNum !== undefined) return pl.cellNum === cellNum;
    return true;
  }

  isMoveHint(lineIndex: number, kind: 'cell' | 'inn', cellNum?: number): boolean {
    if (!this.state || this.state.stageIndex !== lineIndex) return false;
    return this.validTargets.some((t) => {
      if (t.kind === 'cell' && kind === 'cell') return t.cellNum === cellNum;
      if (t.kind === 'inn' && kind === 'inn') return true;
      return false;
    });
  }

  isClickable(lineIndex: number, kind: 'cell' | 'inn', cellNum?: number): boolean {
    return this.interactionActive && this.isMoveHint(lineIndex, kind, cellNum);
  }

  clickSlot(lineIndex: number, kind: 'start' | 'cell' | 'inn', cellNum?: number): void {
    if (kind === 'start') return;
    if (!this.isClickable(lineIndex, kind, cellNum)) return;
    if (kind === 'inn') this.moveTargetPick.emit({ kind: 'inn' });
    else this.moveTargetPick.emit({ kind: 'cell', cellNum });
  }

  private playRoll(): void {
    if (this.rollTimer !== undefined) clearTimeout(this.rollTimer);
    this.rolling = true;
    this.rollTimer = setTimeout(() => {
      this.rolling = false;
      this.rollTimer = undefined;
    }, 720);
  }

  labelFor(lineIndex: number, cellNum1to13: number): string {
    const t = getCellType(lineIndex, cellNum1to13);
    return cellTypeLabelVi(t);
  }

  private placementForPid(
    playerId: string
  ): { line: number; kind: 'start' | 'cell' | 'inn'; cellNum?: number; seat?: number } | null {
    if (!this.state) return null;
    const me = this.state.players[playerId];
    if (!me) return null;

    const line = this.state.stageIndex;
    if (line < 0 || line > 3) return null;

    const seat = Math.min(Math.max(me.hubSeat, 0), 4);

    if (me.status === 'inLine') {
      const pos = me.cellPos;
      if (pos === 0) return { line, kind: 'start', seat };
      if (pos >= 1 && pos <= 13) return { line, kind: 'cell', cellNum: pos };
      if (pos >= 14) return { line, kind: 'inn', seat };
    }

    if (me.status === 'inInn' || me.status === 'inTerminalInn') {
      return { line, kind: 'inn', seat };
    }

    return null;
  }
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function adjustHex(hex: string, delta: number): string {
  const h = hex.trim().replace('#', '');
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return '#2e7d32';
  const num = parseInt(h, 16);
  let r = (num >> 16) + delta;
  let g = ((num >> 8) & 0xff) + delta;
  let b = (num & 0xff) + delta;
  r = clamp(r, 0, 255);
  g = clamp(g, 0, 255);
  b = clamp(b, 0, 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function pawnCssVarsFromHex(base: string): Record<string, string> {
  return {
    '--pawn-mid': base,
    '--pawn-dark': adjustHex(base, -38),
    '--pawn-deep': adjustHex(base, -58),
    '--pawn-light': adjustHex(base, 42),
    '--pawn-top': adjustHex(base, 58)
  };
}
