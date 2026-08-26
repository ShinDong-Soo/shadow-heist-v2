import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GUARD_AI_CONFIG } from '../../config/guardAIConfig';
import { GUARD_CONFIG } from '../../config/guardConfig';
import { CROWN_HALL_CONFIG } from '../../config/crownHallConfig';
import type { GuardRouteProfile } from '../../config/museumMapConfig';
import { GUARD_VISION_CONFIG } from '../../config/guardVisionConfig';
import type { CollisionBox } from '../../systems/CollisionWorld';
import type { DetectionState } from '../../systems/DetectionSystem';
import type { LockdownThreatStage } from '../../systems/LockdownSystem';
import type { Guard } from './Guard';
import type { GuardFlashlight } from './GuardFlashlight';
import { GuardMemory } from './GuardMemory';
import { GuardNavigation } from './GuardNavigation';
import type { GuardPatrol } from './GuardPatrol';
import { GuardRadio } from './GuardRadio';
import { GuardSearch } from './GuardSearch';
import { GuardStateMachine, type GuardAIStateId } from './GuardStateMachine';

export type GuardPatrolState = 'IDLE' | 'TURN' | 'PATROL';
export type GuardState = GuardPatrolState | 'ALERT' | 'SUSPICIOUS' | 'DETECTED' | 'INVESTIGATE' | 'SEARCH' | 'RETURN' | 'CAPTURE';
type SearchPhase = 'SCAN' | 'MOVE';

const CROWN_HALL_ROUTE_PROFILE: GuardRouteProfile = {
  id: 'guard-alpha',
  normal: CROWN_HALL_CONFIG.guardRoute,
  alert: CROWN_HALL_CONFIG.alertGuardRoute,
  lockdown: {
    crown: CROWN_HALL_CONFIG.lockdownGuardRoutes.crown,
    west: CROWN_HALL_CONFIG.lockdownGuardRoutes.west,
    exit: CROWN_HALL_CONFIG.lockdownGuardRoutes.exit,
  },
};

export class GuardController {
  readonly memory = new GuardMemory();
  readonly navigation: GuardNavigation;
  readonly search: GuardSearch;
  readonly radio = new GuardRadio();
  readonly stateMachine = new GuardStateMachine();

  private patrolState: GuardPatrolState = 'PATROL';
  private detectionState: DetectionState = 'CLEAR';
  private targetVisible = false;
  private alertMode = false;
  private lockdownStage: LockdownThreatStage = 'NONE';
  private debugFrozen = false;
  private captured = false;
  private pauseRemaining = 0;
  private scanElapsed = 0;
  private scanBaseYaw = 0;
  private stateElapsed = 0;
  private lostSightElapsed = 0;
  private investigationReason = 'NONE';
  private investigationPriority = 0;
  private readonly investigationTarget = Vector3.Zero();
  private searchElapsed = 0;
  private searchPhase: SearchPhase = 'SCAN';
  private searchPhaseElapsed = 0;
  private searchBaseYaw = 0;
  private searchActionTriggered = false;
  private captureHandler: (() => void) | null = null;
  private searchHandler: ((position: Vector3, reason: string) => void) | null = null;
  private stalledFor = 0;
  private recoveryCount = 0;
  private readonly forward = new Vector3(0, 0, 1);

  constructor(
    private readonly guard: Guard,
    private readonly patrol: GuardPatrol,
    private readonly flashlight: GuardFlashlight,
    collisionBoxes: CollisionBox[],
    private readonly routeProfile: GuardRouteProfile = CROWN_HALL_ROUTE_PROFILE,
  ) {
    this.navigation = new GuardNavigation(guard, collisionBoxes);
    this.search = new GuardSearch(this.navigation);
    this.configureStates();
    const initialDirection = patrol.target.subtract(patrol.start).normalize();
    guard.root.rotation.y = Math.atan2(initialDirection.x, initialDirection.z);
    this.forward.copyFrom(initialDirection);
    this.navigation.setTarget(patrol.target);
    this.stateMachine.setLogger(transition => {
      console.debug(`[Guard FSM] ${transition.from ?? 'NONE'} -> ${transition.to} (${transition.reason})`);
    });
    this.stateMachine.start();
  }

  update(deltaTime: number) {
    this.memory.update(deltaTime);
    if (this.debugFrozen) {
      this.navigation.stop();
      this.flashlight.update(deltaTime, false);
      return;
    }
    this.stateMachine.update(deltaTime);
    const flashlightMoving = this.navigation.moving || (this.stateMachine.current === 'PATROL' && this.patrolState === 'PATROL');
    const focused = this.stateMachine.current === 'SUSPICIOUS'
      || this.stateMachine.current === 'INVESTIGATE';
    const flashlightMode = this.stateMachine.current === 'SEARCH'
      ? 'SEARCH'
      : this.stateMachine.current === 'CHASE'
        ? 'CHASE'
        : focused
          ? 'FOCUS'
          : this.alertMode
            ? 'ALERT'
            : 'PATROL';
    this.flashlight.update(deltaTime, flashlightMoving, flashlightMode);
  }

  setAwareness(state: DetectionState, target: Vector3, visible = false) {
    this.detectionState = state;
    this.targetVisible = visible;
    if (visible) this.memory.rememberSeen(target);

    if (state === 'DETECTED') {
      if (visible && this.stateMachine.current !== 'CHASE' && this.stateMachine.current !== 'CAPTURE') {
        this.transition('CHASE', 'PLAYER_CONFIRMED');
      }
      return;
    }

    if (state === 'SUSPICIOUS') {
      if (this.stateMachine.current === 'PATROL' || this.stateMachine.current === 'RETURN') {
        this.transition('SUSPICIOUS', 'VISUAL_SUSPICION');
      } else if ((this.stateMachine.current === 'INVESTIGATE' || this.stateMachine.current === 'SEARCH') && visible) {
        this.transition('SUSPICIOUS', 'PLAYER_GLIMPSED');
      }
    }
  }

  requestInvestigation(position: Vector3, reason = 'DISTURBANCE', priority = this.priorityForReason(reason)) {
    const current = this.stateMachine.current;
    if (this.captured || current === 'CHASE' || current === 'CAPTURE') return false;
    if (current === 'SUSPICIOUS' && priority < 4) return false;
    if ((current === 'INVESTIGATE' || current === 'SEARCH') && priority < this.investigationPriority) return false;

    this.investigationTarget.copyFrom(position);
    this.investigationTarget.y = 0;
    this.investigationReason = reason;
    this.investigationPriority = priority;
    if (reason === 'OBSERVED_HIDE') this.memory.rememberHideSpot('staff-locker', position);
    if (current === 'INVESTIGATE') {
      this.stateElapsed = 0;
      this.navigation.setTarget(this.investigationTarget);
      return true;
    }
    this.transition('INVESTIGATE', reason);
    return true;
  }

  hearNoise(position: Vector3, strength: number, kind = 'FOOTSTEP') {
    if (strength < .12 || this.stateMachine.current === 'CHASE' || this.stateMachine.current === 'CAPTURE') return false;
    this.memory.rememberHeard(position);
    const loud = strength >= .8;
    return this.requestInvestigation(position, loud ? `LOUD_${kind}` : kind, loud ? 2.4 : 2);
  }

  receiveRadioReport(position: Vector3, reason = 'RADIO_REPORT', priority = 2.6) {
    if (this.stateMachine.current === 'CHASE' || this.stateMachine.current === 'CAPTURE') return false;
    this.memory.rememberRadio(position);
    return this.requestInvestigation(position, reason, priority);
  }

  raiseAlarm(position: Vector3) {
    if (this.stateMachine.current === 'CHASE' || this.stateMachine.current === 'CAPTURE') return false;
    this.memory.rememberAlarm(position);
    return this.requestInvestigation(position, 'CROWN_ALARM', 3);
  }

  setCaptureHandler(handler: () => void) {
    this.captureHandler = handler;
  }

  setSearchHandler(handler: (position: Vector3, reason: string) => void) {
    this.searchHandler = handler;
  }

  setDebugFrozen(frozen: boolean) {
    this.debugFrozen = frozen;
  }

  setAlertMode(active: boolean) {
    if (this.alertMode === active) return;
    this.alertMode = active;
    this.stalledFor = 0;
    if (active) this.patrol.setRoute(this.routeProfile.alert);
    else this.patrol.reset(this.routeProfile.normal);
    if (this.stateMachine.current === 'PATROL') {
      this.patrolState = 'TURN';
      this.navigation.setTarget(this.patrol.target);
    }
  }

  setLockdownStage(stage: LockdownThreatStage) {
    if (this.lockdownStage === stage) return;
    this.lockdownStage = stage;
    if (stage === 'NONE') return;
    const routes = this.routeProfile.lockdown;
    const route = stage === 'CROWN_SWEEP' ? routes.crown : stage === 'WEST_SWEEP' ? routes.west : routes.exit;
    this.patrol.setRoute(route);
    this.stalledFor = 0;
    if (this.stateMachine.current === 'PATROL') {
      this.patrolState = 'TURN';
      this.navigation.setTarget(this.patrol.target);
    }
  }

  reset() {
    this.debugFrozen = false;
    this.alertMode = false;
    this.lockdownStage = 'NONE';
    this.detectionState = 'CLEAR';
    this.targetVisible = false;
    this.captured = false;
    this.pauseRemaining = 0;
    this.scanElapsed = 0;
    this.stateElapsed = 0;
    this.lostSightElapsed = 0;
    this.investigationReason = 'NONE';
    this.investigationPriority = 0;
    this.investigationTarget.setAll(0);
    this.searchElapsed = 0;
    this.searchActionTriggered = false;
    this.stalledFor = 0;
    this.recoveryCount = 0;
    this.memory.reset();
    this.search.reset();
    this.patrol.reset(this.routeProfile.normal);
    this.guard.position.copyFrom(this.patrol.start);
    const initialDirection = this.patrol.target.subtract(this.patrol.start).normalize();
    this.guard.root.rotation.y = Math.atan2(initialDirection.x, initialDirection.z);
    this.forward.copyFrom(initialDirection);
    this.navigation.setTarget(this.patrol.target);
    this.stateMachine.reset();
    this.flashlight.reset();
  }

  private configureStates() {
    this.stateMachine
      .register('PATROL', { enter: () => this.enterPatrol(), update: deltaTime => this.updatePatrol(deltaTime) })
      .register('SUSPICIOUS', { enter: () => this.enterSuspicious(), update: deltaTime => this.updateSuspicious(deltaTime) })
      .register('INVESTIGATE', { enter: () => this.enterInvestigate(), update: deltaTime => this.updateInvestigate(deltaTime) })
      .register('CHASE', { enter: () => this.enterChase(), update: deltaTime => this.updateChase(deltaTime) })
      .register('SEARCH', { enter: () => this.enterSearch(), update: deltaTime => this.updateSearch(deltaTime) })
      .register('RETURN', { enter: () => this.enterReturn(), update: deltaTime => this.updateReturn(deltaTime) })
      .register('CAPTURE', { enter: () => this.enterCapture(), update: () => undefined });
  }

  private enterPatrol() {
    this.stateElapsed = 0;
    this.investigationPriority = 0;
    this.investigationReason = 'NONE';
    this.patrolState = 'TURN';
    this.navigation.setTarget(this.patrol.target);
  }

  private updatePatrol(deltaTime: number) {
    this.stateElapsed += deltaTime;
    if (this.patrolState === 'IDLE') {
      if (this.alertMode) {
        this.scanElapsed += deltaTime;
        this.guard.root.rotation.y = this.scanBaseYaw + Math.sin(this.scanElapsed * 4.5) * .52;
        this.syncForwardFromYaw();
      }
      this.pauseRemaining -= deltaTime;
      if (this.pauseRemaining <= 0) this.patrolState = 'TURN';
      return;
    }

    if (this.patrolState === 'TURN') {
      if (this.turnToward(this.patrol.target, GUARD_CONFIG.rotationSpeed, deltaTime)) {
        this.patrolState = 'PATROL';
        this.navigation.setTarget(this.patrol.target);
      }
      return;
    }

    const reached = this.navigation.update(deltaTime, this.modifiedSpeed(GUARD_AI_CONFIG.patrolSpeed), GUARD_CONFIG.arrivalRadius);
    this.faceNavigationDirection(GUARD_CONFIG.rotationSpeed, deltaTime);
    this.stalledFor = this.navigation.stalledFor;
    if (this.stalledFor >= .72) {
      this.recoveryCount += 1;
      this.stalledFor = 0;
      this.patrol.advance();
      this.navigation.setTarget(this.patrol.target);
      this.patrolState = 'TURN';
      return;
    }
    if (reached) this.beginPauseAtWaypoint();
  }

  private enterSuspicious() {
    this.stateElapsed = 0;
    this.navigation.stop();
  }

  private updateSuspicious(deltaTime: number) {
    this.stateElapsed += deltaTime;
    const target = this.memory.mostRecentKnownPosition;
    if (target) this.turnToward(target, GUARD_VISION_CONFIG.suspiciousRotationSpeed, deltaTime);
    if (this.detectionState === 'DETECTED' && this.targetVisible) {
      this.transition('CHASE', 'PLAYER_CONFIRMED');
      return;
    }
    const delay = GUARD_AI_CONFIG.suspiciousReactionDelay * this.reactionMultiplier;
    if (!this.targetVisible && this.stateElapsed >= delay && target) {
      this.investigationTarget.copyFrom(target);
      this.investigationReason = 'SUSPICIOUS_GLIMPSE';
      this.investigationPriority = 4;
      this.transition('INVESTIGATE', 'VISUAL_LOST');
    }
  }

  private enterInvestigate() {
    this.stateElapsed = 0;
    this.navigation.setTarget(this.investigationTarget);
  }

  private updateInvestigate(deltaTime: number) {
    this.stateElapsed += deltaTime;
    if (this.detectionState === 'DETECTED' && this.targetVisible) {
      this.transition('CHASE', 'PLAYER_REFOUND');
      return;
    }
    const reached = this.navigation.update(deltaTime, this.modifiedSpeed(GUARD_AI_CONFIG.investigateSpeed), GUARD_AI_CONFIG.investigateArrivalRadius);
    this.faceNavigationDirection(GUARD_CONFIG.rotationSpeed, deltaTime);
    if (reached) {
      this.transition('SEARCH', 'INVESTIGATION_ARRIVED');
    } else if (this.navigation.stalledFor >= GUARD_AI_CONFIG.investigateStallTimeout) {
      if (this.navigation.remainingDistance > GUARD_AI_CONFIG.investigateBlockedArrivalRadius) {
        // With lightweight steering there may be no route around a large
        // display. Search the last reachable edge instead of appearing frozen.
        this.investigationTarget.copyFrom(this.guard.position);
      }
      this.transition('SEARCH', 'INVESTIGATION_REACHED_BLOCKED_EDGE');
    }
  }

  private enterChase() {
    this.stateElapsed = 0;
    this.lostSightElapsed = 0;
    this.investigationReason = 'PLAYER_DETECTED';
    if (Number.isFinite(this.memory.seenAge)) this.radio.report(this.routeProfile.id, this.memory.lastSeenPosition, 'PLAYER_CONFIRMED');
  }

  private updateChase(deltaTime: number) {
    this.stateElapsed += deltaTime;
    if (this.targetVisible) {
      this.lostSightElapsed = 0;
      this.navigation.setTarget(this.memory.lastSeenPosition);
      if (Vector3.Distance(this.guard.position, this.memory.lastSeenPosition) <= GUARD_AI_CONFIG.captureDistance) {
        this.transition('CAPTURE', 'PLAYER_CAUGHT');
        return;
      }
    } else {
      this.lostSightElapsed += deltaTime;
      const predicted = this.memory.lastSeenPosition.add(this.memory.lastKnownPlayerDirection.scale(GUARD_AI_CONFIG.predictionDistance));
      this.navigation.setTarget(predicted);
      if (this.lostSightElapsed >= GUARD_AI_CONFIG.lostSightGrace) {
        this.investigationTarget.copyFrom(predicted);
        this.investigationReason = 'LOST_SIGHT';
        this.investigationPriority = 5;
        this.transition('INVESTIGATE', 'LOST_SIGHT_GRACE_EXPIRED');
        return;
      }
    }

    const delay = GUARD_AI_CONFIG.chaseReactionDelay * this.reactionMultiplier;
    if (this.stateElapsed < delay) {
      this.navigation.stop();
      this.turnToward(this.navigation.target, GUARD_VISION_CONFIG.detectedRotationSpeed, deltaTime);
      return;
    }
    this.navigation.update(deltaTime, this.modifiedSpeed(GUARD_AI_CONFIG.chaseSpeed), GUARD_AI_CONFIG.captureDistance);
    this.faceNavigationDirection(GUARD_VISION_CONFIG.detectedRotationSpeed, deltaTime);
  }

  private enterSearch() {
    this.stateElapsed = 0;
    this.searchElapsed = 0;
    this.searchPhaseElapsed = 0;
    this.searchPhase = 'SCAN';
    this.searchActionTriggered = false;
    this.searchBaseYaw = this.guard.root.rotation.y;
    this.navigation.stop();
    this.search.generate(this.investigationTarget, this.alertMode);
  }

  private updateSearch(deltaTime: number) {
    this.stateElapsed += deltaTime;
    this.searchElapsed += deltaTime;
    this.searchPhaseElapsed += deltaTime;
    if (this.detectionState === 'DETECTED' && this.targetVisible) {
      this.transition('CHASE', 'PLAYER_REFOUND_DURING_SEARCH');
      return;
    }
    const duration = GUARD_AI_CONFIG.searchDuration * (this.alertMode ? GUARD_AI_CONFIG.alarm.searchDurationMultiplier : 1);
    if (this.searchElapsed >= duration) {
      this.transition('RETURN', 'SEARCH_EXHAUSTED');
      return;
    }

    if (this.searchPhase === 'MOVE') {
      const reached = this.navigation.update(deltaTime, this.modifiedSpeed(GUARD_AI_CONFIG.investigateSpeed), GUARD_AI_CONFIG.searchPointArrivalRadius);
      this.faceNavigationDirection(GUARD_CONFIG.rotationSpeed, deltaTime);
      if (reached) {
        this.searchPhase = 'SCAN';
        this.searchPhaseElapsed = 0;
        this.searchBaseYaw = this.guard.root.rotation.y;
      } else if (this.navigation.stalledFor >= GUARD_AI_CONFIG.searchStallTimeout) {
        this.search.discardCurrentPoint();
        if (!this.startNextSearchMove()) this.transition('RETURN', 'SEARCH_PATHS_BLOCKED');
      }
      return;
    }

    this.navigation.stop();
    if (!this.searchActionTriggered && this.searchPhaseElapsed >= GUARD_AI_CONFIG.searchInspectDelay) {
      this.searchActionTriggered = true;
      this.searchHandler?.(this.investigationTarget.clone(), this.investigationReason);
    }
    const inspectKnownHideSpot = this.investigationReason === 'OBSERVED_HIDE' || this.investigationReason === 'LOCKDOWN_SWEEP';
    const scanDuration = inspectKnownHideSpot && !this.searchActionTriggered
      ? GUARD_AI_CONFIG.searchInspectDelay + .1
      : GUARD_AI_CONFIG.searchScanDuration;
    const scanProgress = Math.min(1, this.searchPhaseElapsed / Math.max(.001, scanDuration));
    // A complete right-left sweep with a return to center makes the search
    // readable and prevents every scan from ending on the same side.
    this.guard.root.rotation.y = this.searchBaseYaw + Math.sin(scanProgress * Math.PI * 2) * .68;
    this.syncForwardFromYaw();
    if (this.searchPhaseElapsed < scanDuration) return;
    if (!this.startNextSearchMove()) this.transition('RETURN', 'NO_SEARCH_POINT');
  }

  private enterReturn() {
    this.stateElapsed = 0;
    this.investigationPriority = 0;
    this.navigation.setTarget(this.patrol.setNearestTarget(this.guard.position));
  }

  private startNextSearchMove() {
    const next = this.search.nextPoint();
    if (!next) return false;
    this.navigation.setTarget(next);
    this.searchPhase = 'MOVE';
    this.searchPhaseElapsed = 0;
    return true;
  }

  private updateReturn(deltaTime: number) {
    this.stateElapsed += deltaTime;
    if (this.detectionState === 'DETECTED' && this.targetVisible) {
      this.transition('CHASE', 'PLAYER_FOUND_WHILE_RETURNING');
      return;
    }
    const reached = this.navigation.update(deltaTime, this.modifiedSpeed(GUARD_AI_CONFIG.returnSpeed), GUARD_AI_CONFIG.returnArrivalRadius);
    this.faceNavigationDirection(GUARD_CONFIG.rotationSpeed, deltaTime);
    if (reached) {
      this.patrolState = 'TURN';
      this.transition('PATROL', 'PATROL_ROUTE_REJOINED');
    } else if (this.navigation.stalledFor >= GUARD_AI_CONFIG.returnStallTimeout) {
      this.patrol.advance();
      this.navigation.setTarget(this.patrol.target);
    }
  }

  private enterCapture() {
    this.captured = true;
    this.navigation.stop();
    this.captureHandler?.();
  }

  private transition(next: GuardAIStateId, reason: string) {
    this.stateMachine.transition(next, reason);
  }

  private beginPauseAtWaypoint() {
    this.stalledFor = 0;
    this.patrol.advance();
    this.navigation.setTarget(this.patrol.target);
    this.pauseRemaining = this.alertMode ? GUARD_CONFIG.alertPauseTime : GUARD_CONFIG.pauseTime;
    this.scanElapsed = 0;
    this.scanBaseYaw = this.guard.root.rotation.y;
    this.patrolState = 'IDLE';
    this.navigation.stop();
  }

  private turnToward(target: Vector3, speed: number, deltaTime: number) {
    const desired = target.subtract(this.guard.position);
    desired.y = 0;
    if (desired.lengthSquared() < .0001) return true;
    desired.normalize();
    const targetYaw = Math.atan2(desired.x, desired.z);
    const yawDelta = Scalar.NormalizeRadians(targetYaw - this.guard.root.rotation.y);
    const step = speed * deltaTime;
    this.guard.root.rotation.y += Math.abs(yawDelta) <= step ? yawDelta : Math.sign(yawDelta) * step;
    this.syncForwardFromYaw();
    return Math.abs(yawDelta) <= step;
  }

  private faceNavigationDirection(speed: number, deltaTime: number) {
    if (!this.navigation.moving) return;
    const targetYaw = Math.atan2(this.navigation.direction.x, this.navigation.direction.z);
    const yawDelta = Scalar.NormalizeRadians(targetYaw - this.guard.root.rotation.y);
    const step = speed * deltaTime;
    this.guard.root.rotation.y += Math.abs(yawDelta) <= step ? yawDelta : Math.sign(yawDelta) * step;
    this.syncForwardFromYaw();
  }

  private syncForwardFromYaw() {
    this.forward.copyFromFloats(Math.sin(this.guard.root.rotation.y), 0, Math.cos(this.guard.root.rotation.y));
  }

  private modifiedSpeed(base: number) {
    return base * (this.alertMode ? GUARD_AI_CONFIG.alarm.speedMultiplier : 1);
  }

  private priorityForReason(reason: string) {
    if (reason === 'OBSERVED_HIDE') return 4.5;
    if (reason === 'LOCKDOWN_SWEEP') return 3.5;
    if (reason.includes('ALARM')) return 3;
    if (reason.includes('RADIO')) return 2.6;
    if (reason.includes('LOUD')) return 2.4;
    return 2;
  }

  private get reactionMultiplier() {
    return this.alertMode ? GUARD_AI_CONFIG.alarm.reactionDelayMultiplier : 1;
  }

  get state(): GuardState {
    if (this.stateMachine.current === 'CHASE') return 'DETECTED';
    if (this.stateMachine.current === 'CAPTURE') return 'CAPTURE';
    if (this.stateMachine.current === 'PATROL') {
      return this.alertMode && this.patrolState === 'PATROL' ? 'ALERT' : this.patrolState;
    }
    return this.stateMachine.current;
  }

  get fsmState() {
    return this.stateMachine.current;
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

  get isDebugFrozen() {
    return this.debugFrozen;
  }

  get routeRecoveryCount() {
    return this.recoveryCount;
  }

  get investigationLabel() {
    return this.investigationReason;
  }

  get transitionLabel() {
    const transition = this.stateMachine.lastTransition;
    return `${transition.from ?? 'NONE'}>${transition.to}:${transition.reason}`;
  }

  get isSearchingOnMove() {
    return this.stateMachine.current === 'SEARCH' && this.searchPhase === 'MOVE';
  }

  get searchLabel() {
    if (this.stateMachine.current !== 'SEARCH') return '--';
    const index = this.search.currentIndex < 0 ? 0 : this.search.currentIndex + 1;
    return `${index}/${this.search.points.length} ${this.searchPhase}${this.navigation.stalledFor > 0 ? ` STALL ${this.navigation.stalledFor.toFixed(1)}S` : ''}`;
  }

  get navigationLabel() {
    if (!this.navigation.hasTarget) return '--';
    return `${this.navigation.remainingDistance.toFixed(2)}M · ${this.navigation.routeLabel}${this.navigation.stalledFor > 0 ? ` · STALL ${this.navigation.stalledFor.toFixed(1)}S` : ''}`;
  }
}
