import type { Engine } from '@babylonjs/core/Engines/engine';
import { createPrototypeScene, type PrototypeSceneResult } from '../scenes/PrototypeScene';
import type { AssetProgress } from './AssetManager';

export class SceneManager {
  constructor(private readonly engine: Engine, private readonly canvas: HTMLCanvasElement) {}

  createPrototypeScene(onProgress: AssetProgress): Promise<PrototypeSceneResult> {
    return createPrototypeScene(this.engine, this.canvas, onProgress);
  }
}
