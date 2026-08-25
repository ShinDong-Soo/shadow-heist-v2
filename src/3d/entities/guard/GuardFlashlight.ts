import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import { GUARD_CONFIG } from '../../config/guardConfig';
import type { Guard } from './Guard';

export class GuardFlashlight {
  readonly light: SpotLight;
  readonly shadowGenerator: ShadowGenerator;
  private elapsed = 0;

  constructor(scene: Scene, private readonly guard: Guard) {
    const config = GUARD_CONFIG.flashlight;
    const direction = new Vector3(0, config.pitch, 1).normalize();
    this.light = new SpotLight('guard-flashlight', Vector3.Zero(), direction, config.angle, config.exponent, scene);
    this.light.parent = guard.flashlightPivot;
    this.light.range = config.range;
    this.light.intensity = config.intensity;
    this.light.diffuse = new Color3(1, .87, .64);
    this.light.specular = new Color3(.7, .57, .38);

    this.shadowGenerator = new ShadowGenerator(config.shadowMapSize, this.light);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_LOW;
    this.shadowGenerator.bias = .0008;
    this.shadowGenerator.normalBias = .025;
  }

  setShadowCasters(meshes: AbstractMesh[]) {
    meshes.forEach(mesh => this.shadowGenerator.addShadowCaster(mesh));
  }

  update(deltaTime: number, moving: boolean) {
    this.elapsed += deltaTime;
    const amount = moving ? 1 : .35;
    this.guard.flashlightPivot.rotation.x = Math.sin(this.elapsed * 6.7) * GUARD_CONFIG.flashlight.swayVertical * amount;
    this.guard.flashlightPivot.rotation.y = Math.sin(this.elapsed * 4.1) * GUARD_CONFIG.flashlight.swayHorizontal * amount;
  }

  get worldDirection() {
    return this.light.getShadowDirection(0);
  }

  dispose() {
    this.shadowGenerator.dispose();
    this.light.dispose();
  }
}
