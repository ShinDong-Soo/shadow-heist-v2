import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { CROWN_HALL_CONFIG } from '../config/crownHallConfig';
import type { CollisionBox } from './CollisionWorld';

export type SecurityGateState = 'OPEN' | 'CLOSING' | 'CLOSED' | 'OPENING';

export class SecurityGate {
  readonly collisionBox: CollisionBox = { minX: 999, maxX: 999, minZ: 999, maxZ: 999 };
  state: SecurityGateState = 'OPEN';
  progress = 0;
  private readonly mesh: Mesh;
  private readonly statusMaterial: StandardMaterial;
  private closedListener: (() => void) | null = null;

  constructor(scene: Scene) {
    const metal = new StandardMaterial('security-gate-metal-material', scene);
    metal.diffuseColor = new Color3(.075, .085, .085);
    metal.specularColor = new Color3(.34, .37, .35);
    metal.specularPower = 72;

    this.statusMaterial = new StandardMaterial('security-gate-status-material', scene);
    this.statusMaterial.diffuseColor = new Color3(.25, .02, .015);
    this.statusMaterial.emissiveColor = new Color3(.03, .005, .002);

    this.mesh = MeshBuilder.CreateBox('security-lockdown-gate', {
      width: 2.35,
      height: 2.65,
      depth: .18,
    }, scene);
    this.mesh.position.copyFromFloats(0, 4.36, -5.25);
    this.mesh.material = metal;
    this.mesh.metadata = { blocksVision: true, dynamicGate: true };
    this.mesh.receiveShadows = true;

    for (let index = 0; index < 6; index += 1) {
      const warningBar = MeshBuilder.CreateBox(`security-gate-warning-${index}`, {
        width: .26,
        height: .055,
        depth: .195,
      }, scene);
      warningBar.parent = this.mesh;
      warningBar.position.copyFromFloats(-.82 + index * .33, -1.05, -.01);
      warningBar.material = this.statusMaterial;
    }
  }

  update(deltaTime: number) {
    if (this.state === 'CLOSING') {
      this.progress = Math.min(1, this.progress + deltaTime / CROWN_HALL_CONFIG.lockdown.gateCloseDuration);
      if (this.progress >= 1) {
        this.state = 'CLOSED';
        this.closedListener?.();
      }
    } else if (this.state === 'OPENING') {
      this.progress = Math.max(0, this.progress - deltaTime / CROWN_HALL_CONFIG.lockdown.gateOpenDuration);
      if (this.progress <= 0) this.state = 'OPEN';
    }
    this.applyProgress();
  }

  close() {
    if (this.state === 'CLOSED' || this.state === 'CLOSING') return;
    this.state = 'CLOSING';
    this.statusMaterial.emissiveColor.copyFromFloats(.55, .025, .012);
  }

  open() {
    if (this.progress <= 0) {
      this.reset();
      return;
    }
    this.state = 'OPENING';
  }

  reset() {
    this.progress = 0;
    this.state = 'OPEN';
    this.statusMaterial.emissiveColor.copyFromFloats(.03, .005, .002);
    this.applyProgress();
  }

  onClosed(listener: () => void) {
    this.closedListener = listener;
  }

  dispose() {
    this.closedListener = null;
    this.mesh.dispose(false, true);
  }

  private applyProgress() {
    this.mesh.position.y = 4.36 - this.progress * 2.93;
    const blocks = this.progress >= .68;
    if (blocks) {
      this.collisionBox.minX = -1.17;
      this.collisionBox.maxX = 1.17;
      this.collisionBox.minZ = -5.39;
      this.collisionBox.maxZ = -5.11;
    } else {
      this.collisionBox.minX = 999;
      this.collisionBox.maxX = 999;
      this.collisionBox.minZ = 999;
      this.collisionBox.maxZ = 999;
    }
  }
}
