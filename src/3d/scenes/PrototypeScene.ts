import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import '@babylonjs/core/Shaders/postprocess.vertex.js';
import '@babylonjs/core/Shaders/rgbdDecode.fragment.js';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { GameCamera, type CameraDistance } from '../camera/GameCamera';
import { CROWN_HALL_CONFIG } from '../config/crownHallConfig';
import { GAME_3D_CONFIG } from '../config/gameConfig';
import { AssetManager, type AssetProgress } from '../core/AssetManager';
import { GameFlowManager } from '../core/GameFlowManager';
import { Guard } from '../entities/guard/Guard';
import { GuardController } from '../entities/guard/GuardController';
import { GuardDebugView } from '../entities/guard/GuardDebugView';
import { GuardFlashlight } from '../entities/guard/GuardFlashlight';
import { GuardPatrol } from '../entities/guard/GuardPatrol';
import { GuardVision } from '../entities/guard/GuardVision';
import { Player } from '../entities/player/Player';
import { PlayerController } from '../entities/player/PlayerController';
import { Crown } from '../entities/treasure/Crown';
import { CrownDisplay } from '../entities/treasure/CrownDisplay';
import type { CollisionBox } from '../systems/CollisionWorld';
import { DetectionSystem } from '../systems/DetectionSystem';
import { InputManager } from '../systems/InputManager';
import { AlarmSystem } from '../systems/AlarmSystem';
import { SecurityGate } from '../systems/SecurityGate';

export type PrototypeSceneResult = {
  scene: Scene;
  cameraRig: GameCamera;
  player: Player;
  controller: PlayerController;
  guard: Guard;
  guardController: GuardController;
  guardFlashlight: GuardFlashlight;
  guardVision: GuardVision;
  detection: DetectionSystem;
  crown: Crown;
  gameFlow: GameFlowManager;
  securityGate: SecurityGate;
  alarm: AlarmSystem;
  readonly crownEvent: string;
  readonly interactionAvailable: boolean;
  loadedModel: AbstractMesh | null;
  update: (deltaTime: number) => void;
  setCameraDistance: (mode: CameraDistance) => void;
  setDebugVisible: (visible: boolean) => void;
  teleportToCrownTest: () => void;
  setupCoverLosTest: () => void;
  startCrownSequenceTest: () => void;
  resetCrownHall: () => void;
  dispose: () => void;
};

export async function createPrototypeScene(engine: Engine, canvas: HTMLCanvasElement, onProgress: AssetProgress): Promise<PrototypeSceneResult> {
  const scene = new Scene(engine);
  const [r, g, b, a] = GAME_3D_CONFIG.scene.clearColor;
  scene.clearColor = new Color4(r, g, b, a);
  scene.environmentIntensity = .62;

  const ambient = new HemisphericLight('crown-hall-ambient', new Vector3(.2, 1, -.35), scene);
  ambient.intensity = .48;
  ambient.diffuse = new Color3(.48, .58, .59);
  ambient.groundColor = new Color3(.025, .03, .035);

  const keyLight = new DirectionalLight('crown-hall-key', new Vector3(.4, -1, .28), scene);
  keyLight.position = new Vector3(-6, 12, -8);
  keyLight.intensity = .8;
  keyLight.diffuse = new Color3(.82, .72, .55);

  const shadowGenerator = new ShadowGenerator(GAME_3D_CONFIG.scene.shadowMapSize, keyLight);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_LOW;

  const makeMaterial = (name: string, diffuse: Color3, specular = new Color3(.08, .1, .1)) => {
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = diffuse;
    material.specularColor = specular;
    return material;
  };
  const floorMaterial = makeMaterial('crown-hall-floor-material', new Color3(.075, .095, .1), new Color3(.22, .25, .24));
  floorMaterial.specularPower = 72;
  const wallMaterial = makeMaterial('crown-hall-wall-material', new Color3(.105, .125, .13), new Color3(.13, .16, .16));
  const pillarMaterial = makeMaterial('crown-hall-pillar-material', new Color3(.16, .18, .18), new Color3(.28, .27, .23));
  const stoneMaterial = makeMaterial('crown-hall-stone-material', new Color3(.2, .205, .2), new Color3(.2, .2, .17));
  const goldMaterial = makeMaterial('crown-hall-gold-material', new Color3(.46, .3, .08), new Color3(.72, .53, .2));
  const velvetMaterial = makeMaterial('crown-hall-velvet-material', new Color3(.16, .022, .035), new Color3(.12, .03, .04));

  const ground = MeshBuilder.CreateGround('crown-hall-site-ground', {
    width: GAME_3D_CONFIG.scene.groundSize,
    height: GAME_3D_CONFIG.scene.groundSize,
    subdivisions: 2,
  }, scene);
  ground.material = makeMaterial('crown-hall-site-ground-material', new Color3(.028, .035, .038));
  ground.receiveShadows = true;

  const hallFloor = MeshBuilder.CreateGround('crown-hall-marble-floor', {
    width: CROWN_HALL_CONFIG.room.width,
    height: CROWN_HALL_CONFIG.room.depth,
    subdivisions: 2,
  }, scene);
  hallFloor.position.copyFromFloats(0, .012, CROWN_HALL_CONFIG.room.centerZ);
  hallFloor.material = floorMaterial;
  hallFloor.receiveShadows = true;

  const collisionBoxes: CollisionBox[] = [];
  const decorativeTrims: Mesh[] = [];
  const decorativePanels: Mesh[] = [];
  const addBoxObstacle = (
    name: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    material = wallMaterial,
    blocksVision = true,
    castsKeyShadow = true,
  ) => {
    const mesh = MeshBuilder.CreateBox(name, { width, depth, height }, scene);
    mesh.position.copyFromFloats(x, height / 2, z);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.metadata = { blocksMovement: true, blocksVision };
    if (castsKeyShadow) shadowGenerator.addShadowCaster(mesh);
    collisionBoxes.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
    return mesh;
  };
  const addTrim = (name: string, x: number, y: number, z: number, width: number, height: number, depth: number) => {
    const trim = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    trim.position.copyFromFloats(x, y, z);
    trim.material = goldMaterial;
    trim.receiveShadows = true;
    decorativeTrims.push(trim);
    return trim;
  };

  // Tall side walls establish the museum volume. The camera-facing front wall
  // stays low so it cannot hide the player in this top-down prototype.
  addBoxObstacle('crown-hall-wall-west', -6.15, 1.5, .42, 14.4, 3.5, wallMaterial, true, false);
  addBoxObstacle('crown-hall-wall-east', 6.15, 1.5, .42, 14.4, 3.5, wallMaterial, true, false);
  addBoxObstacle('crown-hall-wall-north', 0, 8.55, 12.7, .42, 3.5, wallMaterial, true, false);
  addBoxObstacle('crown-hall-front-wall-left', -3.72, -5.55, 4.85, .42, 1.15, wallMaterial, true, false);
  addBoxObstacle('crown-hall-front-wall-right', 3.72, -5.55, 4.85, .42, 1.15, wallMaterial, true, false);

  // Door frame and dormant security-gate rails are Phase 06 connection points.
  addBoxObstacle('crown-hall-door-frame-left', -1.42, -5.48, .22, .55, 3.05, goldMaterial, true, false);
  addBoxObstacle('crown-hall-door-frame-right', 1.42, -5.48, .22, .55, 3.05, goldMaterial, true, false);
  addTrim('crown-hall-door-frame-top', 0, 2.94, -5.48, 3.05, .22, .55);
  addTrim('security-gate-rail-left', -1.18, .08, -5.24, .11, .12, .48);
  addTrim('security-gate-rail-right', 1.18, .08, -5.24, .11, .12, .48);

  // A short vestibule lets the player read the room before crossing the door.
  addBoxObstacle('entrance-vestibule-left', -1.65, -7.15, .3, 3.15, 1.25, wallMaterial, true, false);
  addBoxObstacle('entrance-vestibule-right', 1.65, -7.15, .3, 3.15, 1.25, wallMaterial, true, false);
  const runner = MeshBuilder.CreateGround('crown-hall-entrance-runner', { width: 2.75, height: 6.6 }, scene);
  runner.position.copyFromFloats(0, .025, -3.25);
  runner.material = velvetMaterial;
  runner.receiveShadows = true;

  const addPillar = (name: string, x: number, z: number) => {
    const shaft = MeshBuilder.CreateCylinder(name, { diameter: 1.14, height: 3.35, tessellation: 20 }, scene);
    shaft.position.copyFromFloats(x, 1.675, z);
    shaft.material = pillarMaterial;
    shaft.metadata = { blocksMovement: true, blocksVision: true };
    shaft.receiveShadows = true;
    shadowGenerator.addShadowCaster(shaft);
    const base = MeshBuilder.CreateCylinder(`${name}-base`, { diameter: 1.42, height: .18, tessellation: 20 }, scene);
    base.position.copyFromFloats(x, .09, z);
    base.material = goldMaterial;
    base.metadata = { blocksMovement: true, blocksVision: true };
    shadowGenerator.addShadowCaster(base);
    collisionBoxes.push({ minX: x - .62, maxX: x + .62, minZ: z - .62, maxZ: z + .62 });
  };

  // The left has a slower chain of full LOS blockers.
  addPillar('safe-route-pillar-entry', -3.72, -2.15);
  addPillar('safe-route-pillar-middle', -3.62, 1.35);
  addBoxObstacle('safe-route-statue-plinth', -3.55, 4.72, 1.35, 1.35, 1.05, stoneMaterial);
  const statue = MeshBuilder.CreateCapsule('safe-route-statue', { height: 1.75, radius: .38, tessellation: 16 }, scene);
  statue.position.copyFromFloats(-3.55, 1.72, 4.72);
  statue.material = stoneMaterial;
  statue.metadata = { blocksMovement: true, blocksVision: true };
  statue.receiveShadows = true;
  shadowGenerator.addShadowCaster(statue);

  // The right has one cover only: a faster but more exposed approach.
  addBoxObstacle('risk-route-high-exhibit', 3.72, 2.3, 1.9, .78, 2.05, stoneMaterial);
  addTrim('risk-route-high-exhibit-trim', 3.72, 1.12, 1.89, 2.05, .1, .9);

  // Dark-luxury wall panels provide depth without adding gameplay collision.
  for (const x of [-4.35, 0, 4.35]) {
    const panel = MeshBuilder.CreateBox(`north-wall-panel-${x}`, { width: 2.5, height: 1.55, depth: .08 }, scene);
    panel.position.copyFromFloats(x, 1.85, 8.29);
    panel.material = velvetMaterial;
    panel.receiveShadows = true;
    decorativePanels.push(panel);
    addTrim(`north-wall-panel-top-${x}`, x, 2.72, 8.23, 2.68, .045, .035);
    addTrim(`north-wall-panel-bottom-${x}`, x, .98, 8.23, 2.68, .045, .035);
    addTrim(`north-wall-panel-left-${x}`, x - 1.32, 1.85, 8.23, .045, 1.78, .035);
    addTrim(`north-wall-panel-right-${x}`, x + 1.32, 1.85, 8.23, .045, 1.78, .035);
  }

  // Floor border and observation marks are visual only.
  addTrim('floor-border-west', -5.82, .03, 1.5, .055, .035, 13.45);
  addTrim('floor-border-east', 5.82, .03, 1.5, .055, .035, 13.45);
  addTrim('floor-border-north', 0, .03, 8.22, 11.7, .035, .055);
  addTrim('observation-zone-front', 0, .035, -4.75, 2.4, .025, .045);
  addTrim('observation-zone-back', 0, .035, -3.45, 2.4, .025, .045);

  const mergedTrim = Mesh.MergeMeshes(decorativeTrims, true, true, undefined, false, true);
  if (mergedTrim) {
    mergedTrim.name = 'museum-gold-trim-merged';
    mergedTrim.material = goldMaterial;
    mergedTrim.receiveShadows = true;
  }
  const mergedPanels = Mesh.MergeMeshes(decorativePanels, true, true, undefined, false, true);
  if (mergedPanels) {
    mergedPanels.name = 'museum-wall-panels-merged';
    mergedPanels.material = velvetMaterial;
    mergedPanels.receiveShadows = true;
  }

  const crownDisplay = new CrownDisplay(scene, shadowGenerator);
  collisionBoxes.push(crownDisplay.collisionBox);
  const crown = new Crown(scene, shadowGenerator);
  const securityGate = new SecurityGate(scene);
  collisionBoxes.push(securityGate.collisionBox);
  const alarm = new AlarmSystem(scene, ambient, keyLight);
  crownDisplay.spotlight.includedOnlyMeshes.push(...scene.meshes.filter(mesh => (
    mesh === hallFloor
    || mesh.name.startsWith('crown-')
  )));

  const input = new InputManager(canvas);
  const player = new Player(scene, shadowGenerator);
  const cameraRig = new GameCamera(scene, player);
  const controller = new PlayerController(player, input, cameraRig.camera, collisionBoxes);
  const guardPatrol = new GuardPatrol(CROWN_HALL_CONFIG.guardRoute);
  const guard = new Guard(scene, shadowGenerator, guardPatrol.start);
  const guardFlashlight = new GuardFlashlight(scene, guard);
  const guardController = new GuardController(guard, guardPatrol, guardFlashlight, collisionBoxes);
  const guardDebug = new GuardDebugView(scene, guard, guardPatrol);
  const guardVision = new GuardVision(scene, guard, guardFlashlight, player);
  const detection = new DetectionSystem();
  guardDebug.setVisible(false);
  crown.setDebugVisible(false);

  let crownEvent = 'WAITING';
  const removeCrownListener = crown.onStolen(() => {
    crownEvent = 'CROWN_STOLEN';
  });

  securityGate.onClosed(() => alarm.playGateImpact());

  const gameFlow = new GameFlowManager({
    setPlayerLocked: locked => controller.setMovementLocked(locked),
    setDisplayOpening: opening => crownDisplay.setOpening(opening),
    beginCrownTake: () => crown.beginTake(player.interactionPoint.getAbsolutePosition()),
    commitCrownSteal: () => crown.commitSteal(),
    setCrownSpotlight: active => crownDisplay.setSpotlightActive(active),
    beginSilence: () => alarm.beginSilence(),
    setAlarm: active => active ? alarm.activate() : alarm.reset(),
    closeGate: () => {
      securityGate.close();
      alarm.playGateMotor(CROWN_HALL_CONFIG.lockdown.gateCloseDuration);
    },
    openGate: () => {
      securityGate.open();
      if (securityGate.progress > 0) alarm.playGateMotor(CROWN_HALL_CONFIG.lockdown.gateOpenDuration);
    },
    setGuardAlert: active => guardController.setAlertMode(active),
    setCameraCinematic: active => cameraRig.setCinematicMode(active),
    setCameraAlert: active => cameraRig.setAlertMode(active),
  });

  let loadedModel: AbstractMesh | null = null;
  try {
    const assets = new AssetManager(scene, onProgress);
    const loaded = await assets.loadPrototypeModel('test-cube.glb');
    loadedModel = loaded.meshes.find(mesh => mesh.name !== '__root__') ?? loaded.meshes[0] ?? null;
    // Phase 01's pipeline asset still loads as a health check, but the temporary
    // cube is hidden so it cannot weaken the crown's visual hierarchy.
    loaded.meshes.filter(mesh => !mesh.parent).forEach(rootMesh => rootMesh.setEnabled(false));
  } catch (error) {
    console.warn('[Crown Hall] GLB health-check failed; primitive scene remains available.', error);
    onProgress(.92, 'GLB FALLBACK ACTIVE');
  }

  // Static museum geometry never changes its transform. Freezing those world
  // matrices removes repeated transform work while player, guard, debug and
  // future crown-animation meshes remain dynamic.
  scene.meshes.forEach(mesh => {
    const dynamic = mesh.name.startsWith('player-')
      || mesh.name.startsWith('guard-')
      || mesh.name.includes('debug')
      || mesh.name.startsWith('security-')
      || mesh.name.startsWith('alarm-')
      || mesh.name === 'crown-display-glass'
      || mesh.name === 'crown-light-pool'
      || mesh.name === 'crown-band'
      || mesh.name === 'crown-cushion'
      || mesh.name.startsWith('crown-spike');
    if (dynamic) return;
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
  });

  guardFlashlight.setShadowCasters(scene.meshes.filter(mesh => (
    mesh.metadata?.blocksVision === true
    || mesh.name === 'player-visual'
    || guard.shadowCasters.includes(mesh)
  )));

  const result: PrototypeSceneResult = {
    scene,
    cameraRig,
    player,
    controller,
    guard,
    guardController,
    guardFlashlight,
    guardVision,
    detection,
    crown,
    gameFlow,
    securityGate,
    alarm,
    get crownEvent() { return crownEvent; },
    get interactionAvailable() { return crown.interactionResult === 'READY'; },
    loadedModel,
    update: deltaTime => {
      crown.updateInteraction(player);
      gameFlow.update(deltaTime, crown.interactionResult === 'READY', input.interactHeld, detection.state === 'DETECTED');
      controller.update(deltaTime);
      crown.update(deltaTime);
      crownDisplay.update(deltaTime);
      securityGate.update(deltaTime);
      alarm.update(deltaTime);
      guardVision.update(deltaTime);
      detection.update(guardVision.isPlayerVisible, deltaTime);
      guardController.setAwareness(detection.state, guardVision.lastVisiblePosition);
      guardController.update(deltaTime);
      cameraRig.update(deltaTime, controller.direction, controller.speed);
    },
    setCameraDistance: mode => cameraRig.setDistance(mode),
    setDebugVisible: visible => {
      guardDebug.setVisible(visible);
      guardVision.setDebugVisible(visible);
      crown.setDebugVisible(visible);
    },
    teleportToCrownTest: () => {
      guardController.setDebugFrozen(false);
      player.position.copyFromFloats(0, 0, 3.5);
      player.root.rotation.y = 0;
      controller.velocity.setAll(0);
      controller.direction.copyFromFloats(0, 0, 1);
      cameraRig.reset();
    },
    setupCoverLosTest: () => {
      guardController.setDebugFrozen(true);
      player.position.copyFromFloats(-4.85, 0, 1.35);
      player.root.rotation.y = Math.PI / 2;
      controller.velocity.setAll(0);
      guard.position.copyFromFloats(-1.8, 0, 1.35);
      guard.root.rotation.y = -Math.PI / 2;
      detection.reset();
      cameraRig.reset();
    },
    startCrownSequenceTest: () => {
      if (gameFlow.phase !== 'INFILTRATION') return;
      guardController.setDebugFrozen(false);
      player.position.copyFromFloats(0, 0, 3.5);
      player.root.rotation.y = 0;
      controller.velocity.setAll(0);
      controller.direction.copyFromFloats(0, 0, 1);
      cameraRig.reset();
      gameFlow.debugStartSequence();
    },
    resetCrownHall: () => {
      crownEvent = 'WAITING';
      crown.reset();
      crownDisplay.reset();
      securityGate.reset();
      alarm.reset();
      guardController.reset();
      detection.reset();
      controller.reset();
      player.position.copyFromFloats(...GAME_3D_CONFIG.player.start);
      player.root.rotation.y = 0;
      gameFlow.reset();
      input.clearInteractPress();
      cameraRig.reset();
    },
    dispose: () => {
      removeCrownListener();
      input.dispose();
      guardDebug.dispose();
      guardVision.dispose();
      guardFlashlight.dispose();
      alarm.dispose();
      securityGate.dispose();
      guard.dispose();
      crown.dispose();
      crownDisplay.dispose();
      player.dispose();
    },
  };
  onProgress(1, 'CROWN HALL READY');
  return result;
}
