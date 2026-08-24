import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { SceneManager } from './SceneManager';
import type { PrototypeSceneResult } from '../scenes/PrototypeScene';

type GameUi = {
  loading: HTMLElement;
  loadingProgress: HTMLElement;
  loadingStatus: HTMLElement;
  fps: HTMLElement;
  camera: HTMLElement;
  meshCount: HTMLElement;
  movement: HTMLElement;
  position: HTMLElement;
};

export class Game {
  private readonly engine: Engine;
  private readonly sceneManager: SceneManager;
  private scene: Scene | null = null;
  private prototype: PrototypeSceneResult | null = null;
  private debugUpdateAt = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly ui: GameUi) {
    this.engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, true);
    this.sceneManager = new SceneManager(this.engine, canvas);
  }

  async start() {
    this.updateLoading(.08, 'ENGINE READY');
    const result = await this.sceneManager.createPrototypeScene((ratio, label) => this.updateLoading(ratio, label));
    this.scene = result.scene;
    this.prototype = result;
    this.bindEvents();
    this.engine.runRenderLoop(() => {
      const deltaTime = Math.min(.05, this.engine.getDeltaTime() / 1000);
      this.prototype?.update(deltaTime);
      this.scene?.render();
      this.updateDebug();
    });
    this.updateLoading(1, result.loadedModel ? 'GLB PIPELINE READY' : 'SCENE READY · GLB FALLBACK');
    window.setTimeout(() => this.ui.loading.classList.add('complete'), 220);
    this.canvas.focus();
  }

  private updateLoading(ratio: number, label: string) {
    this.ui.loadingProgress.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    this.ui.loadingStatus.textContent = label;
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeydown);
  }

  private readonly handleResize = () => this.engine.resize();

  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (!this.prototype) return;
    if (event.code === 'KeyR') this.prototype.cameraRig.reset();
    if (event.code === 'Digit1') this.prototype.setCameraDistance('near');
    if (event.code === 'Digit2') this.prototype.setCameraDistance('medium');
    if (event.code === 'Digit3') this.prototype.setCameraDistance('far');
  };

  private updateDebug() {
    if (!this.scene || !this.prototype) return;
    const now = performance.now();
    if (now < this.debugUpdateAt) return;
    this.debugUpdateAt = now + 250;
    const { cameraRig, controller, player } = this.prototype;
    const camera = cameraRig.camera;
    this.ui.fps.textContent = `FPS ${Math.round(this.engine.getFps())}`;
    this.ui.camera.textContent = `CAMERA ${cameraRig.distanceLabel} · ${camera.position.y.toFixed(1)}M HIGH`;
    this.ui.meshCount.textContent = `MESHES ${this.scene.meshes.length} · 1 UNIT = 1 M`;
    this.ui.movement.textContent = `INPUT ${controller.inputLabel} · SPEED ${controller.speed.toFixed(2)} M/S · DIR ${controller.direction.x.toFixed(2)}, ${controller.direction.z.toFixed(2)}`;
    this.ui.position.textContent = `PLAYER ${player.position.x.toFixed(2)} / ${player.position.y.toFixed(2)} / ${player.position.z.toFixed(2)}`;
  }

  dispose() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeydown);
    this.prototype?.dispose();
    this.scene?.dispose();
    this.engine.dispose();
  }
}
