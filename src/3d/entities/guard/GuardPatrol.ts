import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export class GuardPatrol {
  points: Vector3[];
  private targetIndex = 1;

  constructor(route: readonly (readonly [number, number, number])[]) {
    if (route.length < 2) throw new Error('Guard patrol requires at least two points.');
    this.points = route.map(([x, y, z]) => new Vector3(x, y, z));
  }

  get start() {
    return this.points[0];
  }

  get target() {
    return this.points[this.targetIndex];
  }

  get currentIndex() {
    return this.targetIndex;
  }

  get pointCount() {
    return this.points.length;
  }

  advance() {
    this.targetIndex = (this.targetIndex + 1) % this.points.length;
  }

  setRoute(route: readonly (readonly [number, number, number])[]) {
    if (route.length < 2) throw new Error('Guard patrol requires at least two points.');
    this.points = route.map(([x, y, z]) => new Vector3(x, y, z));
    this.targetIndex = 0;
  }

  reset(route: readonly (readonly [number, number, number])[]) {
    this.points = route.map(([x, y, z]) => new Vector3(x, y, z));
    this.targetIndex = 1;
  }
}
