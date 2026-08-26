import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { GAME_3D_CONFIG } from '../../config/gameConfig';
import { ProceduralHumanoid } from '../../animation/ProceduralHumanoid';

export class Player {
  readonly root: TransformNode;
  readonly cameraTarget: TransformNode;
  readonly detectionTarget: TransformNode;
  readonly interactionPoint: TransformNode;
  readonly visual: ProceduralHumanoid;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    const { start } = GAME_3D_CONFIG.player;
    this.root = new TransformNode('player-root', scene);
    this.root.position.copyFromFloats(...start);
    this.visual = new ProceduralHumanoid(scene, this.root, shadowGenerator, 'PLAYER');

    this.cameraTarget = new TransformNode('player-camera-target', scene);
    this.cameraTarget.parent = this.root;
    this.cameraTarget.position.y = GAME_3D_CONFIG.camera.targetHeight;

    this.detectionTarget = new TransformNode('player-detection-target', scene);
    this.detectionTarget.parent = this.root;
    this.detectionTarget.position.y = 1.15;

    this.interactionPoint = new TransformNode('player-interaction-point', scene);
    // Crown pickup targets the animated hand, not a fixed point in front of
    // PlayerRoot. This keeps the item/contact timing aligned with the pose.
    this.interactionPoint.parent = this.visual.rightForearm;
    this.interactionPoint.position = new Vector3(0, -.43, .03);
  }

  get position() {
    return this.root.position;
  }

  dispose() {
    this.root.dispose(false, true);
  }
}
