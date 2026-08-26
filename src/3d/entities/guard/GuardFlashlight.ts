import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import { GUARD_CONFIG } from '../../config/guardConfig';
import type { Guard } from './Guard';
import { getQualityProfile } from '../../systems/GraphicsQuality';

export type GuardFlashlightMode = 'PATROL' | 'ALERT' | 'FOCUS' | 'SEARCH' | 'CHASE';

export class GuardFlashlight {
  readonly light: SpotLight;
  readonly shadowGenerator: ShadowGenerator;
  private elapsed = 0;

  constructor(scene: Scene, private readonly guard: Guard) {
    const config = GUARD_CONFIG.flashlight;
    const direction = new Vector3(0, config.pitch, 1).normalize();
    this.light = new SpotLight('guard-flashlight', Vector3.Zero(), direction, config.angle, config.exponent, scene);
    this.light.range = config.range;
    this.light.intensity = config.intensity;
    this.light.diffuse = new Color3(1, .87, .64);
    this.light.specular = new Color3(.7, .57, .38);

    this.shadowGenerator = new ShadowGenerator(getQualityProfile().flashlightShadowMapSize, this.light);
    this.shadowGenerator.usePoissonSampling = true;
    // Smaller offsets reduce visible light leaking around thick Crown Hall
    // walls while keeping the low-cost 512px shadow map.
    this.shadowGenerator.bias = .0004;
    this.shadowGenerator.normalBias = .012;
    const shadowMap = this.shadowGenerator.getShadowMap();
    if (shadowMap) shadowMap.refreshRate = config.shadowRefreshRate;
    this.syncTransform();
  }

  setShadowCasters(meshes: AbstractMesh[]) {
    meshes.forEach(mesh => this.shadowGenerator.addShadowCaster(mesh));
  }

  update(deltaTime: number, moving: boolean, mode: GuardFlashlightMode = 'PATROL') {
    this.elapsed += deltaTime;
    const config = GUARD_CONFIG.flashlight;
    const rangeMultiplier = mode === 'CHASE'
      ? config.chaseRangeMultiplier
      : mode === 'ALERT' || mode === 'SEARCH'
        ? config.warningRangeMultiplier
        : mode === 'FOCUS'
          ? 1.08
          : 1;
    const lightBlend = 1 - Math.exp(-7 * deltaTime);
    this.light.range += (config.range * rangeMultiplier - this.light.range) * lightBlend;
    const intensityMultiplier = mode === 'PATROL' ? 1 : config.warningIntensityMultiplier;
    this.light.intensity += (config.intensity * intensityMultiplier - this.light.intensity) * lightBlend;
    const alertAmount = mode === 'ALERT' ? GUARD_CONFIG.flashlight.alertSwayMultiplier : 1;
    const movementAmount = moving ? 1 : .35;
    const chaseAmount = mode === 'CHASE' ? 1.65 : 1;
    const searchSweep = mode === 'SEARCH' ? Math.sin(this.elapsed * 2.15) * .11 : 0;
    const focusSteadying = mode === 'FOCUS' ? .42 : 1;
    this.guard.flashlightPivot.rotation.x = Math.sin(this.elapsed * (mode === 'CHASE' ? 8.1 : 6.7))
      * GUARD_CONFIG.flashlight.swayVertical * movementAmount * chaseAmount * focusSteadying;
    this.guard.flashlightPivot.rotation.y = searchSweep + Math.sin(this.elapsed * 4.1)
      * GUARD_CONFIG.flashlight.swayHorizontal * movementAmount * alertAmount * chaseAmount * focusSteadying;
    this.syncTransform();
  }

  syncTransform() {
    const config = GUARD_CONFIG.flashlight;
    const yaw = this.guard.root.rotation.y + this.guard.flashlightPivot.rotation.y;
    const pitch = config.pitch + this.guard.flashlightPivot.rotation.x;
    this.light.position.copyFrom(this.guard.flashlightPivot.getAbsolutePosition());
    this.light.direction.copyFromFloats(Math.sin(yaw), pitch, Math.cos(yaw)).normalize();
  }


  reset() {
    this.elapsed = 0;
    this.light.range = GUARD_CONFIG.flashlight.range;
    this.light.intensity = GUARD_CONFIG.flashlight.intensity;
    this.guard.flashlightPivot.rotation.setAll(0);
    this.syncTransform();
  }

  get worldDirection() {
    return this.light.getShadowDirection(0);
  }

  dispose() {
    this.shadowGenerator.dispose();
    this.light.dispose();
  }
}
