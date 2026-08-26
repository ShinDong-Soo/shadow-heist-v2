import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { GameCamera } from '../../camera/GameCamera';
import type { HideSpot } from '../hide/HideSpot';
import type { PlayerHideState } from '../hide/HideSpotTypes';
import type { Player } from './Player';
import type { PlayerController } from './PlayerController';

type HideControllerEffects = {
  playDoor: (opening: boolean) => void;
  rememberLastKnown: (position: Vector3) => void;
  requestGuardInvestigation: (position: Vector3, reason: string) => void;
};

export class PlayerHideController {
  state: PlayerHideState = 'NORMAL';
  currentSpot: HideSpot | null = null;
  wasObservedEntering = false;
  guardDistance = Infinity;
  guardDirection: 'LEFT' | 'RIGHT' | 'FRONT' = 'FRONT';
  hiddenDuration = 0;
  discovered = false;
  private elapsed = 0;
  private readonly transitionStart = Vector3.Zero();
  private doorClosingTriggered = false;
  private campInvestigationRequested = false;

  constructor(
    private readonly player: Player,
    private readonly controller: PlayerController,
    private readonly camera: GameCamera,
    private readonly spots: HideSpot[],
    private readonly effects: HideControllerEffects,
  ) {}

  update(deltaTime: number, interactPressed: boolean, playerVisible: boolean, guardPositions: Vector3 | readonly Vector3[]) {
    this.spots.forEach(spot => {
      spot.updateInteraction(this.player);
      spot.update(deltaTime);
    });
    this.updateGuardProximity(Array.isArray(guardPositions) ? guardPositions : [guardPositions]);

    if (this.state === 'NORMAL') {
      if (interactPressed) {
        const spot = this.spots.find(candidate => candidate.interactionReady);
        if (spot) this.beginEnter(spot, playerVisible);
      }
      return;
    }

    if (this.state === 'HIDDEN') {
      this.hiddenDuration += Math.min(deltaTime, .05);
      if (interactPressed && !this.discovered) this.beginExit();
      return;
    }

    this.elapsed += Math.min(deltaTime, .05);
    if (this.state === 'ENTERING_HIDE') this.updateEnter();
    else this.updateExit();
  }

  reset() {
    this.state = 'NORMAL';
    this.currentSpot = null;
    this.wasObservedEntering = false;
    this.guardDistance = Infinity;
    this.elapsed = 0;
    this.hiddenDuration = 0;
    this.discovered = false;
    this.campInvestigationRequested = false;
    this.doorClosingTriggered = false;
    this.spots.forEach(spot => spot.reset());
    this.controller.setMovementLocked(false);
    this.camera.setHideMode(false);
  }

  get interactionReady() {
    return (this.state === 'HIDDEN' && !this.discovered)
      || (this.state === 'NORMAL' && this.spots.some(spot => spot.interactionReady));
  }

  get interactionLabel() {
    if (this.state === 'HIDDEN') return this.discovered ? '' : 'EXIT LOCKER';
    if (this.state === 'NORMAL' && this.spots.some(spot => spot.interactionReady)) return 'HIDE IN LOCKER';
    return '';
  }

  get tension() {
    if (this.state !== 'HIDDEN' || !Number.isFinite(this.guardDistance)) return 0;
    return Scalar.Clamp((6 - this.guardDistance) / 5, 0, 1);
  }

  get proximityLabel() {
    if (this.discovered) return 'LOCKER COMPROMISED';
    if (this.state !== 'HIDDEN' || this.guardDistance > 8) return '';
    const range = this.guardDistance < 2.2 ? 'VERY CLOSE' : this.guardDistance < 4.5 ? 'APPROACHING' : 'DISTANT';
    return `FOOTSTEPS ${this.guardDirection} · ${range}`;
  }

  consumeLockdownCampInvestigation() {
    if (
      this.state !== 'HIDDEN'
      || this.hiddenDuration < 5.5
      || this.campInvestigationRequested
      || !this.currentSpot
    ) return null;
    this.campInvestigationRequested = true;
    return this.currentSpot.entryPoint.getAbsolutePosition().clone();
  }

  isVulnerableAt(position: Vector3) {
    if (!this.currentSpot || (this.state !== 'HIDDEN' && this.state !== 'ENTERING_HIDE')) return false;
    if (!this.wasObservedEntering && !this.campInvestigationRequested) return false;
    return Vector3.Distance(position, this.currentSpot.entryPoint.getAbsolutePosition()) <= 1.5;
  }

  revealByGuard() {
    if (!this.currentSpot || this.discovered) return false;
    this.discovered = true;
    this.currentSpot.setDoorOpen(true);
    this.effects.playDoor(true);
    this.controller.setMovementLocked(true);
    return true;
  }

  private beginEnter(spot: HideSpot, playerVisible: boolean) {
    this.currentSpot = spot;
    this.state = 'ENTERING_HIDE';
    this.elapsed = 0;
    this.doorClosingTriggered = false;
    this.wasObservedEntering = playerVisible;
    this.hiddenDuration = 0;
    this.discovered = false;
    this.campInvestigationRequested = false;
    spot.occupied = true;
    spot.setDoorOpen(true);
    this.transitionStart.copyFrom(this.player.position);
    this.controller.setMovementLocked(true);
    this.camera.setHideMode(true, spot.cameraTarget.getAbsolutePosition());
    this.effects.playDoor(true);
    if (playerVisible) {
      const entry = spot.entryPoint.getAbsolutePosition();
      this.effects.rememberLastKnown(entry);
      this.effects.requestGuardInvestigation(entry, 'OBSERVED_HIDE');
    }
  }

  private updateEnter() {
    const spot = this.currentSpot;
    if (!spot) return;
    const amount = Scalar.Clamp((this.elapsed - .16) / .5, 0, 1);
    Vector3.LerpToRef(this.transitionStart, spot.hidePoint.getAbsolutePosition(), this.smoothStep(amount), this.player.position);
    this.player.root.rotation.y += Scalar.NormalizeRadians(Math.PI - this.player.root.rotation.y) * .16;
    if (this.elapsed >= .58 && !this.doorClosingTriggered) {
      this.doorClosingTriggered = true;
      spot.setDoorOpen(false);
      this.effects.playDoor(false);
    }
    if (this.elapsed < .82) return;
    this.player.position.copyFrom(spot.hidePoint.getAbsolutePosition());
    this.state = 'HIDDEN';
    this.elapsed = 0;
  }

  private beginExit() {
    const spot = this.currentSpot;
    if (!spot) return;
    this.state = 'EXITING_HIDE';
    this.elapsed = 0;
    this.doorClosingTriggered = false;
    this.transitionStart.copyFrom(this.player.position);
    spot.setDoorOpen(true);
    this.effects.playDoor(true);
  }

  private updateExit() {
    const spot = this.currentSpot;
    if (!spot) return;
    const amount = Scalar.Clamp((this.elapsed - .16) / .5, 0, 1);
    Vector3.LerpToRef(this.transitionStart, spot.exitPoint.getAbsolutePosition(), this.smoothStep(amount), this.player.position);
    this.player.root.rotation.y += Scalar.NormalizeRadians(0 - this.player.root.rotation.y) * .16;
    if (this.elapsed >= .58 && !this.doorClosingTriggered) {
      this.doorClosingTriggered = true;
      spot.setDoorOpen(false);
      this.effects.playDoor(false);
    }
    if (this.elapsed < .82) return;
    this.player.position.copyFrom(spot.exitPoint.getAbsolutePosition());
    spot.occupied = false;
    this.currentSpot = null;
    this.state = 'NORMAL';
    this.wasObservedEntering = false;
    this.hiddenDuration = 0;
    this.discovered = false;
    this.campInvestigationRequested = false;
    this.elapsed = 0;
    this.controller.setMovementLocked(false);
    this.camera.setHideMode(false);
  }

  private updateGuardProximity(guardPositions: readonly Vector3[]) {
    if (!this.currentSpot) {
      this.guardDistance = Infinity;
      return;
    }
    const spotPosition = this.currentSpot.root.getAbsolutePosition();
    let nearest = guardPositions[0];
    this.guardDistance = nearest ? Vector3.Distance(spotPosition, nearest) : Infinity;
    guardPositions.slice(1).forEach(position => {
      const distance = Vector3.Distance(spotPosition, position);
      if (distance < this.guardDistance) {
        this.guardDistance = distance;
        nearest = position;
      }
    });
    if (!nearest) return;
    const deltaX = nearest.x - spotPosition.x;
    this.guardDirection = Math.abs(deltaX) < .8 ? 'FRONT' : deltaX < 0 ? 'LEFT' : 'RIGHT';
  }

  private smoothStep(value: number) {
    return value * value * (3 - 2 * value);
  }
}
