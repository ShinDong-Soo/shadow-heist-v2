import { CROWN_HALL_CONFIG } from '../config/crownHallConfig';
import { CrownStealSequence, type CrownStealCue } from '../systems/CrownStealSequence';
import { GamePhase } from './GamePhase';

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
};

export class GameFlowManager {
  phase = GamePhase.INFILTRATION;
  hasCrown = false;
  holdProgress = 0;
  lockdownRemaining: number = CROWN_HALL_CONFIG.lockdown.duration;
  announcement = '';
  announcementTone: 'gold' | 'alarm' | 'clear' = 'gold';
  private readonly sequence = new CrownStealSequence();
  private holdElapsed = 0;
  private announcementRemaining = 0;

  constructor(private readonly effects: GameFlowEffects) {}

  update(deltaTime: number, interactionReady: boolean, interactHeld: boolean, playerDetected: boolean) {
    const safeDelta = Math.min(deltaTime, .05);
    this.updateAnnouncement(safeDelta);

    if (this.sequence.active) this.sequence.update(safeDelta, this.handleSequenceCue);

    if (this.phase === GamePhase.INFILTRATION) {
      this.updateHold(safeDelta, interactionReady, interactHeld, playerDetected);
      return;
    }

    if (this.phase === GamePhase.CROWN_STEAL) return;

    if (this.phase === GamePhase.LOCKDOWN) {
      this.lockdownRemaining = Math.max(0, this.lockdownRemaining - safeDelta);
      if (this.lockdownRemaining <= 0) this.beginEscape();
    }
  }

  debugStartSequence() {
    if (this.phase !== GamePhase.INFILTRATION) return false;
    this.holdElapsed = CROWN_HALL_CONFIG.crown.holdDuration;
    this.holdProgress = 1;
    this.startSequence();
    return true;
  }

  reset() {
    this.sequence.reset();
    this.phase = GamePhase.INFILTRATION;
    this.hasCrown = false;
    this.holdElapsed = 0;
    this.holdProgress = 0;
    this.lockdownRemaining = CROWN_HALL_CONFIG.lockdown.duration;
    this.announcement = '';
    this.announcementRemaining = 0;
    this.effects.setPlayerLocked(false);
    this.effects.setDisplayOpening(false);
    this.effects.setCrownSpotlight(true);
    this.effects.setAlarm(false);
    this.effects.openGate();
    this.effects.setGuardAlert(false);
    this.effects.setCameraCinematic(false);
    this.effects.setCameraAlert(false);
  }

  get objective() {
    if (this.phase === GamePhase.CROWN_STEAL) return 'SECURING THE CROWN';
    if (this.phase === GamePhase.LOCKDOWN) return 'SURVIVE LOCKDOWN';
    if (this.phase === GamePhase.ESCAPE) return 'REACH THE EXIT';
    if (this.phase === GamePhase.COMPLETE) return 'HEIST COMPLETE';
    if (this.phase === GamePhase.FAILED) return 'HEIST FAILED';
    return 'STEAL THE CROWN';
  }

  get sequenceTime() {
    return this.sequence.elapsed;
  }

  get isHolding() {
    return this.holdElapsed > 0 && this.phase === GamePhase.INFILTRATION;
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
      this.effects.setAlarm(true);
      this.effects.setCameraAlert(true);
      this.showAnnouncement('SECURITY BREACH', 'alarm', 1.35);
    }
    if (cue === 'GATE_CLOSE') this.effects.closeGate();
    if (cue === 'GUARD_ALERT') this.effects.setGuardAlert(true);
    if (cue === 'LOCKDOWN_START') {
      this.phase = GamePhase.LOCKDOWN;
      this.lockdownRemaining = CROWN_HALL_CONFIG.lockdown.duration;
      this.showAnnouncement('LOCKDOWN', 'alarm', 1.2);
    }
    if (cue === 'PLAYER_RELEASE') {
      this.effects.setPlayerLocked(false);
      this.effects.setCameraCinematic(false);
    }
  };

  private beginEscape() {
    this.phase = GamePhase.ESCAPE;
    this.effects.openGate();
    this.showAnnouncement('EXIT UNLOCKED', 'clear', 1.7);
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
