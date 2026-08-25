import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { CROWN_HALL_CONFIG } from '../../config/crownHallConfig';
import type { Player } from '../player/Player';

export type CrownState = 'AVAILABLE' | 'TAKING' | 'STOLEN';
export type CrownInteractionResult = 'READY' | 'TOO_FAR' | 'WRONG_SIDE' | 'LOOK_AT_CROWN' | 'TAKING' | 'STOLEN';
export type CrownStolenListener = () => void;

export class Crown {
  readonly root: TransformNode;
  readonly interactionPoint: TransformNode;
  state: CrownState = 'AVAILABLE';
  interactionResult: CrownInteractionResult = 'TOO_FAR';

  private readonly listeners = new Set<CrownStolenListener>();
  private readonly interactionRing: LinesMesh;
  private readonly horizontalToCrown = Vector3.Zero();
  private readonly playerForward = Vector3.Zero();
  private readonly initialPosition = Vector3.Zero();
  private readonly takeStart = Vector3.Zero();
  private readonly takeTarget = Vector3.Zero();
  private takeElapsed = 0;
  private debugVisible = false;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    const [x, y, z] = CROWN_HALL_CONFIG.crown.position;
    this.root = new TransformNode('crown-root', scene);
    this.root.position.copyFromFloats(x, y, z);
    this.initialPosition.copyFrom(this.root.position);

    const gold = new StandardMaterial('crown-gold-material', scene);
    gold.diffuseColor = new Color3(.93, .61, .12);
    gold.emissiveColor = new Color3(.16, .075, .008);
    gold.specularColor = new Color3(1, .82, .34);
    gold.specularPower = 96;

    const velvet = new StandardMaterial('crown-velvet-material', scene);
    velvet.diffuseColor = new Color3(.23, .018, .035);
    velvet.specularColor = new Color3(.2, .04, .06);

    const band = MeshBuilder.CreateTorus('crown-band', {
      diameter: .62,
      thickness: .105,
      tessellation: 24,
    }, scene);
    band.parent = this.root;
    band.position.y = .13;
    band.material = gold;

    const cushion = MeshBuilder.CreateCylinder('crown-cushion', {
      diameter: .48,
      height: .15,
      tessellation: 20,
    }, scene);
    cushion.parent = this.root;
    cushion.position.y = .02;
    cushion.material = velvet;

    const shadowCasters: AbstractMesh[] = [band, cushion];
    const spikeSource = MeshBuilder.CreateCylinder('crown-spike-source', {
      diameterTop: 0,
      diameterBottom: .13,
      height: .48,
      tessellation: 8,
    }, scene);
    for (let spikeIndex = 0; spikeIndex < 6; spikeIndex += 1) {
      const angle = spikeIndex / 6 * Math.PI * 2;
      const spike = spikeIndex === 0
        ? spikeSource
        : spikeSource.createInstance(`crown-spike-${spikeIndex + 1}`);
      spike.parent = this.root;
      spike.position.copyFromFloats(Math.sin(angle) * .25, .38, Math.cos(angle) * .25);
      if (spikeIndex === 0) spike.material = gold;
      shadowCasters.push(spike);
    }
    shadowCasters.forEach(mesh => shadowGenerator.addShadowCaster(mesh));

    this.interactionPoint = new TransformNode('crown-interaction-point', scene);
    this.interactionPoint.position.copyFromFloats(x, 0, z - 1.2);

    const ringPoints: Vector3[] = [];
    for (let index = 0; index <= 48; index += 1) {
      const angle = index / 48 * Math.PI * 2;
      ringPoints.push(new Vector3(
        Math.sin(angle) * CROWN_HALL_CONFIG.crown.interactionRadius,
        .04,
        Math.cos(angle) * CROWN_HALL_CONFIG.crown.interactionRadius,
      ));
    }
    this.interactionRing = MeshBuilder.CreateLines('crown-interaction-debug', { points: ringPoints }, scene);
    this.interactionRing.position.copyFromFloats(x, 0, z);
    this.interactionRing.color = new Color3(.98, .72, .2);
    this.interactionRing.alpha = .65;
    this.interactionRing.isPickable = false;
  }

  updateInteraction(player: Player) {
    if (this.state === 'TAKING') {
      this.interactionResult = 'TAKING';
      return;
    }
    if (this.state === 'STOLEN') {
      this.interactionResult = 'STOLEN';
      return;
    }

    const playerPosition = player.position;
    const crownPosition = this.root.position;
    this.horizontalToCrown.copyFromFloats(crownPosition.x - playerPosition.x, 0, crownPosition.z - playerPosition.z);
    if (this.horizontalToCrown.length() > CROWN_HALL_CONFIG.crown.interactionRadius) {
      this.interactionResult = 'TOO_FAR';
      return;
    }
    if (playerPosition.z > crownPosition.z - CROWN_HALL_CONFIG.crown.interactionFrontLimit) {
      this.interactionResult = 'WRONG_SIDE';
      return;
    }

    this.horizontalToCrown.normalize();
    this.playerForward.copyFromFloats(Math.sin(player.root.rotation.y), 0, Math.cos(player.root.rotation.y));
    if (Vector3.Dot(this.playerForward, this.horizontalToCrown) < CROWN_HALL_CONFIG.crown.interactionFacingDot) {
      this.interactionResult = 'LOOK_AT_CROWN';
      return;
    }
    this.interactionResult = 'READY';
  }

  beginTake(target: Vector3) {
    if (this.state !== 'AVAILABLE') return false;
    this.state = 'TAKING';
    this.interactionResult = 'TAKING';
    this.takeElapsed = 0;
    this.takeStart.copyFrom(this.root.position);
    this.takeTarget.copyFrom(target);
    this.takeTarget.y = 1.15;
    this.interactionRing.isVisible = false;
    return true;
  }

  update(deltaTime: number) {
    if (this.state !== 'TAKING') return;
    this.takeElapsed = Math.min(CROWN_HALL_CONFIG.crown.takeDuration, this.takeElapsed + deltaTime);
    const progress = this.takeElapsed / CROWN_HALL_CONFIG.crown.takeDuration;
    const eased = 1 - Math.pow(1 - progress, 3);
    Vector3.LerpToRef(this.takeStart, this.takeTarget, eased, this.root.position);
    const scale = 1 - eased * .55;
    this.root.scaling.copyFromFloats(scale, scale, scale);
    this.root.rotation.y += deltaTime * 4.5;
  }

  commitSteal() {
    if (this.state !== 'TAKING') return false;
    this.state = 'STOLEN';
    this.interactionResult = 'STOLEN';
    this.root.setEnabled(false);
    this.interactionRing.isVisible = false;
    this.listeners.forEach(listener => listener());
    return true;
  }

  reset() {
    this.state = 'AVAILABLE';
    this.interactionResult = 'TOO_FAR';
    this.takeElapsed = 0;
    this.root.position.copyFrom(this.initialPosition);
    this.root.rotation.setAll(0);
    this.root.scaling.setAll(1);
    this.root.setEnabled(true);
    this.interactionRing.isVisible = this.debugVisible;
  }

  onStolen(listener: CrownStolenListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setDebugVisible(visible: boolean) {
    this.debugVisible = visible;
    this.interactionRing.isVisible = visible && this.state === 'AVAILABLE';
  }

  dispose() {
    this.listeners.clear();
    this.interactionRing.dispose();
    this.interactionPoint.dispose();
    this.root.dispose(false, true);
  }
}
