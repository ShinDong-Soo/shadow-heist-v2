export const GUARD_VISION_CONFIG = {
  range: 8,
  alarmRangeMultiplier: 1.15,
  angle: 90 * Math.PI / 180,
  detectionTime: 1.2,
  detectionDecayTime: 1.8,
  suspiciousThreshold: .35,
  // 15 Hz is enough for a 1.2 second detection ramp and avoids raycasts on
  // every render frame. Distance and angle still reject before LOS picking.
  checkInterval: 1 / 15,
  suspiciousRotationSpeed: 1.35,
  detectedRotationSpeed: 2.3,
} as const;
