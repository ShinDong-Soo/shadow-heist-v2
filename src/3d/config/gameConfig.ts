export const GAME_3D_CONFIG = {
  debug: true,
  units: {
    metersPerUnit: 1,
    referenceCharacterHeight: 1.75,
    referenceDoorHeight: 2.1,
  },
  camera: {
    alpha: -Math.PI / 2.35,
    beta: .72,
    fov: 50 * Math.PI / 180,
    targetHeight: .92,
    // The player can move inside this camera-relative area without moving the
    // camera. This removes constant micro-follow corrections near obstacles.
    deadZoneHorizontal: 1.2,
    deadZoneForward: .8,
    lookAhead: .18,
    lookAheadSharpness: 3.5,
    followSharpness: 7,
    distancePresets: {
      near: 7.6,
      medium: 9.4,
      far: 12.2,
    },
  },
  player: {
    height: 1.76,
    radius: .38,
    walkSpeed: 3.35,
    runSpeed: 5.2,
    crouchSpeed: 1.8,
    acceleration: 15,
    deceleration: 21,
    rotationSharpness: 18,
    start: [0, 0, -6.5] as const,
  },
  scene: {
    groundSize: 22,
    shadowMapSize: 1024,
    clearColor: [0.075, 0.105, 0.115, 1] as const,
  },
} as const;
