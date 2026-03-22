import type { CellType } from '../game/cell-types.config';

/** Nhãn tiếng Việt tạm thời cho từng loại ô (MVP). */
export function cellTypeLabelVi(t: CellType): string {
  switch (t) {
    case 'temple':
      return 'Chùa';
    case 'rice':
      return 'Đồng lúa';
    case 'village':
      return 'Làng nghề';
    case 'scenic':
      return 'Phong cảnh';
    case 'normal':
      return 'Đường';
    case 'con_bac':
      return 'Con bạc';
    case 'noi_tro':
      return 'Nội trợ';
    case 'tay_balo':
      return 'Tây balô';
    case 'thay_boi':
      return 'Thầy bói';
    case 'effect':
      return 'Hiệu ứng';
    default:
      return 'Ô';
  }
}
