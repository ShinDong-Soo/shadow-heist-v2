export class RunResetManager {
  private transitionTimer = 0;
  private pending: (() => void) | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly resetWorld: () => void,
  ) {}

  request(afterReset: () => void) {
    if (this.pending) return;
    this.pending = afterReset;
    this.transitionTimer = .32;
    this.root.classList.add('run-transition');
  }

  update(deltaTime: number) {
    if (!this.pending) return;
    this.transitionTimer -= deltaTime;
    if (this.transitionTimer > 0) return;
    const finish = this.pending;
    this.pending = null;
    this.resetWorld();
    finish();
    requestAnimationFrame(() => this.root.classList.remove('run-transition'));
  }

  get active() {
    return Boolean(this.pending);
  }
}
