export type HidingSpotKind = 'curtain' | 'display' | 'locker' | 'archive';
export type HidingSpotEntry = 'north' | 'south' | 'east' | 'west';

export type HidingSpot = {
  id: string;
  name: string;
  kind: HidingSpotKind;
  x: number;
  y: number;
  width: number;
  height: number;
  entry: HidingSpotEntry;
};

export const hidingSpots: HidingSpot[] = [
  { id: 'west-curtain', name: '서관 벽면 커튼', kind: 'curtain', x: 60, y: 735, width: 24, height: 76, entry: 'east' },
  { id: 'sculpture-display', name: '조각 전시대 뒤', kind: 'display', x: 500, y: 210, width: 54, height: 44, entry: 'south' },
  { id: 'central-locker', name: '직원용 보관함', kind: 'locker', x: 760, y: 889, width: 70, height: 30, entry: 'south' },
  { id: 'archive-stack', name: '기록 선반 사이', kind: 'archive', x: 1057, y: 925, width: 28, height: 86, entry: 'east' },
];
