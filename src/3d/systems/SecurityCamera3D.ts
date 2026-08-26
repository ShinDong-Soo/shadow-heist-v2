import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Player } from '../entities/player/Player';

export class SecurityCamera3D {
  isPlayerVisible = false;
  readonly lastSeenPosition = Vector3.Zero();
  private readonly light: SpotLight;
  private readonly ray = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 7);
  private readonly direction = Vector3.Zero();
  private readonly toPlayer = Vector3.Zero();
  private readonly flatDirection = Vector3.Zero();
  private readonly flatToPlayer = Vector3.Zero();
  private elapsed = 0;
  private checkRemaining = 0;

  constructor(
    private readonly scene: Scene,
    private readonly player: Player,
    private readonly position: Vector3,
    private readonly baseYaw: number,
    readonly id: string,
  ) {
    this.light = new SpotLight(`security-camera-light-${id}`, position, new Vector3(0, -.35, 1), .58, 8, scene);
    this.light.diffuse = new Color3(.85, .045, .025);
    this.light.specular = new Color3(.2, .01, .005);
    this.light.range = 7;
    this.light.intensity = .42;
    this.light.includedOnlyMeshes = scene.meshes.filter(mesh => mesh.name === 'museum-floor-security-corridor');
  }

  update(deltaTime: number, alarmActive: boolean) {
    this.elapsed += deltaTime;
    const yaw = this.baseYaw + Math.sin(this.elapsed * .72) * .62;
    this.direction.copyFromFloats(Math.sin(yaw), -.34, Math.cos(yaw)).normalize();
    this.light.direction.copyFrom(this.direction);
    this.light.intensity = alarmActive ? .12 : .42;
    this.checkRemaining -= deltaTime;
    if (this.checkRemaining > 0) return;
    this.checkRemaining = .1;
    this.performCheck();
  }

  dispose() {
    this.light.dispose();
  }

  private performCheck() {
    const target = this.player.detectionTarget.getAbsolutePosition();
    target.subtractToRef(this.position, this.toPlayer);
    const distance = this.toPlayer.length();
    if (distance > 7) {
      this.isPlayerVisible = false;
      return;
    }
    this.flatDirection.copyFromFloats(this.direction.x, 0, this.direction.z).normalize();
    this.flatToPlayer.copyFromFloats(this.toPlayer.x, 0, this.toPlayer.z).normalize();
    if (Vector3.Dot(this.flatDirection, this.flatToPlayer) < Math.cos(.58 / 2)) {
      this.isPlayerVisible = false;
      return;
    }
    this.ray.origin.copyFrom(this.position);
    this.toPlayer.scaleToRef(1 / Math.max(.001, distance), this.ray.direction);
    this.ray.length = distance;
    const hit = this.scene.pickWithRay(this.ray, mesh => mesh.metadata?.blocksVision === true, true);
    this.isPlayerVisible = !(hit?.hit && hit.distance < distance - .04);
    if (this.isPlayerVisible) this.lastSeenPosition.copyFrom(target);
  }
}
