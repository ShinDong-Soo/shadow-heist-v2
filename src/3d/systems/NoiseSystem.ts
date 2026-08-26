import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export type FootstepSurface = 'MARBLE' | 'CARPET' | 'METAL';
export type PlayerNoiseMode = 'CROUCH' | 'WALK' | 'RUN';
export type NoiseKind = 'PLAYER_CROUCH' | 'PLAYER_WALK' | 'PLAYER_RUN' | 'LOCKER_DOOR' | 'CROWN' | 'TREASURE' | 'DOOR' | 'ENVIRONMENT';

export type NoiseEvent = {
  id: number;
  position: Vector3;
  radius: number;
  strength: number;
  surface: FootstepSurface;
  kind: NoiseKind;
};

export class NoiseSystem {
  lastEvent: NoiseEvent | null = null;
  private nextId = 1;
  private remaining = 0;

  emitPlayerFootstep(position: Vector3, mode: PlayerNoiseMode, surface: FootstepSurface) {
    const baseRadius = mode === 'RUN' ? 7 : mode === 'WALK' ? 2.6 : .8;
    const surfaceMultiplier = surface === 'METAL' ? 1.35 : surface === 'CARPET' ? .58 : 1;
    const radius = baseRadius * surfaceMultiplier;
    this.lastEvent = {
      id: this.nextId++,
      position: position.clone(),
      radius,
      strength: Math.min(1, radius / 7),
      surface,
      kind: mode === 'RUN' ? 'PLAYER_RUN' : mode === 'WALK' ? 'PLAYER_WALK' : 'PLAYER_CROUCH',
    };
    this.remaining = .3;
  }

  emit(position: Vector3, kind: NoiseKind, strength: number, baseRange = 7, surface: FootstepSurface = 'MARBLE') {
    const clampedStrength = Math.max(0, Math.min(1, strength));
    this.lastEvent = {
      id: this.nextId++,
      position: position.clone(),
      radius: baseRange * clampedStrength,
      strength: clampedStrength,
      surface,
      kind,
    };
    this.remaining = .35;
  }

  update(deltaTime: number) {
    this.remaining -= deltaTime;
  }

  getAudibleEvent(listenerPosition: Vector3, afterEventId: number) {
    if (!this.lastEvent || this.remaining <= 0 || this.lastEvent.id <= afterEventId) return null;
    if (Vector3.Distance(listenerPosition, this.lastEvent.position) > this.lastEvent.radius) return null;
    return this.lastEvent;
  }

  surfaceAt(position: Vector3): FootstepSurface {
    if (position.z >= -42.5 && position.z <= -32.5) return 'CARPET';
    if ((position.z >= -22.5 && position.z <= -12.5) || (position.x >= 6.7 && position.z <= -18.5)) return 'METAL';
    if (Math.abs(position.x) <= 1.4 && position.z >= -6.6 && position.z <= .1) return 'CARPET';
    if (position.x >= 2.1 && position.z >= 5.45) return 'METAL';
    return 'MARBLE';
  }

  reset() {
    this.lastEvent = null;
    this.remaining = 0;
    this.nextId = 1;
  }
}
