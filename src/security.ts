import { BALANCE } from './balance';

export type LockdownReason = 'cctv' | 'final-loot';

export function lockdownDuration(reason: LockdownReason, alertLevel: number) {
  return reason === 'final-loot'
    ? BALANCE.lockdown.finalLootBase + alertLevel * BALANCE.lockdown.finalLootPerAlert
    : BALANCE.lockdown.cctvBase + alertLevel * BALANCE.lockdown.cctvPerAlert;
}
