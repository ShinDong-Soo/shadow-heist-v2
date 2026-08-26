export const GAME_3D_CONFIG = {
  debug: true,
  units: {
    metersPerUnit: 1,
    referenceCharacterHeight: 1.75,
    referenceDoorHeight: 2.1,
  },
  camera: {
    // The full museum is arranged south-to-north. A cardinal camera keeps W
    // aligned with the visible route, so navigation never becomes the puzzle.
    alpha: -Math.PI / 2,
    beta: .72,
    fov: 50 * Math.PI / 180,
    targetHeight: .92,
    // The player can move inside this camera-relative area without moving the
    // camera. This removes constant micro-follow corrections near obstacles.
    deadZoneHorizontal: 1.2,
    deadZoneForward: .8,
    lookAhead: .18,
    lookAheadSharpness: 3.5,
    // Escape reverses the normal northbound route. A larger directional lead
    // keeps the player above centre and reveals southbound threats first.
    escapeDeadZoneForward: .35,
    escapeLookAhead: 1.7,
    escapeLookAheadSharpness: 8,
    escapeRadiusBonus: 1.2,
    followSharpness: 7,
    distancePresets: {
      near: 7.6,
      medium: 9.4,
      far: 12.2,
    },
  },
  player: {
    height: 1.76,
    crouchHeight: 1.08,
    radius: .38,
    walkSpeed: 3.35,
    runSpeed: 5.2,
    crouchSpeed: 1.8,
    acceleration: 15,
    deceleration: 21,
    rotationSharpness: 18,
    // The player begins outside Crown Hall so the entrance, objective and
    // guard route can be read before committing to the room.
    start: [0, 0, -47] as const,
  },
  performance: {
    // Start at 80% of CSS resolution. The adaptive scaler lowers internal
    // resolution only when sustained FPS is below target, then restores it
    // after performance has recovered.
    hardwareScalingLevel: 1.25,
    minHardwareScalingLevel: 1.15,
    maxHardwareScalingLevel: 1.5,
    hardwareScalingStep: .1,
    scaleDownBelowFps: 50,
    scaleUpAboveFps: 58,
    adaptiveCooldownSeconds: 4,
    missionUiIntervalMs: 50,
    sampleWindowSeconds: 2,
  },
  scene: {
    groundSize: 72,
    shadowMapSize: 512,
    clearColor: [0.075, 0.105, 0.115, 1] as const,
  },
} as const;
