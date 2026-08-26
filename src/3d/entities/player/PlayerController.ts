import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
// ArcRotateCamera.getForwardRay() depends on Ray's side-effect registration
// when Babylon is imported through small, deep module paths.
import '@babylonjs/core/Culling/ray';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { GAME_3D_CONFIG } from '../../config/gameConfig';
import { moveCircleWithSliding, type CollisionBox } from '../../systems/CollisionWorld';
import type { InputManager } from '../../systems/InputManager';
import type { Player } from './Player';

export type { CollisionBox } from '../../systems/CollisionWorld';

export class PlayerController {
  readonly velocity = Vector3.Zero();
  readonly direction = new Vector3(0, 0, 1);
  private movementLocked = false;
  private running = false;
  private crouching = false;

  constructor(
    private readonly player: Player,
    private readonly input: InputManager,
    private readonly camera: ArcRotateCamera,
    private readonly collisionBoxes: CollisionBox[],
  ) {}

  update(deltaTime: number) {
    if (this.movementLocked) {
      this.velocity.setAll(0);
      return;
    }
    const inputX = this.input.horizontal;
    const inputZ = this.input.vertical;
    const desiredDirection = this.getCameraRelativeDirection(inputX, inputZ);
    const hasInput = desiredDirection.lengthSquared() > .0001;
    this.crouching = this.input.crouchHeld;
    this.running = hasInput && this.input.runHeld && !this.crouching;
    const movementSpeed = this.crouching
      ? GAME_3D_CONFIG.player.crouchSpeed
      : this.running ? GAME_3D_CONFIG.player.runSpeed : GAME_3D_CONFIG.player.walkSpeed;
    const desiredVelocity = hasInput
      ? desiredDirection.scale(movementSpeed)
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

  setMovementLocked(locked: boolean) {
    this.movementLocked = locked;
    if (locked) this.velocity.setAll(0);
  }

  reset() {
    this.movementLocked = false;
    this.running = false;
    this.crouching = false;
    this.velocity.setAll(0);
    this.direction.copyFromFloats(0, 0, 1);
  }

  get isMovementLocked() {
    return this.movementLocked;
  }

  get speed() {
    return this.velocity.length();
  }

  get isRunning() {
    return this.running;
  }

  get isCrouching() {
    return this.crouching;
  }

  get stanceHeight() {
    return this.crouching ? GAME_3D_CONFIG.player.crouchHeight : GAME_3D_CONFIG.player.height;
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
    const result = moveCircleWithSliding(
      this.player.position.x,
      this.player.position.z,
      delta.x,
      delta.z,
      radius,
      this.collisionBoxes,
      0,
      this.stanceHeight,
    );
    this.player.position.x = result.x;
    this.player.position.z = result.z;
    if (result.blockedX) this.velocity.x = 0;
    if (result.blockedZ) this.velocity.z = 0;
    this.player.position.y = 0;
  }
}
