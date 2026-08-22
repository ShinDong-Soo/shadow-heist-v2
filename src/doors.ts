export type Door = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  open: boolean;
  defaultOpen: boolean;
  locked: boolean;
};

export type Keycard = {
  id: string;
  name: string;
  x: number;
  y: number;
  collected: boolean;
};

export const doors: Door[] = [
  { id: 'west-gallery', name: '서쪽 전시실 문', x: 310, y: 312, w: 32, h: 92, open: false, defaultOpen: false, locked: false },
  { id: 'central-hall', name: '중앙 통로 문', x: 650, y: 489, w: 32, h: 92, open: true, defaultOpen: true, locked: false },
  { id: 'vault', name: '왕관 보관실 보안문', x: 1370, y: 120, w: 32, h: 90, open: false, defaultOpen: false, locked: true },
];

export const keycard: Keycard = {
  id: 'security-keycard',
  name: '보안 키카드',
  x: 1175,
  y: 910,
  collected: false,
};
