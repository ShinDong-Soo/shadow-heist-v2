import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Player } from '../player/Player';
import type { HideSpotType } from './HideSpotTypes';

export abstract class HideSpot {
  readonly root: TransformNode;
  readonly entryPoint: TransformNode;
  readonly hidePoint: TransformNode;
  readonly exitPoint: TransformNode;
  readonly cameraTarget: TransformNode;
  occupied = false;
  interactionReady = false;

  protected constructor(
    scene: Scene,
    readonly id: string,
    readonly type: HideSpotType,
    position: Vector3,
  ) {
    this.root = new TransformNode(`hide-${id}-root`, scene);
    this.root.position.copyFrom(position);
    this.entryPoint = this.makePoint(scene, 'entry');
    this.hidePoint = this.makePoint(scene, 'inside');
    this.exitPoint = this.makePoint(scene, 'exit');
    this.cameraTarget = this.makePoint(scene, 'camera-target');
  }

  updateInteraction(player: Player) {
    if (this.occupied) {
      this.interactionReady = false;
      return;
    }
    const entry = this.entryPoint.getAbsolutePosition();
    const toSpot = this.root.getAbsolutePosition().subtract(player.position);
    toSpot.y = 0;
    const distance = Vector3.Distance(player.position, entry);
    if (toSpot.lengthSquared() < .0001) {
      this.interactionReady = distance <= 1.3;
      return;
    }
    toSpot.normalize();
    const facing = new Vector3(Math.sin(player.root.rotation.y), 0, Math.cos(player.root.rotation.y));
    this.interactionReady = distance <= 1.3 && Vector3.Dot(facing, toSpot) >= .2;
  }

  abstract setDoorOpen(open: boolean): void;
  abstract update(deltaTime: number): void;
  abstract reset(): void;
  abstract dispose(): void;

  private makePoint(scene: Scene, suffix: string) {
    const point = new TransformNode(`hide-${this.id}-${suffix}`, scene);
    point.parent = this.root;
    return point;
  }
}

