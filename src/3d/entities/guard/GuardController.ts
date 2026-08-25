import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GUARD_CONFIG } from '../../config/guardConfig';
import { CROWN_HALL_CONFIG } from '../../config/crownHallConfig';
import { GUARD_VISION_CONFIG } from '../../config/guardVisionConfig';
import { moveCircleWithSliding, type CollisionBox } from '../../systems/CollisionWorld';
import type { DetectionState } from '../../systems/DetectionSystem';
import type { Guard } from './Guard';
import type { GuardFlashlight } from './GuardFlashlight';
import type { GuardPatrol } from './GuardPatrol';
import type { LockdownThreatStage } from '../../systems/LockdownSystem';

export type GuardPatrolState = 'IDLE' | 'TURN' | 'PATROL';
export type GuardState = GuardPatrolState | 'ALERT' | 'SUSPICIOUS' | 'DETECTED';

export class GuardController {
  private patrolState: GuardPatrolState = 'PATROL';
  private awarenessState: DetectionState = 'CLEAR';
  private awarenessTarget: Vector3 | null = null;
  private pauseRemaining = 0;
  private debugFrozen = false;
  private alertMode = false;
  private lockdownStage: LockdownThreatStage = 'NONE';
  private scanElapsed = 0;
  private scanBaseYaw = 0;
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
    if (this.debugFrozen) {
      this.flashlight.update(deltaTime, false);
      return;
    }
    if (this.awarenessState !== 'CLEAR' && this.awarenessTarget) this.updateAwarenessTurn(deltaTime);
    else if (this.patrolState === 'IDLE') this.updateIdle(deltaTime);
    else if (this.patrolState === 'TURN') this.updateTurn(deltaTime);
    else this.updatePatrol(deltaTime);

    this.flashlight.update(deltaTime, this.state === 'PATROL' || this.state === 'ALERT', this.alertMode);
  }

  setAwareness(state: DetectionState, target: Vector3) {
    this.awarenessState = state;
    this.awarenessTarget = state === 'CLEAR' ? null : target.clone();
  }

  setDebugFrozen(frozen: boolean) {
    this.debugFrozen = frozen;
  }

  setAlertMode(active: boolean) {
    if (this.alertMode === active) return;
    this.alertMode = active;
    this.awarenessState = 'CLEAR';
    this.awarenessTarget = null;
    this.patrolState = 'TURN';
    if (active) this.patrol.setRoute(CROWN_HALL_CONFIG.alertGuardRoute);
    else this.patrol.reset(CROWN_HALL_CONFIG.guardRoute);
    this.guard.navigationTarget.position.copyFrom(this.patrol.target);
  }

  setLockdownStage(stage: LockdownThreatStage) {
    if (this.lockdownStage === stage) return;
    this.lockdownStage = stage;
    if (stage === 'NONE') return;
    const routes = CROWN_HALL_CONFIG.lockdownGuardRoutes;
    const route = stage === 'CROWN_SWEEP' ? routes.crown : stage === 'WEST_SWEEP' ? routes.west : routes.exit;
    this.patrol.setRoute(route);
    this.guard.navigationTarget.position.copyFrom(this.patrol.target);
    this.patrolState = 'TURN';
  }

  reset() {
    this.debugFrozen = false;
    this.alertMode = false;
    this.lockdownStage = 'NONE';
    this.scanElapsed = 0;
    this.awarenessState = 'CLEAR';
    this.awarenessTarget = null;
    this.pauseRemaining = 0;
    this.patrolState = 'PATROL';
    this.patrol.reset(CROWN_HALL_CONFIG.guardRoute);
    this.guard.position.copyFrom(this.patrol.start);
    const initialDirection = this.patrol.target.subtract(this.patrol.start).normalize();
    this.guard.root.rotation.y = Math.atan2(initialDirection.x, initialDirection.z);
    this.forward.copyFrom(initialDirection);
    this.guard.navigationTarget.position.copyFrom(this.patrol.target);
    this.flashlight.reset();
  }

  private updateIdle(deltaTime: number) {
    if (this.alertMode) {
      this.scanElapsed += deltaTime;
      this.guard.root.rotation.y = this.scanBaseYaw + Math.sin(this.scanElapsed * 4.5) * .52;
      this.forward.copyFromFloats(Math.sin(this.guard.root.rotation.y), 0, Math.cos(this.guard.root.rotation.y));
    }
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
    const speed = this.alertMode ? GUARD_CONFIG.alertSpeed : GUARD_CONFIG.patrolSpeed;
    const travel = Math.min(distance, speed * deltaTime);
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
    this.pauseRemaining = this.alertMode ? GUARD_CONFIG.alertPauseTime : GUARD_CONFIG.pauseTime;
    this.scanElapsed = 0;
    this.scanBaseYaw = this.guard.root.rotation.y;
    this.patrolState = 'IDLE';
  }

  get state(): GuardState {
    if (this.awarenessState !== 'CLEAR') return this.awarenessState;
    return this.alertMode ? 'ALERT' : this.patrolState;
  }

  get patrolLabel() {
    return `${this.patrol.currentIndex + 1} / ${this.patrol.pointCount}`;
  }

  get forwardDirection() {
    return this.forward;
  }

  get activeLockdownStage() {
    return this.lockdownStage;
  }
}
