import type { Engine } from '@babylonjs/core/Engines/engine';

export type GraphicsQuality = 'LOW' | 'MEDIUM' | 'HIGH';

export type GraphicsQualityProfile = {
  label: GraphicsQuality;
  hardwareScalingLevel: number;
  minHardwareScalingLevel: number;
  maxHardwareScalingLevel: number;
  keyShadowMapSize: number;
  flashlightShadowMapSize: number;
  farAnimationInterval: number;
  alarmLightMultiplier: number;
};

const STORAGE_KEY = 'shadow-heist-v2-quality-v1';
const PROFILES: Record<GraphicsQuality, GraphicsQualityProfile> = {
    LOW: {
    label: 'LOW', hardwareScalingLevel: 1.6, minHardwareScalingLevel: 1.45, maxHardwareScalingLevel: 1.9,
    keyShadowMapSize: 512, flashlightShadowMapSize: 512, farAnimationInterval: .12, alarmLightMultiplier: .65,
  },
  MEDIUM: {
    label: 'MEDIUM', hardwareScalingLevel: 1.25, minHardwareScalingLevel: 1.15, maxHardwareScalingLevel: 1.55,
    keyShadowMapSize: 512, flashlightShadowMapSize: 512, farAnimationInterval: .075, alarmLightMultiplier: .82,
  },
  HIGH: {
    label: 'HIGH', hardwareScalingLevel: 1, minHardwareScalingLevel: 1, maxHardwareScalingLevel: 1.35,
    keyShadowMapSize: 1024, flashlightShadowMapSize: 1024, farAnimationInterval: .05, alarmLightMultiplier: 1,
  },
};

let currentQuality: GraphicsQuality = readStoredQuality();

export function getQualityProfile() {
  return PROFILES[currentQuality];
}

export function setGraphicsQuality(engine: Engine, quality: GraphicsQuality, persist = true) {
  currentQuality = quality;
  const profile = PROFILES[quality];
  engine.setHardwareScalingLevel(profile.hardwareScalingLevel);
  engine.resize();
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, quality); } catch { /* restricted storage */ }
  }
  return profile;
}

function readStoredQuality(): GraphicsQuality {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'LOW' || stored === 'HIGH' || stored === 'MEDIUM' ? stored : 'MEDIUM';
  } catch {
    return 'MEDIUM';
  }
}
