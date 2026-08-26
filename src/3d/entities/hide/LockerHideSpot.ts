import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { CollisionBox } from '../../systems/CollisionWorld';
import { HideSpot } from './HideSpot';

export class LockerHideSpot extends HideSpot {
  readonly collisionBoxes: CollisionBox[];
  private readonly doorHinge: TransformNode;
  private readonly meshes: Mesh[] = [];
  private doorProgress = 0;
  private doorTarget = 0;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator, position: Vector3, id = 'staff-locker') {
    super(scene, id, 'LOCKER', position);
    this.entryPoint.position.copyFromFloats(0, 0, -1.02);
    this.exitPoint.position.copyFromFloats(0, 0, -1.12);
    this.hidePoint.position.copyFromFloats(0, 0, -.02);
    // The hide camera orbits this point from inside the locker, producing an
    // eye-level view through the real door vent rather than a top-down filter.
    this.cameraTarget.position.copyFromFloats(0, 1.28, -1.5);

    const metal = new StandardMaterial('hide-locker-metal-material', scene);
    metal.diffuseColor = new Color3(.12, .17, .18);
    metal.specularColor = new Color3(.3, .38, .38);
    metal.specularPower = 54;
    const dark = new StandardMaterial('hide-locker-interior-material', scene);
    dark.diffuseColor = new Color3(.018, .027, .029);
    const accent = new StandardMaterial('hide-locker-accent-material', scene);
    accent.diffuseColor = new Color3(.18, .48, .43);
    accent.emissiveColor = new Color3(.018, .08, .065);
    const invisibleBlocker = new StandardMaterial('hide-locker-los-blocker-material', scene);
    invisibleBlocker.alpha = 0;
    invisibleBlocker.disableLighting = true;

    const addPanel = (name: string, x: number, y: number, z: number, width: number, height: number, depth: number, material = metal) => {
      const mesh = MeshBuilder.CreateBox(`hide-locker-${name}`, { width, height, depth }, scene);
      mesh.parent = this.root;
      mesh.position.copyFromFloats(x, y, z);
      mesh.material = material;
      mesh.metadata = { blocksVision: true, hideSpot: this.id };
      mesh.receiveShadows = true;
      shadowGenerator.addShadowCaster(mesh);
      this.meshes.push(mesh);
      return mesh;
    };

    addPanel('left', -.64, 1.12, 0, .12, 2.24, .86);
    addPanel('right', .64, 1.12, 0, .12, 2.24, .86);
    addPanel('back', 0, 1.12, .4, 1.4, 2.24, .1, dark);
    const roof = addPanel('roof', 0, 2.22, 0, 1.4, .1, .86);
    (roof.material as StandardMaterial).alpha = .88;
    addPanel('base', 0, .06, 0, 1.4, .12, .86, dark);

    this.doorHinge = new TransformNode('hide-locker-door-hinge', scene);
    this.doorHinge.parent = this.root;
    this.doorHinge.position.copyFromFloats(-.59, 0, -.44);
    const losBlocker = addPanel('door-los-blocker', 0, 1.12, 0, 1.18, 2.18, .035, invisibleBlocker);
    losBlocker.parent = this.doorHinge;
    losBlocker.position.copyFromFloats(.59, 1.12, 0);

    const addDoorPanel = (name: string, x: number, y: number, width: number, height: number) => {
      const panel = MeshBuilder.CreateBox(`hide-locker-door-${name}`, { width, height, depth: .075 }, scene);
      panel.parent = this.doorHinge;
      panel.position.copyFromFloats(.59 + x, y, 0);
      panel.material = metal;
      panel.metadata = { blocksVision: true, hideSpot: this.id };
      panel.receiveShadows = true;
      shadowGenerator.addShadowCaster(panel);
      this.meshes.push(panel);
      return panel;
    };
    addDoorPanel('top', 0, 1.82, 1.18, .68);
    addDoorPanel('bottom', 0, .55, 1.18, 1.08);
    addDoorPanel('vent-left', -.54, 1.28, .1, .4);
    addDoorPanel('vent-right', .54, 1.28, .1, .4);
    for (const x of [-.34, -.11, .11, .34]) addDoorPanel(`vent-bar-${x}`, x, 1.28, .035, .4);
    const lamp = MeshBuilder.CreateBox('hide-locker-status', { width: .16, height: .08, depth: .04 }, scene);
    lamp.parent = this.root;
    lamp.position.copyFromFloats(.46, 1.82, -.5);
    lamp.material = accent;
    this.meshes.push(lamp);

    this.collisionBoxes = [
      { minX: position.x - .72, maxX: position.x - .56, minZ: position.z - .48, maxZ: position.z + .48, minY: 0, maxY: 2.24 },
      { minX: position.x + .56, maxX: position.x + .72, minZ: position.z - .48, maxZ: position.z + .48, minY: 0, maxY: 2.24 },
      { minX: position.x - .72, maxX: position.x + .72, minZ: position.z + .35, maxZ: position.z + .48, minY: 0, maxY: 2.24 },
      { minX: position.x - .6, maxX: position.x + .6, minZ: position.z - .49, maxZ: position.z - .38, minY: 0, maxY: 2.24 },
    ];
  }

  setDoorOpen(open: boolean) {
    this.doorTarget = open ? 1 : 0;
  }

  update(deltaTime: number) {
    this.doorProgress += (this.doorTarget - this.doorProgress) * (1 - Math.exp(-10 * deltaTime));
    this.doorHinge.rotation.y = -this.doorProgress * 1.34;
  }

  reset() {
    this.occupied = false;
    this.interactionReady = false;
    this.doorProgress = 0;
    this.doorTarget = 0;
    this.doorHinge.rotation.y = 0;
  }

  dispose() {
    this.meshes.forEach(mesh => mesh.dispose(false, true));
    this.doorHinge.dispose();
    this.root.dispose();
  }
}
