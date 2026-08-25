import { CROWN_HALL_CONFIG } from '../config/crownHallConfig';

export type LockdownState = 'INACTIVE' | 'STARTING' | 'ACTIVE' | 'RELEASING' | 'COMPLETE';
export type LockdownThreatStage = 'NONE' | 'CROWN_SWEEP' | 'WEST_SWEEP' | 'EXIT_SWEEP';
export type LockdownEvent =
  | { type: 'LOCKDOWN_STARTED' }
  | { type: 'THREAT_STAGE_CHANGED'; stage: LockdownThreatStage }
  | { type: 'COUNTDOWN_TICK'; seconds: number }
  | { type: 'LOCKDOWN_ENDED' }
  | { type: 'ESCAPE_AVAILABLE' };

export class LockdownSystem {
  state: LockdownState = 'INACTIVE';
  remaining: number = CROWN_HALL_CONFIG.lockdown.duration;
  threatStage: LockdownThreatStage = 'NONE';
  private startElapsed = 0;
  private lastTickSecond = Number.POSITIVE_INFINITY;

  constructor(private readonly emit: (event: LockdownEvent) => void) {}

  start() {
    if (this.state !== 'INACTIVE') return;
    this.state = 'STARTING';
    this.remaining = CROWN_HALL_CONFIG.lockdown.duration;
    this.startElapsed = 0;
    this.lastTickSecond = Number.POSITIVE_INFINITY;
    this.emit({ type: 'LOCKDOWN_STARTED' });
    this.setThreatStage('CROWN_SWEEP');
  }

  update(deltaTime: number) {
    if (this.state !== 'STARTING' && this.state !== 'ACTIVE') return;
    const safeDelta = Math.min(deltaTime, .05);
    if (this.state === 'STARTING') {
      this.startElapsed += safeDelta;
      if (this.startElapsed >= .2) this.state = 'ACTIVE';
    }

    this.remaining = Math.max(0, this.remaining - safeDelta);
    const elapsed = CROWN_HALL_CONFIG.lockdown.duration - this.remaining;
    if (elapsed >= 12) this.setThreatStage('EXIT_SWEEP');
    else if (elapsed >= 6) this.setThreatStage('WEST_SWEEP');

    const wholeSeconds = Math.ceil(this.remaining);
    if (wholeSeconds <= 5 && wholeSeconds > 0 && wholeSeconds !== this.lastTickSecond) {
      this.lastTickSecond = wholeSeconds;
      this.emit({ type: 'COUNTDOWN_TICK', seconds: wholeSeconds });
    }

    if (this.remaining <= 0) this.release();
  }

  reset() {
    this.state = 'INACTIVE';
    this.remaining = CROWN_HALL_CONFIG.lockdown.duration;
    this.threatStage = 'NONE';
    this.startElapsed = 0;
    this.lastTickSecond = Number.POSITIVE_INFINITY;
  }

  debugSetRemaining(seconds: number) {
    if (this.state !== 'STARTING' && this.state !== 'ACTIVE') return false;
    this.remaining = Math.max(.1, Math.min(this.remaining, seconds));
    const elapsed = CROWN_HALL_CONFIG.lockdown.duration - this.remaining;
    if (elapsed >= 12) this.setThreatStage('EXIT_SWEEP');
    else if (elapsed >= 6) this.setThreatStage('WEST_SWEEP');
    return true;
  }

  private release() {
    if (this.state === 'RELEASING' || this.state === 'COMPLETE') return;
    this.state = 'RELEASING';
    this.setThreatStage('NONE');
    this.emit({ type: 'LOCKDOWN_ENDED' });
    this.state = 'COMPLETE';
    this.emit({ type: 'ESCAPE_AVAILABLE' });
  }

  private setThreatStage(stage: LockdownThreatStage) {
    if (this.threatStage === stage) return;
    this.threatStage = stage;
    this.emit({ type: 'THREAT_STAGE_CHANGED', stage });
  }
}
