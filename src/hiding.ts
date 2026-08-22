export type HidingSpotKind = 'curtain' | 'display' | 'locker' | 'archive';

export type HidingSpot = {
  id: string;
  name: string;
  kind: HidingSpotKind;
  x: number;
  y: number;
};

export const hidingSpots: HidingSpot[] = [
  { id: 'west-curtain', name: '서관 커튼', kind: 'curtain', x: 270, y: 740 },
  { id: 'sculpture-display', name: '조각 전시대', kind: 'display', x: 585, y: 755 },
  { id: 'central-locker', name: '중앙 보관함', kind: 'locker', x: 735, y: 930 },
  { id: 'archive-stack', name: '기록 보관 공간', kind: 'archive', x: 1120, y: 925 },
  { id: 'east-curtain', name: '동관 커튼', kind: 'curtain', x: 1460, y: 910 },
];
