import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { SceneManager } from './SceneManager';
import type { PrototypeSceneResult } from '../scenes/PrototypeScene';
import { GAME_3D_CONFIG } from '../config/gameConfig';
import { GamePhase } from './GamePhase';
import { RunResetManager } from './RunResetManager';
import { RunStats, type RunSnapshot } from '../systems/RunStats';
import { ScoreSystem, formatRunTime } from '../systems/ScoreSystem';
import { getQualityProfile, setGraphicsQuality, type GraphicsQuality } from '../systems/GraphicsQuality';

type SessionState = 'MENU' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'CONFIRM' | 'ENDING' | 'RESULT';

type GameUi = {
  root: HTMLElement;
  debug: HTMLElement;
  loading: HTMLElement;
  loadingProgress: HTMLElement;
  loadingStatus: HTMLElement;
  loadingPercent: HTMLElement;
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
  menu: HTMLElement;
  play: HTMLButtonElement;
  quality: HTMLSelectElement;
  fullscreen: HTMLButtonElement;
  pause: HTMLElement;
  resume: HTMLButtonElement;
  restart: HTMLButtonElement;
  pauseMenu: HTMLButtonElement;
  confirm: HTMLElement;
  confirmRestart: HTMLButtonElement;
  cancelRestart: HTMLButtonElement;
  result: HTMLElement;
  resultPanel: HTMLElement;
  resultTitle: HTMLElement;
  resultRank: HTMLElement;
  resultReason: HTMLElement;
  resultCrown: HTMLElement;
  resultLoot: HTMLElement;
  resultDetected: HTMLElement;
  resultChases: HTMLElement;
  resultTime: HTMLElement;
  resultScore: HTMLElement;
  resultBadge: HTMLElement;
  resultBest: HTMLElement;
  retry: HTMLButtonElement;
  resultMenu: HTMLButtonElement;
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
  private readonly zonePerformance = new Map<string, { elapsed: number; frames: number }>();
  private readonly runStats = new RunStats();
  private readonly scoreSystem = new ScoreSystem();
  private resetManager: RunResetManager | null = null;
  private sessionState: SessionState = 'MENU';
  private endingAt = 0;
  private endingSnapshot: RunSnapshot | null = null;
  private endingWasSuccess = false;
  private debugForcedEnd = false;
  private sceneLoading: Promise<void> | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly ui: GameUi) {
    this.engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, true);
    this.engine.setHardwareScalingLevel(getQualityProfile().hardwareScalingLevel);
    this.sceneManager = new SceneManager(this.engine, canvas);
  }

  async start() {
    this.bindEvents();
    this.ui.quality.value = getQualityProfile().label;
    this.engine.runRenderLoop(() => {
      const rawDeltaTime = Math.min(.25, this.engine.getDeltaTime() / 1000);
      if (this.sessionState === 'PLAYING') this.updatePerformanceStats(rawDeltaTime);
      const deltaTime = Math.min(.05, rawDeltaTime);
      this.resetManager?.update(deltaTime);
      if (this.sessionState === 'PLAYING') {
        this.prototype?.update(deltaTime);
        this.updateRunStats(deltaTime);
        this.checkRunEnd();
      } else if (this.sessionState === 'ENDING') {
        if (performance.now() >= this.endingAt) this.showResult();
      }
      const now = performance.now();
      if (now >= this.missionUiUpdateAt) {
        this.missionUiUpdateAt = now + GAME_3D_CONFIG.performance.missionUiIntervalMs;
        this.updateMissionUi();
      }
      if (this.sessionState !== 'MENU' && this.sessionState !== 'LOADING') this.scene?.render();
      this.updateDebug();
    });
    this.updateLoading(0, 'PRESS PLAY TO PREPARE THE MUSEUM');
    this.ui.loading.classList.add('complete');
    this.showMenu(false);
  }

  private updateLoading(ratio: number, label: string) {
    this.ui.loadingProgress.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    this.ui.loadingPercent.textContent = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    this.ui.loadingStatus.textContent = label;
  }

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeydown);
    this.ui.play.addEventListener('click', this.startRun);
    this.ui.quality.addEventListener('change', this.handleQualityChange);
    this.ui.fullscreen.addEventListener('click', this.toggleFullscreen);
    this.ui.resume.addEventListener('click', this.resumeRun);
    this.ui.restart.addEventListener('click', this.openRestartConfirm);
    this.ui.cancelRestart.addEventListener('click', this.closeRestartConfirm);
    this.ui.confirmRestart.addEventListener('click', this.retryRun);
    this.ui.pauseMenu.addEventListener('click', this.returnToMenu);
    this.ui.retry.addEventListener('click', this.retryRun);
    this.ui.resultMenu.addEventListener('click', this.returnToMenu);
    window.addEventListener('blur', this.handleFocusLost);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  private readonly handleResize = () => this.engine.resize();

  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (this.sessionState === 'MENU' && event.code === 'Enter') {
      event.preventDefault();
      this.startRun();
      return;
    }
    if (!this.prototype) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      if (this.sessionState === 'PLAYING') this.pauseRun();
      else if (this.sessionState === 'PAUSED') this.resumeRun();
      else if (this.sessionState === 'CONFIRM') this.closeRestartConfirm();
      return;
    }
    if (this.sessionState === 'RESULT' && event.code === 'Enter') {
      event.preventDefault();
      this.retryRun();
      return;
    }
    if (this.sessionState !== 'PLAYING') return;
    if (event.code === 'KeyR') {
      event.preventDefault();
      if (event.shiftKey) this.prototype.cameraRig.reset();
      else this.openRestartConfirm();
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
    if (event.code === 'F1' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.debugVisualsVisible = !this.debugVisualsVisible;
      this.prototype.setDebugVisible(this.debugVisualsVisible);
    }
    if (event.code === 'F2' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.debugPanelVisible = !this.debugPanelVisible;
      this.ui.debug.classList.toggle('hidden', !this.debugPanelVisible);
    }
    if (event.code === 'F3' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.prototype.cycleAnimationPreview();
    }
    if (event.code === 'KeyO' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.debugForcedEnd = true;
      this.prototype.gameFlow.debugComplete();
    }
    if (event.code === 'KeyP' && GAME_3D_CONFIG.debug) {
      event.preventDefault();
      this.debugForcedEnd = true;
      this.prototype.gameFlow.fail('DEBUG CAPTURE TEST');
    }
  };

  private readonly handleQualityChange = () => {
    const quality = this.ui.quality.value as GraphicsQuality;
    setGraphicsQuality(this.engine, quality);
    // Shadow maps are allocated with the scene, so a menu quality change
    // releases the existing scene and rebuilds it on the next PLAY.
    if (this.sessionState === 'MENU' && this.prototype) {
      this.prototype.dispose();
      this.scene?.dispose();
      this.prototype = null;
      this.scene = null;
      this.resetManager = null;
      this.resetUiCache();
    }
  };

  private readonly toggleFullscreen = () => {
    const action = document.fullscreenElement ? document.exitFullscreen() : this.ui.root.requestFullscreen();
    void action.then(() => this.engine.resize()).catch(error => console.warn('[Fullscreen] Request unavailable.', error));
  };

  private readonly handleFullscreenChange = () => {
    this.ui.fullscreen.textContent = document.fullscreenElement ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
    this.engine.resize();
  };

  private readonly handleFocusLost = () => {
    if (this.sessionState === 'PLAYING') this.pauseRun();
  };

  private readonly handleVisibilityChange = () => {
    if (document.hidden) this.handleFocusLost();
  };

  private readonly startRun = () => {
    if (!this.prototype) {
      void this.loadSceneAndStart();
      return;
    }
    this.requestFreshRun(() => {
      this.hideAllScreens();
      this.sessionState = 'PLAYING';
      this.ui.root.classList.remove('terminal-overlay-active');
      this.canvas.focus();
    });
  };

  private async loadSceneAndStart() {
    if (this.sceneLoading) return this.sceneLoading;
    this.sessionState = 'LOADING';
    this.hideAllScreens();
    this.ui.root.classList.remove('terminal-overlay-active');
    this.ui.loading.classList.remove('complete', 'failed');
    this.updateLoading(.04, 'ENGINE READY · PREPARING THE MUSEUM');
    this.sceneLoading = (async () => {
      try {
        const result = await this.sceneManager.createPrototypeScene((ratio, label) => this.updateLoading(ratio, label));
        this.scene = result.scene;
        this.prototype = result;
        this.resetManager = new RunResetManager(this.ui.root, () => this.prototype?.resetCrownHall());
        result.setDebugVisible(false);
        this.updateLoading(1, 'FULL MUSEUM READY · ALL ASSETS PRELOADED');
        await new Promise(resolve => window.setTimeout(resolve, 180));
        this.ui.loading.classList.add('complete');
        this.runStats.reset();
        this.resetUiCache();
        this.sessionState = 'PLAYING';
        this.canvas.focus();
      } catch (error) {
        console.error('[3D Foundation] Scene loading failed.', error);
        this.ui.loadingStatus.textContent = '3D STARTUP FAILED · CONSOLE을 확인하세요';
        this.ui.loading.classList.add('failed');
      } finally {
        this.sceneLoading = null;
      }
    })();
    return this.sceneLoading;
  }

  private readonly retryRun = () => {
    this.requestFreshRun(() => {
      this.hideAllScreens();
      this.sessionState = 'PLAYING';
      this.ui.root.classList.remove('terminal-overlay-active');
      this.canvas.focus();
    });
  };

  private readonly returnToMenu = () => {
    this.requestFreshRun(() => this.showMenu(true));
  };

  private requestFreshRun(afterReset: () => void) {
    if (!this.resetManager || this.resetManager.active) return;
    this.sessionState = 'ENDING';
    this.runStats.reset();
    this.endingSnapshot = null;
    this.debugForcedEnd = false;
    this.resetManager.request(() => {
      this.resetUiCache();
      afterReset();
    });
  }

  private showMenu(focus: boolean) {
    this.hideAllScreens();
    this.sessionState = 'MENU';
    this.ui.menu.classList.remove('hidden');
    this.ui.root.classList.add('terminal-overlay-active');
    if (focus) this.ui.play.focus();
  }

  private readonly pauseRun = () => {
    if (this.sessionState !== 'PLAYING') return;
    this.sessionState = 'PAUSED';
    this.ui.pause.classList.remove('hidden');
    this.ui.root.classList.add('terminal-overlay-active');
    this.ui.resume.focus();
  };

  private readonly resumeRun = () => {
    if (this.sessionState !== 'PAUSED') return;
    this.ui.pause.classList.add('hidden');
    this.ui.root.classList.remove('terminal-overlay-active');
    this.sessionState = 'PLAYING';
    this.canvas.focus();
  };

  private readonly openRestartConfirm = () => {
    if (this.sessionState !== 'PLAYING' && this.sessionState !== 'PAUSED') return;
    this.sessionState = 'CONFIRM';
    this.ui.pause.classList.add('hidden');
    this.ui.confirm.classList.remove('hidden');
    this.ui.root.classList.add('terminal-overlay-active');
    this.ui.confirmRestart.focus();
  };

  private readonly closeRestartConfirm = () => {
    if (this.sessionState !== 'CONFIRM') return;
    this.ui.confirm.classList.add('hidden');
    this.ui.pause.classList.remove('hidden');
    this.sessionState = 'PAUSED';
    this.ui.cancelRestart.blur();
    this.ui.resume.focus();
  };

  private hideAllScreens() {
    this.ui.menu.classList.add('hidden');
    this.ui.pause.classList.add('hidden');
    this.ui.confirm.classList.add('hidden');
    this.ui.result.classList.add('hidden');
  }

  private updateRunStats(deltaTime: number) {
    if (!this.prototype) return;
    const { detection, guardController, guardBController, collectedLootIds, gameFlow } = this.prototype;
    this.runStats.update(deltaTime, {
      detected: detection.state === 'DETECTED',
      chased: guardController.fsmState === 'CHASE' || guardBController.fsmState === 'CHASE',
      lootIds: collectedLootIds,
      crownSecured: gameFlow.hasCrown,
    });
  }

  private checkRunEnd() {
    if (!this.prototype) return;
    const phase = this.prototype.gameFlow.phase;
    if (phase !== GamePhase.COMPLETE && phase !== GamePhase.FAILED) return;
    this.endingSnapshot = this.runStats.finish();
    this.endingWasSuccess = phase === GamePhase.COMPLETE;
    this.endingAt = performance.now() + (this.endingWasSuccess ? 1150 : 1050);
    this.sessionState = 'ENDING';
    this.ui.interaction.classList.remove('visible');
    this.ui.exitMarker.classList.remove('visible');
  }

  private showResult() {
    if (!this.prototype || !this.endingSnapshot) return;
    const snapshot = this.endingSnapshot;
    const scored = this.scoreSystem.calculate(snapshot);
    const saved = this.endingWasSuccess && !this.debugForcedEnd ? this.scoreSystem.saveBest(snapshot) : null;
    this.hideAllScreens();
    this.sessionState = 'RESULT';
    this.ui.root.classList.add('terminal-overlay-active');
    this.ui.result.classList.remove('hidden');
    this.ui.resultPanel.classList.toggle('failed', !this.endingWasSuccess);
    this.ui.resultTitle.textContent = this.endingWasSuccess ? 'HEIST COMPLETE' : 'MISSION FAILED';
    this.ui.resultRank.textContent = this.endingWasSuccess ? scored.rank : 'FAILED';
    this.ui.resultReason.textContent = this.endingWasSuccess ? '왕관과 함께 박물관을 빠져나왔습니다.' : this.prototype.gameFlow.failureReason;
    this.ui.resultCrown.textContent = snapshot.crownSecured ? 'SECURED' : 'NOT SECURED';
    this.ui.resultLoot.textContent = `${snapshot.collectedLootIds.length} / ${this.prototype.totalLootCount}`;
    this.ui.resultDetected.textContent = snapshot.detectedCount.toString();
    this.ui.resultChases.textContent = snapshot.chaseCount.toString();
    this.ui.resultTime.textContent = formatRunTime(snapshot.elapsedSeconds);
    this.ui.resultScore.textContent = this.endingWasSuccess ? `${scored.score.toLocaleString()} / ${scored.maxScore.toLocaleString()}` : '—';
    this.ui.resultBadge.textContent = this.endingWasSuccess && scored.perfect ? 'PERFECT HEIST' : saved?.newBest ? 'NEW BEST SCORE' : '';
    this.ui.resultBest.textContent = saved
      ? `BEST ${saved.bestScore.toLocaleString()} · FASTEST ${saved.bestTime === null ? '--:--' : formatRunTime(saved.bestTime)}`
      : this.debugForcedEnd ? 'DEBUG RESULT · 최고 기록에는 저장되지 않습니다.' : '다시 시도하면 이번 기록은 초기화됩니다.';
    this.ui.retry.focus();
  }

  private resetUiCache() {
    this.lastInteractionAvailable = null;
    this.lastCrownStolen = null;
    this.lastObjective = '';
    this.lastAnnouncement = '';
    this.ui.announcement.classList.remove('visible');
    this.ui.alarmOverlay.classList.remove('active');
    this.ui.hideOverlay.classList.remove('visible');
    this.ui.root.classList.remove('hide-active');
    this.ui.lockdown.classList.remove('visible', 'urgent');
    this.ui.exitMarker.classList.remove('visible');
    this.ui.interaction.classList.remove('visible');
  }

  private updateDebug() {
    if (!this.scene || !this.prototype || !this.debugPanelVisible) return;
    const now = performance.now();
    if (now < this.debugUpdateAt) return;
    this.debugUpdateAt = now + 250;
    const { cameraRig, controller, player, playerAnimation, guard, guardController, guardAnimation, guardFlashlight, guardVision, detection, crown, gameFlow, securityGate, alarm, hideController } = this.prototype;
    const camera = cameraRig.camera;
    const lightDirection = guardFlashlight.worldDirection;
    const renderPercent = Math.round(100 / this.engine.getHardwareScalingLevel());
    this.ui.fps.textContent = `FPS ${Math.round(this.engine.getFps())} · AVG ${this.averageFps} · LOW ${this.lowFps} · ${getQualityProfile().label} ${renderPercent}%`;
    this.ui.fps.dataset.health = this.averageFps >= 50 ? 'good' : this.averageFps >= 40 ? 'warning' : 'fail';
    this.ui.camera.textContent = `CAMERA ${cameraRig.state} / ${cameraRig.distanceLabel} · ${camera.position.y.toFixed(1)}M HIGH · TARGET ${cameraRig.targetPosition.x.toFixed(2)}, ${cameraRig.targetPosition.z.toFixed(2)}`;
    this.ui.meshCount.textContent = `MESHES ${this.scene.meshes.length} · ACTIVE ${this.scene.getActiveMeshes().length} · MATERIALS ${this.scene.materials.length} · LIGHTS ${this.scene.lights.length}`;
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
    const phaseReport = ['INFILTRATION', 'ALARM', 'LOCKDOWN'].map(phase => {
      const sample = this.phasePerformance.get(phase);
      return `${phase.slice(0, 4)} ${sample && sample.elapsed > .15 ? Math.round(sample.frames / sample.elapsed) : '--'} FPS`;
    }).join(' · ');
    const zoneReport = ['WEST GALLERY', 'ARCHIVE', 'CROWN HALL'].map(zone => {
      const sample = this.zonePerformance.get(zone);
      return `${zone.replace('WEST ', '').replace('CROWN ', 'CROWN-')} ${sample && sample.elapsed > .15 ? Math.round(sample.frames / sample.elapsed) : '--'}`;
    }).join(' · ');
    this.ui.phasePerf.textContent = `BENCH ${zoneReport} · LOCK ${this.benchmarkFps(this.phasePerformance.get('LOCKDOWN'))} FPS · ${phaseReport}`;
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

    const escaping = gameFlow.phase === 'ESCAPE';
    // Once the shutter is open, the large countdown panel no longer contains
    // actionable information. Remove it from the playfield and compact the
    // remaining objective into the left-side mission stack.
    const lockdownVisible = gameFlow.phase === 'ALARM' || gameFlow.phase === 'LOCKDOWN';
    this.ui.lockdown.classList.toggle('visible', lockdownVisible);
    this.ui.lockdown.classList.toggle('urgent', gameFlow.phase === 'LOCKDOWN' && gameFlow.lockdownRemaining <= 5);
    this.ui.phase.textContent = gameFlow.phase;
    this.ui.timer.textContent = gameFlow.phase === 'LOCKDOWN'
      ? `00:${Math.ceil(gameFlow.lockdownRemaining).toString().padStart(2, '0')}`
      : gameFlow.phase === 'ALARM' ? 'ALERT' : 'OPEN';
    this.ui.gateState.textContent = `GATE ${securityGate.state}`;
    this.ui.alarmOverlay.classList.toggle('active', alarm.active);
    this.ui.exitMarker.classList.toggle('visible', escaping);
    this.ui.root.classList.toggle('escape-active', escaping);
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
    const zone = this.prototype?.currentZone;
    if (zone) {
      const sample = this.zonePerformance.get(zone) ?? { elapsed: 0, frames: 0 };
      sample.elapsed += deltaTime;
      sample.frames += 1;
      this.zonePerformance.set(zone, sample);
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

  private benchmarkFps(sample?: { elapsed: number; frames: number }) {
    return sample && sample.elapsed > .15 ? Math.round(sample.frames / sample.elapsed).toString() : '--';
  }

  private updateAdaptiveResolution() {
    if (this.adaptiveScaleCooldown > 0) return;
    const config = GAME_3D_CONFIG.performance;
    const quality = getQualityProfile();
    const current = this.engine.getHardwareScalingLevel();
    let next = current;
    if (this.averageFps < config.scaleDownBelowFps) {
      next = Math.min(quality.maxHardwareScalingLevel, current + config.hardwareScalingStep);
    } else if (this.averageFps > config.scaleUpAboveFps) {
      next = Math.max(quality.minHardwareScalingLevel, current - config.hardwareScalingStep);
    }
    if (Math.abs(next - current) < .001) return;
    this.engine.setHardwareScalingLevel(Number(next.toFixed(2)));
    this.engine.resize();
    this.adaptiveScaleCooldown = config.adaptiveCooldownSeconds;
  }

  dispose() {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeydown);
    this.ui.play.removeEventListener('click', this.startRun);
    this.ui.quality.removeEventListener('change', this.handleQualityChange);
    this.ui.fullscreen.removeEventListener('click', this.toggleFullscreen);
    this.ui.resume.removeEventListener('click', this.resumeRun);
    this.ui.restart.removeEventListener('click', this.openRestartConfirm);
    this.ui.cancelRestart.removeEventListener('click', this.closeRestartConfirm);
    this.ui.confirmRestart.removeEventListener('click', this.retryRun);
    this.ui.pauseMenu.removeEventListener('click', this.returnToMenu);
    this.ui.retry.removeEventListener('click', this.retryRun);
    this.ui.resultMenu.removeEventListener('click', this.returnToMenu);
    window.removeEventListener('blur', this.handleFocusLost);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.prototype?.dispose();
    this.scene?.dispose();
    this.engine.dispose();
  }
}
