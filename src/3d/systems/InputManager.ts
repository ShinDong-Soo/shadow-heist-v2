const MOVEMENT_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const ACTION_CODES = new Set(['KeyE', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC']);
const TAP_GRACE_MS = 140;
const KEY_FALLBACKS: Record<string, string> = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD',
  e: 'KeyE', c: 'KeyC',
  ArrowUp: 'ArrowUp', ArrowLeft: 'ArrowLeft', ArrowDown: 'ArrowDown', ArrowRight: 'ArrowRight',
};

export class InputManager {
  private readonly pressed = new Set<string>();
  private readonly justPressed = new Set<string>();
  private readonly activeUntil = new Map<string, number>();
  private cameraOrbitHeld = false;
  private cameraDragDelta = 0;
  private lastPointerX = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    // Capture on document instead of relying only on window bubbling. This
    // keeps input working when the focus is on the canvas or an IME is active.
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('keyup', this.handleKeyUp, true);
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.handleVisibility);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
  }

  get horizontal() {
    return Number(this.isDown('KeyD', 'ArrowRight')) - Number(this.isDown('KeyA', 'ArrowLeft'));
  }

  get vertical() {
    return Number(this.isDown('KeyW', 'ArrowUp')) - Number(this.isDown('KeyS', 'ArrowDown'));
  }

  consumeCameraTurn() {
    const delta = this.cameraDragDelta;
    this.cameraDragDelta = 0;
    return delta;
  }

  get isCameraOrbiting() {
    return this.cameraOrbitHeld;
  }

  get activeLabel() {
    const active = [...MOVEMENT_CODES].filter(code => this.isDown(code));
    return active.map(code => code.replace('Key', '').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→')).join('+') || 'NONE';
  }

  consumeInteract() {
    const pressed = this.justPressed.has('KeyE');
    this.justPressed.delete('KeyE');
    return pressed;
  }

  get interactHeld() {
    return this.isDown('KeyE');
  }

  get runHeld() {
    return this.isDown('ShiftLeft', 'ShiftRight');
  }

  get crouchHeld() {
    return this.isDown('ControlLeft', 'ControlRight', 'KeyC');
  }

  clearInteractPress() {
    this.justPressed.delete('KeyE');
  }

  private isDown(...codes: string[]) {
    const now = performance.now();
    return codes.some(code => this.pressed.has(code) || (this.activeUntil.get(code) ?? 0) > now);
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    const code = this.resolveCode(event);
    if (!code || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (!this.pressed.has(code)) this.justPressed.add(code);
    this.pressed.add(code);
    // Some embedded browsers deliver a key press as keydown+keyup inside one
    // render frame. Keep a short pulse so the next update can consume it.
    this.activeUntil.set(code, performance.now() + TAP_GRACE_MS);
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    const code = this.resolveCode(event);
    if (!code) return;
    event.preventDefault();
    this.pressed.delete(code);
  };

  private resolveCode(event: KeyboardEvent) {
    if (MOVEMENT_CODES.has(event.code) || ACTION_CODES.has(event.code)) return event.code;
    const fallback = KEY_FALLBACKS[event.key] ?? KEY_FALLBACKS[event.key.toLowerCase()];
    return fallback && (MOVEMENT_CODES.has(fallback) || ACTION_CODES.has(fallback)) ? fallback : null;
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    this.canvas.focus({ preventScroll: true });
    if (event.button !== 2) return;
    event.preventDefault();
    this.cameraOrbitHeld = true;
    this.cameraDragDelta = 0;
    this.lastPointerX = event.clientX;
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.cameraOrbitHeld) return;
    if ((event.buttons & 2) === 0) {
      this.cameraOrbitHeld = false;
      return;
    }
    this.cameraDragDelta += event.clientX - this.lastPointerX;
    this.lastPointerX = event.clientX;
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (event.button === 2 || event.type === 'pointercancel') {
      this.cameraOrbitHeld = false;
    }
  };

  private readonly preventContextMenu = (event: MouseEvent) => event.preventDefault();

  private readonly handleVisibility = () => {
    if (document.hidden) this.reset();
  };

  private readonly reset = () => {
    this.pressed.clear();
    this.justPressed.clear();
    this.activeUntil.clear();
    this.cameraOrbitHeld = false;
    this.cameraDragDelta = 0;
  };

  dispose() {
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('keyup', this.handleKeyUp, true);
    window.removeEventListener('blur', this.reset);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    this.reset();
  }
}
