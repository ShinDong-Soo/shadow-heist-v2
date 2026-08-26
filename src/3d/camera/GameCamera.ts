import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import type { Scene } from '@babylonjs/core/scene';
import type { Player } from '../entities/player/Player';
import { GAME_3D_CONFIG } from '../config/gameConfig';

export type CameraDistance = keyof typeof GAME_3D_CONFIG.camera.distancePresets;
export type CameraState = 'NORMAL' | 'HIDE' | 'LOCKDOWN' | 'ESCAPE';

export class GameCamera {
  readonly camera: ArcRotateCamera;
  private readonly smoothTarget: Vector3;
  private readonly lookAheadOffset = Vector3.Zero();
  private readonly desiredTarget = Vector3.Zero();
  private readonly desiredLookAhead = Vector3.Zero();
  private readonly viewForward = Vector3.Zero();
  private readonly viewRight = Vector3.Zero();
  private readonly focus = Vector3.Zero();
  private readonly targetOffset = Vector3.Zero();
  private distanceMode: CameraDistance = 'medium';
  private alertMode = false;
  private cinematicMode = false;
  private hideMode = false;
  private escapeMode = false;
  private readonly hideFocus = Vector3.Zero();

  constructor(scene: Scene, private readonly player: Player) {
    this.smoothTarget = player.cameraTarget.getAbsolutePosition().clone();
    this.camera = new ArcRotateCamera(
      'player-top-down-camera',
      GAME_3D_CONFIG.camera.alpha,
      GAME_3D_CONFIG.camera.beta,
      GAME_3D_CONFIG.camera.distancePresets.medium,
      this.smoothTarget,
      scene,
    );
    this.camera.fov = GAME_3D_CONFIG.camera.fov;
    this.camera.inputs.clear();
    scene.activeCamera = this.camera;
  }

  update(deltaTime: number, movementDirection: Vector3, speed: number) {
    const baseRadius = GAME_3D_CONFIG.camera.distancePresets[this.distanceMode];
    const cameraBlend = 1 - Math.exp(-(this.hideMode ? 7 : 5) * deltaTime);
    const radiusBonus = this.escapeMode
      ? GAME_3D_CONFIG.camera.escapeRadiusBonus
      : this.alertMode
        ? .7
        : 0;
    const targetRadius = this.hideMode ? 1.35 : baseRadius + radiusBonus - (this.cinematicMode ? 1 : 0);
    this.camera.radius += (targetRadius - this.camera.radius) * cameraBlend;
    const targetBeta = this.hideMode ? Math.PI / 2 : GAME_3D_CONFIG.camera.beta;
    this.camera.beta += (targetBeta - this.camera.beta) * cameraBlend;
    const targetAlpha = this.hideMode ? Math.PI / 2 : GAME_3D_CONFIG.camera.alpha;
    this.camera.alpha += Scalar.NormalizeRadians(targetAlpha - this.camera.alpha) * cameraBlend;
    const targetFov = this.hideMode ? 58 * Math.PI / 180 : GAME_3D_CONFIG.camera.fov;
    this.camera.fov += (targetFov - this.camera.fov) * cameraBlend;
    const playerTarget = this.player.cameraTarget.getAbsolutePosition();
    const lookDistance = this.escapeMode ? GAME_3D_CONFIG.camera.escapeLookAhead : GAME_3D_CONFIG.camera.lookAhead;
    const lookSharpness = this.escapeMode ? GAME_3D_CONFIG.camera.escapeLookAheadSharpness : GAME_3D_CONFIG.camera.lookAheadSharpness;
    const lookAmount = this.hideMode ? 0 : Math.min(1, speed / GAME_3D_CONFIG.player.walkSpeed) * lookDistance;
    movementDirection.scaleToRef(lookAmount, this.desiredLookAhead);
    Vector3.LerpToRef(
      this.lookAheadOffset,
      this.desiredLookAhead,
      1 - Math.exp(-lookSharpness * deltaTime),
      this.lookAheadOffset,
    );

    if (this.hideMode) {
      Vector3.LerpToRef(
        this.smoothTarget,
        this.hideFocus,
        1 - Math.exp(-8 * deltaTime),
        this.smoothTarget,
      );
      this.camera.setTarget(this.smoothTarget);
      return;
    }

    this.smoothTarget.subtractToRef(this.camera.position, this.viewForward);
    this.viewForward.y = 0;
    this.viewForward.normalize();
    this.viewRight.copyFromFloats(this.viewForward.z, 0, -this.viewForward.x);
    playerTarget.addToRef(this.lookAheadOffset, this.focus);
    this.focus.subtractToRef(this.smoothTarget, this.targetOffset);
    const horizontalOffset = Vector3.Dot(this.targetOffset, this.viewRight);
    const forwardOffset = Vector3.Dot(this.targetOffset, this.viewForward);

    this.desiredTarget.copyFrom(this.smoothTarget);
    this.moveTargetOutsideDeadZone(this.viewRight, horizontalOffset, GAME_3D_CONFIG.camera.deadZoneHorizontal);
    this.moveTargetOutsideDeadZone(
      this.viewForward,
      forwardOffset,
      this.escapeMode ? GAME_3D_CONFIG.camera.escapeDeadZoneForward : GAME_3D_CONFIG.camera.deadZoneForward,
    );
    this.desiredTarget.y = playerTarget.y;
    Vector3.LerpToRef(
      this.smoothTarget,
      this.desiredTarget,
      1 - Math.exp(-GAME_3D_CONFIG.camera.followSharpness * deltaTime),
      this.smoothTarget,
    );
    this.camera.setTarget(this.smoothTarget);
  }

  private moveTargetOutsideDeadZone(axis: Vector3, offset: number, deadZone: number) {
    const excess = Math.abs(offset) - deadZone;
    if (excess <= 0) return;
    const amount = Math.sign(offset) * excess;
    this.desiredTarget.x += axis.x * amount;
    this.desiredTarget.y += axis.y * amount;
    this.desiredTarget.z += axis.z * amount;
  }

  setDistance(mode: CameraDistance) {
    this.distanceMode = mode;
  }

  setCinematicMode(active: boolean) {
    this.cinematicMode = active;
  }

  setAlertMode(active: boolean) {
    this.alertMode = active;
  }

  setEscapeMode(active: boolean) {
    this.escapeMode = active;
    if (!active) this.lookAheadOffset.setAll(0);
  }

  setHideMode(active: boolean, focus?: Vector3) {
    this.hideMode = active;
    if (focus) this.hideFocus.copyFrom(focus);
    if (active) this.lookAheadOffset.setAll(0);
  }

  reset() {
    this.camera.alpha = GAME_3D_CONFIG.camera.alpha;
    this.camera.beta = GAME_3D_CONFIG.camera.beta;
    this.setDistance('medium');
    this.camera.radius = GAME_3D_CONFIG.camera.distancePresets.medium;
    this.camera.fov = GAME_3D_CONFIG.camera.fov;
    this.alertMode = false;
    this.cinematicMode = false;
    this.hideMode = false;
    this.escapeMode = false;
    this.lookAheadOffset.setAll(0);
    this.smoothTarget.copyFrom(this.player.cameraTarget.getAbsolutePosition());
    this.camera.setTarget(this.smoothTarget);
  }

  get distanceLabel() {
    return `${this.distanceMode.toUpperCase()} ${this.camera.radius.toFixed(1)}M`;
  }

  get targetPosition() {
    return this.smoothTarget;
  }

  get state(): CameraState {
    if (this.hideMode) return 'HIDE';
    if (this.escapeMode) return 'ESCAPE';
    if (this.alertMode) return 'LOCKDOWN';
    return 'NORMAL';
  }
}
