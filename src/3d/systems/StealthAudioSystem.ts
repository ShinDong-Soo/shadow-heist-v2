import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { FootstepSurface } from './NoiseSystem';

export class StealthAudioSystem {
  private static readonly GUARD_AUDIBLE_DISTANCE = 13;
  private context: AudioContext | null = null;
  private guardFootstepBuffer: AudioBuffer | null = null;
  private guardFootstepLoading = false;
  private guardFootstepPromise: Promise<void> | null = null;
  private guardFootstepCursor = 0;
  private breathRemaining = 0;

  constructor(_initialGuardPosition: Vector3) {
    window.addEventListener('keydown', this.unlock, { once: true, capture: true });
    window.addEventListener('pointerdown', this.unlock, { once: true, capture: true });
  }

  async preload() {
    const context = this.ensureContext();
    if (!context) return;
    await this.loadGuardFootstep(context);
  }

  update(deltaTime: number, _guardPosition: Vector3, _playerPosition: Vector3, hidden: boolean, tension: number) {
    if (!hidden || tension < .72) {
      this.breathRemaining = 0;
      return;
    }
    this.breathRemaining -= deltaTime;
    if (this.breathRemaining <= 0) {
      this.playBreath(tension);
      this.breathRemaining = 2.4 - tension * .65;
    }
  }

  playLockerDoor(opening: boolean) {
    const context = this.ensureContext();
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(opening ? 155 : 128, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(opening ? 92 : 58, context.currentTime + .24);
    gain.gain.setValueAtTime(.026, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .27);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .28);
  }

  playGuardFootstep(guardPosition: Vector3, playerPosition: Vector3, hidden: boolean, strength: number, surface: FootstepSurface = 'MARBLE') {
    const distance = Vector3.Distance(guardPosition, playerPosition);
    if (this.playSampledGuardFootstep(distance, guardPosition.x - playerPosition.x, hidden, strength, surface)) return;
    this.playFootstep(
      distance,
      guardPosition.x - playerPosition.x,
      hidden,
      strength,
      this.surfaceFrequency(surface, 68),
      StealthAudioSystem.GUARD_AUDIBLE_DISTANCE,
    );
  }

  playPlayerFootstep(strength: number, surface: FootstepSurface = 'MARBLE') {
    this.playFootstep(0, 0, false, strength * .46, this.surfaceFrequency(surface, 105));
  }

  reset(_guardPosition: Vector3) {
    this.breathRemaining = 0;
    this.guardFootstepCursor = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this.unlock, true);
    window.removeEventListener('pointerdown', this.unlock, true);
    void this.context?.close();
  }

  private playFootstep(
    distance: number,
    horizontalOffset: number,
    hidden: boolean,
    strength: number,
    frequency: number,
    maxDistance = 10,
  ) {
    if (distance > maxDistance) return;
    const context = this.ensureContext();
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    const distanceGain = Math.pow(1 - Scalar.Clamp(distance / maxDistance, 0, 1), 1.35);
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .5, context.currentTime + .09);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, distanceGain * (hidden ? .085 : .058) * strength), context.currentTime + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .12);
    panner.pan.value = Scalar.Clamp(horizontalOffset / Math.max(2.5, distance), -1, 1);
    oscillator.connect(gain).connect(panner).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .13);
  }

  private playBreath(tension: number) {
    const context = this.ensureContext();
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 104;
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.006 * tension, context.currentTime + .2);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .75);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .78);
  }

  private readonly unlock = () => this.ensureContext();

  private playSampledGuardFootstep(
    distance: number,
    horizontalOffset: number,
    hidden: boolean,
    strength: number,
    surface: FootstepSurface,
  ) {
    if (distance > StealthAudioSystem.GUARD_AUDIBLE_DISTANCE || !this.guardFootstepBuffer) return false;
    const context = this.ensureContext();
    if (!context || context.state !== 'running') return false;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    const filter = context.createBiquadFilter();
    const distanceGain = Math.pow(1 - Scalar.Clamp(distance / StealthAudioSystem.GUARD_AUDIBLE_DISTANCE, 0, 1), 1.35);
    const sliceCount = Math.max(4, Math.min(12, Math.round(this.guardFootstepBuffer.duration / .55)));
    const sliceLength = this.guardFootstepBuffer.duration / sliceCount;
    const sliceIndex = this.guardFootstepCursor % sliceCount;
    const offset = sliceIndex * sliceLength;
    const duration = Math.min(.4, sliceLength, this.guardFootstepBuffer.duration - offset);
    const now = context.currentTime;
    this.guardFootstepCursor += 1;
    source.buffer = this.guardFootstepBuffer;
    source.playbackRate.value = surface === 'METAL' ? 1.16 : surface === 'CARPET' ? .86 : 1;
    const peak = Math.max(.0001, distanceGain * (hidden ? .34 : .24) * strength);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + .012);
    gain.gain.setValueAtTime(Math.max(.0001, peak * .68), now + Math.max(.03, duration - .07));
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    panner.pan.value = Scalar.Clamp(horizontalOffset / Math.max(2.5, distance), -1, 1);
    filter.type = 'lowpass';
    filter.frequency.value = hidden ? 3600 : 4200;
    source.connect(gain).connect(filter).connect(panner).connect(context.destination);
    source.start(now, offset, duration);
    return true;
  }

  private surfaceFrequency(surface: FootstepSurface, base: number) {
    if (surface === 'METAL') return base * 1.55;
    if (surface === 'CARPET') return base * .72;
    return base;
  }

  private ensureContext() {
    try {
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      void this.loadGuardFootstep(this.context);
      return this.context;
    } catch {
      return null;
    }
  }

  private loadGuardFootstep(context: AudioContext): Promise<void> {
    if (this.guardFootstepBuffer) return Promise.resolve();
    if (this.guardFootstepPromise) return this.guardFootstepPromise;
    this.guardFootstepLoading = true;
    this.guardFootstepPromise = fetch(`${import.meta.env.BASE_URL}assets/audio/guard-footstep.mp3`)
      .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(data => context.decodeAudioData(data))
      .then(buffer => { this.guardFootstepBuffer = buffer; })
      .catch(error => console.warn('[Audio] Guard footstep sample unavailable; using synthesized fallback.', error))
      .finally(() => { this.guardFootstepLoading = false; });
    return this.guardFootstepPromise;
  }
}
