export const GUARD_CONFIG = {
  height: 1.88,
  radius: .42,
  patrolSpeed: 1.85,
  alertSpeed: 2.55,
  chaseSpeed: 4.15,
  investigateSpeed: 1.45,
  investigationArrivalRadius: 1.05,
  searchInspectDelay: 1.05,
  searchDuration: 4.2,
  captureDistance: .82,
  rotationSpeed: 2.45,
  pauseTime: .42,
  alertPauseTime: .62,
  arrivalRadius: .08,
  flashlight: {
    height: 1.38,
    forwardOffset: .3,
    // Dark-museum values: the beam must stay readable past the player's local
    // fill so patrol threats appear as approaching cones of light.
    range: 9.2,
    warningRangeMultiplier: 1.3,
    chaseRangeMultiplier: 1.4,
    warningIntensityMultiplier: 1.18,
    angle: 44 * Math.PI / 180,
    intensity: 8.4,
    exponent: 2.05,
    // At hand height this places the brightest ground area roughly 3.5-4.5m
    // ahead instead of near the far edge of the vision range.
    pitch: -.34,
    swayHorizontal: .026,
    swayVertical: .018,
    alertSwayMultiplier: 2.5,
    shadowMapSize: 256,
    shadowRefreshRate: 2,
  },
} as const;
