export type LockdownReason = 'cctv' | 'final-loot';

export function lockdownDuration(reason: LockdownReason, alertLevel: number) {
  return reason === 'final-loot'
    ? 11 + alertLevel * 1.5
    : 7 + alertLevel * 2;
}
