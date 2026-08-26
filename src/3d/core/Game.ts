import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { SceneManager } from './SceneManager';
import type { PrototypeSceneResult } from '../scenes/PrototypeScene';
import { GAME_3D_CONFIG } from '../config/gameConfig';

type GameUi = {
  root: HTMLElement;
  debug: HTMLElement;
  loading: HTMLElement;
  loadingProgress: HTMLElement;
  loadingStatus: HTMLElement;
  fps: HTMLElement;
  camera: HTMLElement;
  meshCount: HTMLElement;
  movement: HTMLElement;
  position: HTMLElement;
  guard: HTMLElement;
  guardB: HTMLElement;
  flashlight: HTMLElement;
  vision: HTMLElement;
  detection: HTMLElement;
  detectionFill: HTMLElement;
  detectionValue: HTMLElement;
  crown: HTMLElement;
  flow: HTMLElement;
  map: HTMLElement;
  phasePerf: HTMLElement;
  objective: HTMLElement;
  interaction: HTMLElement;
  interactionLabel: HTMLElement;
  interactionFill: HTMLElement;
  lockdown: HTMLElement;
  phase: HTMLElement;
  timer: HTMLElement;
  gateState: HTMLElement;
  announcement: HTMLElement;
  alarmOverlay: HTMLElement;
  hideOverlay: HTMLElement;
  hideAwareness: HTMLElement;
  exitMarker: HTMLElement;
  zone: HTMLElement;
  loot: HTMLElement;
};

export class Game {
  private readonly engine: Engine;
  private readonly sceneManager: SceneManager;
  private scene: Scene | null = null;
  private prototype: PrototypeSceneResult | null = null;
  private debugUpdateAt = 0;
  private missionUiUpdateAt = 0;
  private debugVisualsVisible = false;
  private debugPanelVisible = false;
  private lastInteractionAvailable: boolean | null = null;
  private lastCrownStolen: boolean | null = null;
  private lastObjective = '';
  private lastAnnouncement = '';
  private performanceElapsed = 0;
  private performanceFrames = 0;
  private performanceSlowestFrame = 0;
  private averageFps = 0;
  private lowFps = 0;
  private adaptiveScaleCooldown = 0;
  private readonly phasePerformance = new Map<string, { elapsed: number; frames: number }>();

  constructor(private readonly canvas: HTMLCanvasElement, private readonly ui: GameUi) {
    this.engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, true);
    this.engine.setHardwareScalingLevel(GAME_3D_CONFIG.performance.hardwareScalingLevel);
    this.sceneManager = new SceneManager(this.engine, canvas);
  }

  async start() {
    this.updateLoading(.08, 'ENGINE READY');
    const result = await this.sceneManager.createPrototypeScene((ratio, label) => this.updateLoading(ratio, label));
    this.scene = result.scene;
    this.prototype = result;
    result.setDebugVisible(false);
    this.bindEvents();
    this.engine.runRenderLoop(() => {
      const rawDeltaTime = Math.min(.25, this.engine.getDeltaTime() / 1000);
      this.updatePerformanceStats(rawDeltaTime);
      const deltaTime = Math.min(.05, rawDeltaTime);
      this.prototype?.update(deltaTime);
      const now = performance.now();
      if (now >= this.missionUiUpdateAt) {
        this.missionUiUpdateAt = now + GAME_3D_CONFIG.performance.missionUiIntervalMs;
        this.updateMissionUi();
      }
      this.scene?.render();
      this.updateDebug();
    });
    this.updateLoading(1, result.loadedModel ? 'FULL MUSEUM READY · GLB VERIFIED' : 'FULL MUSEUM READY · GLB FALLBACK');
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
    if (event.code === 'KeyR') {
      event.preventDefault();
      if (event.shiftKey) this.prototype.cameraRig.reset();
      else this.prototype.resetCrownHall();
    }
    if (event.code === 'Digit1') this.prototype.setCameraDistance('near');
    if (event.code === 'Digit2') this.prototype.setCameraDistance('medium');
    if (event.code === 'Digit3') this.prototype.setCameraDistance('far');
    if (event.code === 'Digit0' && GAME_3D_CONFIG.debug) this.prototype.teleportToExitTest();
    if (event.code === 'Digit7' && GAME_3D_CONFIG.debug) this.prototype.teleportToEscapeRouteTest();
    if (event.code === 'Digit8' && GAME_3D_CONFIG.debug) this.prototype.teleportToLootTest();
    if (event.code === 'Digit9' && GAME_3D_CONFIG.debug) this.prototype.teleportToSecurityTest();
    if (event.code === 'F4' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.prototype.teleportToCrownTest();
    }
    if (event.code === 'F5' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.prototype.setupCoverLosTest();
    }
    if (event.code === 'F6' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.prototype.startCrownSequenceTest();
    }
    if (event.code === 'F7' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.prototype.setLockdownFinalSecondsTest();
    }
    if (event.code === 'F8' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.prototype.teleportToLockerTest();
    }
    if (event.code === 'F9' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.prototype.setupObservedLockerTest();
    }
    if (event.code === 'F10' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.prototype.setupShelfLosTest();
    }
    if (event.code === 'F1') {
      event.preventDefault();
      this.debugVisualsVisible = !this.debugVisualsVisible;
      this.prototype.setDebugVisible(this.debugVisualsVisible);
    }
    if (event.code === 'F2') {
      event.preventDefault();
      this.debugPanelVisible = !this.debugPanelVisible;
      this.ui.debug.classList.toggle('hidden', !this.debugPanelVisible);
    }
    if (event.code === 'F3' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.prototype.cycleAnimationPreview();
    }
  };

  private updateDebug() {
    if (!this.scene || !this.prototype || !this.debugPanelVisible) return;
    const now = performance.now();
    if (now < this.debugUpdateAt) return;
    this.debugUpdateAt = now + 250;
    const { cameraRig, controller, player, playerAnimation, guard, guardController, guardAnimation, guardFlashlight, guardVision, detection, crown, gameFlow, securityGate, alarm, hideController } = this.prototype;
    const camera = cameraRig.camera;
    const lightDirection = guardFlashlight.worldDirection;
    const renderPercent = Math.round(100 / this.engine.getHardwareScalingLevel());
    this.ui.fps.textContent = `FPS ${Math.round(this.engine.getFps())} · AVG ${this.averageFps} · LOW ${this.lowFps} · RENDER ${renderPercent}%`;
    this.ui.camera.textContent = `CAMERA ${cameraRig.state} / ${cameraRig.distanceLabel} · ${camera.position.y.toFixed(1)}M HIGH · TARGET ${cameraRig.targetPosition.x.toFixed(2)}, ${cameraRig.targetPosition.z.toFixed(2)}`;
    this.ui.meshCount.textContent = `MESHES ${this.scene.meshes.length} · 1 UNIT = 1 M`;
    this.ui.movement.textContent = `INPUT ${controller.inputLabel} · SPEED ${controller.speed.toFixed(2)} M/S · STANCE ${controller.isCrouching ? 'CROUCH' : controller.isRunning ? 'RUN' : 'NORMAL'} · COLLIDER ${controller.stanceHeight.toFixed(2)}M · ANIM ${playerAnimation.state}`;
    this.ui.position.textContent = `PLAYER ${player.position.x.toFixed(2)} / ${player.position.y.toFixed(2)} / ${player.position.z.toFixed(2)} · HIDE ${hideController.state} / ${hideController.currentSpot?.id ?? 'NONE'} · OBSERVED ${hideController.wasObservedEntering ? 'YES' : 'NO'}`;
    const seenAge = Number.isFinite(guardController.memory.seenAge) ? `${guardController.memory.seenAge.toFixed(1)}S` : '--';
    const heardAge = Number.isFinite(guardController.memory.heardAge) ? `${guardController.memory.heardAge.toFixed(1)}S` : '--';
    this.ui.guard.textContent = `GUARD ${guardController.fsmState}/${guardController.state}${guardController.isDebugFrozen ? ' · FROZEN(TEST)' : ''} · ANIM ${guardAnimation.state} · REASON ${guardController.investigationLabel} · MEMORY SEEN ${seenAge} HEARD ${heardAge} · ${guardController.transitionLabel} · PATROL ${guardController.patrolLabel} · SEARCH ${guardController.searchLabel} · NAV ${guardController.navigationLabel} · RECOVERY ${guardController.routeRecoveryCount} · POS ${guard.position.x.toFixed(2)}, ${guard.position.z.toFixed(2)}`;
    this.ui.guardB.textContent = `GUARD B ${this.prototype.secondaryGuardLabel}`;
    this.ui.flashlight.textContent = `LIGHT DIR ${lightDirection.x.toFixed(2)}, ${lightDirection.y.toFixed(2)}, ${lightDirection.z.toFixed(2)} · RANGE ${guardFlashlight.light.range.toFixed(1)}M`;
    this.ui.vision.textContent = `VISION ${guardVision.result} · ${guardVision.distance.toFixed(1)}M · ${guardVision.angleDegrees.toFixed(0)}° · LAST ${guardVision.lastVisiblePosition.x.toFixed(2)}, ${guardVision.lastVisiblePosition.z.toFixed(2)} · ${guardVision.checksPerSecond} CHECKS · ${guardVision.raycastsPerSecond} RAYS${guardVision.blockedBy === 'NONE' ? '' : ` · ${guardVision.blockedBy}`}`;
    const percent = Math.round(detection.value * 100);
    this.ui.detectionFill.style.width = `${percent}%`;
    this.ui.detectionValue.textContent = `${detection.state} ${percent}%`;
    this.ui.detection.dataset.state = detection.state;
    this.ui.crown.textContent = `CROWN ${crown.state} · INTERACT ${crown.interactionResult} · EVENT ${this.prototype.crownEvent}`;
    this.ui.flow.textContent = `FLOW ${gameFlow.phase} · EVENT ${gameFlow.lastEvent} · ALARM ${alarm.state} · LOCK ${gameFlow.lockdownState}/${gameFlow.lockdownThreatStage} · GATE ${securityGate.state}${securityGate.blockedByPlayer ? ' (PLAYER HOLD)' : ''} · TIMER ${gameFlow.lockdownRemaining.toFixed(1)}S`;
    this.ui.map.textContent = `ZONE ${this.prototype.currentZone} · LOOT ${this.prototype.lootLabel} · CCTV ${this.prototype.securityCameraLabel} · SHORTCUT ${this.prototype.shortcutState}`;
    this.ui.phasePerf.textContent = `PHASE PERF ${['INFILTRATION', 'ALARM', 'LOCKDOWN'].map(phase => {
      const sample = this.phasePerformance.get(phase);
      return `${phase.slice(0, 4)} ${sample && sample.elapsed > .15 ? Math.round(sample.frames / sample.elapsed) : '--'} FPS`;
    }).join(' · ')}`;
  }

  private updateMissionUi() {
    if (!this.prototype) return;
    const { gameFlow, securityGate, alarm, hideController } = this.prototype;
    this.ui.zone.textContent = this.prototype.currentZone;
    this.ui.loot.textContent = `OPTIONAL LOOT ${this.prototype.lootLabel}`;
    const stolen = gameFlow.hasCrown;
    const interactionAvailable = this.prototype.interactionAvailable || gameFlow.isHolding;
    if (interactionAvailable !== this.lastInteractionAvailable) {
      this.lastInteractionAvailable = interactionAvailable;
      this.ui.interaction.classList.toggle('visible', interactionAvailable);
    }
    this.ui.interactionLabel.textContent = gameFlow.isHolding ? 'SECURING CROWN' : this.prototype.interactionLabel;
    this.ui.interactionFill.style.width = `${Math.round(gameFlow.holdProgress * 100)}%`;
    if (stolen !== this.lastCrownStolen) {
      this.lastCrownStolen = stolen;
      this.ui.objective.classList.toggle('complete', stolen);
    }
    if (gameFlow.objective !== this.lastObjective) {
      this.lastObjective = gameFlow.objective;
      this.ui.objective.textContent = gameFlow.objective;
    }

    const lockdownVisible = gameFlow.phase === 'ALARM' || gameFlow.phase === 'LOCKDOWN' || gameFlow.phase === 'ESCAPE';
    this.ui.lockdown.classList.toggle('visible', lockdownVisible);
    this.ui.lockdown.classList.toggle('urgent', gameFlow.phase === 'LOCKDOWN' && gameFlow.lockdownRemaining <= 5);
    this.ui.phase.textContent = gameFlow.phase;
    this.ui.timer.textContent = gameFlow.phase === 'LOCKDOWN'
      ? `00:${Math.ceil(gameFlow.lockdownRemaining).toString().padStart(2, '0')}`
      : gameFlow.phase === 'ALARM' ? 'ALERT' : 'OPEN';
    this.ui.gateState.textContent = `GATE ${securityGate.state}`;
    this.ui.alarmOverlay.classList.toggle('active', alarm.active);
    this.ui.exitMarker.classList.toggle('visible', gameFlow.phase === 'ESCAPE');
    const hidden = hideController.state === 'HIDDEN';
    this.ui.root.classList.toggle('hide-active', hidden);
    this.ui.hideOverlay.classList.toggle('visible', hidden);
    if (hidden) {
      this.ui.hideOverlay.style.setProperty('--hide-tension', hideController.tension.toFixed(2));
      this.ui.hideOverlay.style.setProperty('--hide-danger-alpha', (hideController.tension * .32).toFixed(2));
      this.ui.hideOverlay.style.setProperty('--hide-vignette', `${45 + hideController.tension * 70}px`);
      this.ui.hideOverlay.style.setProperty('--hide-text-alpha', (.42 + hideController.tension * .5).toFixed(2));
      this.ui.hideAwareness.textContent = hideController.proximityLabel;
    }

    if (gameFlow.announcement !== this.lastAnnouncement) {
      this.lastAnnouncement = gameFlow.announcement;
      this.ui.announcement.textContent = gameFlow.announcement;
      this.ui.announcement.dataset.tone = gameFlow.announcementTone;
      this.ui.announcement.classList.toggle('visible', Boolean(gameFlow.announcement));
    }
  }

  private updatePerformanceStats(deltaTime: number) {
    if (deltaTime <= 0) return;
    const phase = this.prototype?.gameFlow.phase;
    if (phase) {
      const phaseSample = this.phasePerformance.get(phase) ?? { elapsed: 0, frames: 0 };
      phaseSample.elapsed += deltaTime;
      phaseSample.frames += 1;
      this.phasePerformance.set(phase, phaseSample);
    }
    this.performanceElapsed += deltaTime;
    this.performanceFrames += 1;
    this.performanceSlowestFrame = Math.max(this.performanceSlowestFrame, deltaTime);
    this.adaptiveScaleCooldown = Math.max(0, this.adaptiveScaleCooldown - deltaTime);
    if (this.performanceElapsed < GAME_3D_CONFIG.performance.sampleWindowSeconds) return;
    this.averageFps = Math.round(this.performanceFrames / this.performanceElapsed);
    this.lowFps = Math.round(1 / this.performanceSlowestFrame);
    this.updateAdaptiveResolution();
    this.performanceElapsed = 0;
    this.performanceFrames = 0;
    this.performanceSlowestFrame = 0;
  }

  private updateAdaptiveResolution() {
    if (this.adaptiveScaleCooldown > 0) return;
    const config = GAME_3D_CONFIG.performance;
    const current = this.engine.getHardwareScalingLevel();
    let next = current;
    if (this.averageFps < config.scaleDownBelowFps) {
      next = Math.min(config.maxHardwareScalingLevel, current + config.hardwareScalingStep);
    } else if (this.averageFps > config.scaleUpAboveFps) {
      next = Math.max(config.minHardwareScalingLevel, current - config.hardwareScalingStep);
    }
    if (Math.abs(next - current) < .001) return;
    this.engine.setHardwareScalingLevel(Number(next.toFixed(2)));
    this.engine.resize();
    this.adaptiveScaleCooldown = config.adaptiveCooldownSeconds;
  }

  dispose() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeydown);
    this.prototype?.dispose();
    this.scene?.dispose();
    this.engine.dispose();
  }
}
