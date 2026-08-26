import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import type { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import type { Scene } from '@babylonjs/core/scene';
import { GAME_3D_CONFIG } from '../config/gameConfig';
import { getQualityProfile } from './GraphicsQuality';

export type AlarmState = 'INACTIVE' | 'TRIGGERING' | 'ACTIVE' | 'ENDING';

export class AlarmSystem {
  state: AlarmState = 'INACTIVE';
  private elapsed = 0;
  private nextBeepAt = 0;
  private readonly lights: PointLight[] = [];
  private readonly beaconMaterials: StandardMaterial[] = [];
  private audioContext: AudioContext | null = null;
  private stealthOscillator: OscillatorNode | null = null;
  private stealthGain: GainNode | null = null;
  private escapeOscillators: OscillatorNode[] = [];
  private escapeGain: GainNode | null = null;

  constructor(
    scene: Scene,
    private readonly ambient: HemisphericLight,
    private readonly keyLight: DirectionalLight,
  ) {
    const positions = [
      new Vector3(-4.9, 2.8, 5.75),
      new Vector3(-1.48, 2.6, -2.45),
      new Vector3(1.48, 2.6, -2.45),
      new Vector3(4.9, 2.8, -3.8),
    ];
    positions.forEach((position, index) => {
      const material = new StandardMaterial(`alarm-beacon-material-${index}`, scene);
      material.diffuseColor = new Color3(.16, .012, .008);
      material.emissiveColor = new Color3(.025, .002, .001);
      this.beaconMaterials.push(material);

      const housing = MeshBuilder.CreateCylinder(`alarm-beacon-${index}`, {
        diameter: .28,
        height: .34,
        tessellation: 12,
      }, scene);
      housing.rotation.z = Math.PI / 2;
      housing.position.copyFrom(position);
      housing.material = material;

      if (index === 0 || index === positions.length - 1) {
        const light = new PointLight(`alarm-light-${index}`, position, scene);
        light.diffuse = new Color3(1, .035, .018);
        light.specular = new Color3(.5, .01, .005);
        light.range = 5.6;
        light.intensity = 0;
        this.lights.push(light);
      }
    });

    window.addEventListener('keydown', this.unlockAudio, { once: true, capture: true });
    window.addEventListener('pointerdown', this.unlockAudio, { once: true, capture: true });
  }

  update(deltaTime: number) {
    if (!this.active) return;
    this.elapsed += deltaTime;
    if (this.state === 'TRIGGERING' && this.elapsed >= .32) {
      this.state = 'ACTIVE';
      this.startEscapeBed();
    }
    const pulse = Math.sin(this.elapsed * Math.PI * 2 / .6) > -.5 ? 1 : .15;
    this.lights.forEach((light, index) => {
      light.intensity = (.72 + index * .08) * pulse * getQualityProfile().alarmLightMultiplier;
    });
    this.beaconMaterials.forEach((material, index) => {
      const offsetPulse = Math.sin((this.elapsed + index * .08) * Math.PI * 2 / .6) > -.5 ? 1 : .15;
      material.emissiveColor.copyFromFloats(.72 * offsetPulse, .012 * offsetPulse, .006 * offsetPulse);
    });
    if (this.elapsed >= this.nextBeepAt) {
      this.playBeep();
      this.nextBeepAt = this.elapsed + .68;
    }
  }

  beginSilence() {
    this.ensureAudio();
    this.rampGain(this.stealthGain, 0, .22);
  }

  activate() {
    if (this.active) return;
    this.state = 'TRIGGERING';
    this.elapsed = 0;
    this.nextBeepAt = 0;
    this.ambient.intensity = GAME_3D_CONFIG.lighting.alarmAmbientIntensity;
    this.keyLight.intensity = GAME_3D_CONFIG.lighting.alarmKeyIntensity;
    this.ensureAudio();
    this.playWarningTone();
  }

  reset() {
    this.state = 'INACTIVE';
    this.elapsed = 0;
    this.nextBeepAt = 0;
    this.ambient.intensity = GAME_3D_CONFIG.lighting.ambientIntensity;
    this.keyLight.intensity = GAME_3D_CONFIG.lighting.keyIntensity;
    this.lights.forEach(light => { light.intensity = 0; });
    this.beaconMaterials.forEach(material => material.emissiveColor.copyFromFloats(.025, .002, .001));
    this.rampGain(this.escapeGain, 0, .12);
    this.rampGain(this.stealthGain, .014, .35);
  }

  playGateMotor(duration = 2.4) {
    const context = this.ensureAudio();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(92, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(48, context.currentTime + duration);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.026, context.currentTime + .08);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + .02);
  }

  playGateImpact() {
    const context = this.ensureAudio();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(72, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(34, context.currentTime + .18);
    gain.gain.setValueAtTime(.04, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .2);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .22);
  }

  playCountdownTick(seconds: number) {
    this.playTone(520 + (5 - seconds) * 55, .045, .09, 'square');
  }

  playReleaseTone() {
    this.playTone(440, .035, .32, 'sine', 760);
  }

  get active() {
    return this.state === 'TRIGGERING' || this.state === 'ACTIVE' || this.state === 'ENDING';
  }

  dispose() {
    window.removeEventListener('keydown', this.unlockAudio, true);
    window.removeEventListener('pointerdown', this.unlockAudio, true);
    this.stopEscapeBed();
    this.stealthOscillator?.stop();
    this.audioContext?.close().catch(() => undefined);
    this.lights.forEach(light => light.dispose());
  }

  private readonly unlockAudio = () => {
    this.ensureAudio();
  };

  private ensureAudio() {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        this.startStealthBed();
      }
      if (this.audioContext.state === 'suspended') void this.audioContext.resume();
      return this.audioContext;
    } catch (error) {
      console.warn('[Alarm audio] AudioContext unavailable; game flow continues.', error);
      return null;
    }
  }

  private startStealthBed() {
    const context = this.audioContext;
    if (!context || this.stealthOscillator) return;
    this.stealthOscillator = context.createOscillator();
    this.stealthGain = context.createGain();
    this.stealthOscillator.type = 'sine';
    this.stealthOscillator.frequency.value = 73;
    this.stealthGain.gain.value = .014;
    this.stealthOscillator.connect(this.stealthGain).connect(context.destination);
    this.stealthOscillator.start();
  }

  private startEscapeBed() {
    const context = this.audioContext;
    if (!context || this.escapeOscillators.length > 0) {
      this.rampGain(this.escapeGain, .018, .25);
      return;
    }
    this.escapeGain = context.createGain();
    this.escapeGain.gain.value = .0001;
    this.escapeGain.connect(context.destination);
    this.escapeOscillators = [110, 165].map((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(this.escapeGain!);
      oscillator.start();
      return oscillator;
    });
    this.rampGain(this.escapeGain, .018, .25);
  }

  private stopEscapeBed() {
    this.escapeOscillators.forEach(oscillator => {
      try { oscillator.stop(); } catch { /* already stopped */ }
    });
    this.escapeOscillators = [];
  }

  private playBeep() {
    const context = this.audioContext;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 430;
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.035, context.currentTime + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .14);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .15);
  }

  private playWarningTone() {
    this.playTone(280, .055, .38, 'sawtooth', 560);
  }

  private playTone(frequency: number, volume: number, duration: number, type: OscillatorType, endFrequency?: number) {
    const context = this.ensureAudio();
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + duration);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + .02);
  }

  private rampGain(node: GainNode | null, value: number, duration: number) {
    if (!node || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(Math.max(.0001, node.gain.value), now);
    node.gain.exponentialRampToValueAtTime(Math.max(.0001, value), now + duration);
  }
}
