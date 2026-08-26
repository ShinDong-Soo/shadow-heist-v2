import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import type { Scene } from '@babylonjs/core/scene';
import { GAME_3D_CONFIG } from '../../config/gameConfig';
import type { Player } from './Player';
import type { PlayerHideState } from '../hide/HideSpotTypes';

/**
 * Local awareness light for the top-down stealth camera. The museum stays
 * nearly black so the player only reads the room around themselves, while
 * guard SpotLights remain the long-range threat cue.
 */
export class PlayerVisionLight {
  readonly light: PointLight;
  private currentIntensity: number;
  private currentRange: number;

  constructor(scene: Scene, private readonly player: Player) {
    const config = GAME_3D_CONFIG.playerVision;
    this.currentIntensity = config.intensity;
    this.currentRange = config.range;
    this.light = new PointLight('player-vision-light', this.player.root.position.clone(), scene);
    this.light.diffuse = new Color3(.7, .82, .9);
    this.light.specular = new Color3(.18, .22, .26);
    this.light.intensity = this.currentIntensity;
    this.light.range = this.currentRange;
    // Keep the soft fill below gameplay flashlights so overlapping rooms still
    // prefer the warmer guard beam when both lights hit the same mesh.
    this.light.renderPriority = 12;
    this.syncTransform();
  }

  update(deltaTime: number, crouching: boolean, hideState: PlayerHideState) {
    const config = GAME_3D_CONFIG.playerVision;
    const hidden = hideState === 'HIDDEN' || hideState === 'ENTERING_HIDE';
    const intensityTarget = hidden
      ? config.hiddenIntensity
      : config.intensity * (crouching ? config.crouchIntensityMultiplier : 1);
    const rangeTarget = hidden
      ? config.hiddenRange
      : config.range * (crouching ? config.crouchRangeMultiplier : 1);
    const blend = 1 - Math.exp(-8 * deltaTime);
    this.currentIntensity += (intensityTarget - this.currentIntensity) * blend;
    this.currentRange += (rangeTarget - this.currentRange) * blend;
    this.light.intensity = this.currentIntensity;
    this.light.range = this.currentRange;
    this.syncTransform();
  }

  reset() {
    const config = GAME_3D_CONFIG.playerVision;
    this.currentIntensity = config.intensity;
    this.currentRange = config.range;
    this.light.intensity = this.currentIntensity;
    this.light.range = this.currentRange;
    this.syncTransform();
  }

  dispose() {
    this.light.dispose();
  }

  private syncTransform() {
    const position = this.player.root.position;
    this.light.position.copyFromFloats(
      position.x,
      GAME_3D_CONFIG.playerVision.height,
      position.z,
    );
  }
}
