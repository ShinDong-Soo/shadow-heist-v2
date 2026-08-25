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
  private distanceMode: CameraDistance = 'medium';

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
    const playerTarget = this.player.cameraTarget.getAbsolutePosition();
    const lookAmount = Math.min(1, speed / GAME_3D_CONFIG.player.walkSpeed) * GAME_3D_CONFIG.camera.lookAhead;
    const desiredLookAhead = movementDirection.scale(lookAmount);
    Vector3.LerpToRef(
      this.lookAheadOffset,
      desiredLookAhead,
      1 - Math.exp(-GAME_3D_CONFIG.camera.lookAheadSharpness * deltaTime),
      this.lookAheadOffset,
    );

    const viewForward = this.smoothTarget.subtract(this.camera.position);
    viewForward.y = 0;
    viewForward.normalize();
    const viewRight = new Vector3(viewForward.z, 0, -viewForward.x);
    const focus = playerTarget.add(this.lookAheadOffset);
    const offset = focus.subtract(this.smoothTarget);
    const horizontalOffset = Vector3.Dot(offset, viewRight);
    const forwardOffset = Vector3.Dot(offset, viewForward);

    this.desiredTarget.copyFrom(this.smoothTarget);
    this.moveTargetOutsideDeadZone(viewRight, horizontalOffset, GAME_3D_CONFIG.camera.deadZoneHorizontal);
    this.moveTargetOutsideDeadZone(viewForward, forwardOffset, GAME_3D_CONFIG.camera.deadZoneForward);
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
    this.desiredTarget.addInPlace(axis.scale(Math.sign(offset) * excess));
  }

  setDistance(mode: CameraDistance) {
    this.distanceMode = mode;
    this.camera.radius = GAME_3D_CONFIG.camera.distancePresets[mode];
  }

  reset() {
    this.camera.alpha = GAME_3D_CONFIG.camera.alpha;
    this.camera.beta = GAME_3D_CONFIG.camera.beta;
    this.setDistance('medium');
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
