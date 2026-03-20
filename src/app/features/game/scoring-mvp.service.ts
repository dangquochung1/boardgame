import { type PlayerRuntime } from './game-engine.service';

export type TempleDeedValue = 1 | 2 | 3;

export type VillageCraftItem = {
  // Category/type id for village (toy/gốm/...).
  typeId: string;
  // Mệnh giá 1..3 (dùng để trả tiền).
  cost: number;
};

// MVP scoring formulas based on rules you described.
export class ScoringMvpService {
  addInnFoodCard(params: {
    player: PlayerRuntime;
    // Inn food card always worth 6 points in your rules.
    points: number; // should be 6
    // Cost to pay (0 for free first picker).
    costPaid: number;
    foodTypeId: string;
  }): void {
    const { player, points, costPaid, foodTypeId } = params;
    if (player.foods.includes(foodTypeId)) {
      // The engine should normally prevent this, but keep it safe.
      return;
    }

    if (costPaid > 0) {
      if (player.coins < costPaid) return;
      player.coins -= costPaid;
    }

    player.foods.push(foodTypeId);
    player.score += points;
  }

  applyTempleDeed(player: PlayerRuntime, deedValue: TempleDeedValue): void {
    // Temple: choose 1..3, pay deedValue coins and gain deedValue points.
    if (player.coins < deedValue) return;

    player.coins -= deedValue;
    player.score += deedValue;

    player.templeDeeds.push(deedValue);

    // Each unit of công đức allows drawing 1 blessing card (stub).
    for (let i = 0; i < deedValue; i++) {
      player.buas.push(`temple_bua_stub_${Date.now()}_${i}`);
    }
  }

  applyRice(player: PlayerRuntime): void {
    // Đồng lúa: +3 tiền (coins). Coins are later used for buying at inns/temple.
    player.coins += 3;
  }

  applyScenicCard(player: PlayerRuntime, scenicType: 1 | 2 | 3): void {
    // Scenic: each card has base points from 1..3.
    // If you already own the same scenic type, you gain +1 per already-owned card.
    const existingCount = player.scenicTypes.filter((t) => t === scenicType).length;
    const delta = scenicType + existingCount;

    player.score += delta;
    player.scenicTypes.push(scenicType);
  }

  applyVillagePurchase(player: PlayerRuntime, items: VillageCraftItem[]): void {
    for (const item of items) {
      this.applyVillageSingleItem(player, item);
    }
  }

  private applyVillageSingleItem(player: PlayerRuntime, item: VillageCraftItem): void {
    // Village craft: max +7 per type => max 4 purchases per type.
    // Threshold points: count=1=>+1, 2=>+3, 3=>+5, 4=>+7.
    const current = player.craftCounts[item.typeId] ?? 0;
    if (current >= 4) return;

    const scoreByCount = [0, 1, 3, 5, 7] as const;
    const nextCount = current + 1;
    const deltaScore = scoreByCount[nextCount] - scoreByCount[current];

    // Village items are paid with coins based on their cost.
    if (player.coins < item.cost) return;
    player.coins -= item.cost;

    player.craftCounts[item.typeId] = nextCount;
    player.score += deltaScore;
  }

  computeFinalScoreFromRuntime(player: PlayerRuntime): number {
    // In MVP we keep `player.score` updated incrementally.
    // This is a fallback computation if you later change integration approach.
    return player.score;
  }
}

