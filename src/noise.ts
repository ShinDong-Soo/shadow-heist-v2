import { BALANCE } from './balance';

export type NoisePoint = { x: number; y: number };

export type NoisePulse = NoisePoint & {
  radius: number;
  age: number;
  duration: number;
  mode: MovementMode;
};

export type MovementMode = 'walk' | 'run' | 'crouch';

export type MovementNoiseProfile = {
  radius: number;
  interval: number;
};

export function movementNoiseProfile(mode: MovementMode, lootCount: number): MovementNoiseProfile {
  // 보물이 늘수록 가방이 무거워져 발소리가 조금 더 멀리 전달된다.
  if (mode === 'crouch') return { radius: BALANCE.noise.crouchRadius + lootCount * BALANCE.noise.crouchLootBonus, interval: BALANCE.noise.crouchInterval };
  if (mode === 'run') return { radius: BALANCE.noise.runRadius + lootCount * BALANCE.noise.runLootBonus, interval: BALANCE.noise.runInterval };
  return { radius: BALANCE.noise.walkRadius + lootCount * BALANCE.noise.walkLootBonus, interval: BALANCE.noise.walkInterval };
}

export function effectiveHearingRadius(radius: number, wallBlocked: boolean, alertLevel: number) {
  const wallMultiplier = wallBlocked ? BALANCE.noise.wallMultiplier : 1;
  const alertMultiplier = 1 + alertLevel * BALANCE.noise.alertMultiplier;
  return radius * wallMultiplier * alertMultiplier;
}
