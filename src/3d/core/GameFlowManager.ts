import { CROWN_HALL_CONFIG } from '../config/crownHallConfig';
import { CrownStealSequence, type CrownStealCue } from '../systems/CrownStealSequence';
import { LockdownSystem, type LockdownEvent, type LockdownThreatStage } from '../systems/LockdownSystem';
import { GamePhase } from './GamePhase';

export type GameFlowEvent = 'ALARM_STARTED' | 'LOCKDOWN_STARTED' | 'LOCKDOWN_ENDED' | 'ESCAPE_AVAILABLE';

export type GameFlowEffects = {
  setPlayerLocked: (locked: boolean) => void;
  setDisplayOpening: (opening: boolean) => void;
  beginCrownTake: () => void;
  commitCrownSteal: () => void;
  setCrownSpotlight: (active: boolean) => void;
  beginSilence: () => void;
  setAlarm: (active: boolean) => void;
  closeGate: () => void;
  openGate: () => void;
  setGuardAlert: (active: boolean) => void;
  setCameraCinematic: (active: boolean) => void;
  setCameraAlert: (active: boolean) => void;
  setLockdownThreatStage: (stage: LockdownThreatStage) => void;
  playLockdownTick: (seconds: number) => void;
  playLockdownReleased: () => void;
};

export class GameFlowManager {
  phase = GamePhase.INFILTRATION;
  hasCrown = false;
  holdProgress = 0;
  announcement = '';
  announcementTone: 'gold' | 'alarm' | 'clear' = 'gold';
  private readonly sequence = new CrownStealSequence();
  private readonly lockdown: LockdownSystem;
  private holdElapsed = 0;
  private announcementRemaining = 0;
  private readonly eventListeners = new Set<(event: GameFlowEvent) => void>();
  lastEvent: GameFlowEvent | 'NONE' = 'NONE';

  constructor(private readonly effects: GameFlowEffects) {
    this.lockdown = new LockdownSystem(this.handleLockdownEvent);
  }

  update(deltaTime: number, interactionReady: boolean, interactHeld: boolean, playerDetected: boolean) {
    const safeDelta = Math.min(deltaTime, .05);
    this.updateAnnouncement(safeDelta);

    if (this.sequence.active) this.sequence.update(safeDelta, this.handleSequenceCue);

    if (this.phase === GamePhase.INFILTRATION) {
      this.updateHold(safeDelta, interactionReady, interactHeld, playerDetected);
      return;
    }

    if (this.phase === GamePhase.CROWN_STEAL || this.phase === GamePhase.ALARM) return;
    if (this.phase === GamePhase.LOCKDOWN) this.lockdown.update(safeDelta);
  }

  debugStartSequence() {
    if (this.phase !== GamePhase.INFILTRATION) return false;
    this.holdElapsed = CROWN_HALL_CONFIG.crown.holdDuration;
    this.holdProgress = 1;
    this.startSequence();
    return true;
  }

  debugSetLockdownFinalSeconds() {
    return this.lockdown.debugSetRemaining(5);
  }

  reset() {
    this.sequence.reset();
    this.phase = GamePhase.INFILTRATION;
    this.hasCrown = false;
    this.holdElapsed = 0;
    this.holdProgress = 0;
    this.lockdown.reset();
    this.announcement = '';
    this.announcementRemaining = 0;
    this.lastEvent = 'NONE';
    this.effects.setPlayerLocked(false);
    this.effects.setDisplayOpening(false);
    this.effects.setCrownSpotlight(true);
    this.effects.setAlarm(false);
    this.effects.openGate();
    this.effects.setGuardAlert(false);
    this.effects.setCameraCinematic(false);
    this.effects.setCameraAlert(false);
    this.effects.setLockdownThreatStage('NONE');
  }

  get objective() {
    if (this.phase === GamePhase.CROWN_STEAL) return 'SECURING THE CROWN';
    if (this.phase === GamePhase.ALARM) return 'SECURITY BREACH';
    if (this.phase === GamePhase.LOCKDOWN) return 'SURVIVE LOCKDOWN';
    if (this.phase === GamePhase.ESCAPE) return 'REACH THE EXIT';
    if (this.phase === GamePhase.COMPLETE) return 'HEIST COMPLETE';
    if (this.phase === GamePhase.FAILED) return 'HEIST FAILED';
    return 'STEAL THE CROWN';
  }

  get sequenceTime() {
    return this.sequence.elapsed;
  }

  get lockdownRemaining() {
    return this.lockdown.remaining;
  }

  get lockdownState() {
    return this.lockdown.state;
  }

  get lockdownThreatStage() {
    return this.lockdown.threatStage;
  }

  get isHolding() {
    return this.holdElapsed > 0 && this.phase === GamePhase.INFILTRATION;
  }

  onEvent(listener: (event: GameFlowEvent) => void) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private updateHold(deltaTime: number, ready: boolean, held: boolean, detected: boolean) {
    if (!ready || !held || detected) {
      if (this.holdElapsed > 0) this.cancelHold(detected ? 'STEAL CANCELLED · DETECTED' : 'STEAL CANCELLED');
      return;
    }

    if (this.holdElapsed === 0) {
      this.effects.setPlayerLocked(true);
      this.effects.setDisplayOpening(true);
      this.effects.setCameraCinematic(true);
    }
    this.holdElapsed += deltaTime;
    this.holdProgress = Math.min(1, this.holdElapsed / CROWN_HALL_CONFIG.crown.holdDuration);
    if (this.holdProgress >= 1) this.startSequence();
  }

  private cancelHold(message: string) {
    this.holdElapsed = 0;
    this.holdProgress = 0;
    this.effects.setPlayerLocked(false);
    this.effects.setDisplayOpening(false);
    this.effects.setCameraCinematic(false);
    this.showAnnouncement(message, 'alarm', 1.15);
  }

  private startSequence() {
    this.phase = GamePhase.CROWN_STEAL;
    this.effects.setPlayerLocked(true);
    this.effects.setDisplayOpening(true);
    this.effects.setCameraCinematic(true);
    this.effects.beginSilence();
    this.sequence.start(this.handleSequenceCue);
  }

  private readonly handleSequenceCue = (cue: CrownStealCue) => {
    if (cue === 'TAKE_CROWN') this.effects.beginCrownTake();
    if (cue === 'CROWN_ACQUIRED') {
      this.hasCrown = true;
      this.effects.commitCrownSteal();
      this.showAnnouncement('CROWN SECURED', 'gold', .9);
    }
    if (cue === 'SPOTLIGHT_OFF') this.effects.setCrownSpotlight(false);
    if (cue === 'ALARM_START') {
      this.phase = GamePhase.ALARM;
      this.emitEvent('ALARM_STARTED');
      this.effects.setAlarm(true);
      this.effects.setCameraAlert(true);
      this.showAnnouncement('SECURITY BREACH', 'alarm', 1.35);
    }
    if (cue === 'GATE_CLOSE') this.effects.closeGate();
    if (cue === 'GUARD_ALERT') this.effects.setGuardAlert(true);
    if (cue === 'LOCKDOWN_START') {
      this.lockdown.start();
    }
    if (cue === 'PLAYER_RELEASE') {
      this.effects.setPlayerLocked(false);
      this.effects.setCameraCinematic(false);
    }
  };

  private readonly handleLockdownEvent = (event: LockdownEvent) => {
    if (event.type === 'LOCKDOWN_STARTED') {
      this.phase = GamePhase.LOCKDOWN;
      this.emitEvent('LOCKDOWN_STARTED');
      this.showAnnouncement('LOCKDOWN', 'alarm', 1.2);
    }
    if (event.type === 'THREAT_STAGE_CHANGED') this.effects.setLockdownThreatStage(event.stage);
    if (event.type === 'COUNTDOWN_TICK') this.effects.playLockdownTick(event.seconds);
    if (event.type === 'LOCKDOWN_ENDED') {
      this.emitEvent('LOCKDOWN_ENDED');
      this.effects.openGate();
      this.effects.playLockdownReleased();
    }
    if (event.type === 'ESCAPE_AVAILABLE') {
      this.phase = GamePhase.ESCAPE;
      this.emitEvent('ESCAPE_AVAILABLE');
      this.showAnnouncement('EXIT UNLOCKED', 'clear', 1.7);
    }
  };

  private emitEvent(event: GameFlowEvent) {
    this.lastEvent = event;
    this.eventListeners.forEach(listener => listener(event));
  }

  private showAnnouncement(message: string, tone: 'gold' | 'alarm' | 'clear', duration: number) {
    this.announcement = message;
    this.announcementTone = tone;
    this.announcementRemaining = duration;
  }

  private updateAnnouncement(deltaTime: number) {
    if (this.announcementRemaining <= 0) return;
    this.announcementRemaining -= deltaTime;
    if (this.announcementRemaining <= 0) this.announcement = '';
  }
}
