import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Player } from '../entities/player/Player';
import { GAME_3D_CONFIG } from '../config/gameConfig';

export type CameraDistance = keyof typeof GAME_3D_CONFIG.camera.distancePresets;

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
    const targetRadius = baseRadius + (this.alertMode ? .7 : 0) - (this.cinematicMode ? 1 : 0);
    this.camera.radius += (targetRadius - this.camera.radius) * (1 - Math.exp(-5 * deltaTime));
    const playerTarget = this.player.cameraTarget.getAbsolutePosition();
    const lookAmount = Math.min(1, speed / GAME_3D_CONFIG.player.walkSpeed) * GAME_3D_CONFIG.camera.lookAhead;
    movementDirection.scaleToRef(lookAmount, this.desiredLookAhead);
    Vector3.LerpToRef(
      this.lookAheadOffset,
      this.desiredLookAhead,
      1 - Math.exp(-GAME_3D_CONFIG.camera.lookAheadSharpness * deltaTime),
      this.lookAheadOffset,
    );

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
    this.moveTargetOutsideDeadZone(this.viewForward, forwardOffset, GAME_3D_CONFIG.camera.deadZoneForward);
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

  reset() {
    this.camera.alpha = GAME_3D_CONFIG.camera.alpha;
    this.camera.beta = GAME_3D_CONFIG.camera.beta;
    this.setDistance('medium');
    this.camera.radius = GAME_3D_CONFIG.camera.distancePresets.medium;
    this.alertMode = false;
    this.cinematicMode = false;
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
}
