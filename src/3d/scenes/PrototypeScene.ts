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
import type { AssetProgress } from '../core/AssetManager';
import { GameFlowManager } from '../core/GameFlowManager';
import { Guard } from '../entities/guard/Guard';
import { GuardController } from '../entities/guard/GuardController';
import { GuardDebugView } from '../entities/guard/GuardDebugView';
import { GuardFlashlight } from '../entities/guard/GuardFlashlight';
import { GuardPatrol } from '../entities/guard/GuardPatrol';
import { GuardVision } from '../entities/guard/GuardVision';
import { Player } from '../entities/player/Player';
import { PlayerController } from '../entities/player/PlayerController';
import { PlayerHideController } from '../entities/player/PlayerHideController';
import { PlayerAnimationController } from '../entities/player/PlayerAnimationController';
import { LockerHideSpot } from '../entities/hide/LockerHideSpot';
import { Crown } from '../entities/treasure/Crown';
import { CrownDisplay } from '../entities/treasure/CrownDisplay';
import type { CollisionBox } from '../systems/CollisionWorld';
import { DetectionSystem } from '../systems/DetectionSystem';
import { InputManager } from '../systems/InputManager';
import { AlarmSystem } from '../systems/AlarmSystem';
import { SecurityGate } from '../systems/SecurityGate';
import { StealthAudioSystem } from '../systems/StealthAudioSystem';
import { InteractionSystem } from '../systems/InteractionSystem';
import { GuardAnimationController } from '../entities/guard/GuardAnimationController';
import { NoiseSystem, type PlayerNoiseMode } from '../systems/NoiseSystem';
import { GuardHearing } from '../entities/guard/GuardHearing';
import { GuardRadio } from '../entities/guard/GuardRadio';
import { MUSEUM_MAP_CONFIG } from '../config/museumMapConfig';
import { MuseumMap } from './MuseumMap';
import { OptionalTreasure } from '../entities/treasure/OptionalTreasure';
import { SecurityCamera3D } from '../systems/SecurityCamera3D';
import { getQualityProfile } from '../systems/GraphicsQuality';

export type PrototypeSceneResult = {
  scene: Scene;
  cameraRig: GameCamera;
  player: Player;
  controller: PlayerController;
  guard: Guard;
  guardController: GuardController;
  guardBController: GuardController;
  guardFlashlight: GuardFlashlight;
  guardVision: GuardVision;
  detection: DetectionSystem;
  crown: Crown;
  gameFlow: GameFlowManager;
  securityGate: SecurityGate;
  alarm: AlarmSystem;
  hideController: PlayerHideController;
  playerAnimation: PlayerAnimationController;
  guardAnimation: GuardAnimationController;
  readonly crownEvent: string;
  readonly interactionAvailable: boolean;
  readonly interactionLabel: string;
  readonly currentZone: string;
  readonly lootLabel: string;
  readonly collectedLootIds: readonly string[];
  readonly totalLootCount: number;
  readonly shortcutState: string;
  readonly secondaryGuardLabel: string;
  readonly securityCameraLabel: string;
  loadedModel: AbstractMesh | null;
  update: (deltaTime: number) => void;
  setCameraDistance: (mode: CameraDistance) => void;
  setDebugVisible: (visible: boolean) => void;
  teleportToCrownTest: () => void;
  setupCoverLosTest: () => void;
  startCrownSequenceTest: () => void;
  setLockdownFinalSecondsTest: () => void;
  teleportToLockerTest: () => void;
  teleportToLootTest: () => void;
  teleportToSecurityTest: () => void;
  teleportToEscapeRouteTest: () => void;
  setupObservedLockerTest: () => void;
  setupShelfLosTest: () => void;
  teleportToExitTest: () => void;
  cycleAnimationPreview: () => string;
  resetCrownHall: () => void;
  dispose: () => void;
};

export async function createPrototypeScene(engine: Engine, canvas: HTMLCanvasElement, onProgress: AssetProgress): Promise<PrototypeSceneResult> {
  const scene = new Scene(engine);
  scene.skipPointerMovePicking = true;
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

  const qualityProfile = getQualityProfile();
  const shadowGenerator = new ShadowGenerator(qualityProfile.keyShadowMapSize, keyLight);
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
    collisionBoxes.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, minY: 0, maxY: height });
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
    collisionBoxes.push({ minX: x - .62, maxX: x + .62, minZ: z - .62, maxZ: z + .62, minY: 0, maxY: 3.35 });
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

  // A compact archive edge demonstrates geometry-driven hiding. The shelf
  // bodies are single meshes; painted bands suggest files without creating
  // hundreds of individual book meshes.
  addBoxObstacle('archive-shelf-cover-west', 2.4, 6.75, .42, 2.25, 2.35, wallMaterial, true, true);
  addBoxObstacle('archive-shelf-cover-east', 4.1, 6.75, .42, 2.25, 2.35, wallMaterial, true, true);
  for (const x of [2.4, 4.1]) {
    addTrim(`archive-shelf-band-top-${x}`, x - .24, 1.78, 6.75, .035, .055, 2.05);
    addTrim(`archive-shelf-band-mid-${x}`, x - .24, 1.14, 6.75, .035, .045, 2.05);
    addTrim(`archive-shelf-band-low-${x}`, x - .24, .5, 6.75, .035, .045, 2.05);
  }

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

  const museumMap = new MuseumMap({ scene, shadowGenerator, collisionBoxes });
  const crownDisplay = new CrownDisplay(scene, shadowGenerator);
  collisionBoxes.push(crownDisplay.collisionBox);
  const crown = new Crown(scene, shadowGenerator);
  const securityGate = new SecurityGate(scene);
  collisionBoxes.push(securityGate.collisionBox);
  const alarm = new AlarmSystem(scene, ambient, keyLight);
  const crownLocker = new LockerHideSpot(scene, shadowGenerator, new Vector3(5.2, 0, 7.28), 'crown-locker');
  const archiveLocker = new LockerHideSpot(scene, shadowGenerator, museumMap.archiveLockerPosition, 'archive-locker');
  const lockers = [archiveLocker, crownLocker];
  lockers.forEach(locker => collisionBoxes.push(...locker.collisionBoxes));
  crownDisplay.spotlight.includedOnlyMeshes.push(...scene.meshes.filter(mesh => (
    mesh === hallFloor
    || mesh.name.startsWith('crown-')
  )));

  const input = new InputManager(canvas);
  const player = new Player(scene, shadowGenerator);
  const cameraRig = new GameCamera(scene, player);
  const controller = new PlayerController(player, input, cameraRig.camera, collisionBoxes);
  const securityCameras = [
    new SecurityCamera3D(scene, player, new Vector3(-2.65, 2.45, -11), .65, 'west'),
    new SecurityCamera3D(scene, player, new Vector3(2.65, 2.45, -7.3), -2.45, 'east'),
  ];
  const guardPatrol = new GuardPatrol(MUSEUM_MAP_CONFIG.guardA.normal);
  const guard = new Guard(scene, shadowGenerator, guardPatrol.start);
  const guardFlashlight = new GuardFlashlight(scene, guard, 'west');
  const guardController = new GuardController(guard, guardPatrol, guardFlashlight, collisionBoxes, MUSEUM_MAP_CONFIG.guardA);
  const guardHearing = new GuardHearing(guard);
  const guardDebug = new GuardDebugView(scene, guard, guardPatrol);
  const guardVision = new GuardVision(scene, guard, guardFlashlight, player);
  const guardBPatrol = new GuardPatrol(MUSEUM_MAP_CONFIG.guardB.normal);
  const guardB = new Guard(scene, shadowGenerator, guardBPatrol.start);
  const guardBFlashlight = new GuardFlashlight(scene, guardB, 'east');
  const guardBController = new GuardController(guardB, guardBPatrol, guardBFlashlight, collisionBoxes, MUSEUM_MAP_CONFIG.guardB);
  const guardBHearing = new GuardHearing(guardB);
  const guardBDebug = new GuardDebugView(scene, guardB, guardBPatrol);
  const guardBVision = new GuardVision(scene, guardB, guardBFlashlight, player);
  const detection = new DetectionSystem();
  const stealthAudio = new StealthAudioSystem(guard.position);
  onProgress(.18, 'PRELOADING GUARD AUDIO');
  await stealthAudio.preload();
  const noise = new NoiseSystem();
  const playerAnimation = new PlayerAnimationController(player, controller, strength => {
    const surface = noise.surfaceAt(player.position);
    const mode: PlayerNoiseMode = controller.isCrouching ? 'CROUCH' : controller.isRunning ? 'RUN' : 'WALK';
    stealthAudio.playPlayerFootstep(strength, surface);
    noise.emitPlayerFootstep(player.position, mode, surface);
  });
  const guardAnimation = new GuardAnimationController(guard, guardController, strength => {
    const surface = noise.surfaceAt(guard.position);
    stealthAudio.playGuardFootstep(guard.position, player.position, hideController.state === 'HIDDEN', strength, surface);
  });
  const guardBAnimation = new GuardAnimationController(guardB, guardBController, strength => {
    const surface = noise.surfaceAt(guardB.position);
    stealthAudio.playGuardFootstep(guardB.position, player.position, hideController.state === 'HIDDEN', strength, surface);
  });
  const hideController = new PlayerHideController(player, controller, cameraRig, lockers, {
    playDoor: opening => {
      stealthAudio.playLockerDoor(opening);
      const activeLocker = hideController.currentSpot ?? lockers.find(candidate => candidate.interactionReady) ?? archiveLocker;
      noise.emit(activeLocker.root.getAbsolutePosition(), 'LOCKER_DOOR', .45, 7, 'METAL');
    },
    rememberLastKnown: position => {
      guardVision.rememberLastKnownPosition(position);
      guardBVision.rememberLastKnownPosition(position);
    },
    requestGuardInvestigation: (position, reason) => {
      guardController.requestInvestigation(position, reason);
      guardBController.receiveRadioReport(position, 'RADIO_OBSERVED_HIDE');
    },
  });
  const radio = new GuardRadio();
  const removeRadioA = guardController.radio.subscribe(report => radio.report(report.reporterId, report.position, report.reason));
  const removeRadioB = guardBController.radio.subscribe(report => radio.report(report.reporterId, report.position, report.reason));
  const removeSharedRadio = radio.subscribe(report => {
    if (report.reporterId !== MUSEUM_MAP_CONFIG.guardA.id) guardController.receiveRadioReport(report.position, report.reason);
    if (report.reporterId !== MUSEUM_MAP_CONFIG.guardB.id) guardBController.receiveRadioReport(report.position, report.reason);
  });
  const optionalTreasures = [
    new OptionalTreasure(scene, shadowGenerator, 'antique-watch', 'ANTIQUE WATCH', 1200000, new Vector3(4.9, 0, -40), new Color3(.76, .5, .13)),
    new OptionalTreasure(scene, shadowGenerator, 'royal-document', 'ROYAL DOCUMENT', 2000000, new Vector3(5.75, 0, -20.6), new Color3(.28, .65, .58)),
    new OptionalTreasure(scene, shadowGenerator, 'diamond-brooch', 'DIAMOND BROOCH', 2800000, new Vector3(-5.35, 0, -25), new Color3(.4, .72, .95)),
  ];
  const interactionSystem = new InteractionSystem();
  guardDebug.setVisible(false);
  guardBDebug.setVisible(false);
  crown.setDebugVisible(false);

  let crownEvent = 'WAITING';
  const removeCrownListener = crown.onStolen(() => {
    crownEvent = 'CROWN_STOLEN';
  });

  securityGate.onClosed(() => alarm.playGateImpact());

  const gameFlow = new GameFlowManager({
    setPlayerLocked: locked => controller.setMovementLocked(locked),
    setDisplayOpening: opening => crownDisplay.setOpening(opening),
    beginCrownTake: () => {
      crown.beginTake(player.interactionPoint.getAbsolutePosition());
      noise.emit(crown.root.position, 'CROWN', .72, 8, 'METAL');
    },
    commitCrownSteal: () => crown.commitSteal(),
    setCrownSpotlight: active => crownDisplay.setSpotlightActive(active),
    beginSilence: () => alarm.beginSilence(),
    setAlarm: active => {
      if (active) alarm.activate();
      else alarm.reset();
      museumMap.setAlarmActive(active);
    },
    closeGate: () => {
      securityGate.close();
      alarm.playGateMotor(CROWN_HALL_CONFIG.lockdown.gateCloseDuration);
    },
    openGate: () => {
      securityGate.open();
      if (securityGate.progress > 0) alarm.playGateMotor(CROWN_HALL_CONFIG.lockdown.gateOpenDuration);
    },
    setGuardAlert: active => {
      guardController.setAlertMode(active);
      guardVision.setAlertMode(active);
      guardBController.setAlertMode(active);
      guardBVision.setAlertMode(active);
      if (active) {
        const crownPosition = new Vector3(...CROWN_HALL_CONFIG.crown.position);
        guardController.raiseAlarm(crownPosition);
        guardBController.raiseAlarm(crownPosition);
      }
    },
    setCameraCinematic: active => cameraRig.setCinematicMode(active),
    setCameraAlert: active => cameraRig.setAlertMode(active),
    setCameraEscape: active => cameraRig.setEscapeMode(active),
    setLockdownThreatStage: stage => {
      guardController.setLockdownStage(stage);
      guardBController.setLockdownStage(stage);
    },
    playLockdownTick: seconds => alarm.playCountdownTick(seconds),
    playLockdownReleased: () => alarm.playReleaseTone(),
  });
  guardController.setCaptureHandler(() => {
    gameFlow.fail('CAUGHT BY SECURITY');
  });
  guardBController.setCaptureHandler(() => {
    gameFlow.fail('CAUGHT BY SECURITY');
  });
  guardController.setSearchHandler((position, reason) => {
    if (!hideController.isVulnerableAt(position)) return;
    if (hideController.revealByGuard()) gameFlow.fail(reason === 'LOCKDOWN_SWEEP' ? 'LOCKER SEARCHED' : 'FOUND IN LOCKER');
  });
  guardBController.setSearchHandler((position, reason) => {
    if (!hideController.isVulnerableAt(position)) return;
    if (hideController.revealByGuard()) gameFlow.fail(reason === 'LOCKDOWN_SWEEP' ? 'LOCKER SEARCHED' : 'FOUND IN LOCKER');
  });
  const removeFlowListener = gameFlow.onEvent(event => {
    if (event === 'ESCAPE_AVAILABLE') museumMap.setShortcutOpen(true);
  });
  let lootCount = 0;
  let lootValue = 0;
  let cctvReportCooldown = 0;
  let guardAnimationAccumulator = 0;
  let guardBAnimationAccumulator = 0;

  // The old hidden test-cube GLB was a Phase 01 pipeline check. It was never
  // visible, so loading the glTF runtime and model on every visit only delayed
  // first play. The current modular museum is entirely built from optimized
  // Babylon primitives and needs no runtime GLB request.
  const loadedModel: AbstractMesh | null = null;
  onProgress(.92, 'MUSEUM AND LOCKDOWN ASSETS READY');

  // StandardMaterial renders only four simultaneous lights by default. This
  // scene can overlap ambient + key + crown/CCTV + two guard flashlights, so
  // the second guard's beam could silently disappear. Eight keeps both
  // gameplay flashlights visible while remaining below Babylon's common WebGL
  // light limit and only affects meshes inside each light's range.
  scene.materials.forEach(material => {
    if (material instanceof StandardMaterial) material.maxSimultaneousLights = 8;
  });

  // Static museum geometry never changes its transform. Freezing those world
  // matrices removes repeated transform work while player, guard, debug and
  // future crown-animation meshes remain dynamic.
  scene.meshes.forEach(mesh => {
    const dynamic = mesh.name.startsWith('player-')
      || mesh.name.startsWith('guard-')
      || mesh.name.includes('debug')
      || mesh.name.startsWith('security-')
      || mesh.name.startsWith('alarm-')
      || mesh.name.startsWith('hide-')
      || mesh.name.startsWith('optional-treasure-')
      || mesh.name.startsWith('museum-shortcut-')
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
    || player.visual.shadowCasters.includes(mesh)
    || guard.shadowCasters.includes(mesh)
    || guardB.shadowCasters.includes(mesh)
  )));
  guardBFlashlight.setShadowCasters(scene.meshes.filter(mesh => (
    mesh.metadata?.blocksVision === true
    || player.visual.shadowCasters.includes(mesh)
    || guard.shadowCasters.includes(mesh)
    || guardB.shadowCasters.includes(mesh)
  )));

  const result: PrototypeSceneResult = {
    scene,
    cameraRig,
    player,
    controller,
    guard,
    guardController,
    guardBController,
    guardFlashlight,
    guardVision,
    detection,
    crown,
    gameFlow,
    securityGate,
    alarm,
    hideController,
    playerAnimation,
    guardAnimation,
    get crownEvent() { return crownEvent; },
    get interactionAvailable() { return interactionSystem.available; },
    get interactionLabel() { return interactionSystem.label; },
    get currentZone() { return museumMap.zoneAt(player.position).label; },
    get lootLabel() { return `${lootCount}/${optionalTreasures.length} · ₩${lootValue.toLocaleString('ko-KR')}`; },
    get collectedLootIds() { return optionalTreasures.filter(treasure => treasure.collected).map(treasure => treasure.id); },
    get totalLootCount() { return optionalTreasures.length; },
    get shortcutState() { return museumMap.shortcutState; },
    get secondaryGuardLabel() { return `${guardBController.fsmState}/${guardBController.state} · ${guardBController.transitionLabel} · NAV ${guardBController.navigationLabel} · POS ${guardB.position.x.toFixed(1)}, ${guardB.position.z.toFixed(1)}`; },
    get securityCameraLabel() { return securityCameras.some(camera => camera.isPlayerVisible) ? 'PLAYER VISIBLE' : 'SCANNING'; },
    loadedModel,
    update: deltaTime => {
      const interactPressed = input.consumeInteract();
      const playerVisible = guardVision.isPlayerVisible || guardBVision.isPlayerVisible;
      hideController.update(deltaTime, interactPressed, playerVisible, [guard.position, guardB.position]);
      crown.updateInteraction(player);
      optionalTreasures.forEach(treasure => treasure.update(player, deltaTime));
      const treasureCandidates = optionalTreasures.map(treasure => ({
        id: treasure.id,
        available: hideController.state === 'NORMAL' && treasure.interactionReady,
        label: `TAKE ${treasure.label}`,
        priority: 70,
      }));
      interactionSystem.update([
        { id: 'hide', available: hideController.interactionReady, label: hideController.interactionLabel, priority: 100 },
        { id: 'crown', available: hideController.state === 'NORMAL' && crown.interactionResult === 'READY', label: 'HOLD TO STEAL CROWN', priority: 50 },
        ...treasureCandidates,
      ]);
      if (interactPressed) {
        const treasure = optionalTreasures.find(candidate => interactionSystem.isSelected(candidate.id));
        if (treasure?.collect()) {
          lootCount += 1;
          lootValue += treasure.value;
          noise.emit(treasure.root.position, 'TREASURE', .38, 5.5, 'METAL');
        }
      }
      gameFlow.update(deltaTime, interactionSystem.isSelected('crown'), interactionSystem.isSelected('crown') && input.interactHeld, detection.state === 'DETECTED');
      const zone = museumMap.zoneAt(player.position);
      if (zone.id === 'CROWN_HALL') gameFlow.discoverCrownHall();
      if (gameFlow.phase === 'ESCAPE' && museumMap.isAtExit(player.position)) gameFlow.complete();
      if (gameFlow.phase === 'LOCKDOWN') {
        const campTarget = hideController.consumeLockdownCampInvestigation();
        if (campTarget) {
          guardController.requestInvestigation(campTarget, 'LOCKDOWN_SWEEP');
          guardBController.requestInvestigation(campTarget, 'LOCKDOWN_SWEEP');
        }
      }
      controller.update(deltaTime);
      playerAnimation.update(deltaTime, hideController.state, gameFlow.isHolding || gameFlow.phase === 'CROWN_STEAL');
      noise.update(deltaTime);
      const heardNoise = guardHearing.update(noise);
      if (heardNoise) guardController.hearNoise(heardNoise.position, heardNoise.strength, heardNoise.kind);
      const heardNoiseB = guardBHearing.update(noise);
      if (heardNoiseB) guardBController.hearNoise(heardNoiseB.position, heardNoiseB.strength, heardNoiseB.kind);
      crown.update(deltaTime);
      crownDisplay.update(deltaTime);
      securityGate.update(deltaTime, player.position, GAME_3D_CONFIG.player.radius);
      alarm.update(deltaTime);
      museumMap.update(deltaTime);
      guardController.update(deltaTime);
      guardBController.update(deltaTime);
      guardAnimationAccumulator += deltaTime;
      guardBAnimationAccumulator += deltaTime;
      const farAnimationInterval = qualityProfile.farAnimationInterval;
      const guardNear = Vector3.DistanceSquared(guard.position, player.position) <= 144;
      const guardBNear = Vector3.DistanceSquared(guardB.position, player.position) <= 144;
      if (guardNear || guardAnimationAccumulator >= farAnimationInterval) {
        guardAnimation.update(guardAnimationAccumulator);
        guardAnimationAccumulator = 0;
      }
      if (guardBNear || guardBAnimationAccumulator >= farAnimationInterval) {
        guardBAnimation.update(guardBAnimationAccumulator);
        guardBAnimationAccumulator = 0;
      }
      guardFlashlight.syncTransform();
      guardBFlashlight.syncTransform();
      guardDebug.update(guardController);
      guardBDebug.update(guardBController);
      guardVision.update(deltaTime);
      guardBVision.update(deltaTime);
      securityCameras.forEach(camera => camera.update(deltaTime, alarm.active));
      const visibleCamera = securityCameras.find(camera => camera.isPlayerVisible);
      detection.update(guardVision.isPlayerVisible || guardBVision.isPlayerVisible || Boolean(visibleCamera), deltaTime);
      guardController.setAwareness(detection.state, guardVision.lastVisiblePosition, guardVision.isPlayerVisible);
      guardBController.setAwareness(detection.state, guardBVision.lastVisiblePosition, guardBVision.isPlayerVisible);
      cctvReportCooldown = Math.max(0, cctvReportCooldown - deltaTime);
      if (visibleCamera && detection.state === 'DETECTED' && cctvReportCooldown <= 0) {
        cctvReportCooldown = 2.5;
        guardBController.requestInvestigation(visibleCamera.lastSeenPosition, 'CCTV_ALARM', 4.2);
        guardController.receiveRadioReport(visibleCamera.lastSeenPosition, 'RADIO_CCTV_REPORT', 4);
      }
      const nearestGuard = Vector3.DistanceSquared(guard.position, player.position) <= Vector3.DistanceSquared(guardB.position, player.position) ? guard : guardB;
      stealthAudio.update(deltaTime, nearestGuard.position, player.position, hideController.state === 'HIDDEN', hideController.tension);
      cameraRig.update(deltaTime, controller.direction, controller.speed, input.consumeCameraTurn());
    },
    setCameraDistance: mode => cameraRig.setDistance(mode),
    setDebugVisible: visible => {
      guardDebug.setVisible(visible);
      guardBDebug.setVisible(visible);
      guardVision.setDebugVisible(visible);
      guardBVision.setDebugVisible(visible);
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
    setLockdownFinalSecondsTest: () => {
      gameFlow.debugSetLockdownFinalSeconds();
    },
    teleportToLockerTest: () => {
      guardController.setDebugFrozen(false);
      guardBController.setDebugFrozen(false);
      player.position.copyFrom(archiveLocker.entryPoint.getAbsolutePosition()).addInPlaceFromFloats(0, 0, -.25);
      player.root.rotation.y = 0;
      controller.velocity.setAll(0);
      cameraRig.reset();
    },
    teleportToLootTest: () => {
      hideController.reset();
      player.position.copyFromFloats(4.9, 0, -41.05);
      player.root.rotation.y = 0;
      controller.velocity.setAll(0);
      controller.direction.copyFromFloats(0, 0, 1);
      cameraRig.reset();
    },
    teleportToSecurityTest: () => {
      hideController.reset();
      guardController.setDebugFrozen(false);
      guardBController.setDebugFrozen(false);
      player.position.copyFromFloats(0, 0, -9.2);
      player.root.rotation.y = 0;
      controller.velocity.setAll(0);
      controller.direction.copyFromFloats(0, 0, 1);
      detection.reset();
      cctvReportCooldown = 0;
      guardAnimationAccumulator = 0;
      guardBAnimationAccumulator = 0;
      cameraRig.reset();
    },
    teleportToEscapeRouteTest: () => {
      if (gameFlow.phase !== 'ESCAPE') return;
      hideController.reset();
      player.position.copyFromFloats(5.65, 0, -20.8);
      player.root.rotation.y = Math.PI / 2;
      controller.velocity.setAll(0);
      controller.direction.copyFromFloats(1, 0, 0);
      cameraRig.reset();
      cameraRig.setAlertMode(true);
      cameraRig.setEscapeMode(true);
    },
    setupObservedLockerTest: () => {
      hideController.reset();
      guardController.setDebugFrozen(false);
      guardBController.setDebugFrozen(false);
      player.position.copyFrom(archiveLocker.entryPoint.getAbsolutePosition()).addInPlaceFromFloats(0, 0, -.25);
      player.root.rotation.y = 0;
      controller.velocity.setAll(0);
      guardB.position.copyFromFloats(-5.65, 0, -17.4);
      guardB.root.rotation.y = Math.PI;
      guard.position.copyFromFloats(-2.8, 0, -24.5);
      guard.root.rotation.y = 0;
      detection.reset();
      cameraRig.reset();
    },
    setupShelfLosTest: () => {
      hideController.reset();
      guardController.setDebugFrozen(true);
      player.position.copyFromFloats(3.2, 0, 6.75);
      player.root.rotation.y = -Math.PI / 2;
      controller.velocity.setAll(0);
      guard.position.copyFromFloats(1.45, 0, 6.75);
      guard.root.rotation.y = Math.PI / 2;
      detection.reset();
      cameraRig.reset();
    },
    teleportToExitTest: () => {
      if (gameFlow.phase !== 'ESCAPE') return;
      player.position.copyFromFloats(...MUSEUM_MAP_CONFIG.exit.position);
      controller.velocity.setAll(0);
      cameraRig.reset();
    },
    cycleAnimationPreview: () => {
      const label = guardAnimation.cyclePreview();
      return label;
    },
    resetCrownHall: () => {
      crownEvent = 'WAITING';
      crown.reset();
      crownDisplay.reset();
      securityGate.reset();
      alarm.reset();
      guardController.reset();
      guardBController.reset();
      guardAnimation.reset();
      guardBAnimation.reset();
      guardVision.setAlertMode(false);
      guardBVision.setAlertMode(false);
      detection.reset();
      hideController.reset();
      stealthAudio.reset(guard.position);
      noise.reset();
      guardHearing.reset();
      guardBHearing.reset();
      interactionSystem.reset();
      optionalTreasures.forEach(treasure => treasure.reset());
      lootCount = 0;
      lootValue = 0;
      cctvReportCooldown = 0;
      museumMap.reset();
      controller.reset();
      playerAnimation.reset();
      player.position.copyFromFloats(...MUSEUM_MAP_CONFIG.playerStart);
      player.root.rotation.y = 0;
      gameFlow.reset();
      input.clearInteractPress();
      cameraRig.reset();
    },
    dispose: () => {
      removeCrownListener();
      removeFlowListener();
      removeRadioA();
      removeRadioB();
      removeSharedRadio();
      input.dispose();
      guardDebug.dispose();
      guardBDebug.dispose();
      guardVision.dispose();
      guardBVision.dispose();
      guardFlashlight.dispose();
      guardBFlashlight.dispose();
      hideController.reset();
      stealthAudio.dispose();
      lockers.forEach(locker => locker.dispose());
      optionalTreasures.forEach(treasure => treasure.dispose());
      securityCameras.forEach(camera => camera.dispose());
      alarm.dispose();
      securityGate.dispose();
      guard.dispose();
      guardB.dispose();
      crown.dispose();
      crownDisplay.dispose();
      player.dispose();
    },
  };
  onProgress(1, 'FULL MUSEUM READY');
  return result;
}
