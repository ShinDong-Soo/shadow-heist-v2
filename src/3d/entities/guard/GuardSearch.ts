import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GUARD_AI_CONFIG } from '../../config/guardAIConfig';
import type { GuardNavigation } from './GuardNavigation';

export class GuardSearch {
  readonly origin = Vector3.Zero();
  readonly points: Vector3[] = [];
  currentIndex = -1;
  private generation = 0;

  constructor(private readonly navigation: GuardNavigation) {}

  generate(origin: Vector3, alarm: boolean) {
    this.origin.copyFrom(origin);
    this.origin.y = 0;
    this.points.length = 0;
    this.currentIndex = -1;
    const count = alarm ? GUARD_AI_CONFIG.alarm.searchPointCount : GUARD_AI_CONFIG.searchPointCount;
    const baseAngle = this.generation % 2 === 0 ? Math.PI / 8 : -Math.PI / 8;
    this.generation += 1;
    const directions = GUARD_AI_CONFIG.searchCandidateDirections;
    for (const radius of GUARD_AI_CONFIG.searchPointRadii) {
      for (let index = 0; index < directions && this.points.length < count; index += 1) {
        // Alternating the direction order prevents every search from tracing
        // the same clockwise pattern while remaining deterministic and fair.
        const orderedIndex = this.generation % 2 === 0 ? index : directions - 1 - index;
        const angle = baseAngle + orderedIndex * Math.PI * 2 / directions;
        const candidate = new Vector3(
          origin.x + Math.sin(angle) * radius,
          0,
          origin.z + Math.cos(angle) * radius,
        );
        const distinct = this.points.every(point => Vector3.DistanceSquared(point, candidate) >= GUARD_AI_CONFIG.searchPointMinSpacing ** 2);
        if (distinct && this.navigation.canReachPoint(candidate)) this.points.push(candidate);
      }
    }
    // The known position itself is always a fair fallback when nearby points
    // are inside walls or display cases.
    if (this.points.length === 0) this.points.push(this.origin.clone());
  }

  nextPoint() {
    if (this.points.length === 0) return null;
    this.currentIndex = (this.currentIndex + 1) % this.points.length;
    return this.points[this.currentIndex];
  }

  discardCurrentPoint() {
    if (this.currentIndex < 0 || this.currentIndex >= this.points.length) return;
    this.points.splice(this.currentIndex, 1);
    this.currentIndex -= 1;
  }

  reset() {
    this.origin.setAll(0);
    this.points.length = 0;
    this.currentIndex = -1;
    this.generation = 0;
  }
}
