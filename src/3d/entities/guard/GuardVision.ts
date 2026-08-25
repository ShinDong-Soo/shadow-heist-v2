import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Scene } from '@babylonjs/core/scene';
import { GUARD_VISION_CONFIG } from '../../config/guardVisionConfig';
import type { Player } from '../player/Player';
import type { Guard } from './Guard';
import type { GuardFlashlight } from './GuardFlashlight';

export type VisionResult = 'VISIBLE' | 'BLOCKED' | 'OUT_OF_RANGE' | 'OUTSIDE_FOV';

export class GuardVision {
  isPlayerVisible = false;
  result: VisionResult = 'OUT_OF_RANGE';
  distance = Infinity;
  angleDegrees = 180;
  blockedBy = 'NONE';
  checksPerSecond = 0;
  raycastsPerSecond = 0;
  readonly lastVisiblePosition = Vector3.Zero();

  private checkRemaining = 0;
  private metricElapsed = 0;
  private checksThisWindow = 0;
  private raycastsThisWindow = 0;
  private readonly cone: LinesMesh;
  private rayLine: LinesMesh;

  constructor(
    private readonly scene: Scene,
    private readonly guard: Guard,
    private readonly flashlight: GuardFlashlight,
    private readonly player: Player,
  ) {
    const halfAngle = GUARD_VISION_CONFIG.angle / 2;
    const conePoints = [new Vector3(0, .055, 0)];
    const segments = 18;
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = -halfAngle + GUARD_VISION_CONFIG.angle * segment / segments;
      conePoints.push(new Vector3(
        Math.sin(angle) * GUARD_VISION_CONFIG.range,
        .055,
        Math.cos(angle) * GUARD_VISION_CONFIG.range,
      ));
    }
    conePoints.push(new Vector3(0, .055, 0));
    this.cone = MeshBuilder.CreateLines('guard-vision-debug-cone', { points: conePoints }, scene);
    this.cone.parent = guard.root;
    this.cone.color = new Color3(.34, .69, .92);
    this.cone.alpha = .55;
    this.cone.isPickable = false;

    const origin = guard.detectionOrigin.getAbsolutePosition();
    const target = player.detectionTarget.getAbsolutePosition();
    this.rayLine = MeshBuilder.CreateLines('guard-vision-debug-ray', {
      points: [origin, target],
      updatable: true,
    }, scene);
    this.rayLine.color = new Color3(.38, .45, .47);
    this.rayLine.isPickable = false;
  }

  update(deltaTime: number) {
    this.checkRemaining -= deltaTime;
    this.metricElapsed += deltaTime;
    if (this.checkRemaining <= 0) {
      this.checkRemaining += GUARD_VISION_CONFIG.checkInterval;
      this.performCheck();
    }
    if (this.metricElapsed >= 1) {
      this.checksPerSecond = Math.round(this.checksThisWindow / this.metricElapsed);
      this.raycastsPerSecond = Math.round(this.raycastsThisWindow / this.metricElapsed);
      this.metricElapsed = 0;
      this.checksThisWindow = 0;
      this.raycastsThisWindow = 0;
    }
  }

  private performCheck() {
    this.checksThisWindow += 1;
    const origin = this.guard.detectionOrigin.getAbsolutePosition();
    const target = this.player.detectionTarget.getAbsolutePosition();
    const toTarget = target.subtract(origin);
    this.distance = toTarget.length();
    this.blockedBy = 'NONE';

    if (this.distance > GUARD_VISION_CONFIG.range) {
      this.setResult('OUT_OF_RANGE', origin, target);
      return;
    }

    const horizontalToTarget = new Vector3(toTarget.x, 0, toTarget.z).normalize();
    const visionForward = this.flashlight.worldDirection.clone();
    visionForward.y = 0;
    visionForward.normalize();
    const dot = Math.max(-1, Math.min(1, Vector3.Dot(visionForward, horizontalToTarget)));
    this.angleDegrees = Math.acos(dot) * 180 / Math.PI;
    if (dot < Math.cos(GUARD_VISION_CONFIG.angle / 2)) {
      this.setResult('OUTSIDE_FOV', origin, target);
      return;
    }

    this.raycastsThisWindow += 1;
    const ray = new Ray(origin, toTarget.scale(1 / this.distance), this.distance);
    const hit = this.scene.pickWithRay(ray, mesh => mesh.metadata?.blocksVision === true, true);
    if (hit?.hit && hit.distance < this.distance - .03) {
      this.blockedBy = hit.pickedMesh?.name ?? 'VISION BLOCKER';
      this.setResult('BLOCKED', origin, hit.pickedPoint ?? target);
      return;
    }

    this.setResult('VISIBLE', origin, target);
  }

  private setResult(result: VisionResult, origin: Vector3, rayEnd: Vector3) {
    this.result = result;
    this.isPlayerVisible = result === 'VISIBLE';
    if (this.isPlayerVisible) this.lastVisiblePosition.copyFrom(this.player.detectionTarget.getAbsolutePosition());
    this.rayLine = MeshBuilder.CreateLines('guard-vision-debug-ray', {
      points: [origin, rayEnd],
      instance: this.rayLine,
    }, this.scene);
    this.rayLine.color = result === 'VISIBLE'
      ? new Color3(.2, 1, .5)
      : result === 'BLOCKED'
        ? new Color3(1, .22, .16)
        : new Color3(.38, .45, .47);
  }

  setDebugVisible(visible: boolean) {
    this.cone.isVisible = visible;
    this.rayLine.isVisible = visible;
  }

  dispose() {
    this.cone.dispose();
    this.rayLine.dispose();
  }
}
