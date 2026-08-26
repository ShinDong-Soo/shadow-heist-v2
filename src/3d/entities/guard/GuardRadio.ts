import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export type GuardRadioReport = {
  reporterId: string;
  position: Vector3;
  reason: string;
};

export class GuardRadio {
  private readonly listeners = new Set<(report: GuardRadioReport) => void>();

  report(reporterId: string, position: Vector3, reason = 'PLAYER_REPORTED') {
    const report = { reporterId, position: position.clone(), reason };
    this.listeners.forEach(listener => listener(report));
  }

  subscribe(listener: (report: GuardRadioReport) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear() {
    this.listeners.clear();
  }
}
