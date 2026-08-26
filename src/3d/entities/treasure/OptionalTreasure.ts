import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { Player } from '../player/Player';

export class OptionalTreasure {
  readonly root: TransformNode;
  collected = false;
  interactionReady = false;

  constructor(
    scene: Scene,
    shadowGenerator: ShadowGenerator,
    readonly id: string,
    readonly label: string,
    readonly value: number,
    position: Vector3,
    color: Color3,
  ) {
    this.root = new TransformNode(`optional-treasure-${id}-root`, scene);
    this.root.position.copyFrom(position);
    const gold = new StandardMaterial(`optional-treasure-${id}-material`, scene);
    gold.diffuseColor = color;
    gold.emissiveColor = color.scale(.12);
    gold.specularColor = new Color3(.8, .7, .42);
    gold.specularPower = 72;
    const base = MeshBuilder.CreateCylinder(`optional-treasure-${id}-base`, { diameter: .58, height: .16, tessellation: 16 }, scene);
    base.parent = this.root;
    base.position.y = .82;
    base.material = gold;
    const gem = MeshBuilder.CreatePolyhedron(`optional-treasure-${id}-hero`, { type: 1, size: .28 }, scene);
    gem.parent = this.root;
    gem.position.y = 1.08;
    gem.material = gold;
    shadowGenerator.addShadowCaster(base);
    shadowGenerator.addShadowCaster(gem);
  }

  update(player: Player, deltaTime: number) {
    if (this.collected) {
      this.interactionReady = false;
      return;
    }
    this.root.rotation.y += deltaTime * .55;
    const distance = Vector3.Distance(player.position, this.root.position);
    this.interactionReady = distance <= 1.35;
  }

  collect() {
    if (this.collected || !this.interactionReady) return false;
    this.collected = true;
    this.interactionReady = false;
    this.root.setEnabled(false);
    return true;
  }

  reset() {
    this.collected = false;
    this.interactionReady = false;
    this.root.setEnabled(true);
  }

  dispose() {
    this.root.dispose(false, true);
  }
}
