import { Injectable } from '@angular/core';
import { ScoringMvpService } from './scoring-mvp.service';
import { getCellDemoCoinBonus, getCellDemoScoreBonus, getCellType } from './cell-types.config';

export type GamePhase = 'character_pick' | 'turns' | 'inn_pick' | 'ended';

export type PlayerRuntime = {
  playerId: string;
  displayName: string;
  characterPrice: number;
  coins: number;
  score: number;

  // For the current gameplay line (0..13). 0 means "before cell 1".
  cellPos: number;
  // Thứ tự lượt khi trùng ô: số nhỏ hơn = đi trước (gán lúc khởi tạo theo xu + thứ tự chọn).
  cellEnteredAt: number;
  status: 'inLine' | 'inInn' | 'inTerminalInn';

  // Foods chosen at Inns (foodTypeId). Used to enforce "no duplicates" per player.
  foods: string[];

  // Temple deeds chosen (each is 1..3). Linear scoring.
  templeDeeds: number[];

  // Scenic types you have collected (3 types, each yields base 1..3 points).
  scenicTypes: number[];

  // Village craft counts by typeId (toy/gốm/...).
  craftCounts: Record<string, number>;

  // Bùa drawn at temple (stub). Content is handled later.
  buas: string[];

  /** 0..4 trong khu vực hub (4 ghế + 1 quán), áp dụng lúc ở xuất phát hoặc quán nước. */
  hubSeat: number;
};

export type GameRuntimeState = {
  phase: GamePhase;
  version: number;

  // Which line stage the players are currently moving on: 0..3 (4 lines).
  stageIndex: number;

  // Player id whose action is expected right now.
  expectedPlayerId: string | null;
  seq: number;

  players: Record<string, PlayerRuntime>;

  // innQueues[0..4] correspond to Inn1..Inn5.
  // During stageIndex < 3, only innQueues[stageIndex] is used.
  // When stageIndex == 3, innQueues[3] fills, then players are moved to innQueues[4] and the game ends.
  innQueues: string[][];

  // Inn card selection phase data.
  innSelection: InnSelectionState | null;

  // Debug helpers / end order
  endedOrder?: string[];
};

export type InnFoodCard = {
  cardId: string;
  foodTypeId: string;
  // Mệnh giá 1..3
  cost: number;
  // Luôn 6 điểm theo luật bạn chốt
  points: number;
};

export type InnSelectionState = {
  // innIndex = 0..4 (Inn1..Inn5)
  innIndex: number;
  /** Thứ tự vào quán (xếp ghế). */
  arrivalOrder: string[];
  /** Ai đã chọn quà / skip xong ở quán này. */
  completedPicks: string[];
  cards: InnFoodCard[];
};

export type ChooseStepsAction = {
  type: 'CHOOSE_STEPS';
  payload: { steps: number };
};

/** Ô hợp lệ để đi tới (bàn cờ click-to-move), chỉ cho hàng `stageIndex` hiện tại. */
export type ValidMoveTarget =
  | { kind: 'cell'; cellNum: number }
  | { kind: 'inn' };

type ValidationErrorCode =
  | 'NOT_EXPECTED_PLAYER'
  | 'INVALID_PHASE'
  | 'INVALID_STEPS'
  | 'CANNOT_LAND_OCCUPIED'
  | 'CANNOT_ENTER_INN_WHEN_FULL'
  | 'NO_SUCH_PLAYER';

export class GameEngineError extends Error {
  constructor(public code: ValidationErrorCode, message: string) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class GameEngineService {
  private readonly scoring = new ScoringMvpService();

  initializeTurnsState(params: {
    players: Array<{
      player_id: string;
      display_name: string;
      coins: number;
      score: number;
      /** Giá nhân vật 1..6 (stub, chưa dùng hết trong MVP). */
      character_price: number | null;
      /**
       * Thứ tự vào bàn: 0 = chọn đầu, cao hơn = chọn sau.
       * Cùng số xu: ai chọn sau (join_order lớn hơn) đi trước.
       */
      join_order?: number;
    }>;
    version?: number;
  }): GameRuntimeState {
    const players = params.players;
    const version = params.version ?? 1;

    // Xu nhiều → đi trước; cùng xu → chọn sau đi trước (join_order lớn hơn).
    const sorted = [...players].sort((a, b) => {
      if (b.coins !== a.coins) return b.coins - a.coins;
      const ja = a.join_order ?? 0;
      const jb = b.join_order ?? 0;
      if (jb !== ja) return jb - ja;
      return a.player_id.localeCompare(b.player_id);
    });

    const seqBase = 1000;
    const runtimePlayers: Record<string, PlayerRuntime> = {};
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      runtimePlayers[p.player_id] = {
        playerId: p.player_id,
        displayName: p.display_name,
        characterPrice: clampCharPrice(p.character_price),
        coins: p.coins,
        score: p.score,
        cellPos: 0,
        cellEnteredAt: seqBase + i,
        status: 'inLine',
        foods: [],
        templeDeeds: [],
        scenicTypes: [],
        craftCounts: {},
        buas: [],
        hubSeat: Math.min(i, 4)
      };
    }

    const state: GameRuntimeState = {
      phase: 'turns',
      version,
      stageIndex: 0,
      expectedPlayerId: null,
      seq: 1,
      players: runtimePlayers,
      innQueues: [[], [], [], [], []],
      innSelection: null
    };

    state.expectedPlayerId = this.getExpectedPlayerId(state);
    return state;
  }

  /**
   * Danh sách ô có thể đi tới (1..13 hoặc quán nước cuối hàng), đã loại ô bị chiếm / quán đầy.
   */
  getValidMoveTargets(state: GameRuntimeState, playerId: string): ValidMoveTarget[] {
    if (state.phase !== 'turns') return [];
    if (state.expectedPlayerId !== playerId) return [];
    const runtimePlayer = state.players[playerId];
    if (!runtimePlayer || runtimePlayer.status !== 'inLine') return [];

    const cellPos = runtimePlayer.cellPos;
    const maxSteps = 14 - cellPos;
    if (!Number.isFinite(maxSteps) || maxSteps < 1) return [];

    const playerCount = Object.keys(state.players).length;
    const innIndex = state.stageIndex;
    if (innIndex < 0 || innIndex > 3) return [];

    const targets: ValidMoveTarget[] = [];
    let innAdded = false;

    for (let steps = 1; steps <= maxSteps; steps++) {
      const target = cellPos + steps;
      if (target <= 13) {
        const occupied = Object.values(state.players).some(
          (p) => p.status === 'inLine' && p.cellPos === target && p.playerId !== playerId
        );
        if (!occupied) targets.push({ kind: 'cell', cellNum: target });
      } else if (target === 14) {
        const queue = state.innQueues[innIndex];
        if (queue.length < playerCount && !innAdded) {
          targets.push({ kind: 'inn' });
          innAdded = true;
        }
      }
    }
    return targets;
  }

  getExpectedPlayerId(state: GameRuntimeState): string | null {
    if (state.phase !== 'turns') return null;

    const active = Object.values(state.players).filter((p) => p.status === 'inLine');
    if (active.length === 0) return null;

    active.sort((a, b) => {
      if (a.cellPos !== b.cellPos) return a.cellPos - b.cellPos; // "standing last" = behind => smaller cellPos.
      if (a.cellEnteredAt !== b.cellEnteredAt) return a.cellEnteredAt - b.cellEnteredAt;
      return a.playerId.localeCompare(b.playerId);
    });

    return active[0]?.playerId ?? null;
  }

  processChooseSteps(state: GameRuntimeState, playerId: string, steps: number): GameRuntimeState {
    if (state.phase !== 'turns') {
      throw new GameEngineError('INVALID_PHASE', `Invalid phase: ${state.phase}`);
    }
    if (!playerId || !state.players[playerId]) {
      throw new GameEngineError('NO_SUCH_PLAYER', 'Player not found in runtime state');
    }

    if (state.expectedPlayerId !== playerId) {
      throw new GameEngineError('NOT_EXPECTED_PLAYER', 'Not the expected player for this turn');
    }

    const runtimePlayer = state.players[playerId];
    if (runtimePlayer.status !== 'inLine') {
      throw new GameEngineError('INVALID_PHASE', 'Player is not in the current line stage');
    }

    const cellPos = runtimePlayer.cellPos; // 0..13
    const maxSteps = 14 - cellPos; // landing on 14 => enter inn
    if (!Number.isInteger(steps) || steps < 1 || steps > maxSteps) {
      throw new GameEngineError('INVALID_STEPS', `Invalid steps: ${steps}. Allowed 1..${maxSteps}`);
    }

    const target = cellPos + steps; // 1..14

    // target 1..13 => occupy a line cell
    if (target <= 13) {
      const occupied = Object.values(state.players).some(
        (p) => p.status === 'inLine' && p.cellPos === target && p.playerId !== playerId
      );
      if (occupied) throw new GameEngineError('CANNOT_LAND_OCCUPIED', 'Target cell is occupied');

      const nextSeq = state.seq + 1;
      runtimePlayer.cellPos = target;
      runtimePlayer.cellEnteredAt = nextSeq;
      runtimePlayer.status = 'inLine';

      // Auto-apply MVP effects for cell types (no extra player choice UI yet).
      this.applyCellEffectAuto(state, playerId, target);

      state.seq = nextSeq;
      state.version += 1;
      state.expectedPlayerId = this.getExpectedPlayerId(state);
      return state;
    }

    // target 14 => enter inn
    if (target === 14) {
      const playerCount = Object.keys(state.players).length;
      if (playerCount < 1) {
        throw new GameEngineError('INVALID_PHASE', 'No players in runtime state');
      }

      const innIndex = state.stageIndex; // for stageIndex 0..3 => innQueue 0..3
      if (innIndex < 0 || innIndex > 3) {
        throw new GameEngineError('INVALID_PHASE', 'Invalid stage->inn mapping for MVP');
      }

      const queue = state.innQueues[innIndex];
      if (queue.length >= playerCount) {
        throw new GameEngineError('CANNOT_ENTER_INN_WHEN_FULL', 'Inn is full');
      }

      runtimePlayer.status = 'inInn';
      runtimePlayer.cellPos = 14;
      queue.push(playerId);
      runtimePlayer.hubSeat = queue.length - 1;

      state.seq += 1;
      state.version += 1;

      this.syncInnSelectionAfterQueueChange(state, innIndex);
      return state;
    }

    throw new GameEngineError('INVALID_STEPS', 'Unexpected target cell');
  }

  /**
   * Vào quán: ai tới thì tới lượt chọn quà ngay (theo thứ tự vào quán).
   * Sang line sau: chỉ khi đủ 5/5 trong quán **và** mọi người đã chọn/skip xong.
   */
  private syncInnSelectionAfterQueueChange(state: GameRuntimeState, innIndex: number): void {
    const queue = state.innQueues[innIndex];
    const playerCount = Object.keys(state.players).length;

    if (!state.innSelection || state.innSelection.innIndex !== innIndex) {
      state.innSelection = {
        innIndex,
        arrivalOrder: [...queue],
        completedPicks: [],
        cards: this.generateInnDraft()
      };
    } else {
      const sel = state.innSelection;
      sel.arrivalOrder = [...queue];
      if (sel.cards.length === 0) {
        sel.cards = this.generateInnDraft();
      }
    }

    const sel = state.innSelection;
    const everyoneInInn = queue.length === playerCount;
    const allInQueueHavePicked =
      queue.length > 0 && queue.every((pid) => sel.completedPicks.includes(pid));

    if (everyoneInInn && allInQueueHavePicked) {
      this.finishInnSelection(state);
      return;
    }

    const next = this.nextInnPicker(sel);
    if (next) {
      state.phase = 'inn_pick';
      state.expectedPlayerId = next;
    } else {
      state.phase = 'turns';
      state.expectedPlayerId = this.getExpectedPlayerId(state);
    }
  }

  /** Người tiếp theo chưa chọn quà / skip (theo thứ tự vào quán). */
  private nextInnPicker(sel: InnSelectionState): string | null {
    for (const pid of sel.arrivalOrder) {
      if (!sel.completedPicks.includes(pid)) {
        return pid;
      }
    }
    return null;
  }

  private generateInnDraft(): InnFoodCard[] {
    // MVP: keep 5 food types as available options. For fewer players,
    // only the first N picks (N = arrivalOrder length) will be used.
    const foodTypes = ['food1', 'food2', 'food3', 'food4', 'food5'];
    return foodTypes.map((foodTypeId) => ({
      cardId: this.randomId(),
      foodTypeId,
      cost: 1 + Math.floor(Math.random() * 3),
      points: 6
    }));
  }

  private randomId(): string {
    // Use crypto when available; fallback to random string for environments without crypto.
    const anyCrypto = (globalThis as any).crypto as Crypto | undefined;
    if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }

  processChooseInnCard(
    state: GameRuntimeState,
    playerId: string,
    cardId: string | null
  ): GameRuntimeState {
    if (state.phase !== 'inn_pick') {
      throw new GameEngineError('INVALID_PHASE', `Invalid phase for inn pick: ${state.phase}`);
    }
    if (!state.innSelection) throw new GameEngineError('INVALID_PHASE', 'Missing innSelection');
    if (!playerId || !state.players[playerId]) {
      throw new GameEngineError('NO_SUCH_PLAYER', 'Player not found in runtime state');
    }

    const sel = state.innSelection;
    if (state.expectedPlayerId !== playerId) {
      throw new GameEngineError('NOT_EXPECTED_PLAYER', 'Not the expected player for inn pick');
    }

    const expectedPid = this.nextInnPicker(sel);
    if (expectedPid !== playerId) {
      throw new GameEngineError('NOT_EXPECTED_PLAYER', 'Expected player mismatch');
    }

    const player = state.players[playerId];
    /** Người vào quán đầu tiên (theo thứ tự tới) được miễn phí lần chọn. */
    const firstArrivalId = sel.arrivalOrder[0] ?? null;
    const isFree = firstArrivalId === playerId;

    const markDone = (): void => {
      if (!sel.completedPicks.includes(playerId)) {
        sel.completedPicks.push(playerId);
      }
    };

    if (cardId == null) {
      markDone();
      state.version += 1;
      state.seq += 1;

      const q = state.innQueues[sel.innIndex];
      const pc = Object.keys(state.players).length;
      const shouldFinishInn =
        q.length === pc && q.every((pid) => sel.completedPicks.includes(pid));
      if (shouldFinishInn) {
        return this.finishInnSelection(state);
      }

      const next = this.nextInnPicker(sel);
      if (next) {
        state.phase = 'inn_pick';
        state.expectedPlayerId = next;
      } else {
        state.phase = 'turns';
        state.expectedPlayerId = this.getExpectedPlayerId(state);
      }
      return state;
    }

    const cardIdx = sel.cards.findIndex((c) => c.cardId === cardId);
    if (cardIdx === -1) throw new GameEngineError('INVALID_STEPS', 'Chosen card not available');
    const card = sel.cards[cardIdx];

    // Cannot pick a food type you already own.
    if (player.foods.includes(card.foodTypeId)) {
      throw new GameEngineError('INVALID_STEPS', 'Cannot pick duplicate food type');
    }

    if (!isFree) {
      if (player.coins < card.cost) {
        throw new GameEngineError('INVALID_STEPS', 'Not enough coins to buy this card');
      }
      player.coins -= card.cost;
    }

    player.foods.push(card.foodTypeId);
    player.score += card.points; // always 6 points

    // Remove chosen card from remaining options.
    sel.cards.splice(cardIdx, 1);

    markDone();
    state.seq += 1;
    state.version += 1;

    const q = state.innQueues[sel.innIndex];
    const pc = Object.keys(state.players).length;
    const shouldFinishInn =
      q.length === pc && q.every((pid) => sel.completedPicks.includes(pid));
    if (shouldFinishInn) {
      state.expectedPlayerId = null;
      return this.finishInnSelection(state);
    }

    const next = this.nextInnPicker(sel);
    if (next) {
      state.phase = 'inn_pick';
      state.expectedPlayerId = next;
    } else {
      state.phase = 'turns';
      state.expectedPlayerId = this.getExpectedPlayerId(state);
    }
    return state;
  }

  private finishInnSelection(state: GameRuntimeState): GameRuntimeState {
    if (!state.innSelection) throw new GameEngineError('INVALID_PHASE', 'Missing innSelection');

    const sel = state.innSelection;
    const innIndex = sel.innIndex; // 0..4
    const arrivalOrder = sel.arrivalOrder;

    // Clear innSelection first; then set the next phase.
    state.innSelection = null;

    // Inn1..Inn3: transfer to next line stage.
    if (innIndex >= 0 && innIndex < 3) {
      // Move to next gameplay line.
      state.stageIndex = innIndex + 1;
      state.phase = 'turns';
      state.innQueues[innIndex] = [];

      const transferBase = state.seq + 1000;
      for (let i = 0; i < arrivalOrder.length; i++) {
        const pid = arrivalOrder[i];
        const p = state.players[pid];
        p.status = 'inLine';
        p.cellPos = 0;
        p.cellEnteredAt = transferBase + i;
        p.hubSeat = Math.min(i, 4);
      }

      state.expectedPlayerId = this.getExpectedPlayerId(state);
      return state;
    }

    // Inn4 (index3): chuyển cả bàn sang quán cuối (Inn5) — đủ người nên sync mở chọn quà ngay.
    if (innIndex === 3) {
      state.innQueues[3] = [];
      state.innQueues[4] = [...arrivalOrder];

      arrivalOrder.forEach((pid, i) => {
        const p = state.players[pid];
        p.status = 'inTerminalInn';
        p.cellPos = 14;
        p.hubSeat = Math.min(i, 4);
      });

      state.innSelection = null;
      this.syncInnSelectionAfterQueueChange(state, 4);
      return state;
    }

    // Inn5 (index4): end the game.
    if (innIndex === 4) {
      state.innQueues[4] = [...arrivalOrder];
      state.phase = 'ended';
      state.expectedPlayerId = null;
      state.endedOrder = [...arrivalOrder];
      return state;
    }

    throw new GameEngineError('INVALID_PHASE', `Unknown innIndex: ${innIndex}`);
  }

  private applyCellEffectAuto(state: GameRuntimeState, playerId: string, cellPos: number): void {
    const cellType = getCellType(state.stageIndex, cellPos);
    const player = state.players[playerId];
    if (!player) return;

    switch (cellType) {
      case 'rice': {
        // Đồng lúa: +3 tiền.
        this.scoring.applyRice(player);
        break;
      }
      case 'temple': {
        // Chùa (temple): auto-pick the best affordable deed value in [1..3].
        const deed = (Math.min(3, Math.floor(player.coins)) as number) || 0;
        if (deed >= 1) this.scoring.applyTempleDeed(player, deed as 1 | 2 | 3);
        break;
      }
      case 'scenic': {
        // Phong cảnh: auto-draw 1 card among 3 types.
        const scenicType = (1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3;
        this.scoring.applyScenicCard(player, scenicType);
        break;
      }
      case 'village': {
        // Làng nghề: draw 3 items, auto-buy anything affordable (1..3 items).
        const craftTypes = ['toy', 'ceramic', 'decoration', 'textile'];
        const items = Array.from({ length: 3 }, () => ({
          typeId: craftTypes[Math.floor(Math.random() * craftTypes.length)],
          cost: 1 + Math.floor(Math.random() * 3)
        }));
        this.scoring.applyVillagePurchase(player, items);
        break;
      }
      case 'normal':
      case 'effect':
      case 'con_bac':
      case 'noi_tro':
      case 'tay_balo':
      case 'thay_boi':
      default:
        // Stub/no-op for cells not implemented yet.
        break;
    }

    const demoPts = getCellDemoScoreBonus(state.stageIndex, cellPos);
    if (demoPts > 0) {
      player.score += demoPts;
    }
    const demoCoins = getCellDemoCoinBonus(state.stageIndex, cellPos);
    if (demoCoins > 0) {
      player.coins += demoCoins;
    }
  }
}

function clampCharPrice(n: number | null | undefined): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(6, v));
}

