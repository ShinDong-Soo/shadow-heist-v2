import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { GAME_3D_CONFIG } from '../../config/gameConfig';

export class Player {
  readonly root: TransformNode;
  readonly cameraTarget: TransformNode;
  readonly detectionTarget: TransformNode;
  readonly interactionPoint: TransformNode;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    const { height, radius, start } = GAME_3D_CONFIG.player;
    this.root = new TransformNode('player-root', scene);
    this.root.position.copyFromFloats(...start);

    const visual = MeshBuilder.CreateCapsule('player-visual', { height, radius, tessellation: 16 }, scene);
    visual.parent = this.root;
    visual.position.y = height / 2;
    const material = new StandardMaterial('player-debug-material', scene);
    material.diffuseColor = new Color3(.12, .72, .78);
    material.emissiveColor = new Color3(.015, .09, .1);
    material.specularColor = new Color3(.25, .6, .64);
    visual.material = material;
    shadowGenerator.addShadowCaster(visual);

    const facing = MeshBuilder.CreateBox('player-facing-marker', { width: .22, height: .18, depth: .18 }, scene);
    facing.parent = this.root;
    facing.position = new Vector3(0, 1.12, radius + .08);
    const facingMaterial = new StandardMaterial('player-facing-material', scene);
    facingMaterial.diffuseColor = new Color3(.95, .72, .24);
    facingMaterial.emissiveColor = new Color3(.24, .12, .01);
    facing.material = facingMaterial;
    shadowGenerator.addShadowCaster(facing);

    this.cameraTarget = new TransformNode('player-camera-target', scene);
    this.cameraTarget.parent = this.root;
    this.cameraTarget.position.y = GAME_3D_CONFIG.camera.targetHeight;

    this.detectionTarget = new TransformNode('player-detection-target', scene);
    this.detectionTarget.parent = this.root;
    this.detectionTarget.position.y = 1.15;

    this.interactionPoint = new TransformNode('player-interaction-point', scene);
    this.interactionPoint.parent = this.root;
    this.interactionPoint.position = new Vector3(0, .9, .75);
  }

  get position() {
    return this.root.position;
  }

  dispose() {
    this.root.dispose(false, true);
  }
}
