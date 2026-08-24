import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Scene } from '@babylonjs/core/scene';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
// Deep Babylon imports keep the bundle smaller, so runtime-loaded shaders
// used by shadows/PBR must be registered explicitly.
import '@babylonjs/core/Shaders/shadowMap.vertex';
import '@babylonjs/core/Shaders/shadowMap.fragment';
import '@babylonjs/core/Shaders/postprocess.vertex';
import '@babylonjs/core/Shaders/rgbdDecode.fragment';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { AssetManager, type AssetProgress } from '../core/AssetManager';
import { GameCamera, type CameraDistance } from '../camera/GameCamera';
import { GAME_3D_CONFIG } from '../config/gameConfig';
import { Player } from '../entities/player/Player';
import { PlayerController, type CollisionBox } from '../entities/player/PlayerController';
import { InputManager } from '../systems/InputManager';

export type PrototypeSceneResult = {
  scene: Scene;
  cameraRig: GameCamera;
  player: Player;
  controller: PlayerController;
  loadedModel: AbstractMesh | null;
  update: (deltaTime: number) => void;
  setCameraDistance: (mode: CameraDistance) => void;
  dispose: () => void;
};

export async function createPrototypeScene(engine: Engine, canvas: HTMLCanvasElement, onProgress: AssetProgress): Promise<PrototypeSceneResult> {
  const scene = new Scene(engine);
  const [r, g, b, a] = GAME_3D_CONFIG.scene.clearColor;
  scene.clearColor = new Color4(r, g, b, a);
  scene.environmentIntensity = .7;

  const ambient = new HemisphericLight('prototype-ambient', new Vector3(.25, 1, -.3), scene);
  ambient.intensity = .65;
  ambient.diffuse = new Color3(.66, .78, .76);
  ambient.groundColor = new Color3(.06, .08, .09);

  const keyLight = new DirectionalLight('prototype-key', new Vector3(.45, -1, .38), scene);
  keyLight.position = new Vector3(-7, 12, -7);
  keyLight.intensity = 1.4;
  keyLight.diffuse = new Color3(1, .87, .65);

  const shadowGenerator = new ShadowGenerator(GAME_3D_CONFIG.scene.shadowMapSize, keyLight);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;

  const ground = MeshBuilder.CreateGround('movement-test-ground', {
    width: GAME_3D_CONFIG.scene.groundSize,
    height: GAME_3D_CONFIG.scene.groundSize,
    subdivisions: 2,
  }, scene);
  const groundMaterial = new StandardMaterial('movement-test-ground-material', scene);
  groundMaterial.diffuseColor = new Color3(.17, .22, .22);
  groundMaterial.specularColor = new Color3(.05, .08, .08);
  ground.material = groundMaterial;
  ground.receiveShadows = true;

  const wallMaterial = new StandardMaterial('movement-test-wall-material', scene);
  wallMaterial.diffuseColor = new Color3(.22, .27, .27);
  wallMaterial.specularColor = new Color3(.08, .12, .12);
  const accentMaterial = new StandardMaterial('movement-test-accent-material', scene);
  accentMaterial.diffuseColor = new Color3(.43, .31, .19);
  accentMaterial.specularColor = new Color3(.28, .22, .14);
  const collisionBoxes: CollisionBox[] = [];

  const addObstacle = (name: string, x: number, z: number, width: number, depth: number, height: number, material = wallMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width, depth, height }, scene);
    mesh.position.copyFromFloats(x, height / 2, z);
    mesh.material = material;
    mesh.receiveShadows = true;
    shadowGenerator.addShadowCaster(mesh);
    collisionBoxes.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  };

  // Start room → 2.4m doorway/corridor → small room.
  addObstacle('outer-wall-west', -10.7, 0, .6, 21.4, 2.7);
  addObstacle('outer-wall-east', 10.7, 0, .6, 21.4, 2.7);
  addObstacle('outer-wall-south', 0, -10.7, 22, .6, 2.7);
  addObstacle('outer-wall-north', 0, 10.7, 22, .6, 2.7);
  addObstacle('start-room-divider-left', -4.1, -2.6, 5.8, .45, 2.45);
  addObstacle('start-room-divider-right', 4.1, -2.6, 5.8, .45, 2.45);
  addObstacle('gallery-l-wall', 3.2, 1.4, .45, 5.8, 2.45);
  addObstacle('gallery-short-wall', 5.1, 4.3, 4.2, .45, 2.45);
  addObstacle('collision-test-crate', -3.1, 3.4, 1.55, 1.55, 1.3, accentMaterial);

  const input = new InputManager(canvas);
  const player = new Player(scene, shadowGenerator);
  const cameraRig = new GameCamera(scene, player);
  const controller = new PlayerController(player, input, cameraRig.camera, collisionBoxes);

  let loadedModel: AbstractMesh | null = null;
  try {
    const assets = new AssetManager(scene, onProgress);
    const loaded = await assets.loadPrototypeModel('test-cube.glb');
    loadedModel = loaded.meshes.find(mesh => mesh.name !== '__root__') ?? loaded.meshes[0] ?? null;
    loaded.meshes.filter(mesh => !mesh.parent).forEach(rootMesh => {
      rootMesh.position.addInPlace(new Vector3(-5.4, 0, 6.4));
    });
    loaded.meshes.forEach(mesh => {
      mesh.receiveShadows = true;
      shadowGenerator.addShadowCaster(mesh);
    });
  } catch (error) {
    console.warn('[3D Foundation] GLB load failed; movement test remains available.', error);
    onProgress(.92, 'GLB FALLBACK ACTIVE');
  }

  onProgress(1, 'PLAYER MOVEMENT READY');
  return {
    scene,
    cameraRig,
    player,
    controller,
    loadedModel,
    update: deltaTime => {
      controller.update(deltaTime);
      cameraRig.update(deltaTime, controller.direction, controller.speed);
    },
    setCameraDistance: mode => cameraRig.setDistance(mode),
    dispose: () => {
      input.dispose();
      player.dispose();
    },
  };
}
