export type GuardState = 'PATROL' | 'SUSPICIOUS' | 'INVESTIGATE' | 'CHASE' | 'SEARCH' | 'HIDE_CHECK';

export type GuardPoint = { x: number; y: number };

export type GuardActor = GuardPoint & {
  id: string;
  name: string;
  facing: number;
  target: number;
  state: GuardState;
  stateTime: number;
  lostSightTime: number;
  lastSeen: GuardPoint;
  searchOrigin: GuardPoint;
  searchStep: number;
  path: GuardPoint[];
  pathIndex: number;
  pathTarget: GuardPoint;
  repathTimer: number;
  suspectedHideId: string | null;
};

export const supportPatrol: GuardPoint[] = [
  { x: 1220, y: 900 }, { x: 1510, y: 930 }, { x: 1650, y: 740 },
  { x: 1490, y: 560 }, { x: 1260, y: 540 }, { x: 1100, y: 720 },
];

export function createSupportGuard(): GuardActor {
  return {
    id: 'guard-bravo', name: '경비 브라보', x: 1220, y: 900, facing: 0, target: 1,
    state: 'PATROL', stateTime: 0, lostSightTime: 0,
    lastSeen: { x: 0, y: 0 }, searchOrigin: { x: 0, y: 0 }, searchStep: 0,
    path: [], pathIndex: 0, pathTarget: { x: 0, y: 0 }, repathTimer: 0, suspectedHideId: null,
  };
}
