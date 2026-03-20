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

