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

  constructor(scene: Scene, private readonly guard: Guard, id: string) {
    const config = GUARD_CONFIG.flashlight;
    const direction = new Vector3(0, config.pitch, 1).normalize();
    this.light = new SpotLight(`guard-flashlight-${id}`, Vector3.Zero(), direction, config.angle, config.exponent, scene);
    this.light.range = config.range;
    this.light.intensity = config.intensity;
    // Dark museum: keep a warm threat beam that remains readable past the
    // player's local fill when several lights compete for the same mesh.
    this.light.renderPriority = 20;
    this.light.diffuse = new Color3(1, .87, .64);
    this.light.specular = new Color3(.7, .57, .38);
    // Tight near/far planes keep depth precision high enough for thin museum
    // walls. Without these, SpotLight shadows smear and light bleeds through.
    this.light.shadowMinZ = .12;
    this.light.shadowMaxZ = config.range;

    const mapSize = Math.max(config.shadowMapSize, getQualityProfile().flashlightShadowMapSize);
    this.shadowGenerator = new ShadowGenerator(mapSize, this.light);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    // Back-face depth only is much more stable on .28-.42m cutaway walls than
    // dual-face sampling, which otherwise lets the beam punch through.
    this.shadowGenerator.forceBackFacesOnly = true;
    this.shadowGenerator.bias = .001;
    this.shadowGenerator.normalBias = .035;
    this.shadowGenerator.darkness = 0;
    const shadowMap = this.shadowGenerator.getShadowMap();
    if (shadowMap) {
      // Moving lights need a fresh depth map every frame or the previous cone
      // keeps lighting floors that are already behind a wall.
      shadowMap.refreshRate = 1;
    }
    this.syncTransform();
  }

  setShadowCasters(meshes: AbstractMesh[]) {
    meshes.forEach(mesh => {
      this.shadowGenerator.addShadowCaster(mesh, false);
      // Frozen museum walls can otherwise drop out of the light-space pass
      // when the main camera no longer sees them, letting the beam continue.
      mesh.alwaysSelectAsActiveMesh = true;
    });
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
    const targetRange = config.range * rangeMultiplier;
    this.light.range += (targetRange - this.light.range) * lightBlend;
    this.light.shadowMaxZ = this.light.range;
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
    this.light.shadowMaxZ = GUARD_CONFIG.flashlight.range;
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
