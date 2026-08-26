import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import '@babylonjs/core/Meshes/instancedMesh';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { MUSEUM_MAP_CONFIG, museumZoneAt } from '../config/museumMapConfig';
import type { CollisionBox } from '../systems/CollisionWorld';

type MuseumMapOptions = {
  scene: Scene;
  shadowGenerator: ShadowGenerator;
  collisionBoxes: CollisionBox[];
};

export class MuseumMap {
  readonly shortcutCollision: CollisionBox = { minX: 999, maxX: 999, minZ: 999, maxZ: 999, minY: 0, maxY: 2.6 };
  readonly archiveLockerPosition = new Vector3(-5.65, 0, -14.2);
  private readonly shortcutGate: Mesh;
  private readonly shortcutLampMaterial: StandardMaterial;
  private readonly shortcutThresholdMaterial: StandardMaterial;
  private readonly shortcutSignTexture: DynamicTexture;
  private readonly escapeGuideMaterial: StandardMaterial;
  private readonly escapeGuideMeshes: AbstractMesh[] = [];
  private readonly alarmMaterials: StandardMaterial[] = [];
  private shortcutOpen = false;
  private shortcutProgress = 0;
  private alarmActive = false;
  private elapsed = 0;

  constructor({ scene, shadowGenerator, collisionBoxes }: MuseumMapOptions) {
    const material = (name: string, diffuse: Color3, emissive = Color3.Black()) => {
      const result = new StandardMaterial(name, scene);
      result.diffuseColor = diffuse;
      result.emissiveColor = emissive;
      result.specularColor = new Color3(.08, .1, .1);
      return result;
    };

    const wall = material('museum-modular-wall', new Color3(.09, .12, .125));
    const darkMetal = material('museum-service-metal', new Color3(.055, .075, .08));
    const galleryFloor = material('museum-gallery-carpet', new Color3(.17, .055, .045));
    const sculptureFloor = material('museum-sculpture-marble', new Color3(.22, .25, .245));
    sculptureFloor.specularColor = new Color3(.22, .25, .25);
    sculptureFloor.specularPower = 58;
    const archiveFloor = material('museum-archive-floor', new Color3(.09, .15, .16), new Color3(.008, .022, .024));
    const corridorFloor = material('museum-security-floor', new Color3(.065, .075, .08));
    const entranceFloor = material('museum-service-floor', new Color3(.09, .105, .105));
    const brass = material('museum-brass', new Color3(.45, .29, .08), new Color3(.035, .018, .003));
    const wood = material('museum-gallery-wood', new Color3(.19, .09, .045));
    const stone = material('museum-sculpture-stone', new Color3(.42, .43, .4));
    const shelf = material('museum-archive-shelf', new Color3(.12, .2, .21), new Color3(.004, .012, .013));
    const securityRed = material('museum-security-red', new Color3(.22, .018, .012), new Color3(.12, .008, .004));
    const serviceBlue = material('museum-service-blue', new Color3(.045, .16, .18), new Color3(.012, .08, .09));

    const staticMeshes: AbstractMesh[] = [];
    const addFloor = (name: string, x: number, z: number, width: number, depth: number, floorMaterial: StandardMaterial) => {
      const mesh = MeshBuilder.CreateGround(name, { width, height: depth, subdivisions: 1 }, scene);
      mesh.position.copyFromFloats(x, .018, z);
      mesh.material = floorMaterial;
      mesh.receiveShadows = true;
      staticMeshes.push(mesh);
      return mesh;
    };
    const addBox = (
      name: string, x: number, z: number, width: number, depth: number, height: number,
      boxMaterial = wall, blocksVision = true, castShadow = false,
    ) => {
      const mesh = MeshBuilder.CreateBox(name, { width, depth, height }, scene);
      mesh.position.copyFromFloats(x, height / 2, z);
      mesh.material = boxMaterial;
      mesh.receiveShadows = true;
      mesh.metadata = { blocksMovement: true, blocksVision, museumStatic: true };
      collisionBoxes.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, minY: 0, maxY: height });
      if (castShadow) shadowGenerator.addShadowCaster(mesh);
      staticMeshes.push(mesh);
      return mesh;
    };
    const addVisualBox = (name: string, x: number, y: number, z: number, width: number, height: number, depth: number, boxMaterial: StandardMaterial) => {
      const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
      mesh.position.copyFromFloats(x, y, z);
      mesh.material = boxMaterial;
      mesh.receiveShadows = true;
      staticMeshes.push(mesh);
      return mesh;
    };
    const addDivider = (name: string, z: number, width: number, gapWidth: number, gapX = 0) => {
      const leftEdge = -width / 2;
      const rightEdge = width / 2;
      const gapLeft = gapX - gapWidth / 2;
      const gapRight = gapX + gapWidth / 2;
      // These are south-facing walls in the fixed camera composition. Keeping
      // them waist-high is the map's cutaway treatment and prevents the room
      // the player occupies from being hidden by its own front wall.
      if (gapLeft > leftEdge) addBox(`${name}-left`, (leftEdge + gapLeft) / 2, z, gapLeft - leftEdge, .28, 1.2);
      if (gapRight < rightEdge) addBox(`${name}-right`, (gapRight + rightEdge) / 2, z, rightEdge - gapRight, .28, 1.2);
      addVisualBox(`${name}-lintel`, gapX, 2.72, z, gapWidth, .38, .34, brass);
    };

    addFloor('museum-floor-entrance', 0, -46.5, 8, 8, entranceFloor);
    addFloor('museum-floor-gallery', 0, -37.5, 12, 10, galleryFloor);
    addFloor('museum-floor-sculpture', 0, -27.5, 14, 10, sculptureFloor);
    addFloor('museum-floor-archive', 0, -17.5, 14, 10, archiveFloor);
    addFloor('museum-floor-security-corridor', 0, -9, 6, 7, corridorFloor);
    addFloor('museum-floor-service-route', 8.5, -34.5, 3, 32, darkMetal);
    addFloor('museum-floor-exit-apron', 8.5, -49.3, 5, 3, entranceFloor);

    // Outer walls use camera-friendly 3.15m height. Openings are explicit so
    // every doorway has a collision gap rather than a decorative fake door.
    addBox('entrance-wall-west', -4.15, -46.5, .3, 8.3, 3.15);
    addBox('entrance-wall-east', 4.15, -46.5, .3, 8.3, 1.25);
    addDivider('entrance-south-service-door', -50.55, 8.3, 2.4);
    addDivider('entrance-gallery-door', -42.5, 12.3, 3.1, -.8);
    addBox('gallery-wall-west', -6.15, -37.5, .3, 10, 3.15);
    addBox('gallery-wall-east', 6.15, -37.5, .3, 10, 1.25);
    addDivider('gallery-sculpture-door', -32.5, 14.3, 3.8, 1.2);
    addBox('sculpture-wall-west', -7.15, -27.5, .3, 10, 3.35);
    addBox('sculpture-wall-east', 7.15, -27.5, .3, 10, 1.25);
    addDivider('sculpture-archive-door', -22.5, 14.3, 3.2, -1.4);
    addBox('archive-wall-west', -7.15, -17.5, .3, 10, 3.15);
    addBox('archive-wall-east-north', 7.15, -15.2, .3, 4.6, 1.25);
    addBox('archive-wall-east-south', 7.15, -21.1, .3, 2.8, 1.25);
    addDivider('archive-security-door', -12.5, 14.3, 3, 0);
    addBox('security-wall-west', -3.15, -9, .3, 7, 3.15);
    addBox('security-wall-east', 3.15, -9, .3, 7, 1.25);

    // Service route is intentionally short and exposed. It is only reachable
    // after Lockdown through the sliding emergency shutter.
    addBox('service-route-wall-west-south', 6.95, -34.5, .22, 29.2, 3.05, darkMetal);
    addBox('service-route-wall-east', 10.05, -34.5, .22, 32.2, 1.25, darkMetal);
    addVisualBox('service-exit-lintel', 8.5, 2.72, -50.55, 2.8, .34, .3, serviceBlue);

    // West Gallery: warm frames, bench and one risky side alcove.
    for (const z of [-40.4, -37.6, -34.8]) {
      addVisualBox(`gallery-frame-west-${z}`, -5.92, 1.65, z, .08, 1.45, 1.9, wood);
      addVisualBox(`gallery-painting-west-${z}`, -5.83, 1.65, z, .05, 1.18, 1.55, brass);
    }
    addBox('gallery-cover-partition', -.9, -37.2, 3.3, .5, 2.25, wood, true, true);
    addBox('gallery-bench', 3.7, -39, 2.1, .65, .75, wood, false, false);
    addBox('gallery-high-display', 4.7, -35, 1.1, 1.1, 1.85, wall, true, true);

    // Sculpture Hall: large geometry blocks LOS and creates the signature
    // flashlight/shadow rotation play around real objects.
    const addSculpture = (name: string, x: number, z: number, scale = 1) => {
      addBox(`${name}-plinth`, x, z, 1.45 * scale, 1.45 * scale, .85, stone, true, true);
      const body = MeshBuilder.CreateCapsule(`${name}-body`, { height: 2.05 * scale, radius: .42 * scale, tessellation: 12 }, scene);
      body.position.copyFromFloats(x, 1.75 * scale, z);
      body.material = stone;
      body.metadata = { blocksVision: true, museumStatic: true };
      body.receiveShadows = true;
      shadowGenerator.addShadowCaster(body);
      staticMeshes.push(body);
    };
    addSculpture('sculpture-landmark-hero', 0, -27.2, 1.2);
    addSculpture('sculpture-cover-west', -4.6, -29.5, .85);
    addSculpture('sculpture-cover-east', 4.6, -25.5, .85);
    addBox('sculpture-pillar-west', -4.8, -24, 1.1, 1.1, 3.1, stone, true, true);
    addBox('sculpture-pillar-east', 4.8, -31, 1.1, 1.1, 3.1, stone, true, true);

    // Archive: four readable rows, narrow but wider than both colliders.
    for (const x of [-4.8, -1.65, 1.65, 4.8]) {
      addBox(`archive-shelf-${x}`, x, -17.5, .62, 6.2, 2.4, shelf, true, true);
      for (const z of [-19.4, -17.5, -15.6]) addVisualBox(`archive-file-band-${x}-${z}`, x + .34, 1.2, z, .035, .12, 1.15, serviceBlue);
    }
    addBox('archive-cabinet', 5.6, -13.8, 1.5, .7, 1.75, darkMetal, true, false);

    // Security Corridor: red landmark, camera housings and intentionally
    // limited cover before the existing Crown Hall gate.
    addVisualBox('security-door-landmark', 0, 2.75, -6.1, 3, .32, .28, securityRed);
    addBox('security-cover-console', 1.9, -10.3, 1.15, .65, 1.2, darkMetal, true, false);
    for (const [index, x, z, yaw] of [[0, -2.65, -11, .65], [1, 2.65, -7.3, -2.45]] as const) {
      const camera = MeshBuilder.CreateBox(`security-camera-${index}`, { width: .42, height: .25, depth: .72 }, scene);
      camera.position.copyFromFloats(x, 2.45, z);
      camera.rotation.y = yaw;
      camera.material = darkMetal;
      staticMeshes.push(camera);
    }

    // Zone-wide alarm beacons are emissive only, avoiding many dynamic lights.
    this.alarmMaterials.push(
      material('museum-alarm-material-even', new Color3(.18, .012, .008), new Color3(.02, .001, 0)),
      material('museum-alarm-material-odd', new Color3(.18, .012, .008), new Color3(.02, .001, 0)),
    );
    const beaconSources: Array<Mesh | null> = [null, null];
    for (const [index, x, z] of [[0, 0, -45], [1, -5.5, -36], [2, 5.8, -25], [3, 0, -14], [4, 0, -8], [5, 8.5, -38]] as const) {
      const phase = index % 2;
      const beacon = beaconSources[phase]
        ? beaconSources[phase]!.createInstance(`museum-alarm-beacon-${index}`)
        : MeshBuilder.CreateCylinder(`museum-alarm-beacon-${index}`, { diameter: .28, height: .38, tessellation: 10 }, scene);
      if (!beaconSources[phase] && beacon instanceof Mesh) beaconSources[phase] = beacon;
      beacon.rotation.z = Math.PI / 2;
      beacon.position.copyFromFloats(x, 2.68, z);
      if (beacon instanceof Mesh) beacon.material = this.alarmMaterials[phase];
      staticMeshes.push(beacon);
    }

    this.shortcutLampMaterial = material('museum-shortcut-lamp', new Color3(.08, .18, .14), new Color3(.015, .08, .045));
    this.shortcutThresholdMaterial = material('museum-shortcut-threshold', new Color3(.12, .025, .018), new Color3(.22, .012, .005));
    this.escapeGuideMaterial = material('museum-escape-guide', new Color3(.025, .22, .14), Color3.Black());

    // A permanent industrial frame makes this read as a doorway even before
    // Escape starts. The old version only showed a thin green box after the
    // shortcut opened, so players could not tell whether a door existed.
    addVisualBox('museum-shortcut-frame-north', 7.03, 1.45, MUSEUM_MAP_CONFIG.shortcutDoor.z - 1.28, .38, 2.9, .24, serviceBlue);
    addVisualBox('museum-shortcut-frame-south', 7.03, 1.45, MUSEUM_MAP_CONFIG.shortcutDoor.z + 1.28, .38, 2.9, .24, serviceBlue);
    addVisualBox('museum-shortcut-frame-top', 7.03, 2.82, MUSEUM_MAP_CONFIG.shortcutDoor.z, .38, .25, 2.8, serviceBlue);
    const shortcutThreshold = MeshBuilder.CreateBox('museum-shortcut-threshold-strip', { width: 1.2, height: .025, depth: 2.18 }, scene);
    shortcutThreshold.position.copyFromFloats(7.35, .04, MUSEUM_MAP_CONFIG.shortcutDoor.z);
    shortcutThreshold.material = this.shortcutThresholdMaterial;
    shortcutThreshold.isPickable = false;
    staticMeshes.push(shortcutThreshold);

    this.shortcutGate = MeshBuilder.CreateBox('museum-shortcut-lockdown-gate', { width: .18, height: 2.65, depth: 2.35 }, scene);
    this.shortcutGate.position.copyFromFloats(7.05, 1.325, MUSEUM_MAP_CONFIG.shortcutDoor.z);
    this.shortcutGate.material = darkMetal;
    this.shortcutGate.metadata = { blocksVision: true, dynamicGate: true };
    for (const [index, y] of [-.82, -.41, 0, .41, .82].entries()) {
      const shutterBar = MeshBuilder.CreateBox(`museum-shortcut-shutter-bar-${index}`, { width: .08, height: .075, depth: 2.12 }, scene);
      shutterBar.parent = this.shortcutGate;
      shutterBar.position.copyFromFloats(-.13, y, 0);
      shutterBar.material = this.shortcutLampMaterial;
      shutterBar.isPickable = false;
    }
    const shortcutLamp = MeshBuilder.CreateBox('museum-shortcut-status', { width: .1, height: .18, depth: .3 }, scene);
    shortcutLamp.position.copyFromFloats(6.9, 2.35, MUSEUM_MAP_CONFIG.shortcutDoor.z - 1.25);
    shortcutLamp.material = this.shortcutLampMaterial;

    this.shortcutSignTexture = new DynamicTexture('museum-shortcut-exit-sign-texture', { width: 512, height: 192 }, scene, false);
    const shortcutSignMaterial = new StandardMaterial('museum-shortcut-exit-sign-material', scene);
    shortcutSignMaterial.diffuseTexture = this.shortcutSignTexture;
    shortcutSignMaterial.emissiveTexture = this.shortcutSignTexture;
    shortcutSignMaterial.emissiveColor = Color3.White();
    shortcutSignMaterial.backFaceCulling = false;
    shortcutSignMaterial.disableLighting = true;
    const shortcutSign = MeshBuilder.CreatePlane('museum-shortcut-exit-sign', { width: 2.4, height: .9 }, scene);
    // Use a floor stencil just before the frame. An east-facing wall is almost
    // edge-on to the fixed camera, and an overhead sign overlaps the objective
    // HUD. The floor marking remains readable and points at the real opening.
    shortcutSign.position.copyFromFloats(6.05, .058, MUSEUM_MAP_CONFIG.shortcutDoor.z);
    shortcutSign.rotation.x = Math.PI / 2;
    shortcutSign.material = shortcutSignMaterial;
    shortcutSign.isPickable = false;
    staticMeshes.push(shortcutSign);
    this.drawShortcutSign(false);
    collisionBoxes.push(this.shortcutCollision);
    this.applyShortcutProgress();

    // These emissive floor markers form a physical route cue instead of a
    // minimap arrow. They appear only when Escape starts: first east through
    // Archive, then south through the shorter service corridor.
    let guideSource: Mesh | null = null;
    const addEscapeGuide = (index: number, x: number, z: number, yaw: number) => {
      const marker = guideSource
        ? guideSource.createInstance(`museum-escape-guide-${index}`)
        : MeshBuilder.CreateCylinder(`museum-escape-guide-${index}`, { diameter: .52, height: .026, tessellation: 3 }, scene);
      if (!guideSource && marker instanceof Mesh) {
        guideSource = marker;
        guideSource.material = this.escapeGuideMaterial;
      }
      marker.position.copyFromFloats(x, .045, z);
      marker.rotation.y = yaw;
      marker.setEnabled(false);
      this.escapeGuideMeshes.push(marker);
      staticMeshes.push(marker);
    };
    const eastGuides = [[3.8, -20.8], [4.9, -20.8], [6, -20.6], [7.15, -19.7]] as const;
    eastGuides.forEach(([x, z], index) => addEscapeGuide(index, x, z, 0));
    [-22, -25, -28, -31, -34, -37, -40, -43, -46, -48].forEach((z, index) => {
      addEscapeGuide(index + eastGuides.length, 8.5, z, Math.PI / 2);
    });
    // The exit is visible from far down the service corridor.
    addVisualBox('museum-exit-frame-top', 8.5, 2.55, -49.6, 2.8, .24, .3, serviceBlue);
    addVisualBox('museum-exit-frame-left', 7.18, 1.35, -49.6, .22, 2.55, .3, serviceBlue);
    addVisualBox('museum-exit-frame-right', 9.82, 1.35, -49.6, .22, 2.55, .3, serviceBlue);
    const exitPool = MeshBuilder.CreateDisc('museum-exit-light-pool', { radius: 1.05, tessellation: 28 }, scene);
    exitPool.rotation.x = Math.PI / 2;
    exitPool.position.copyFromFloats(8.5, .035, -48.4);
    exitPool.material = serviceBlue;
    staticMeshes.push(exitPool);

    staticMeshes.forEach(mesh => {
      mesh.computeWorldMatrix(true);
      mesh.freezeWorldMatrix();
    });
  }

  update(deltaTime: number) {
    this.elapsed += deltaTime;
    const target = this.shortcutOpen ? 1 : 0;
    this.shortcutProgress += (target - this.shortcutProgress) * (1 - Math.exp(-5 * deltaTime));
    this.applyShortcutProgress();
    if (this.shortcutOpen) {
      const guidePulse = .62 + (Math.sin(this.elapsed * 5.2) + 1) * .19;
      this.escapeGuideMaterial.emissiveColor.copyFromFloats(.025 * guidePulse, .72 * guidePulse, .42 * guidePulse);
    }
    if (!this.alarmActive) return;
    const pulse = Math.sin(this.elapsed * 9) > -.35 ? 1 : .12;
    this.alarmMaterials.forEach((material, index) => {
      const offset = index % 2 === 0 ? pulse : 1.12 - pulse;
      material.emissiveColor.copyFromFloats(.58 * offset, .008 * offset, .003 * offset);
    });
  }

  setAlarmActive(active: boolean) {
    this.alarmActive = active;
    if (!active) this.alarmMaterials.forEach(material => material.emissiveColor.copyFromFloats(.02, .001, 0));
  }

  setShortcutOpen(open: boolean) {
    this.shortcutOpen = open;
    this.shortcutLampMaterial.emissiveColor.copyFrom(open ? new Color3(.02, .5, .22) : new Color3(.22, .018, .006));
    this.shortcutThresholdMaterial.diffuseColor.copyFrom(open ? new Color3(.025, .24, .14) : new Color3(.12, .025, .018));
    this.shortcutThresholdMaterial.emissiveColor.copyFrom(open ? new Color3(.025, .58, .3) : new Color3(.22, .012, .005));
    this.drawShortcutSign(open);
    this.escapeGuideMeshes.forEach(mesh => mesh.setEnabled(open));
    if (!open) this.escapeGuideMaterial.emissiveColor.setAll(0);
  }

  isAtExit(position: Vector3) {
    const [x, , z] = MUSEUM_MAP_CONFIG.exit.position;
    return this.shortcutOpen && Math.hypot(position.x - x, position.z - z) <= MUSEUM_MAP_CONFIG.exit.radius;
  }

  zoneAt(position: Vector3) {
    return museumZoneAt(position.x, position.z);
  }

  reset() {
    this.shortcutOpen = false;
    this.shortcutProgress = 0;
    this.setAlarmActive(false);
    this.shortcutLampMaterial.emissiveColor.copyFromFloats(.22, .018, .006);
    this.shortcutThresholdMaterial.diffuseColor.copyFromFloats(.12, .025, .018);
    this.shortcutThresholdMaterial.emissiveColor.copyFromFloats(.22, .012, .005);
    this.drawShortcutSign(false);
    this.escapeGuideMaterial.emissiveColor.setAll(0);
    this.escapeGuideMeshes.forEach(mesh => mesh.setEnabled(false));
    this.applyShortcutProgress();
  }

  get shortcutState() {
    return this.shortcutOpen ? (this.shortcutProgress > .96 ? 'OPEN' : 'OPENING') : 'LOCKED';
  }

  private applyShortcutProgress() {
    this.shortcutGate.position.y = 1.325 + this.shortcutProgress * 2.9;
    if (this.shortcutProgress < .72) {
      this.shortcutCollision.minX = 6.92;
      this.shortcutCollision.maxX = 7.18;
      this.shortcutCollision.minZ = MUSEUM_MAP_CONFIG.shortcutDoor.z - 1.18;
      this.shortcutCollision.maxZ = MUSEUM_MAP_CONFIG.shortcutDoor.z + 1.18;
    } else {
      this.shortcutCollision.minX = 999;
      this.shortcutCollision.maxX = 999;
      this.shortcutCollision.minZ = 999;
      this.shortcutCollision.maxZ = 999;
    }
  }

  private drawShortcutSign(open: boolean) {
    const context = this.shortcutSignTexture.getContext() as unknown as CanvasRenderingContext2D;
    context.fillStyle = '#071411';
    context.fillRect(0, 0, 512, 192);
    context.strokeStyle = open ? '#52f0a4' : '#9d4a3e';
    context.lineWidth = 8;
    context.strokeRect(5, 5, 502, 182);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 52px Arial';
    context.fillStyle = '#e6f4ef';
    context.fillText('EMERGENCY EXIT', 256, 70);
    context.font = '800 44px Arial';
    context.fillStyle = open ? '#52f0a4' : '#ff6d5d';
    context.fillText(open ? 'OPEN' : 'LOCKED', 256, 138);
    this.shortcutSignTexture.update();
  }
}
