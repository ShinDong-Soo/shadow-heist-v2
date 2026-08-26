import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';

export type HumanoidStyle = 'PLAYER' | 'GUARD';

type HumanoidColors = {
  cloth: Color3;
  dark: Color3;
  accent: Color3;
  skin: Color3;
};

/**
 * Lightweight articulated character used until final GLB rigs are supplied.
 * Gameplay roots stay stable while only this visual hierarchy animates.
 */
export class ProceduralHumanoid {
  private static readonly materialCache = new WeakMap<Scene, Map<HumanoidStyle, Record<keyof HumanoidColors, StandardMaterial>>>();
  readonly root: TransformNode;
  readonly hips: TransformNode;
  readonly chest: TransformNode;
  readonly head: TransformNode;
  readonly leftArm: TransformNode;
  readonly rightArm: TransformNode;
  readonly leftForearm: TransformNode;
  readonly rightForearm: TransformNode;
  readonly leftLeg: TransformNode;
  readonly rightLeg: TransformNode;
  readonly leftShin: TransformNode;
  readonly rightShin: TransformNode;
  readonly flashlightSocket: TransformNode;
  readonly shadowCasters: AbstractMesh[] = [];

  constructor(
    scene: Scene,
    parent: TransformNode,
    shadowGenerator: ShadowGenerator,
    style: HumanoidStyle,
  ) {
    const guard = style === 'GUARD';
    const scale = guard ? 1.06 : 1;
    const colors: HumanoidColors = guard
      ? {
          cloth: new Color3(.055, .082, .115),
          dark: new Color3(.025, .035, .05),
          accent: new Color3(.66, .48, .18),
          skin: new Color3(.42, .3, .22),
        }
      : {
          cloth: new Color3(.07, .13, .17),
          dark: new Color3(.018, .025, .035),
          accent: new Color3(.12, .66, .68),
          skin: new Color3(.34, .25, .2),
        };
    const materials = this.getMaterials(scene, style, colors);
    const { cloth, dark, accent, skin } = materials;

    this.root = new TransformNode(`${style.toLowerCase()}-character-visual`, scene);
    this.root.parent = parent;

    this.hips = new TransformNode(`${style.toLowerCase()}-hips`, scene);
    this.hips.parent = this.root;
    this.hips.position.y = .89 * scale;
    this.addBox(scene, `${style.toLowerCase()}-pelvis`, this.hips, new Vector3(guard ? .55 : .46, .27, .3), new Vector3(0, .04, 0), cloth);

    this.chest = new TransformNode(`${style.toLowerCase()}-chest`, scene);
    this.chest.parent = this.hips;
    this.chest.position.y = .43 * scale;
    this.addBox(scene, `${style.toLowerCase()}-torso`, this.chest, new Vector3(guard ? .68 : .54, .7, .34), new Vector3(0, .25, 0), cloth);

    this.head = new TransformNode(`${style.toLowerCase()}-head`, scene);
    this.head.parent = this.chest;
    this.head.position.y = .78 * scale;
    this.addSphere(scene, `${style.toLowerCase()}-face`, this.head, guard ? .34 : .32, new Vector3(0, 0, 0), skin);
    if (guard) {
      this.addCylinder(scene, 'guard-cap', this.head, .42, .11, new Vector3(0, .2, .025), dark);
      this.addBox(scene, 'guard-cap-visor', this.head, new Vector3(.37, .045, .18), new Vector3(0, .15, .18), dark);
    } else {
      this.addSphere(scene, 'player-hood', this.head, .37, new Vector3(0, .015, -.02), dark);
      this.addBox(scene, 'player-mask', this.head, new Vector3(.34, .16, .1), new Vector3(0, -.07, .27), dark);
      this.addBox(scene, 'player-backpack', this.chest, new Vector3(.42, .57, .22), new Vector3(0, .2, -.28), dark);
    }

    const shoulderY = .57 * scale;
    this.leftArm = this.makeJoint(scene, `${style.toLowerCase()}-left-arm`, this.chest, new Vector3(-(guard ? .42 : .34), shoulderY, 0));
    this.rightArm = this.makeJoint(scene, `${style.toLowerCase()}-right-arm`, this.chest, new Vector3(guard ? .42 : .34, shoulderY, 0));
    this.addLimb(scene, `${style.toLowerCase()}-left-upper-arm`, this.leftArm, .47 * scale, guard ? .17 : .145, cloth);
    this.addLimb(scene, `${style.toLowerCase()}-right-upper-arm`, this.rightArm, .47 * scale, guard ? .17 : .145, cloth);
    this.leftForearm = this.makeJoint(scene, `${style.toLowerCase()}-left-forearm`, this.leftArm, new Vector3(0, -.45 * scale, 0));
    this.rightForearm = this.makeJoint(scene, `${style.toLowerCase()}-right-forearm`, this.rightArm, new Vector3(0, -.45 * scale, 0));
    this.addLimb(scene, `${style.toLowerCase()}-left-forearm-mesh`, this.leftForearm, .43 * scale, guard ? .15 : .125, dark);
    this.addLimb(scene, `${style.toLowerCase()}-right-forearm-mesh`, this.rightForearm, .43 * scale, guard ? .15 : .125, dark);

    const hipX = guard ? .19 : .16;
    this.leftLeg = this.makeJoint(scene, `${style.toLowerCase()}-left-leg`, this.hips, new Vector3(-hipX, -.08, 0));
    this.rightLeg = this.makeJoint(scene, `${style.toLowerCase()}-right-leg`, this.hips, new Vector3(hipX, -.08, 0));
    this.addLimb(scene, `${style.toLowerCase()}-left-thigh`, this.leftLeg, .48 * scale, guard ? .2 : .17, cloth);
    this.addLimb(scene, `${style.toLowerCase()}-right-thigh`, this.rightLeg, .48 * scale, guard ? .2 : .17, cloth);
    this.leftShin = this.makeJoint(scene, `${style.toLowerCase()}-left-shin`, this.leftLeg, new Vector3(0, -.45 * scale, 0));
    this.rightShin = this.makeJoint(scene, `${style.toLowerCase()}-right-shin`, this.rightLeg, new Vector3(0, -.45 * scale, 0));
    this.addLimb(scene, `${style.toLowerCase()}-left-shin-mesh`, this.leftShin, .44 * scale, guard ? .17 : .145, dark);
    this.addLimb(scene, `${style.toLowerCase()}-right-shin-mesh`, this.rightShin, .44 * scale, guard ? .17 : .145, dark);
    this.addBox(scene, `${style.toLowerCase()}-left-boot`, this.leftShin, new Vector3(.24, .14, .38), new Vector3(0, -.43 * scale, .09), dark);
    this.addBox(scene, `${style.toLowerCase()}-right-boot`, this.rightShin, new Vector3(.24, .14, .38), new Vector3(0, -.43 * scale, .09), dark);

    if (guard) {
      this.addBox(scene, 'guard-radio', this.chest, new Vector3(.13, .25, .09), new Vector3(-.25, .42, .2), accent);
      this.addBox(scene, 'guard-badge', this.chest, new Vector3(.11, .14, .03), new Vector3(.18, .38, .19), accent);
    } else {
      this.addBox(scene, 'player-tool-pouch', this.hips, new Vector3(.14, .3, .12), new Vector3(.27, -.03, .16), accent);
    }

    this.flashlightSocket = new TransformNode(`${style.toLowerCase()}-flashlight-socket`, scene);
    this.flashlightSocket.parent = this.rightForearm;
    this.flashlightSocket.position = new Vector3(0, -.42 * scale, .12);
    // The forearm is pitched forward to hold the torch. Counter-rotate the
    // socket so its local +Z remains the visible beam/LOS direction.
    this.flashlightSocket.rotation.x = .68;

    this.shadowCasters.forEach(mesh => {
      mesh.receiveShadows = true;
      shadowGenerator.addShadowCaster(mesh);
    });
  }

  resetPose() {
    this.root.position.setAll(0);
    this.root.rotation.setAll(0);
    this.hips.rotation.setAll(0);
    this.chest.rotation.setAll(0);
    this.head.rotation.setAll(0);
    this.leftArm.rotation.setAll(0);
    this.rightArm.rotation.setAll(0);
    this.leftForearm.rotation.setAll(0);
    this.rightForearm.rotation.setAll(0);
    this.leftLeg.rotation.setAll(0);
    this.rightLeg.rotation.setAll(0);
    this.leftShin.rotation.setAll(0);
    this.rightShin.rotation.setAll(0);
  }

  private makeMaterial(scene: Scene, name: string, color: Color3, emissive = 0) {
    const material = new StandardMaterial(`${name}-material`, scene);
    material.diffuseColor = color;
    material.specularColor = color.scale(.65);
    material.emissiveColor = color.scale(emissive);
    return material;
  }

  private getMaterials(scene: Scene, style: HumanoidStyle, colors: HumanoidColors) {
    let sceneCache = ProceduralHumanoid.materialCache.get(scene);
    if (!sceneCache) {
      sceneCache = new Map();
      ProceduralHumanoid.materialCache.set(scene, sceneCache);
    }
    const cached = sceneCache.get(style);
    if (cached) return cached;
    const prefix = style.toLowerCase();
    const created = {
      cloth: this.makeMaterial(scene, `${prefix}-cloth`, colors.cloth),
      dark: this.makeMaterial(scene, `${prefix}-dark`, colors.dark),
      accent: this.makeMaterial(scene, `${prefix}-accent`, colors.accent, .08),
      skin: this.makeMaterial(scene, `${prefix}-skin`, colors.skin),
    };
    sceneCache.set(style, created);
    return created;
  }

  private makeJoint(scene: Scene, name: string, parent: TransformNode, position: Vector3) {
    const joint = new TransformNode(name, scene);
    joint.parent = parent;
    joint.position.copyFrom(position);
    return joint;
  }

  private addLimb(scene: Scene, name: string, parent: TransformNode, length: number, diameter: number, material: StandardMaterial) {
    return this.addCylinder(scene, name, parent, diameter, length, new Vector3(0, -length / 2, 0), material);
  }

  private addCylinder(scene: Scene, name: string, parent: TransformNode, diameter: number, height: number, position: Vector3, material: StandardMaterial) {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 8 }, scene);
    mesh.parent = parent;
    mesh.position.copyFrom(position);
    mesh.material = material;
    this.shadowCasters.push(mesh);
    return mesh;
  }

  private addBox(scene: Scene, name: string, parent: TransformNode, size: Vector3, position: Vector3, material: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.parent = parent;
    mesh.position.copyFrom(position);
    mesh.material = material;
    this.shadowCasters.push(mesh);
    return mesh;
  }

  private addSphere(scene: Scene, name: string, parent: TransformNode, diameter: number, position: Vector3, material: StandardMaterial) {
    const mesh = MeshBuilder.CreateSphere(name, { diameter, segments: 10 }, scene);
    mesh.parent = parent;
    mesh.position.copyFrom(position);
    mesh.material = material;
    this.shadowCasters.push(mesh);
    return mesh;
  }
}
