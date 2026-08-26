import type { NoiseEvent, NoiseSystem } from '../../systems/NoiseSystem';
import type { Guard } from './Guard';

export class GuardHearing {
  private lastEventId = 0;

  constructor(private readonly guard: Guard) {}

  update(noise: NoiseSystem): NoiseEvent | null {
    const event = noise.getAudibleEvent(this.guard.position, this.lastEventId);
    if (event) this.lastEventId = event.id;
    return event;
  }

  reset() {
    this.lastEventId = 0;
  }
}
