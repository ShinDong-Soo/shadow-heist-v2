export const GUARD_CONFIG = {
  height: 1.88,
  radius: .42,
  patrolSpeed: 1.85,
  rotationSpeed: 2.45,
  pauseTime: .65,
  arrivalRadius: .08,
  flashlight: {
    height: 1.38,
    forwardOffset: .3,
    range: 9,
    angle: 44 * Math.PI / 180,
    intensity: 5.2,
    exponent: 2.2,
    pitch: -.16,
    swayHorizontal: .026,
    swayVertical: .018,
    shadowMapSize: 512,
  },
} as const;

// The route is scene data, not logic inside GuardController. Points form a
// clockwise loop around the upper L/T corridor test area.
export const GUARD_PATROL_ROUTE = [
  [-7.8, 0, 7.8],
  [-1.2, 0, 7.8],
  [-1.2, 0, 5.4],
  [1.5, 0, 5.4],
  [1.5, 0, .2],
  [-1.2, 0, .2],
  [-1.2, 0, 2],
  [-7.8, 0, 2],
] as const;
