import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { GUARD_CONFIG } from '../../config/guardConfig';

export class Guard {
  readonly root: TransformNode;
  readonly flashlightPivot: TransformNode;
  readonly detectionOrigin: TransformNode;
  readonly navigationTarget: TransformNode;
  readonly shadowCasters: AbstractMesh[];

  constructor(scene: Scene, shadowGenerator: ShadowGenerator, start: Vector3) {
    this.root = new TransformNode('guard-root', scene);
    this.root.position.copyFrom(start);

    const uniformMaterial = new StandardMaterial('guard-uniform-material', scene);
    uniformMaterial.diffuseColor = new Color3(.065, .095, .13);
    uniformMaterial.specularColor = new Color3(.22, .28, .34);

    const body = MeshBuilder.CreateCapsule('guard-visual', {
      height: GUARD_CONFIG.height,
      radius: GUARD_CONFIG.radius,
      tessellation: 16,
    }, scene);
    body.parent = this.root;
    body.position.y = GUARD_CONFIG.height / 2;
    body.material = uniformMaterial;
    body.receiveShadows = true;

    const capMaterial = new StandardMaterial('guard-cap-material', scene);
    capMaterial.diffuseColor = new Color3(.035, .05, .07);
    const cap = MeshBuilder.CreateCylinder('guard-cap', { height: .16, diameter: .68, tessellation: 16 }, scene);
    cap.parent = this.root;
    cap.position.y = 1.74;
    cap.position.z = .04;
    cap.material = capMaterial;
    cap.receiveShadows = true;

    const flashlightBodyMaterial = new StandardMaterial('guard-flashlight-body-material', scene);
    flashlightBodyMaterial.diffuseColor = new Color3(.12, .13, .14);
    flashlightBodyMaterial.emissiveColor = new Color3(.025, .022, .016);
    const flashlightBody = MeshBuilder.CreateCylinder('guard-flashlight-body', {
      height: .38,
      diameter: .12,
      tessellation: 12,
    }, scene);
    flashlightBody.parent = this.root;
    flashlightBody.rotation.x = Math.PI / 2;
    flashlightBody.position = new Vector3(.25, 1.26, .32);
    flashlightBody.material = flashlightBodyMaterial;

    this.flashlightPivot = new TransformNode('guard-flashlight-pivot', scene);
    this.flashlightPivot.parent = this.root;
    this.flashlightPivot.position = new Vector3(0, GUARD_CONFIG.flashlight.height, GUARD_CONFIG.flashlight.forwardOffset);

    this.detectionOrigin = new TransformNode('guard-detection-origin', scene);
    this.detectionOrigin.parent = this.root;
    this.detectionOrigin.position = new Vector3(0, 1.55, .2);

    this.navigationTarget = new TransformNode('guard-navigation-target', scene);
    this.navigationTarget.position.copyFrom(start);

    this.shadowCasters = [body, cap, flashlightBody];
    this.shadowCasters.forEach(mesh => shadowGenerator.addShadowCaster(mesh));
  }

  get position() {
    return this.root.position;
  }

  dispose() {
    this.navigationTarget.dispose();
    this.root.dispose(false, true);
  }
}
