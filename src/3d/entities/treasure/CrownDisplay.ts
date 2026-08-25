import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { CROWN_HALL_CONFIG } from '../../config/crownHallConfig';
import type { CollisionBox } from '../../systems/CollisionWorld';

export class CrownDisplay {
  readonly spotlight: SpotLight;
  readonly collisionBox: CollisionBox;
  private readonly caseMesh: Mesh;
  private readonly lightPool: Mesh;
  private openProgress = 0;
  private targetOpen = false;
  private targetSpotlightIntensity = 4.2;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    const [x, , z] = CROWN_HALL_CONFIG.crown.position;

    const stone = new StandardMaterial('crown-pedestal-material', scene);
    stone.diffuseColor = new Color3(.105, .12, .13);
    stone.specularColor = new Color3(.28, .3, .28);
    stone.specularPower = 48;

    const gold = new StandardMaterial('crown-display-trim-material', scene);
    gold.diffuseColor = new Color3(.58, .39, .12);
    gold.emissiveColor = new Color3(.035, .018, .002);
    gold.specularColor = new Color3(.75, .55, .2);

    const glass = new StandardMaterial('crown-glass-material', scene);
    glass.diffuseColor = new Color3(.28, .5, .5);
    glass.emissiveColor = new Color3(.015, .04, .045);
    glass.specularColor = new Color3(.85, 1, 1);
    glass.alpha = .18;
    glass.backFaceCulling = false;

    const base = MeshBuilder.CreateBox('crown-display-base', { width: 1.75, height: .18, depth: 1.75 }, scene);
    base.position.copyFromFloats(x, .09, z);
    base.material = gold;
    base.receiveShadows = true;

    const pedestal = MeshBuilder.CreateBox('crown-display-pedestal', { width: 1.25, height: 1.05, depth: 1.25 }, scene);
    pedestal.position.copyFromFloats(x, .615, z);
    pedestal.material = stone;
    pedestal.receiveShadows = true;
    pedestal.metadata = { blocksMovement: true, blocksVision: false };

    this.caseMesh = MeshBuilder.CreateBox('crown-display-glass', { width: 1.32, height: 1.12, depth: 1.32 }, scene);
    this.caseMesh.position.copyFromFloats(x, 1.65, z);
    this.caseMesh.material = glass;
    this.caseMesh.visibility = .72;
    this.caseMesh.metadata = { blocksMovement: true, blocksVision: false };

    const frameY = 2.22;
    const topFrame = MeshBuilder.CreateBox('crown-display-top-frame', { width: 1.4, height: .07, depth: 1.4 }, scene);
    topFrame.position.copyFromFloats(x, frameY, z);
    topFrame.material = gold;

    [base, pedestal, topFrame].forEach(mesh => shadowGenerator.addShadowCaster(mesh));

    this.spotlight = new SpotLight(
      'crown-objective-spotlight',
      new Vector3(x, 6.2, z),
      new Vector3(0, -1, 0),
      .72,
      2.4,
      scene,
    );
    this.spotlight.diffuse = new Color3(1, .76, .35);
    this.spotlight.specular = new Color3(1, .83, .5);
    this.spotlight.intensity = 4.2;
    this.spotlight.range = 8;

    const lightPoolMaterial = new StandardMaterial('crown-light-pool-material', scene);
    lightPoolMaterial.diffuseColor = new Color3(.34, .22, .06);
    lightPoolMaterial.emissiveColor = new Color3(.075, .042, .006);
    lightPoolMaterial.alpha = .34;
    this.lightPool = MeshBuilder.CreateCylinder('crown-light-pool', {
      diameter: 3.8,
      height: .018,
      tessellation: 48,
    }, scene);
    this.lightPool.position.copyFromFloats(x, .025, z);
    this.lightPool.material = lightPoolMaterial;
    this.lightPool.isPickable = false;

    this.collisionBox = {
      minX: x - .72,
      maxX: x + .72,
      minZ: z - .72,
      maxZ: z + .72,
    };
  }

  update(deltaTime: number) {
    const target = this.targetOpen ? 1 : 0;
    this.openProgress += (target - this.openProgress) * (1 - Math.exp(-5.5 * deltaTime));
    this.caseMesh.position.y = 1.65 + this.openProgress * .92;
    this.spotlight.intensity += (this.targetSpotlightIntensity - this.spotlight.intensity) * (1 - Math.exp(-7 * deltaTime));
    this.lightPool.visibility = Math.max(0, this.spotlight.intensity / 4.2);
  }

  setOpening(opening: boolean) {
    this.targetOpen = opening;
  }

  setSpotlightActive(active: boolean) {
    this.targetSpotlightIntensity = active ? 4.2 : 0;
  }

  reset() {
    this.targetOpen = false;
    this.openProgress = 0;
    this.caseMesh.position.y = 1.65;
    this.targetSpotlightIntensity = 4.2;
    this.spotlight.intensity = 4.2;
    this.lightPool.visibility = 1;
  }

  dispose() {
    this.spotlight.dispose();
  }
}
