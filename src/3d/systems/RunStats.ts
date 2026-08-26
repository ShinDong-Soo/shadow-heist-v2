export type RunSnapshot = {
  elapsedSeconds: number;
  detectedCount: number;
  chaseCount: number;
  collectedLootIds: string[];
  crownSecured: boolean;
};

export class RunStats {
  private elapsedSeconds = 0;
  private detectedCount = 0;
  private chaseCount = 0;
  private collectedLootIds = new Set<string>();
  private crownSecured = false;
  private wasDetected = false;
  private wasChased = false;
  private finished = false;

  update(deltaTime: number, observation: {
    detected: boolean;
    chased: boolean;
    lootIds: readonly string[];
    crownSecured: boolean;
  }) {
    if (this.finished) return;
    this.elapsedSeconds += Math.max(0, deltaTime);
    if (observation.detected && !this.wasDetected) this.detectedCount += 1;
    if (observation.chased && !this.wasChased) this.chaseCount += 1;
    this.wasDetected = observation.detected;
    this.wasChased = observation.chased;
    observation.lootIds.forEach(id => this.collectedLootIds.add(id));
    this.crownSecured ||= observation.crownSecured;
  }

  finish() {
    this.finished = true;
    return this.snapshot;
  }

  reset() {
    this.elapsedSeconds = 0;
    this.detectedCount = 0;
    this.chaseCount = 0;
    this.collectedLootIds.clear();
    this.crownSecured = false;
    this.wasDetected = false;
    this.wasChased = false;
    this.finished = false;
  }

  get snapshot(): RunSnapshot {
    return {
      elapsedSeconds: this.elapsedSeconds,
      detectedCount: this.detectedCount,
      chaseCount: this.chaseCount,
      collectedLootIds: [...this.collectedLootIds],
      crownSecured: this.crownSecured,
    };
  }
}
