export type CctvState = 'SCAN' | 'DETECTING' | 'ALERT' | 'COOLDOWN' | 'DISABLED';

export type CctvCamera = {
  id: string;
  name: string;
  x: number;
  y: number;
  facing: number;
  minAngle: number;
  maxAngle: number;
  direction: 1 | -1;
  range: number;
  sweepSpeed: number;
  state: CctvState;
  stateTime: number;
  detection: number;
  disabledTime: number;
  disabledPassRecorded: boolean;
};

export type CctvPanel = {
  id: string;
  name: string;
  cameraId: string;
  x: number;
  y: number;
  used: boolean;
};

export const cctvCameras: CctvCamera[] = [
  { id: 'central-cam', name: '중앙 전시실 CCTV', x: 720, y: 330, facing: .85, minAngle: .35, maxAngle: 1.45, direction: 1, range: 345, sweepSpeed: .42, state: 'SCAN', stateTime: 0, detection: 0, disabledTime: 0, disabledPassRecorded: false },
  { id: 'crown-cam', name: '왕관실 CCTV', x: 1705, y: 90, facing: 2.35, minAngle: 1.75, maxAngle: 2.95, direction: 1, range: 370, sweepSpeed: .36, state: 'SCAN', stateTime: 0, detection: 0, disabledTime: 0, disabledPassRecorded: false },
  { id: 'exit-cam', name: '출구 회랑 CCTV', x: 365, y: 780, facing: 3.15, minAngle: 2.5, maxAngle: 3.8, direction: 1, range: 330, sweepSpeed: .4, state: 'SCAN', stateTime: 0, detection: 0, disabledTime: 0, disabledPassRecorded: false },
];

export const cctvPanels: CctvPanel[] = [
  { id: 'central-panel', name: '중앙 CCTV 제어반', cameraId: 'central-cam', x: 950, y: 335, used: false },
  { id: 'crown-panel', name: '왕관실 CCTV 제어반', cameraId: 'crown-cam', x: 1450, y: 420, used: false },
  { id: 'exit-panel', name: '출구 CCTV 제어반', cameraId: 'exit-cam', x: 395, y: 690, used: false },
];
