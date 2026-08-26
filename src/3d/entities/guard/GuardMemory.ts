import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export type GuardMemorySource = 'NONE' | 'VISUAL' | 'HEARING' | 'ALARM' | 'RADIO' | 'HIDE_SPOT';

export class GuardMemory {
  readonly lastSeenPosition = Vector3.Zero();
  readonly lastHeardPosition = Vector3.Zero();
  readonly lastKnownPlayerDirection = Vector3.Zero();
  readonly lastKnownHideSpotPosition = Vector3.Zero();
  lastSeenTime = Number.NEGATIVE_INFINITY;
  lastHeardTime = Number.NEGATIVE_INFINITY;
  lastKnownHideSpot: string | null = null;
  source: GuardMemorySource = 'NONE';
  private clock = 0;
  private hasSeen = false;
  private hasHeard = false;

  update(deltaTime: number) {
    this.clock += deltaTime;
  }

  rememberSeen(position: Vector3) {
    if (this.hasSeen) {
      position.subtractToRef(this.lastSeenPosition, this.lastKnownPlayerDirection);
      this.lastKnownPlayerDirection.y = 0;
      if (this.lastKnownPlayerDirection.lengthSquared() > .0001) this.lastKnownPlayerDirection.normalize();
    }
    this.lastSeenPosition.copyFrom(position);
    this.lastSeenPosition.y = 0;
    this.lastSeenTime = this.clock;
    this.source = 'VISUAL';
    this.hasSeen = true;
  }

  rememberHeard(position: Vector3) {
    this.lastHeardPosition.copyFrom(position);
    this.lastHeardPosition.y = 0;
    this.lastHeardTime = this.clock;
    this.source = 'HEARING';
    this.hasHeard = true;
  }

  rememberAlarm(position: Vector3) {
    this.lastHeardPosition.copyFrom(position);
    this.lastHeardPosition.y = 0;
    this.lastHeardTime = this.clock;
    this.source = 'ALARM';
    this.hasHeard = true;
  }

  rememberRadio(position: Vector3) {
    this.lastHeardPosition.copyFrom(position);
    this.lastHeardPosition.y = 0;
    this.lastHeardTime = this.clock;
    this.source = 'RADIO';
    this.hasHeard = true;
  }

  rememberHideSpot(id: string, position: Vector3) {
    this.lastKnownHideSpot = id;
    this.lastKnownHideSpotPosition.copyFrom(position);
    this.lastKnownHideSpotPosition.y = 0;
    this.source = 'HIDE_SPOT';
  }

  get predictedLastSeenPosition() {
    return this.lastSeenPosition.clone();
  }

  get mostRecentKnownPosition() {
    if (this.lastKnownHideSpot && this.source === 'HIDE_SPOT') return this.lastKnownHideSpotPosition.clone();
    if (this.hasSeen && (!this.hasHeard || this.lastSeenTime >= this.lastHeardTime)) return this.lastSeenPosition.clone();
    if (this.hasHeard) return this.lastHeardPosition.clone();
    return null;
  }

  get seenAge() {
    return this.hasSeen ? Math.max(0, this.clock - this.lastSeenTime) : Infinity;
  }

  get heardAge() {
    return this.hasHeard ? Math.max(0, this.clock - this.lastHeardTime) : Infinity;
  }

  reset() {
    this.lastSeenPosition.setAll(0);
    this.lastHeardPosition.setAll(0);
    this.lastKnownPlayerDirection.setAll(0);
    this.lastKnownHideSpotPosition.setAll(0);
    this.lastSeenTime = Number.NEGATIVE_INFINITY;
    this.lastHeardTime = Number.NEGATIVE_INFINITY;
    this.lastKnownHideSpot = null;
    this.source = 'NONE';
    this.clock = 0;
    this.hasSeen = false;
    this.hasHeard = false;
  }
}
