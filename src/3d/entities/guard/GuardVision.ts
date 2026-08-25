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
  private debugVisible = false;
  private alertMode = false;
  private readonly toTarget = Vector3.Zero();
  private readonly horizontalToTarget = Vector3.Zero();
  private readonly visionForward = Vector3.Zero();
  private readonly visionRay = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 0);
  private readonly visibleColor = new Color3(.2, 1, .5);
  private readonly blockedColor = new Color3(1, .22, .16);
  private readonly inactiveColor = new Color3(.38, .45, .47);

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
    this.cone.isVisible = false;

    const origin = guard.detectionOrigin.getAbsolutePosition();
    const target = player.detectionTarget.getAbsolutePosition();
    this.rayLine = MeshBuilder.CreateLines('guard-vision-debug-ray', {
      points: [origin, target],
      updatable: true,
    }, scene);
    this.rayLine.color = new Color3(.38, .45, .47);
    this.rayLine.isPickable = false;
    this.rayLine.isVisible = false;
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
    target.subtractToRef(origin, this.toTarget);
    this.distance = this.toTarget.length();
    this.blockedBy = 'NONE';

    if (this.distance > this.effectiveRange) {
      this.setResult('OUT_OF_RANGE', origin, target);
      return;
    }

    this.horizontalToTarget.copyFromFloats(this.toTarget.x, 0, this.toTarget.z).normalize();
    this.visionForward.copyFrom(this.flashlight.worldDirection);
    this.visionForward.y = 0;
    this.visionForward.normalize();
    const dot = Math.max(-1, Math.min(1, Vector3.Dot(this.visionForward, this.horizontalToTarget)));
    this.angleDegrees = Math.acos(dot) * 180 / Math.PI;
    if (dot < Math.cos(GUARD_VISION_CONFIG.angle / 2)) {
      this.setResult('OUTSIDE_FOV', origin, target);
      return;
    }

    this.raycastsThisWindow += 1;
    this.visionRay.origin.copyFrom(origin);
    this.toTarget.scaleToRef(1 / this.distance, this.visionRay.direction);
    this.visionRay.length = this.distance;
    const hit = this.scene.pickWithRay(this.visionRay, mesh => mesh.metadata?.blocksVision === true, true);
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
    if (this.debugVisible) {
      this.rayLine = MeshBuilder.CreateLines('guard-vision-debug-ray', {
        points: [origin, rayEnd],
        instance: this.rayLine,
      }, this.scene);
      this.rayLine.color = result === 'VISIBLE'
        ? this.visibleColor
        : result === 'BLOCKED'
          ? this.blockedColor
          : this.inactiveColor;
    }
  }

  setDebugVisible(visible: boolean) {
    this.debugVisible = visible;
    this.cone.isVisible = visible;
    this.rayLine.isVisible = visible;
  }

  setAlertMode(active: boolean) {
    this.alertMode = active;
  }

  get effectiveRange() {
    return GUARD_VISION_CONFIG.range * (this.alertMode ? GUARD_VISION_CONFIG.alarmRangeMultiplier : 1);
  }

  dispose() {
    this.cone.dispose();
    this.rayLine.dispose();
  }
}
