import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
// ArcRotateCamera.getForwardRay() depends on Ray's side-effect registration
// when Babylon is imported through small, deep module paths.
import '@babylonjs/core/Culling/ray';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { GAME_3D_CONFIG } from '../../config/gameConfig';
import type { InputManager } from '../../systems/InputManager';
import type { Player } from './Player';

export type CollisionBox = { minX: number; maxX: number; minZ: number; maxZ: number };

export class PlayerController {
  readonly velocity = Vector3.Zero();
  readonly direction = new Vector3(0, 0, 1);

  constructor(
    private readonly player: Player,
    private readonly input: InputManager,
    private readonly camera: ArcRotateCamera,
    private readonly collisionBoxes: CollisionBox[],
  ) {}

  update(deltaTime: number) {
    const inputX = this.input.horizontal;
    const inputZ = this.input.vertical;
    const desiredDirection = this.getCameraRelativeDirection(inputX, inputZ);
    const hasInput = desiredDirection.lengthSquared() > .0001;
    const desiredVelocity = hasInput
      ? desiredDirection.scale(GAME_3D_CONFIG.player.walkSpeed)
      : Vector3.Zero();
    const sharpness = hasInput ? GAME_3D_CONFIG.player.acceleration : GAME_3D_CONFIG.player.deceleration;
    Vector3.LerpToRef(this.velocity, desiredVelocity, 1 - Math.exp(-sharpness * deltaTime), this.velocity);
    if (!hasInput && this.velocity.lengthSquared() < .0025) this.velocity.setAll(0);

    this.moveWithSliding(this.velocity.scale(deltaTime));
    if (hasInput) {
      this.direction.copyFrom(desiredDirection);
      const targetYaw = Math.atan2(desiredDirection.x, desiredDirection.z);
      const yawDelta = Scalar.NormalizeRadians(targetYaw - this.player.root.rotation.y);
      this.player.root.rotation.y += yawDelta * (1 - Math.exp(-GAME_3D_CONFIG.player.rotationSharpness * deltaTime));
    }
  }

  get speed() {
    return this.velocity.length();
  }

  get inputLabel() {
    return this.input.activeLabel;
  }

  private getCameraRelativeDirection(horizontal: number, vertical: number) {
    if (horizontal === 0 && vertical === 0) return Vector3.Zero();
    const forward = this.camera.getForwardRay().direction;
    forward.y = 0;
    forward.normalize();
    const right = new Vector3(forward.z, 0, -forward.x);
    return forward.scale(vertical).add(right.scale(horizontal)).normalize();
  }

  private moveWithSliding(delta: Vector3) {
    const radius = GAME_3D_CONFIG.player.radius;
    let x = this.player.position.x + delta.x;
    const z = this.player.position.z;
    for (const box of this.collisionBoxes) {
      if (!this.circleOverlapsBox(x, z, radius, box)) continue;
      x = delta.x > 0 ? box.minX - radius : box.maxX + radius;
      this.velocity.x = 0;
    }
    this.player.position.x = x;

    let nextZ = z + delta.z;
    for (const box of this.collisionBoxes) {
      if (!this.circleOverlapsBox(this.player.position.x, nextZ, radius, box)) continue;
      nextZ = delta.z > 0 ? box.minZ - radius : box.maxZ + radius;
      this.velocity.z = 0;
    }
    this.player.position.z = nextZ;
    this.player.position.y = 0;
  }

  private circleOverlapsBox(x: number, z: number, radius: number, box: CollisionBox) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    return dx * dx + dz * dz < radius * radius;
  }
}
