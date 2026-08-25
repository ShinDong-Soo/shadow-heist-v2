import { GUARD_VISION_CONFIG } from '../config/guardVisionConfig';

export type DetectionState = 'CLEAR' | 'SUSPICIOUS' | 'DETECTED';

export class DetectionSystem {
  value = 0;
  state: DetectionState = 'CLEAR';

  update(visible: boolean, deltaTime: number) {
    if (visible) this.value = Math.min(1, this.value + deltaTime / GUARD_VISION_CONFIG.detectionTime);
    else this.value = Math.max(0, this.value - deltaTime / GUARD_VISION_CONFIG.detectionDecayTime);

    if (this.value >= 1) this.state = 'DETECTED';
    else if (this.value >= GUARD_VISION_CONFIG.suspiciousThreshold) this.state = 'SUSPICIOUS';
    else this.state = 'CLEAR';
  }

  reset() {
    this.value = 0;
    this.state = 'CLEAR';
  }
}
