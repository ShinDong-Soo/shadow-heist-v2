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
    // The player begins outside Crown Hall so the entrance, objective and
    // guard route can be read before committing to the room.
    start: [0, 0, -8.15] as const,
  },
  performance: {
    // 1.15 renders roughly 87% of the CSS resolution on each axis, then lets
    // the browser upscale it to 1080p. This saves pixel work with a small
    // quality tradeoff suitable for the web submission build.
    hardwareScalingLevel: 1.15,
    sampleWindowSeconds: 2,
  },
  scene: {
    groundSize: 22,
    shadowMapSize: 512,
    clearColor: [0.075, 0.105, 0.115, 1] as const,
  },
} as const;
