import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { GUARD_CONFIG } from '../../config/guardConfig';
import { ProceduralHumanoid } from '../../animation/ProceduralHumanoid';

export class Guard {
  readonly root: TransformNode;
  readonly flashlightPivot: TransformNode;
  readonly detectionOrigin: TransformNode;
  readonly navigationTarget: TransformNode;
  readonly shadowCasters: AbstractMesh[];
  readonly visual: ProceduralHumanoid;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator, start: Vector3) {
    this.root = new TransformNode('guard-root', scene);
    this.root.position.copyFrom(start);

    this.visual = new ProceduralHumanoid(scene, this.root, shadowGenerator, 'GUARD');

    this.flashlightPivot = new TransformNode('guard-flashlight-pivot', scene);
    this.flashlightPivot.parent = this.visual.flashlightSocket;
    this.flashlightPivot.position = new Vector3(0, 0, .08);
    const flashlightMaterial = new StandardMaterial('guard-flashlight-material', scene);
    flashlightMaterial.diffuseColor = new Color3(.11, .12, .13);
    flashlightMaterial.specularColor = new Color3(.35, .35, .31);
    const flashlightBody = MeshBuilder.CreateCylinder('guard-hand-flashlight', { height: .34, diameter: .105, tessellation: 10 }, scene);
    flashlightBody.parent = this.flashlightPivot;
    flashlightBody.rotation.x = Math.PI / 2;
    flashlightBody.position.z = .12;
    flashlightBody.material = flashlightMaterial;
    shadowGenerator.addShadowCaster(flashlightBody);

    this.detectionOrigin = new TransformNode('guard-detection-origin', scene);
    this.detectionOrigin.parent = this.root;
    this.detectionOrigin.position = new Vector3(0, 1.55, .2);

    this.navigationTarget = new TransformNode('guard-navigation-target', scene);
    this.navigationTarget.position.copyFrom(start);

    this.shadowCasters = [...this.visual.shadowCasters, flashlightBody];
  }

  get position() {
    return this.root.position;
  }

  dispose() {
    this.navigationTarget.dispose();
    this.root.dispose(false, true);
  }
}
