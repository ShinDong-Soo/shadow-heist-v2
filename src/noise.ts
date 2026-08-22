export type NoisePoint = { x: number; y: number };

export type NoisePulse = NoisePoint & {
  radius: number;
  age: number;
  duration: number;
  mode: MovementMode;
};

export type MovementMode = 'normal' | 'careful' | 'crouch';

export type MovementNoiseProfile = {
  radius: number;
  interval: number;
};

export function movementNoiseProfile(mode: MovementMode, lootCount: number): MovementNoiseProfile {
  // 보물이 늘수록 가방이 무거워져 발소리가 조금 더 멀리 전달된다.
  if (mode === 'crouch') return { radius: 65 + lootCount * 6, interval: .72 };
  if (mode === 'careful') return { radius: 105 + lootCount * 8, interval: .58 };
  return { radius: 285 + lootCount * 14, interval: .34 };
}

export function effectiveHearingRadius(radius: number, wallBlocked: boolean, alertLevel: number) {
  const wallMultiplier = wallBlocked ? .58 : 1;
  const alertMultiplier = 1 + alertLevel * .06;
  return radius * wallMultiplier * alertMultiplier;
}
