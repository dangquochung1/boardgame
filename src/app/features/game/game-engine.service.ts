import { Injectable } from '@angular/core';
import { ScoringMvpService } from './scoring-mvp.service';
import { getCellType, type CellType } from './cell-types.config';

export type GamePhase = 'character_pick' | 'turns' | 'inn_pick' | 'ended';

export type PlayerRuntime = {
  playerId: string;
  displayName: string;
  characterPrice: number;
  coins: number;
  score: number;

  // For the current gameplay line (0..13). 0 means "before cell 1".
  cellPos: number;
  // Used for tie-break: earlier = goes first.
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
  arrivalOrder: string[]; // length = 5, slot1..slot5
  pickIndex: number; // 0..5 (how many picks already made)
  cards: InnFoodCard[]; // remaining choices
};

export type ChooseStepsAction = {
  type: 'CHOOSE_STEPS';
  payload: { steps: number };
};

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
      character_price: number | null;
    }>;
    version?: number;
  }): GameRuntimeState {
    const players = params.players;
    const version = params.version ?? 1;

    // "Càng rẻ thì càng được đi trước" => cheaper first.
    const sorted = [...players].sort((a, b) => {
      const pa = a.character_price ?? 3;
      const pb = b.character_price ?? 3;
      if (pa !== pb) return pa - pb;
      return a.player_id.localeCompare(b.player_id);
    });

    const seqBase = 1000;
    const runtimePlayers: Record<string, PlayerRuntime> = {};
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      runtimePlayers[p.player_id] = {
        playerId: p.player_id,
        displayName: p.display_name,
        characterPrice: p.character_price ?? 3,
        coins: p.coins,
        score: p.score,
        cellPos: 0,
        cellEnteredAt: seqBase + i,
        status: 'inLine',
        foods: [],
        templeDeeds: [],
        scenicTypes: [],
        craftCounts: {},
        buas: []
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
      const innIndex = state.stageIndex; // for stageIndex 0..3 => innQueue 0..3
      if (innIndex < 0 || innIndex > 3) {
        throw new GameEngineError('INVALID_PHASE', 'Invalid stage->inn mapping for MVP');
      }

      const queue = state.innQueues[innIndex];
      if (queue.length >= 5) throw new GameEngineError('CANNOT_ENTER_INN_WHEN_FULL', 'Inn is full');

      runtimePlayer.status = 'inInn';
      runtimePlayer.cellPos = 14; // debug only

      queue.push(playerId);

      state.seq += 1;
      state.version += 1;

      // Stage completion: when inn filled with 5, pause for Inn card selection.
      if (queue.length === 5) {
        const arrivalOrder = [...queue]; // slot1..slot5 arrival order

        state.phase = 'inn_pick';
        state.innSelection = {
          innIndex,
          arrivalOrder,
          pickIndex: 0,
          cards: this.generateInnDraft()
        };

        state.expectedPlayerId = arrivalOrder[0] ?? null;
        return state;
      }

      // Inn not full yet: select next expected from remaining inLine players.
      state.expectedPlayerId = this.getExpectedPlayerId(state);
      return state;
    }

    throw new GameEngineError('INVALID_STEPS', 'Unexpected target cell');
  }

  private generateInnDraft(): InnFoodCard[] {
    // MVP: 5 food types always appear in each Inn draw.
    // Cost is random 1..3; points are always 6.
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

    const player = state.players[playerId];

    // The expected player is determined by pickIndex and arrivalOrder.
    const expectedPid = sel.arrivalOrder[sel.pickIndex];
    if (expectedPid !== playerId) {
      throw new GameEngineError('NOT_EXPECTED_PLAYER', 'Expected player mismatch');
    }

    if (cardId == null) {
      // Skip
      sel.pickIndex += 1;
      state.expectedPlayerId = sel.pickIndex < sel.arrivalOrder.length ? sel.arrivalOrder[sel.pickIndex] : null;
      state.version += 1;
      state.seq += 1;

      if (sel.pickIndex >= sel.arrivalOrder.length) {
        return this.finishInnSelection(state);
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

    // Only the first arrival (pickIndex === 0) is free.
    const isFree = sel.pickIndex === 0;
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

    sel.pickIndex += 1;
    state.seq += 1;
    state.version += 1;

    if (sel.pickIndex >= sel.arrivalOrder.length) {
      state.expectedPlayerId = null;
      return this.finishInnSelection(state);
    }

    state.expectedPlayerId = sel.arrivalOrder[sel.pickIndex];
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
      }

      state.expectedPlayerId = this.getExpectedPlayerId(state);
      return state;
    }

    // Inn4 (index3): move to Inn5 and immediately start inn5 pick.
    if (innIndex === 3) {
      state.innQueues[3] = [];
      state.innQueues[4] = [...arrivalOrder];

      for (const pid of arrivalOrder) {
        const p = state.players[pid];
        p.status = 'inTerminalInn';
        p.cellPos = 14;
      }

      state.phase = 'inn_pick';
      state.innSelection = {
        innIndex: 4,
        arrivalOrder: [...arrivalOrder],
        pickIndex: 0,
        cards: this.generateInnDraft()
      };
      state.expectedPlayerId = arrivalOrder[0] ?? null;
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
        return;
      }
      case 'temple': {
        // Chùa (temple): auto-pick the best affordable deed value in [1..3].
        const deed = (Math.min(3, Math.floor(player.coins)) as number) || 0;
        if (deed >= 1) this.scoring.applyTempleDeed(player, deed as 1 | 2 | 3);
        return;
      }
      case 'scenic': {
        // Phong cảnh: auto-draw 1 card among 3 types.
        const scenicType = (1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3;
        this.scoring.applyScenicCard(player, scenicType);
        return;
      }
      case 'village': {
        // Làng nghề: draw 3 items, auto-buy anything affordable (1..3 items).
        const craftTypes = ['toy', 'ceramic', 'decoration', 'textile'];
        const items = Array.from({ length: 3 }, () => ({
          typeId: craftTypes[Math.floor(Math.random() * craftTypes.length)],
          cost: 1 + Math.floor(Math.random() * 3)
        }));
        this.scoring.applyVillagePurchase(player, items);
        return;
      }
      case 'normal':
      case 'effect':
      case 'con_bac':
      case 'noi_tro':
      case 'tay_balo':
      case 'thay_boi':
      default:
        // Stub/no-op for cells not implemented yet.
        return;
    }
  }
}

