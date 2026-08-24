import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Player } from '../entities/player/Player';
import { GAME_3D_CONFIG } from '../config/gameConfig';

export type CameraDistance = keyof typeof GAME_3D_CONFIG.camera.distancePresets;

export class GameCamera {
  readonly camera: ArcRotateCamera;
  private readonly smoothTarget: Vector3;
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
    const target = this.player.cameraTarget.getAbsolutePosition();
    const lookAmount = Math.min(1, speed / GAME_3D_CONFIG.player.walkSpeed) * GAME_3D_CONFIG.camera.lookAhead;
    target.addInPlace(movementDirection.scale(lookAmount));
    Vector3.LerpToRef(this.smoothTarget, target, 1 - Math.exp(-GAME_3D_CONFIG.camera.followSharpness * deltaTime), this.smoothTarget);
    this.camera.setTarget(this.smoothTarget);
  }

  setDistance(mode: CameraDistance) {
    this.distanceMode = mode;
    this.camera.radius = GAME_3D_CONFIG.camera.distancePresets[mode];
  }

  reset() {
    this.camera.alpha = GAME_3D_CONFIG.camera.alpha;
    this.camera.beta = GAME_3D_CONFIG.camera.beta;
    this.setDistance('medium');
    this.smoothTarget.copyFrom(this.player.cameraTarget.getAbsolutePosition());
    this.camera.setTarget(this.smoothTarget);
  }

  get distanceLabel() {
    return `${this.distanceMode.toUpperCase()} ${this.camera.radius.toFixed(1)}M`;
  }
}
