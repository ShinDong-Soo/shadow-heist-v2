export type GuardAIStateId = 'PATROL' | 'SUSPICIOUS' | 'INVESTIGATE' | 'CHASE' | 'SEARCH' | 'RETURN' | 'CAPTURE';

export type GuardAIState = {
  enter?: (previous: GuardAIStateId | null, reason: string) => void;
  update: (deltaTime: number) => void;
  exit?: (next: GuardAIStateId) => void;
};

export type GuardTransition = {
  from: GuardAIStateId | null;
  to: GuardAIStateId;
  reason: string;
};

export class GuardStateMachine {
  current: GuardAIStateId = 'PATROL';
  lastTransition: GuardTransition = { from: null, to: 'PATROL', reason: 'INITIAL' };
  private readonly states = new Map<GuardAIStateId, GuardAIState>();
  private logger: ((transition: GuardTransition) => void) | null = null;
  private updating = false;
  private pending: { state: GuardAIStateId; reason: string } | null = null;

  register(id: GuardAIStateId, state: GuardAIState) {
    this.states.set(id, state);
    return this;
  }

  start(reason = 'INITIAL') {
    this.lastTransition = { from: null, to: this.current, reason };
    this.states.get(this.current)?.enter?.(null, reason);
  }

  update(deltaTime: number) {
    this.updating = true;
    this.states.get(this.current)?.update(deltaTime);
    this.updating = false;
    if (this.pending) {
      const { state, reason } = this.pending;
      this.pending = null;
      this.transition(state, reason);
    }
  }

  transition(next: GuardAIStateId, reason: string) {
    if (this.current === next) return false;
    if (this.updating) {
      this.pending = { state: next, reason };
      return true;
    }
    const previous = this.current;
    this.states.get(previous)?.exit?.(next);
    this.current = next;
    this.lastTransition = { from: previous, to: next, reason };
    this.logger?.(this.lastTransition);
    this.states.get(next)?.enter?.(previous, reason);
    return true;
  }

  setLogger(logger: (transition: GuardTransition) => void) {
    this.logger = logger;
  }

  reset() {
    this.pending = null;
    this.current = 'PATROL';
    this.lastTransition = { from: null, to: 'PATROL', reason: 'RESET' };
    this.states.get(this.current)?.enter?.(null, 'RESET');
  }
}
