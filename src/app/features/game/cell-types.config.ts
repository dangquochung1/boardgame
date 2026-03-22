export type CellType =
  | 'normal'
  | 'temple'
  | 'rice'
  | 'village'
  | 'scenic'
  | 'con_bac' // stub
  | 'noi_tro' // stub
  | 'tay_balo' // stub
  | 'thay_boi' // stub
  | 'effect'; // stub (hiệu ứng chung)

// MVP placeholder mapping.
// 4 lines (stageIndex 0..3), each has 13 cells (cellPos 1..13).
//
// IMPORTANT: This is a starting point. Once you confirm the exact board layout
// from your image, we can adjust these indices.
export const CELL_TYPES_BY_LINE: CellType[][] = [
  // Line 1 (stageIndex = 0)
  [
    'normal', // 1
    'scenic', // 2
    'temple', // 3
    'normal', // 4
    'rice', // 5
    'normal', // 6
    'village', // 7
    'normal', // 8
    'rice', // 9
    'temple', // 10
    'village', // 11
    'scenic', // 12
    'normal' // 13
  ],
  // Line 2 (stageIndex = 1)
  [
    'normal',
    'scenic',
    'temple',
    'normal',
    'rice',
    'normal',
    'village',
    'normal',
    'rice',
    'temple',
    'village',
    'scenic',
    'normal'
  ],
  // Line 3 (stageIndex = 2)
  [
    'normal',
    'scenic',
    'temple',
    'normal',
    'rice',
    'normal',
    'village',
    'normal',
    'rice',
    'temple',
    'village',
    'scenic',
    'normal'
  ],
  // Line 4 (stageIndex = 3)
  [
    'normal',
    'scenic',
    'temple',
    'normal',
    'rice',
    'normal',
    'village',
    'normal',
    'rice',
    'temple',
    'village',
    'scenic',
    'normal'
  ]
];

export function getCellType(stageIndex: number, cellPos1to13: number): CellType {
  const line = CELL_TYPES_BY_LINE[stageIndex];
  if (!line) return 'normal';
  const idx = cellPos1to13 - 1;
  if (idx < 0 || idx >= line.length) return 'normal';
  return line[idx];
}

/**
 * Đúng 6 ô / hàng có thêm một hàng ô phụ **phía trên** — cùng loại & cùng nhãn với ô chính bên dưới.
 * Chỉ số 1..13 theo thứ tự trên bàn cờ hàng đó.
 */
export const CELL_UPPER_LAYER_SLOTS: number[][] = [
  [1, 3, 5, 8, 10, 12],
  [2, 4, 7, 9, 11, 13],
  [1, 4, 6, 8, 11, 13],
  [2, 3, 5, 7, 10, 12]
];

export function hasUpperLayerCell(lineIndex: number, cellNum1to13: number): boolean {
  const row = CELL_UPPER_LAYER_SLOTS[lineIndex];
  return row ? row.includes(cellNum1to13) : false;
}

/** Điểm cộng demo (1–3) khi đi vào ô — để test thanh điểm; 0 = không cộng. */
export const CELL_DEMO_SCORE_BONUS: number[][] = [
  [1, 0, 2, 0, 3, 1, 0, 2, 0, 1, 3, 0, 2],
  [0, 2, 1, 3, 0, 2, 0, 1, 0, 3, 2, 1, 0],
  [2, 1, 0, 2, 3, 0, 1, 0, 2, 0, 1, 3, 2],
  [1, 3, 2, 0, 1, 0, 2, 3, 1, 0, 2, 0, 3]
];

export function getCellDemoScoreBonus(stageIndex: number, cellPos1to13: number): number {
  const row = CELL_DEMO_SCORE_BONUS[stageIndex];
  if (!row) return 0;
  const idx = cellPos1to13 - 1;
  if (idx < 0 || idx >= row.length) return 0;
  const v = row[idx];
  return v >= 1 && v <= 3 ? v : 0;
}

/** Xu cộng demo (1–3) khi đi vào ô — hiển thị cạnh ô; 0 = không cộng. */
export const CELL_DEMO_COIN_BONUS: number[][] = [
  [2, 0, 1, 0, 3, 2, 0, 1, 0, 2, 3, 0, 1],
  [0, 1, 3, 2, 0, 1, 0, 3, 0, 2, 1, 2, 0],
  [1, 2, 0, 3, 1, 0, 2, 0, 1, 0, 3, 2, 1],
  [3, 1, 2, 0, 2, 0, 1, 3, 2, 0, 1, 0, 2]
];

export function getCellDemoCoinBonus(stageIndex: number, cellPos1to13: number): number {
  const row = CELL_DEMO_COIN_BONUS[stageIndex];
  if (!row) return 0;
  const idx = cellPos1to13 - 1;
  if (idx < 0 || idx >= row.length) return 0;
  const v = row[idx];
  return v >= 1 && v <= 3 ? v : 0;
}
