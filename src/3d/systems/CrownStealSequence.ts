export type CrownStealCue =
  | 'TAKE_CROWN'
  | 'CROWN_ACQUIRED'
  | 'SPOTLIGHT_OFF'
  | 'ALARM_START'
  | 'GATE_CLOSE'
  | 'GUARD_ALERT'
  | 'LOCKDOWN_START'
  | 'PLAYER_RELEASE';

const CUES: readonly [time: number, cue: CrownStealCue][] = [
  [0, 'TAKE_CROWN'],
  [.3, 'CROWN_ACQUIRED'],
  [.55, 'SPOTLIGHT_OFF'],
  [.75, 'ALARM_START'],
  [.95, 'GATE_CLOSE'],
  [1.05, 'GUARD_ALERT'],
  [1.25, 'LOCKDOWN_START'],
  [1.6, 'PLAYER_RELEASE'],
];

export class CrownStealSequence {
  elapsed = 0;
  active = false;
  private nextCue = 0;

  start(dispatch: (cue: CrownStealCue) => void) {
    if (this.active) return false;
    this.elapsed = 0;
    this.active = true;
    this.nextCue = 0;
    this.dispatchReadyCues(dispatch);
    return true;
  }

  update(deltaTime: number, dispatch: (cue: CrownStealCue) => void) {
    if (!this.active) return;
    this.elapsed += Math.min(deltaTime, .05);
    this.dispatchReadyCues(dispatch);
    if (this.nextCue >= CUES.length) this.active = false;
  }

  reset() {
    this.elapsed = 0;
    this.active = false;
    this.nextCue = 0;
  }

  private dispatchReadyCues(dispatch: (cue: CrownStealCue) => void) {
    while (this.nextCue < CUES.length && this.elapsed >= CUES[this.nextCue][0]) {
      dispatch(CUES[this.nextCue][1]);
      this.nextCue += 1;
    }
  }
}
