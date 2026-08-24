// Register both the .glb file type and its glTF 2.0 implementation.
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import { SceneLoader, type ISceneLoaderAsyncResult } from '@babylonjs/core/Loading/sceneLoader';
import type { Scene } from '@babylonjs/core/scene';

export type AssetProgress = (ratio: number, label: string) => void;

export class AssetManager {
  constructor(private readonly scene: Scene, private readonly onProgress: AssetProgress) {}

  async loadPrototypeModel(fileName: string): Promise<ISceneLoaderAsyncResult> {
    const rootUrl = `${import.meta.env.BASE_URL}models/prototype/`;
    this.onProgress(.35, `LOADING ${fileName.toUpperCase()}`);
    const result = await SceneLoader.ImportMeshAsync('', rootUrl, fileName, this.scene, event => {
      if (!event.lengthComputable || !event.total) return;
      this.onProgress(.35 + event.loaded / event.total * .55, `LOADING ${fileName.toUpperCase()}`);
    });
    this.onProgress(.92, 'GLB PIPELINE READY');
    return result;
  }
}
