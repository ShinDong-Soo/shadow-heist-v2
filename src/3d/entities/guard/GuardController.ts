import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GUARD_CONFIG } from '../../config/guardConfig';
import { GUARD_VISION_CONFIG } from '../../config/guardVisionConfig';
import { moveCircleWithSliding, type CollisionBox } from '../../systems/CollisionWorld';
import type { DetectionState } from '../../systems/DetectionSystem';
import type { Guard } from './Guard';
import type { GuardFlashlight } from './GuardFlashlight';
import type { GuardPatrol } from './GuardPatrol';

export type GuardPatrolState = 'IDLE' | 'TURN' | 'PATROL';
export type GuardState = GuardPatrolState | 'SUSPICIOUS' | 'DETECTED';

export class GuardController {
  private patrolState: GuardPatrolState = 'PATROL';
  private awarenessState: DetectionState = 'CLEAR';
  private awarenessTarget: Vector3 | null = null;
  private pauseRemaining = 0;
  private readonly forward = new Vector3(0, 0, 1);

  constructor(
    private readonly guard: Guard,
    private readonly patrol: GuardPatrol,
    private readonly flashlight: GuardFlashlight,
    private readonly collisionBoxes: CollisionBox[],
  ) {
    const initialDirection = patrol.target.subtract(patrol.start).normalize();
    guard.root.rotation.y = Math.atan2(initialDirection.x, initialDirection.z);
    guard.navigationTarget.position.copyFrom(patrol.target);
    this.forward.copyFrom(initialDirection);
  }

  update(deltaTime: number) {
    if (this.awarenessState !== 'CLEAR' && this.awarenessTarget) this.updateAwarenessTurn(deltaTime);
    else if (this.patrolState === 'IDLE') this.updateIdle(deltaTime);
    else if (this.patrolState === 'TURN') this.updateTurn(deltaTime);
    else this.updatePatrol(deltaTime);

    this.flashlight.update(deltaTime, this.state === 'PATROL');
  }

  setAwareness(state: DetectionState, target: Vector3) {
    this.awarenessState = state;
    this.awarenessTarget = state === 'CLEAR' ? null : target.clone();
  }

  private updateIdle(deltaTime: number) {
    this.pauseRemaining -= deltaTime;
    if (this.pauseRemaining <= 0) this.patrolState = 'TURN';
  }

  private updateTurn(deltaTime: number) {
    const desired = this.patrol.target.subtract(this.guard.position);
    desired.y = 0;
    if (desired.lengthSquared() < .0001) {
      this.beginPauseAtWaypoint();
      return;
    }
    desired.normalize();
    const targetYaw = Math.atan2(desired.x, desired.z);
    const yawDelta = Scalar.NormalizeRadians(targetYaw - this.guard.root.rotation.y);
    const step = GUARD_CONFIG.rotationSpeed * deltaTime;
    if (Math.abs(yawDelta) <= step) {
      this.guard.root.rotation.y = targetYaw;
      this.forward.copyFrom(desired);
      this.patrolState = 'PATROL';
      return;
    }
    this.guard.root.rotation.y += Math.sign(yawDelta) * step;
    this.forward.copyFromFloats(Math.sin(this.guard.root.rotation.y), 0, Math.cos(this.guard.root.rotation.y));
  }

  private updatePatrol(deltaTime: number) {
    const toTarget = this.patrol.target.subtract(this.guard.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance <= GUARD_CONFIG.arrivalRadius) {
      this.guard.position.copyFrom(this.patrol.target);
      this.beginPauseAtWaypoint();
      return;
    }

    const direction = toTarget.scale(1 / distance);
    const travel = Math.min(distance, GUARD_CONFIG.patrolSpeed * deltaTime);
    const result = moveCircleWithSliding(
      this.guard.position.x,
      this.guard.position.z,
      direction.x * travel,
      direction.z * travel,
      GUARD_CONFIG.radius,
      this.collisionBoxes,
    );
    this.guard.position.x = result.x;
    this.guard.position.z = result.z;
    this.guard.position.y = 0;
    this.forward.copyFrom(direction);
  }

  private updateAwarenessTurn(deltaTime: number) {
    if (!this.awarenessTarget) return;
    const desired = this.awarenessTarget.subtract(this.guard.position);
    desired.y = 0;
    if (desired.lengthSquared() < .0001) return;
    desired.normalize();
    const targetYaw = Math.atan2(desired.x, desired.z);
    const yawDelta = Scalar.NormalizeRadians(targetYaw - this.guard.root.rotation.y);
    const turnSpeed = this.awarenessState === 'DETECTED'
      ? GUARD_VISION_CONFIG.detectedRotationSpeed
      : GUARD_VISION_CONFIG.suspiciousRotationSpeed;
    const step = turnSpeed * deltaTime;
    this.guard.root.rotation.y += Math.abs(yawDelta) <= step ? yawDelta : Math.sign(yawDelta) * step;
    this.forward.copyFromFloats(Math.sin(this.guard.root.rotation.y), 0, Math.cos(this.guard.root.rotation.y));
  }

  private beginPauseAtWaypoint() {
    this.patrol.advance();
    this.guard.navigationTarget.position.copyFrom(this.patrol.target);
    this.pauseRemaining = GUARD_CONFIG.pauseTime;
    this.patrolState = 'IDLE';
  }

  get state(): GuardState {
    return this.awarenessState === 'CLEAR' ? this.patrolState : this.awarenessState;
  }

  get patrolLabel() {
    return `${this.patrol.currentIndex + 1} / ${this.patrol.pointCount}`;
  }

  get forwardDirection() {
    return this.forward;
  }
}
