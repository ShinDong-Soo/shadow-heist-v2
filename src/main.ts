import './style.css';
import { hidingSpots, type HidingSpot } from './hiding';
import { cctvCameras, cctvPanels, type CctvCamera } from './cctv';
import { castVisionRay, hasVisionLine } from './vision';
import { effectiveHearingRadius, movementNoiseProfile, type MovementMode, type NoisePulse } from './noise';
import { doors, keycard, type Door } from './doors';
import { createSupportGuard, supportPatrol, type GuardActor, type GuardState } from './guards';
import { lockdownDuration, type LockdownReason } from './security';
import { createExplorationCells, exploredPercent } from './exploration';
import { BALANCE } from './balance';
import { characterAssets, directionFromAngle, drawCharacterFrame, isCharacterReady, type CharacterDirection } from './character-assets';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Treasure = Point & { id: string; name: string; value: number; color: string; collected: boolean };
type LightSource = Point & { id: string; radius: number; intensity: number; color: string; group: string; on: boolean; defaultOn: boolean; linkedTreasure?: string; emergencyLevel?: number; flicker?: boolean };
type LightSwitch = Point & { id: string; group: string; used: boolean };
type GameState = 'menu' | 'playing' | 'won' | 'caught';
type PlaytestEvent = { time: number; type: string; x: number; y: number };

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const objectiveText = document.querySelector<HTMLElement>('#objectiveText')!;
const statusBadge = document.querySelector<HTMLElement>('#statusBadge')!;
const prompt = document.querySelector<HTMLElement>('#prompt')!;
const startScreen = document.querySelector<HTMLElement>('#startScreen')!;
const resultScreen = document.querySelector<HTMLElement>('#resultScreen')!;
const resultTitle = document.querySelector<HTMLElement>('#resultTitle')!;
const resultMessage = document.querySelector<HTMLElement>('#resultMessage')!;
const resultTime = document.querySelector<HTMLElement>('#resultTime')!;
const resultSpotted = document.querySelector<HTMLElement>('#resultSpotted')!;
const resultDetection = document.querySelector<HTMLElement>('#resultDetection')!;
const resultChase = document.querySelector<HTMLElement>('#resultChase')!;
const resultLoot = document.querySelector<HTMLElement>('#resultLoot')!;
const resultScore = document.querySelector<HTMLElement>('#resultScore')!;
const resultEyebrow = document.querySelector<HTMLElement>('#resultEyebrow')!;
const onboarding = document.querySelector<HTMLElement>('#onboarding')!;
const onboardingStep = document.querySelector<HTMLElement>('#onboardingStep')!;
const onboardingTitle = document.querySelector<HTMLElement>('#onboardingTitle')!;
const onboardingDetail = document.querySelector<HTMLElement>('#onboardingDetail')!;
const onboardingProgress = [...onboarding.querySelectorAll<HTMLElement>('div i')];
const riskDecision = document.querySelector<HTMLElement>('#riskDecision')!;
const riskValue = document.querySelector<HTMLElement>('#riskValue')!;
const riskMultiplier = document.querySelector<HTMLElement>('#riskMultiplier')!;
const lootCount = document.querySelector<HTMLElement>('#lootCount')!;
const scorePreview = document.querySelector<HTMLElement>('#scorePreview')!;
const alertText = document.querySelector<HTMLElement>('#alertText')!;
const alertReadout = document.querySelector<HTMLElement>('.alert-readout')!;
const exposureText = document.querySelector<HTMLElement>('#exposureText')!;
const exposureReadout = document.querySelector<HTMLElement>('.exposure-readout')!;
const cameraWarning = document.querySelector<HTMLElement>('#cameraWarning')!;
const cameraDetection = document.querySelector<HTMLElement>('#cameraDetection')!;
const noiseText = document.querySelector<HTMLElement>('#noiseText')!;
const noiseReadout = document.querySelector<HTMLElement>('.noise-readout')!;
const accessText = document.querySelector<HTMLElement>('#accessText')!;
const securityWarning = document.querySelector<HTMLElement>('#securityWarning')!;
const lockdownTimeText = document.querySelector<HTMLElement>('#lockdownTime')!;
const mapText = document.querySelector<HTMLElement>('#mapText')!;
const devPanel = document.querySelector<HTMLElement>('#devPanel')!;
const devLiveData = document.querySelector<HTMLElement>('#devLiveData')!;
const recentRuns = document.querySelector<HTMLElement>('#recentRuns')!;
const debugPathsInput = document.querySelector<HTMLInputElement>('#debugPaths')!;
const showNoiseWavesInput = document.querySelector<HTMLInputElement>('#showNoiseWaves')!;

const VIEW = { w: 1280, h: 720 };
const WORLD = { w: 1800, h: 1100 };
const GUARD_FOOTSTEP_PATH = `${import.meta.env.BASE_URL}assets/audio/guard-footstep.mp3`;
const GUARD_FOOTSTEP_MAX_DISTANCE = 900;
const fogCanvas = document.createElement('canvas');
fogCanvas.width = WORLD.w;
fogCanvas.height = WORLD.h;
const fogCtx = fogCanvas.getContext('2d')!;
const OUTER = 46;
const PLAYER_RADIUS = 14;
const GUARD_RADIUS = 16;
const PLAYER_ANIMATION = {
  frameCount: 4,
  idleSpeedThreshold: 5,
  strideLength: { normal: 140, careful: 136, crouch: 128 } satisfies Record<MovementMode, number>,
  pivot: 'bottom-center',
} as const;

function guardFootstepLevel(distanceToGuard: number) {
  const proximity = Math.max(0, Math.min(1, 1 - distanceToGuard / GUARD_FOOTSTEP_MAX_DISTANCE));
  return proximity * proximity * (3 - 2 * proximity);
}
const keys = new Set<string>();
const explorationCells = createExplorationCells(WORLD.w, WORLD.h);

const walls: Rect[] = [
  { x: 0, y: 0, w: WORLD.w, h: OUTER }, { x: 0, y: WORLD.h - OUTER, w: WORLD.w, h: OUTER },
  { x: 0, y: 0, w: OUTER, h: WORLD.h }, { x: WORLD.w - OUTER, y: 0, w: OUTER, h: WORLD.h },
  { x: 310, y: 46, w: 32, h: 250 }, { x: 310, y: 420, w: 32, h: 250 }, { x: 310, y: 800, w: 32, h: 254 },
  { x: 650, y: 220, w: 32, h: 255 }, { x: 650, y: 595, w: 32, h: 245 },
  { x: 1010, y: 46, w: 32, h: 205 }, { x: 1010, y: 370, w: 32, h: 285 }, { x: 1010, y: 775, w: 32, h: 279 },
  { x: 1370, y: 46, w: 32, h: 74 }, { x: 1370, y: 210, w: 32, h: 45 },
  { x: 1370, y: 255, w: 32, h: 225 }, { x: 1370, y: 600, w: 32, h: 260 },
  { x: 342, y: 295, w: 190, h: 32 }, { x: 650, y: 840, w: 220, h: 32 },
  { x: 1042, y: 655, w: 190, h: 32 }, { x: 1402, y: 480, w: 352, h: 32 },
  { x: 1160, y: 160, w: 130, h: 52 }, { x: 1510, y: 180, w: 90, h: 190 },
  { x: 430, y: 720, w: 120, h: 70 }, { x: 780, y: 370, w: 110, h: 55 },
];
const explorableCells = explorationCells.filter(cell => !walls.some(wall => cell.x >= wall.x && cell.x <= wall.x + wall.w && cell.y >= wall.y && cell.y <= wall.y + wall.h));

const labels = [
  { x: 125, y: 185, text: '서관' }, { x: 450, y: 180, text: '조각 회랑' },
  { x: 760, y: 150, text: '중앙 전시실' }, { x: 1120, y: 130, text: '보존실' },
  { x: 1450, y: 110, text: '왕관실' }, { x: 1110, y: 970, text: '기록 보관소' },
];

const galleryZones: Rect[] = [
  { x: 72, y: 82, w: 205, h: 250 }, { x: 375, y: 80, w: 230, h: 175 },
  { x: 715, y: 80, w: 245, h: 210 }, { x: 1075, y: 80, w: 250, h: 225 },
  { x: 1430, y: 70, w: 285, h: 365 }, { x: 1085, y: 735, w: 240, h: 270 },
];

let state: GameState = 'menu';
let treasureTaken = false;
let alertLevel = 0;
let lootScore = 0;
let finalScore = 0;
let playerExposure = .12;
let maxExposure = .12;
let brightTime = 0;
let darkTime = 0;
let switchesUsed = 0;
let activeHidingSpot: HidingSpot | null = null;
let hidingTime = 0;
let hideEntries = 0;
let safeHides = 0;
let hideChecks = 0;
let hiddenCaptures = 0;
let noiseInvestigations = 0;
let playerFootsteps = 0;
let heardFootsteps = 0;
let footstepInvestigations = 0;
let doorsOpened = 0;
let doorsClosed = 0;
let lockedAttempts = 0;
let doorNoiseInvestigations = 0;
let supportDetection = 0;
let radioMessages = 0;
let sharedInvestigations = 0;
let radioCooldown = 0;
let exitLockdown = 0;
let lockdownsTriggered = 0;
let lockdownExtensions = 0;
let blockedExitAttempts = 0;
let lockdownSurvivalTime = 0;
let maxLockdownDuration = 0;
let explorationTimer = 0;
let maxExploredPercent = 0;
const exploredCells = new Set<number>();
let devPanelOpen = false;
let debugPaths = false;
let showNoiseWaves = true;
let devPanelTimer = 0;
let currentMovementMode: MovementMode = 'normal';
let carefulWalkTime = 0;
let normalWalkTime = 0;
let crouchTime = 0;
let playerStepTimer = 0;
let playerFrameDistance = 0;
let playerActualSpeed = 0;
const noisePulses: NoisePulse[] = [];
let cctvSightEntries = 0;
let cctvAlerts = 0;
let cctvPanelsUsed = 0;
let disabledPasses = 0;
let cctvBlindTime = 0;
let maxCctvDetection = 0;
let lastCctvAlertAt = -1;
let caughtAfterCctv = -1;
const camerasSeeingPlayer = new Set<string>();
let spottedCount = 0;
let elapsed = 0;
let lastTime = performance.now();
let camera = { x: 0, y: 0 };
let shake = 0;
let detection = 0;
let visualTime = 0;
let stateFlash = 0;
let treasureBeat = 0;
let maxDetection = 0;
let chaseTime = 0;
let closeCalls = 0;
let playtestEvents: PlaytestEvent[] = [];
let onboardingStage = 0;
let onboardingDistance = 0;
let onboardingFinishedAt = -1;
let firstDangerCueAt = -1;
let lastDangerCueAt = -1;
let dangerCuesHeard = 0;
let hesitationAfterCue = 0;
let directionReversalsAfterCue = 0;
let firstDetectionAt = -1;
let firstTreasureAt = -1;
let surpriseCaptures = 0;
let reactionCueActive = false;
let reactionCueFacing = 0;
let reactionCueWasMoving = false;
let reactionCueExpiresAt = 0;
let nextReactionCueAt = 0;
let riskDecisionUntil = 0;
type GuardFeedback = { text: string; tone: 'notice' | 'warning' | 'danger'; expiresAt: number };
const guardFeedback = new Map<string, GuardFeedback>();

const player = { x: 135, y: 940, vx: 0, vy: 0, facing: -Math.PI / 2 };
const treasures: Treasure[] = [
  { id: 'relic', name: '청동 유물', x: 165, y: 145, value: 1000, color: '#9fc5b4', collected: false },
  { id: 'jewel', name: '밤의 보석', x: 885, y: 145, value: 1800, color: '#7fa9d6', collected: false },
  { id: 'crown', name: '황금 왕관', x: 1640, y: 130, value: 3200, color: '#d6ab54', collected: false },
];
const lightSources: LightSource[] = [
  { id: 'relic-spot', x: 165, y: 145, radius: 205, intensity: .9, color: '#d9e7cf', group: 'exhibits', on: true, defaultOn: true, linkedTreasure: 'relic' },
  { id: 'jewel-spot', x: 885, y: 145, radius: 220, intensity: 1, color: '#c6dded', group: 'exhibits', on: true, defaultOn: true, linkedTreasure: 'jewel' },
  { id: 'crown-spot', x: 1640, y: 130, radius: 235, intensity: 1.08, color: '#ffe3a1', group: 'exhibits', on: true, defaultOn: true, linkedTreasure: 'crown' },
  { id: 'west-hall', x: 500, y: 520, radius: 230, intensity: .64, color: '#d8e1d4', group: 'west', on: true, defaultOn: true, flicker: true },
  { id: 'central-hall', x: 845, y: 635, radius: 250, intensity: .72, color: '#d7e4df', group: 'central', on: false, defaultOn: false },
  { id: 'east-hall', x: 1255, y: 530, radius: 245, intensity: .68, color: '#e2dfca', group: 'east', on: true, defaultOn: true },
  { id: 'archive', x: 1180, y: 915, radius: 210, intensity: .55, color: '#cadbd7', group: 'central', on: false, defaultOn: false, flicker: true },
  { id: 'alarm-west', x: 400, y: 750, radius: 185, intensity: .55, color: '#e14f39', group: 'alarm', on: true, defaultOn: true, emergencyLevel: 1 },
  { id: 'alarm-center', x: 960, y: 530, radius: 200, intensity: .62, color: '#e14f39', group: 'alarm', on: true, defaultOn: true, emergencyLevel: 2 },
  { id: 'alarm-east', x: 1460, y: 550, radius: 215, intensity: .72, color: '#e14f39', group: 'alarm', on: true, defaultOn: true, emergencyLevel: 3 },
];
const lightSwitches: LightSwitch[] = [
  { id: 'west-switch', x: 270, y: 365, group: 'west', used: false },
  { id: 'central-switch', x: 730, y: 535, group: 'central', used: false },
  { id: 'east-switch', x: 1325, y: 555, group: 'east', used: false },
];
const hidingCollisionRects = hidingSpots.map(hidingSpotBounds);
const deviceCollisionRects: Rect[] = [
  ...lightSwitches.map(item => ({ x: item.x - 11, y: item.y - 15, w: 22, h: 30 })),
  ...cctvPanels.map(item => ({ x: item.x - 10, y: item.y - 14, w: 20, h: 28 })),
];
const lightPolygonCache = new Map<string, Point[]>();
const exit = { x: 135, y: 990 };
const patrol: Point[] = [
  { x: 530, y: 510 }, { x: 740, y: 520 }, { x: 930, y: 520 }, { x: 930, y: 300 },
  { x: 1200, y: 300 }, { x: 1280, y: 520 }, { x: 1300, y: 610 }, { x: 1300, y: 730 },
  { x: 900, y: 735 }, { x: 900, y: 920 }, { x: 590, y: 930 }, { x: 590, y: 565 },
  { x: 530, y: 565 },
];
const guard: GuardActor = {
  id: 'guard-alpha', name: '경비 알파', x: 530, y: 510, facing: 0, target: 1,
  state: 'PATROL' as GuardState,
  stateTime: 0,
  lostSightTime: 0,
  lastSeen: { x: 0, y: 0 },
  searchOrigin: { x: 0, y: 0 },
  searchStep: 0,
  path: [] as Point[],
  pathIndex: 0,
  pathTarget: { x: 0, y: 0 },
  repathTimer: 0,
  suspectedHideId: null as string | null,
};
const supportGuard = createSupportGuard();

type CharacterMotion = { phase: number; moving: boolean; direction: CharacterDirection };
const playerMotion: CharacterMotion = { phase: 0, moving: false, direction: 'north' };
const guardMotions = new Map<string, CharacterMotion>();

function guardMotionFor(actor: GuardActor) {
  let motion = guardMotions.get(actor.id);
  if (!motion) {
    motion = { phase: 0, moving: false, direction: directionFromAngle(actor.facing) };
    guardMotions.set(actor.id, motion);
  }
  return motion;
}

class AudioEngine {
  context?: AudioContext;
  master?: GainNode;
  limiter?: DynamicsCompressorNode;
  guardFootstep?: AudioBuffer;
  guardStepCursor = [0, 3];
  nextSteps = new Map<string, number>();
  guardLevels = new Map<string, number>();
  nextAlarm = 0;
  nextHum = 0;
  nextCameraMotor = 0;
  nextLockdownPulse = 0;

  start() {
    if (this.context) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.limiter = this.context.createDynamicsCompressor();
    this.master.gain.value = 0.68;
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = .003;
    this.limiter.release.value = .18;
    this.master.connect(this.limiter).connect(this.context.destination);
    void this.loadGuardFootstep();
  }

  async loadGuardFootstep() {
    if (!this.context || this.guardFootstep) return;
    try {
      const response = await fetch(GUARD_FOOTSTEP_PATH);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.guardFootstep = await this.context.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      console.warn('[Shadow Heist] 경비 발소리 파일을 불러오지 못해 합성음을 사용합니다.', error);
    }
  }

  updateGuard(id: string, now: number, distance: number, pan: number, chasing: boolean, occluded: boolean) {
    if (!this.context || !this.master || state !== 'playing') {
      this.guardLevels.set(id, 0);
      return false;
    }
    const audible = guardFootstepLevel(distance);
    const finalLevel = audible * (occluded ? .64 : 1);
    this.guardLevels.set(id, finalLevel);
    const nextStep = this.nextSteps.get(id) ?? 0;
    if (audible <= 0 || now < nextStep) return false;
    const variant = id === 'guard-bravo' ? 1 : 0;
    this.nextSteps.set(id, now + (chasing ? (variant ? 235 : 270) : (variant ? 395 : 450) + distance * .32));
    this.step(finalLevel, pan, chasing, occluded, variant);
    return finalLevel > .08;
  }

  step(volume: number, pan: number, chasing: boolean, occluded: boolean, variant: number) {
    if (!this.context || !this.master) return;
    if (this.guardFootstep) {
      const t = this.context.currentTime;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      const panner = this.context.createStereoPanner();
      const filter = this.context.createBiquadFilter();
      const sliceCount = Math.max(4, Math.min(12, Math.round(this.guardFootstep.duration / .55)));
      const sliceLength = this.guardFootstep.duration / sliceCount;
      const cursor = this.guardStepCursor[variant] % sliceCount;
      const offset = cursor * sliceLength;
      const duration = Math.min(chasing ? .3 : .42, sliceLength, this.guardFootstep.duration - offset);
      this.guardStepCursor[variant] = cursor + (variant ? 2 : 1);
      source.buffer = this.guardFootstep;
      source.playbackRate.value = chasing ? 1.09 : variant ? 1.04 : .96;
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      filter.type = 'lowpass';
      filter.frequency.value = occluded ? 950 : 4200;
      filter.Q.value = occluded ? 1.2 : .45;
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.exponentialRampToValueAtTime(.9 * volume, t + .012);
      gain.gain.setValueAtTime(Math.max(.0001, .68 * volume), t + Math.max(.03, duration - .07));
      gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      source.connect(gain).connect(filter).connect(panner).connect(this.master);
      source.start(t, offset, duration);
      if (variant) {
        const keys = this.context.createOscillator();
        const keyGain = this.context.createGain();
        keys.type = 'sine';
        keys.frequency.setValueAtTime(720, t + .018);
        keys.frequency.exponentialRampToValueAtTime(510, t + .085);
        keyGain.gain.setValueAtTime(.0001, t);
        keyGain.gain.exponentialRampToValueAtTime(.024 * volume, t + .022);
        keyGain.gain.exponentialRampToValueAtTime(.0001, t + .095);
        keys.connect(keyGain).connect(panner);
        keys.start(t + .015); keys.stop(t + .1);
      }
      return;
    }
    const t = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const filter = this.context.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime((chasing ? 75 : 58) + variant * 7, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + .13);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.2 * volume, t + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .18);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    filter.type = 'lowpass';
    filter.frequency.value = occluded ? 420 : 1900;
    filter.Q.value = occluded ? 1.4 : .6;
    osc.connect(gain).connect(filter).connect(panner).connect(this.master);
    osc.start(t); osc.stop(t + .2);
    if (variant) {
      const keys = this.context.createOscillator();
      const keyGain = this.context.createGain();
      keys.type = 'sine';
      keys.frequency.setValueAtTime(720, t + .018);
      keys.frequency.exponentialRampToValueAtTime(510, t + .085);
      keyGain.gain.setValueAtTime(.0001, t);
      keyGain.gain.exponentialRampToValueAtTime(.018 * volume, t + .022);
      keyGain.gain.exponentialRampToValueAtTime(.0001, t + .095);
      keys.connect(keyGain).connect(filter);
      keys.start(t + .015); keys.stop(t + .1);
    }
  }

  cue(next: GuardState) {
    if (!this.context || !this.master || next === 'PATROL') return;
    const frequencies: Record<Exclude<GuardState, 'PATROL'>, number> = {
      SUSPICIOUS: 310, INVESTIGATE: 245, CHASE: 92, SEARCH: 180, HIDE_CHECK: 135,
    };
    const t = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = next === 'CHASE' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(frequencies[next], t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(55, frequencies[next] * .72), t + .28);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(next === 'CHASE' ? .09 : .035, t + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .34);
    osc.connect(gain).connect(this.master); osc.start(t); osc.stop(t + .36);
  }

  updateAlarm(now: number) {
    if (!this.context || !this.master || alertLevel === 0 || state !== 'playing' || now < this.nextAlarm) return;
    this.nextAlarm = now + Math.max(1450, 3100 - alertLevel * 450);
    const t = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine'; osc.frequency.value = 46 + alertLevel * 4;
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.018 + alertLevel * .009, t + .08);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .7);
    osc.connect(gain).connect(this.master); osc.start(t); osc.stop(t + .75);
  }

  updateLightHum(now: number, exposure: number) {
    if (!this.context || !this.master || state !== 'playing' || exposure < .3 || now < this.nextHum) return;
    this.nextHum = now + 1250;
    const t = this.context.currentTime;
    const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = 'sine'; osc.frequency.value = 118;
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.006 * exposure, t + .08); gain.gain.exponentialRampToValueAtTime(.0001, t + .7);
    osc.connect(gain).connect(this.master); osc.start(t); osc.stop(t + .75);
  }

  sting(success: boolean) {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    [0, .13, .26].forEach((delay, i) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = success ? 'sine' : 'sawtooth';
      osc.frequency.value = success ? [220, 277, 330][i] : [150, 110, 70][i];
      gain.gain.setValueAtTime(.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(.07, t + delay + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, t + delay + .28);
      osc.connect(gain).connect(this.master!); osc.start(t + delay); osc.stop(t + delay + .3);
    });
  }

  switchClick(powered: boolean) {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(powered ? 110 : 180, t); osc.frequency.exponentialRampToValueAtTime(powered ? 260 : 65, t + .12);
    gain.gain.setValueAtTime(.035, t); gain.gain.exponentialRampToValueAtTime(.0001, t + .14);
    osc.connect(gain).connect(this.master); osc.start(t); osc.stop(t + .15);
  }

  hideMovement(entering: boolean) {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    const osc = this.context.createOscillator(); const gain = this.context.createGain(); const filter = this.context.createBiquadFilter();
    osc.type = entering ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(entering ? 145 : 105, t);
    osc.frequency.exponentialRampToValueAtTime(entering ? 72 : 190, t + .18);
    filter.type = 'lowpass'; filter.frequency.value = 520;
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.028, t + .025); gain.gain.exponentialRampToValueAtTime(.0001, t + .22);
    osc.connect(gain).connect(filter).connect(this.master); osc.start(t); osc.stop(t + .24);
  }

  hideInspect() {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(82, t); osc.frequency.exponentialRampToValueAtTime(48, t + .3);
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.045, t + .03); gain.gain.exponentialRampToValueAtTime(.0001, t + .34);
    osc.connect(gain).connect(this.master); osc.start(t); osc.stop(t + .36);
  }

  cameraMotor(now: number, proximity: number) {
    if (!this.context || !this.master || state !== 'playing' || proximity <= 0 || now < this.nextCameraMotor) return;
    this.nextCameraMotor = now + 720;
    const t = this.context.currentTime;
    const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(38, t); osc.frequency.linearRampToValueAtTime(54, t + .12);
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.009 * proximity, t + .025); gain.gain.exponentialRampToValueAtTime(.0001, t + .15);
    osc.connect(gain).connect(this.master); osc.start(t); osc.stop(t + .16);
  }

  cameraAlert() {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    [0, .11].forEach(delay => {
      const osc = this.context!.createOscillator(); const gain = this.context!.createGain();
      osc.type = 'square'; osc.frequency.value = 640;
      gain.gain.setValueAtTime(.0001, t + delay); gain.gain.exponentialRampToValueAtTime(.055, t + delay + .01); gain.gain.exponentialRampToValueAtTime(.0001, t + delay + .08);
      osc.connect(gain).connect(this.master!); osc.start(t + delay); osc.stop(t + delay + .09);
    });
  }

  cameraPanel() {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(420, t); osc.frequency.setValueAtTime(220, t + .08);
    gain.gain.setValueAtTime(.035, t); gain.gain.exponentialRampToValueAtTime(.0001, t + .17);
    osc.connect(gain).connect(this.master); osc.start(t); osc.stop(t + .18);
  }

  door(action: 'open' | 'close' | 'locked' | 'keycard') {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    const osc = this.context.createOscillator(); const gain = this.context.createGain(); const filter = this.context.createBiquadFilter();
    osc.type = action === 'locked' ? 'square' : action === 'keycard' ? 'sine' : 'triangle';
    const start = action === 'open' ? 78 : action === 'close' ? 112 : action === 'locked' ? 54 : 620;
    const end = action === 'open' ? 145 : action === 'close' ? 52 : action === 'locked' ? 42 : 920;
    osc.frequency.setValueAtTime(start, t); osc.frequency.exponentialRampToValueAtTime(end, t + .16);
    filter.type = 'lowpass'; filter.frequency.value = action === 'keycard' ? 1800 : 650;
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(action === 'locked' ? .028 : .04, t + .012); gain.gain.exponentialRampToValueAtTime(.0001, t + .2);
    osc.connect(gain).connect(filter).connect(this.master); osc.start(t); osc.stop(t + .22);
  }

  radio() {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    [0, .07, .18].forEach((delay, index) => {
      const osc = this.context!.createOscillator(); const gain = this.context!.createGain();
      osc.type = 'square'; osc.frequency.value = [880, 620, 760][index];
      gain.gain.setValueAtTime(.0001, t + delay); gain.gain.exponentialRampToValueAtTime(.018, t + delay + .008); gain.gain.exponentialRampToValueAtTime(.0001, t + delay + .045);
      osc.connect(gain).connect(this.master!); osc.start(t + delay); osc.stop(t + delay + .055);
    });
  }

  securityCue(unlocked: boolean) {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    const notes = unlocked ? [330, 495] : [190, 125];
    notes.forEach((frequency, index) => {
      const osc = this.context!.createOscillator(); const gain = this.context!.createGain();
      osc.type = unlocked ? 'sine' : 'sawtooth'; osc.frequency.value = frequency;
      const at = t + index * .14;
      gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(unlocked ? .035 : .05, at + .015); gain.gain.exponentialRampToValueAtTime(.0001, at + .18);
      osc.connect(gain).connect(this.master!); osc.start(at); osc.stop(at + .2);
    });
  }

  lockdownPulse(now: number, remaining: number) {
    if (!this.context || !this.master || remaining <= 0 || now < this.nextLockdownPulse) return;
    this.nextLockdownPulse = now + (remaining < 4 ? 520 : 900);
    const t = this.context.currentTime; const osc = this.context.createOscillator(); const gain = this.context.createGain();
    osc.type = 'square'; osc.frequency.value = remaining < 4 ? 510 : 390;
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.018, t + .008); gain.gain.exponentialRampToValueAtTime(.0001, t + .07);
    osc.connect(gain).connect(this.master); osc.start(t); osc.stop(t + .08);
  }

  playerStep(mode: MovementMode) {
    if (!this.context || !this.master) return;
    const careful = mode !== 'normal';
    const crouching = mode === 'crouch';
    const t = this.context.currentTime;
    const osc = this.context.createOscillator(); const gain = this.context.createGain(); const filter = this.context.createBiquadFilter();
    osc.type = careful ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(crouching ? 82 : careful ? 105 : 135, t);
    osc.frequency.exponentialRampToValueAtTime(crouching ? 48 : careful ? 62 : 48, t + .09);
    filter.type = 'lowpass'; filter.frequency.value = crouching ? 380 : careful ? 520 : 900;
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(crouching ? .005 : careful ? .009 : .022, t + .008); gain.gain.exponentialRampToValueAtTime(.0001, t + .11);
    osc.connect(gain).connect(filter).connect(this.master); osc.start(t); osc.stop(t + .12);
  }
}
const audio = new AudioEngine();

function collectedTreasureCount() { return treasures.filter(item => item.collected).length; }

function currentTake() {
  return Math.round(lootScore * BALANCE.scoring.lootMultipliers[collectedTreasureCount()]);
}

function calculateFinalScore(won: boolean) {
  if (!won) return 0;
  const speedBonus = Math.max(0, Math.round(BALANCE.scoring.speedBonusStart - elapsed * BALANCE.scoring.speedPenaltyPerSecond));
  const stealthBonus = spottedCount === 0 ? BALANCE.scoring.perfectStealthBonus : Math.max(0, 500 - spottedCount * 200);
  return currentTake() + speedBonus + stealthBonus;
}

function updateMissionHud() {
  const count = collectedTreasureCount();
  lootCount.textContent = `${count} / ${treasures.length}`;
  scorePreview.textContent = currentTake().toLocaleString('ko-KR');
  alertText.textContent = `LEVEL ${alertLevel}`;
  alertReadout.className = `alert-readout level-${alertLevel}`;
}

function updateExposureHud() {
  const tone = playerExposure < .28 ? 'dark' : playerExposure < .6 ? 'dim' : playerExposure < .9 ? 'visible' : 'exposed';
  exposureText.textContent = tone === 'dark' ? '어두움' : tone === 'dim' ? '희미함' : tone === 'visible' ? '노출됨' : '매우 밝음';
  exposureReadout.className = `exposure-readout ${tone}`;
}

function updateNoiseHud(mode: MovementMode, moving: boolean) {
  const tone = !moving ? 'silent' : mode === 'crouch' ? 'crouch' : mode === 'careful' ? 'quiet' : 'loud';
  noiseText.textContent = tone === 'silent' ? '정지' : tone === 'crouch' ? '웅크림' : tone === 'quiet' ? '조용함' : '발소리';
  noiseReadout.className = `noise-readout ${tone}`;
}

const onboardingMessages = [
  { title: '어둠 속에서 이동하세요', detail: '<b>WASD</b> 또는 방향키로 출구에서 벗어나세요.' },
  { title: '발소리를 줄이세요', detail: '<b>SHIFT</b> 조심 걷기 또는 <b>C</b> 웅크리기를 잠시 사용하세요.' },
  { title: '경비의 위치를 들으세요', detail: '왼쪽 아래 발소리 표시의 방향과 거리를 확인하세요.' },
  { title: '첫 보물을 확보하세요', detail: '빛과 벽을 이용해 경비 시야를 피하고 <b>E</b>로 훔치세요.' },
  { title: '지금 탈출할 수 있습니다', detail: '더 훔치면 점수는 오르지만 <b>발소리와 경계</b>도 커집니다.' },
];

function updateOnboarding() {
  if (onboardingStage === 0 && onboardingDistance >= 70) onboardingStage = 1;
  if (onboardingStage === 1 && carefulWalkTime + crouchTime >= .9) onboardingStage = 2;
  if (onboardingStage === 2 && firstDangerCueAt >= 0) onboardingStage = 3;
  if (onboardingStage === 3 && firstTreasureAt >= 0) {
    onboardingStage = 4;
    onboardingFinishedAt = elapsed;
    logPlaytestEvent('onboarding:complete');
  }
  const finished = onboardingStage === 4;
  onboarding.classList.toggle('hidden', state !== 'playing' || finished);
  onboarding.classList.toggle('risk', onboardingStage === 4);
  const message = onboardingMessages[onboardingStage];
  onboardingStep.textContent = onboardingStage === 4 ? 'RISK / REWARD' : `STEP ${onboardingStage + 1} / 4`;
  onboardingTitle.textContent = message.title;
  onboardingDetail.innerHTML = message.detail;
  onboardingProgress.forEach((item, index) => item.classList.toggle('active', index <= Math.min(3, onboardingStage)));
}

function showRiskDecision() {
  const nextCount = Math.min(treasures.length, collectedTreasureCount() + 1);
  riskValue.textContent = currentTake().toLocaleString('ko-KR');
  riskMultiplier.textContent = `×${BALANCE.scoring.lootMultipliers[nextCount].toFixed(2)}`;
  riskDecisionUntil = elapsed + 3.2;
  riskDecision.classList.remove('hidden');
}

function updateRiskDecision() {
  const urgentThreat = guard.state === 'CHASE' || supportGuard.state === 'CHASE' || detection >= .72 || supportDetection >= .72;
  riskDecision.classList.toggle('hidden', state !== 'playing' || elapsed >= riskDecisionUntil || urgentThreat);
}

function recordDangerCue(playerMoving: boolean) {
  dangerCuesHeard++;
  lastDangerCueAt = elapsed;
  if (firstDangerCueAt < 0) {
    firstDangerCueAt = elapsed;
    logPlaytestEvent('tension:first-danger-cue');
  }
  if (elapsed < nextReactionCueAt || reactionCueActive) return;
  reactionCueActive = true;
  reactionCueFacing = player.facing;
  reactionCueWasMoving = playerMoving;
  reactionCueExpiresAt = elapsed + 2.4;
  nextReactionCueAt = elapsed + 3;
}

function updateDangerReaction(playerMoving: boolean) {
  if (!reactionCueActive) return;
  if (reactionCueWasMoving && !playerMoving) {
    hesitationAfterCue++;
    reactionCueActive = false;
    logPlaytestEvent('tension:hesitation-after-cue');
  } else if (playerMoving && Math.abs(angleDelta(player.facing, reactionCueFacing)) > 1.7) {
    directionReversalsAfterCue++;
    reactionCueActive = false;
    logPlaytestEvent('tension:direction-reversal');
  } else if (elapsed >= reactionCueExpiresAt) reactionCueActive = false;
}

function showGuardFeedback(actor: GuardActor, text: string, tone: GuardFeedback['tone']) {
  guardFeedback.set(actor.id, { text, tone, expiresAt: elapsed + 1.9 });
}

function triggerExitLockdown(reason: LockdownReason) {
  const duration = lockdownDuration(reason, alertLevel);
  if (exitLockdown > 0) {
    if (duration <= exitLockdown) return;
    lockdownExtensions++;
  } else lockdownsTriggered++;
  exitLockdown = Math.max(exitLockdown, duration);
  maxLockdownDuration = Math.max(maxLockdownDuration, exitLockdown);
  securityWarning.classList.remove('hidden');
  objectiveText.textContent = '출구 봉쇄 — 경비를 피해 버티세요';
  audio.securityCue(false);
  stateFlash = Math.max(stateFlash, .5);
  logPlaytestEvent(`lockdown:start:${reason}`);
}

function updateExitLockdown(dt: number, now: number) {
  if (exitLockdown <= 0) return;
  const before = exitLockdown;
  exitLockdown = Math.max(0, exitLockdown - dt);
  lockdownSurvivalTime += dt;
  lockdownTimeText.textContent = `${exitLockdown.toFixed(1)}s`;
  audio.lockdownPulse(now, exitLockdown);
  if (before > 0 && exitLockdown === 0) {
    securityWarning.classList.add('hidden');
    objectiveText.textContent = collectedTreasureCount() === treasures.length ? '모든 보물 확보 — 출구로 탈출하세요' : '출구 봉쇄 해제 — 지금 탈출할 수 있습니다';
    audio.securityCue(true);
    logPlaytestEvent('lockdown:released');
  }
}

function resetGame() {
  player.x = 135; player.y = 940; player.vx = 0; player.vy = 0; player.facing = -Math.PI / 2;
  guard.x = 530; guard.y = 510; guard.facing = 0; guard.target = 1; guard.state = 'PATROL';
  guard.stateTime = 0; guard.lostSightTime = 0; guard.searchStep = 0;
  guard.path = []; guard.pathIndex = 0; guard.repathTimer = 0; guard.suspectedHideId = null;
  const freshSupport = createSupportGuard(); Object.assign(supportGuard, freshSupport);
  playerMotion.phase = 0; playerMotion.moving = false; playerMotion.direction = 'north';
  playerFrameDistance = 0; playerActualSpeed = 0;
  guardMotions.clear(); guardMotionFor(guard); guardMotionFor(supportGuard);
  audio.nextAlarm = 0; audio.nextHum = 0; audio.nextCameraMotor = 0; audio.nextSteps.clear(); audio.guardLevels.clear();
  treasures.forEach(item => { item.collected = false; });
  lightSources.forEach(light => { light.on = light.defaultOn; });
  lightSwitches.forEach(item => { item.used = false; });
  cctvCameras.forEach(camera => {
    camera.facing = (camera.minAngle + camera.maxAngle) / 2; camera.direction = 1; camera.state = 'SCAN';
    camera.stateTime = 0; camera.detection = 0; camera.disabledTime = 0; camera.disabledPassRecorded = false;
  });
  cctvPanels.forEach(panel => { panel.used = false; });
  doors.forEach(door => { door.open = door.defaultOpen; });
  keycard.collected = false;
  lightPolygonCache.clear();
  treasureTaken = false; alertLevel = 0; lootScore = 0; finalScore = 0;
  playerExposure = .12;
  maxExposure = .12; brightTime = 0; darkTime = 0; switchesUsed = 0;
  activeHidingSpot = null; hidingTime = 0; hideEntries = 0; safeHides = 0;
  hideChecks = 0; hiddenCaptures = 0; noiseInvestigations = 0;
  playerFootsteps = 0; heardFootsteps = 0; footstepInvestigations = 0; carefulWalkTime = 0; normalWalkTime = 0; crouchTime = 0;
  doorsOpened = 0; doorsClosed = 0; lockedAttempts = 0; doorNoiseInvestigations = 0;
  supportDetection = 0; radioMessages = 0; sharedInvestigations = 0; radioCooldown = 0;
  exitLockdown = 0; lockdownsTriggered = 0; lockdownExtensions = 0; blockedExitAttempts = 0;
  lockdownSurvivalTime = 0; maxLockdownDuration = 0; audio.nextLockdownPulse = 0;
  explorationTimer = 0; maxExploredPercent = 0; exploredCells.clear();
  playerStepTimer = 0; noisePulses.length = 0;
  cctvSightEntries = 0; cctvAlerts = 0; cctvPanelsUsed = 0; disabledPasses = 0;
  cctvBlindTime = 0; maxCctvDetection = 0; lastCctvAlertAt = -1; caughtAfterCctv = -1; camerasSeeingPlayer.clear();
  spottedCount = 0; elapsed = 0; detection = 0; shake = 0;
  stateFlash = 0; treasureBeat = 0;
  maxDetection = 0; chaseTime = 0; closeCalls = 0; playtestEvents = [];
  onboardingStage = 0; onboardingDistance = 0; onboardingFinishedAt = -1;
  firstDangerCueAt = -1; lastDangerCueAt = -1; dangerCuesHeard = 0;
  hesitationAfterCue = 0; directionReversalsAfterCue = 0; firstDetectionAt = -1; firstTreasureAt = -1; surpriseCaptures = 0;
  reactionCueActive = false; reactionCueFacing = player.facing; reactionCueWasMoving = false; reactionCueExpiresAt = 0; nextReactionCueAt = 0;
  riskDecisionUntil = 0; riskDecision.classList.add('hidden');
  guardFeedback.clear();
  objectiveText.textContent = '보물을 훔치고 살아서 돌아오세요';
  setStatus('미탐지', false);
  updateMissionHud();
  updateExposureHud();
  updateNoiseHud('normal', false);
  accessText.textContent = '없음';
  mapText.textContent = '0%';
  cameraWarning.classList.add('hidden'); cameraWarning.classList.remove('alert');
  securityWarning.classList.add('hidden');
  updateOnboarding();
}

function startGame() {
  audio.start(); resetGame(); state = 'playing'; lastTime = performance.now();
  startScreen.classList.remove('visible'); resultScreen.classList.remove('visible');
}

function finishGame(won: boolean) {
  state = won ? 'won' : 'caught';
  onboarding.classList.add('hidden');
  riskDecision.classList.add('hidden');
  if (!won && (lastDangerCueAt < 0 || elapsed - lastDangerCueAt > 4) && firstDetectionAt >= 0 && elapsed - firstDetectionAt < 1.5) surpriseCaptures++;
  if (!won && lastCctvAlertAt >= 0) caughtAfterCctv = elapsed - lastCctvAlertAt;
  finalScore = calculateFinalScore(won);
  logPlaytestEvent(won ? 'result:escaped' : 'result:caught');
  resultEyebrow.textContent = won ? 'MISSION REPORT // CLEAN EXIT' : 'MISSION REPORT // COMPROMISED';
  resultTitle.textContent = won ? 'HEIST COMPLETE' : 'CAUGHT';
  resultTitle.style.color = won ? '#d6ab54' : '#ef573f';
  const count = collectedTreasureCount();
  resultMessage.textContent = won ? `${count}개의 보물을 확보하고 무사히 어둠 속으로 사라졌습니다.` : `보물 ${count}개와 ${currentTake().toLocaleString('ko-KR')}점을 모두 잃었습니다.`;
  resultLoot.textContent = `${count} / ${treasures.length}`;
  resultScore.textContent = finalScore.toLocaleString('ko-KR');
  resultTime.textContent = formatTime(elapsed); resultSpotted.textContent = String(spottedCount);
  resultDetection.textContent = `${Math.round(maxDetection * 100)}%`;
  resultChase.textContent = `${chaseTime.toFixed(1)}s`;
  savePlaytestRun(won);
  resultScreen.classList.add('visible'); audio.sting(won);
}

function savePlaytestRun(won: boolean) {
  const run = {
    version: 'prototype-27',
    finishedAt: new Date().toISOString(),
    result: won ? 'escaped' : 'caught',
    duration: Number(elapsed.toFixed(2)),
    spottedCount,
    maxDetection: Number(maxDetection.toFixed(2)),
    chaseTime: Number(chaseTime.toFixed(2)),
    closeCalls,
    treasureTaken,
    lootCount: collectedTreasureCount(),
    alertLevel,
    lootScore,
    finalScore,
    maxExposure: Number(maxExposure.toFixed(2)),
    brightTime: Number(brightTime.toFixed(2)),
    darkTime: Number(darkTime.toFixed(2)),
    switchesUsed,
    hidingTime: Number(hidingTime.toFixed(2)),
    hideEntries,
    safeHides,
    hideChecks,
    hiddenCaptures,
    noiseInvestigations,
    playerFootsteps,
    heardFootsteps,
    footstepInvestigations,
    carefulWalkTime: Number(carefulWalkTime.toFixed(2)),
    normalWalkTime: Number(normalWalkTime.toFixed(2)),
    crouchTime: Number(crouchTime.toFixed(2)),
    hasKeycard: keycard.collected,
    doorsOpened,
    doorsClosed,
    lockedAttempts,
    doorNoiseInvestigations,
    radioMessages,
    sharedInvestigations,
    lockdownsTriggered,
    lockdownExtensions,
    blockedExitAttempts,
    lockdownSurvivalTime: Number(lockdownSurvivalTime.toFixed(2)),
    maxLockdownDuration: Number(maxLockdownDuration.toFixed(2)),
    lockdownRemaining: Number(exitLockdown.toFixed(2)),
    caughtDuringLockdown: !won && exitLockdown > 0,
    exploredPercent: maxExploredPercent,
    cctvSightEntries,
    cctvAlerts,
    cctvPanelsUsed,
    disabledPasses,
    cctvBlindTime: Number(cctvBlindTime.toFixed(2)),
    maxCctvDetection: Number(maxCctvDetection.toFixed(2)),
    caughtAfterCctv: caughtAfterCctv < 0 ? null : Number(caughtAfterCctv.toFixed(2)),
    onboardingStage,
    onboardingCompleted: onboardingStage === 4,
    firstDangerCueAt: firstDangerCueAt < 0 ? null : Number(firstDangerCueAt.toFixed(2)),
    dangerCuesHeard,
    hesitationAfterCue,
    directionReversalsAfterCue,
    firstDetectionAt: firstDetectionAt < 0 ? null : Number(firstDetectionAt.toFixed(2)),
    firstTreasureAt: firstTreasureAt < 0 ? null : Number(firstTreasureAt.toFixed(2)),
    surpriseCaptures,
    treasures: treasures.filter(item => item.collected).map(item => item.id),
    events: playtestEvents,
  };
  try {
    const history = JSON.parse(localStorage.getItem('shadow-heist-playtests') ?? '[]') as unknown[];
    localStorage.setItem('shadow-heist-playtests', JSON.stringify([...history.slice(-11), run]));
  } catch {
    // A blocked storage setting should never stop a run from ending.
  }
  console.info('[Shadow Heist playtest]', run);
  if (devPanelOpen) renderRecentRuns();
}

function loadPlaytestRuns(): Record<string, unknown>[] {
  try {
    const value = JSON.parse(localStorage.getItem('shadow-heist-playtests') ?? '[]');
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function renderRecentRuns() {
  recentRuns.replaceChildren();
  const runs = loadPlaytestRuns().slice(-5).reverse();
  if (!runs.length) {
    const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = '저장된 플레이 기록이 없습니다.'; recentRuns.append(empty); return;
  }
  runs.forEach(run => {
    const item = document.createElement('article');
    const result = document.createElement('b');
    const details = document.createElement('span');
    result.textContent = run.result === 'escaped' ? '탈출 성공' : '체포';
    const duration = typeof run.duration === 'number' ? formatTime(run.duration) : '--:--';
    const loot = typeof run.lootCount === 'number' ? run.lootCount : 0;
    const score = typeof run.finalScore === 'number' ? run.finalScore.toLocaleString('ko-KR') : '0';
    details.textContent = `${duration} · 보물 ${loot} · ${score}점`;
    item.append(result, details); recentRuns.append(item);
  });
}

function updateDevPanel(force = false) {
  if (!devPanelOpen) return;
  if (!force && devPanelTimer > 0) return;
  devPanelTimer = .15;
  const noise = movementNoiseProfile(currentMovementMode, collectedTreasureCount());
  devLiveData.textContent = [
    `GAME     ${state.toUpperCase()}  ${formatTime(elapsed)}`,
    `PLAYER   ${Math.round(player.x)}, ${Math.round(player.y)}  ${currentMovementMode.toUpperCase()}`,
    `MOTION   ${playerActualSpeed.toFixed(1)}px/s  STEP ${playerFrameDistance.toFixed(2)}px`,
    `ANIM     ${playerMotion.direction.toUpperCase()}  PHASE ${playerMotion.phase.toFixed(2)}  FRAME ${playerMotion.moving ? Math.floor(playerMotion.phase) % PLAYER_ANIMATION.frameCount : 0}`,
    `PIVOT    ${PLAYER_ANIMATION.pivot.toUpperCase()}  ${Math.round(player.x)}, ${Math.round(player.y)}`,
    `AUDIO    ALPHA ${Math.round((audio.guardLevels.get(guard.id) ?? 0) * 100)}%  BRAVO ${Math.round((audio.guardLevels.get(supportGuard.id) ?? 0) * 100)}%`,
    `EXPOSURE ${Math.round(playerExposure * 100)}%  NOISE ${noise.radius}px`,
    `ALPHA    ${guard.state}  ${Math.round(detection * 100)}%`,
    `BRAVO    ${supportGuard.state}  ${Math.round(supportDetection * 100)}%`,
    `ALERT    ${alertLevel}  CCTV ${camerasSeeingPlayer.size}`,
    `MAP      ${maxExploredPercent}%  LOCK ${exitLockdown.toFixed(1)}s`,
    `RADIO    ${radioMessages}  LOOT ${collectedTreasureCount()}/${treasures.length}`,
    `TENSION  CUE ${dangerCuesHeard}  STOP ${hesitationAfterCue}  TURN ${directionReversalsAfterCue}`,
    `TIMING   DANGER ${firstDangerCueAt < 0 ? '-' : firstDangerCueAt.toFixed(1)}s  LOOT ${firstTreasureAt < 0 ? '-' : firstTreasureAt.toFixed(1)}s`,
  ].join('\n');
}

function toggleDevPanel(open = !devPanelOpen) {
  devPanelOpen = open;
  devPanel.classList.toggle('visible', open);
  devPanel.setAttribute('aria-hidden', String(!open));
  if (open) { renderRecentRuns(); updateDevPanel(true); }
}

function exportPlaytestRuns() {
  const blob = new Blob([JSON.stringify(loadPlaytestRuns(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `shadow-heist-playtests-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function clearPlaytestRuns() {
  localStorage.removeItem('shadow-heist-playtests');
  renderRecentRuns();
}

function setStatus(_text: string, danger: boolean, warning = false) {
  statusBadge.querySelector('span')!.textContent = danger ? '발각' : warning ? '위험 감지' : '미탐지';
  statusBadge.classList.toggle('danger', danger);
  statusBadge.classList.toggle('warning', warning);
}

function circleIntersectsRect(point: Point, r: number, rect: Rect) {
  const nx = Math.max(rect.x, Math.min(point.x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(point.y, rect.y + rect.h));
  return (point.x - nx) ** 2 + (point.y - ny) ** 2 < r ** 2;
}

function hidingSpotBounds(spot: HidingSpot): Rect {
  return { x: spot.x - spot.width / 2, y: spot.y - spot.height / 2, w: spot.width, h: spot.height };
}

function hidingEntryPoint(spot: HidingSpot, padding = PLAYER_RADIUS + 22): Point {
  if (spot.entry === 'north') return { x: spot.x, y: spot.y - spot.height / 2 - padding };
  if (spot.entry === 'south') return { x: spot.x, y: spot.y + spot.height / 2 + padding };
  if (spot.entry === 'west') return { x: spot.x - spot.width / 2 - padding, y: spot.y };
  return { x: spot.x + spot.width / 2 + padding, y: spot.y };
}

function collidesCircle(x: number, y: number, r: number) {
  const point = { x, y };
  return visionBlockers().some(rect => circleIntersectsRect(point, r, rect))
    || hidingCollisionRects.some(rect => circleIntersectsRect(point, r, rect))
    || deviceCollisionRects.some(rect => circleIntersectsRect(point, r, rect));
}

function collidesActorSilhouette(x: number, y: number, r: number) {
  if (collidesCircle(x, y, r)) return true;
  const solidArchitecture = visionBlockers();
  const upperBodyProbes = [
    { x, y: y - 30, radius: r * .85 },
    { x, y: y - 52, radius: r * .65 },
  ];
  return upperBodyProbes.some(probe => solidArchitecture.some(rect => circleIntersectsRect(probe, probe.radius, rect)));
}

function moveEntity(entity: { x: number; y: number }, dx: number, dy: number, r: number) {
  if (!collidesActorSilhouette(entity.x + dx, entity.y, r)) entity.x += dx;
  if (!collidesActorSilhouette(entity.x, entity.y + dy, r)) entity.y += dy;
}

function visionBlockers(): Rect[] { return [...walls, ...doors.filter(door => !door.open)]; }
function hasLineOfSight(a: Point, b: Point) { return hasVisionLine(a, b, visionBlockers()); }
function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleDelta(a: number, b: number) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }

function isLightActive(light: LightSource) {
  if (!light.on) return false;
  if (light.emergencyLevel && alertLevel < light.emergencyLevel) return false;
  if (light.linkedTreasure && treasures.find(item => item.id === light.linkedTreasure)?.collected) return false;
  return true;
}

function lightFlicker(light: LightSource) {
  if (!light.flicker) return 1;
  const wave = Math.sin(visualTime * 17 + light.x) * Math.sin(visualTime * 6.7 + light.y);
  return wave > .78 ? .28 : .88 + Math.sin(visualTime * 3.1) * .08;
}

function lightLevelAt(point: Point) {
  let level = .1;
  for (const light of lightSources) {
    if (!isLightActive(light)) continue;
    const d = distance(point, light);
    if (d >= light.radius || !hasLineOfSight(point, light)) continue;
    const falloff = 1 - d / light.radius;
    level += light.intensity * falloff * falloff * lightFlicker(light);
  }
  return Math.max(.08, Math.min(1.15, level));
}

function currentPlayerVision() {
  if (activeHidingSpot) return 125;
  return BALANCE.player.minimumVision + playerExposure * 112 - (keys.has('c') ? BALANCE.player.crouchVisionPenalty : 0);
}

function updateExploration(dt: number) {
  explorationTimer -= dt;
  if (explorationTimer > 0) return;
  explorationTimer = .18;
  const radius = currentPlayerVision() * .94;
  explorableCells.forEach(cell => {
    if (exploredCells.has(cell.id) || distance(player, cell) > radius) return;
    if (hasLineOfSight(player, cell)) exploredCells.add(cell.id);
  });
  const percent = exploredPercent(exploredCells.size, explorableCells.length);
  maxExploredPercent = Math.max(maxExploredPercent, percent);
  mapText.textContent = `${percent}%`;
}

function playerConcealmentMultiplier() { return keys.has('c') && !activeHidingSpot ? BALANCE.player.crouchDetectionMultiplier : 1; }

function actorCanSeePoint(actor: GuardActor, point: Point, exposure = playerExposure) {
  const chaseVision = actor.state === 'CHASE';
  const range = ((chaseVision ? BALANCE.guard.chaseVision : BALANCE.guard.patrolVision) + alertLevel * 18) * (.68 + exposure * .55) * playerConcealmentMultiplier();
  const angle = chaseVision ? BALANCE.guard.chaseVisionAngle : BALANCE.guard.patrolVisionAngle;
  const direction = Math.atan2(point.y - actor.y, point.x - actor.x);
  return distance(actor, point) < range && Math.abs(angleDelta(direction, actor.facing)) < angle && hasLineOfSight(actor, point);
}

function guardCanSeePoint(point: Point, exposure = playerExposure) { return actorCanSeePoint(guard, point, exposure); }

function beginHideCheck(spot: HidingSpot) {
  guard.suspectedHideId = spot.id;
  guard.lastSeen = { x: spot.x, y: spot.y };
  hideChecks++;
  setGuardState('HIDE_CHECK');
}

function cameraCanSeePlayer(camera: CctvCamera, ignoreState = false) {
  if (activeHidingSpot) return false;
  if (!ignoreState && (camera.state === 'DISABLED' || camera.state === 'COOLDOWN')) return false;
  const range = (camera.range + alertLevel * 18) * (BALANCE.cctv.exposureRangeBase + playerExposure * BALANCE.cctv.exposureRangeWeight) * playerConcealmentMultiplier();
  const direction = Math.atan2(player.y - camera.y, player.x - camera.x);
  return distance(camera, player) < range && Math.abs(angleDelta(direction, camera.facing)) < .43 && hasLineOfSight(camera, player);
}

function triggerCctvAlert(camera: CctvCamera) {
  camera.state = 'ALERT'; camera.stateTime = 0; camera.detection = 1;
  cctvAlerts++; lastCctvAlertAt = elapsed; stateFlash = Math.max(stateFlash, .72); shake = Math.max(shake, 7);
  alertLevel = Math.min(3, Math.max(alertLevel + 1, collectedTreasureCount()));
  updateMissionHud(); audio.cameraAlert(); logPlaytestEvent(`cctv:alert:${camera.id}`);
  guard.lastSeen = { x: player.x, y: player.y };
  if (guard.state === 'CHASE') guard.repathTimer = 0;
  else { detection = Math.max(detection, .48); setGuardState('INVESTIGATE'); }
  shareGuardReport(null, player);
  if (treasureTaken) triggerExitLockdown('cctv');
}

function updateCctvs(dt: number, now: number) {
  let highestDetection = 0;
  let insideCameraRange = false;
  let nearestActiveDistance = Infinity;

  cctvCameras.forEach(camera => {
    camera.stateTime += dt;
    const playerDistance = distance(camera, player);

    if (camera.state === 'DISABLED') {
      camera.disabledTime -= dt;
      if (cameraCanSeePlayer(camera, true) && !camera.disabledPassRecorded) {
        camera.disabledPassRecorded = true; disabledPasses++; logPlaytestEvent(`cctv:disabled-pass:${camera.id}`);
      }
      if (camera.disabledTime <= 0) {
        camera.state = 'SCAN'; camera.stateTime = 0; camera.detection = 0;
        logPlaytestEvent(`cctv:restored:${camera.id}`);
      }
      camerasSeeingPlayer.delete(camera.id);
      return;
    }

    if (camera.state === 'ALERT') {
      highestDetection = 1;
      if (camera.stateTime > .7) {
        camera.state = 'COOLDOWN'; camera.stateTime = 0; camera.detection = 0;
        if (alertLevel >= 3) camera.direction = camera.direction === 1 ? -1 : 1;
      }
      return;
    }

    if (camera.state === 'COOLDOWN') {
      if (camera.stateTime > Math.max(2.7, 5 - alertLevel * .6)) {
        camera.state = 'SCAN'; camera.stateTime = 0;
      }
      camerasSeeingPlayer.delete(camera.id);
      return;
    }

    const sweep = camera.sweepSpeed * (1 + alertLevel * .16);
    camera.facing += camera.direction * sweep * dt;
    if (camera.facing >= camera.maxAngle) { camera.facing = camera.maxAngle; camera.direction = -1; }
    if (camera.facing <= camera.minAngle) { camera.facing = camera.minAngle; camera.direction = 1; }

    nearestActiveDistance = Math.min(nearestActiveDistance, playerDistance);
    if (playerDistance < camera.range + alertLevel * 18 && hasLineOfSight(camera, player)) insideCameraRange = true;
    const sees = cameraCanSeePlayer(camera);
    if (sees) {
      if (!camerasSeeingPlayer.has(camera.id)) { cctvSightEntries++; logPlaytestEvent(`cctv:entered:${camera.id}`); }
      camerasSeeingPlayer.add(camera.id);
      camera.state = 'DETECTING';
      const rate = (BALANCE.cctv.detectionBase + playerExposure * BALANCE.cctv.detectionExposureWeight + alertLevel * BALANCE.cctv.detectionAlertWeight) * playerConcealmentMultiplier();
      camera.detection = Math.min(1, camera.detection + dt * rate);
      if (camera.detection >= 1) triggerCctvAlert(camera);
    } else {
      camerasSeeingPlayer.delete(camera.id);
      camera.detection = Math.max(0, camera.detection - dt * 1.45);
      if (camera.detection === 0) camera.state = 'SCAN';
    }
    highestDetection = Math.max(highestDetection, camera.detection);
  });

  maxCctvDetection = Math.max(maxCctvDetection, highestDetection);
  if (!activeHidingSpot && insideCameraRange && camerasSeeingPlayer.size === 0) cctvBlindTime += dt;
  const motorProximity = nearestActiveDistance < 520 ? Math.max(0, 1 - nearestActiveDistance / 520) : 0;
  audio.cameraMotor(now, motorProximity);
  cameraWarning.classList.toggle('hidden', highestDetection <= .02);
  cameraWarning.classList.toggle('alert', highestDetection >= 1);
  cameraDetection.textContent = `${Math.round(highestDetection * 100)}%`;
}

const NAV_SIZE = 40;
const NAV_COLS = Math.ceil(WORLD.w / NAV_SIZE);
const NAV_ROWS = Math.ceil(WORLD.h / NAV_SIZE);

function navPoint(col: number, row: number): Point {
  return { x: col * NAV_SIZE + NAV_SIZE / 2, y: row * NAV_SIZE + NAV_SIZE / 2 };
}

function isWalkableCell(col: number, row: number) {
  if (col < 0 || row < 0 || col >= NAV_COLS || row >= NAV_ROWS) return false;
  const p = navPoint(col, row);
  return !collidesActorSilhouette(p.x, p.y, GUARD_RADIUS + 5);
}

function nearestWalkable(point: Point) {
  const baseCol = Math.max(0, Math.min(NAV_COLS - 1, Math.floor(point.x / NAV_SIZE)));
  const baseRow = Math.max(0, Math.min(NAV_ROWS - 1, Math.floor(point.y / NAV_SIZE)));
  for (let radius = 0; radius < 6; radius++) {
    for (let y = baseRow - radius; y <= baseRow + radius; y++) {
      for (let x = baseCol - radius; x <= baseCol + radius; x++) {
        if (isWalkableCell(x, y)) return { col: x, row: y };
      }
    }
  }
  return { col: baseCol, row: baseRow };
}

function findPath(start: Point, goal: Point): Point[] {
  const from = nearestWalkable(start);
  const to = nearestWalkable(goal);
  const startKey = from.row * NAV_COLS + from.col;
  const goalKey = to.row * NAV_COLS + to.col;
  const open = new Set<number>([startKey]);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[startKey, 0]]);
  const fScore = new Map<number, number>([[startKey, Math.abs(from.col - to.col) + Math.abs(from.row - to.row)]]);

  while (open.size) {
    let current = -1;
    let best = Infinity;
    for (const key of open) {
      const score = fScore.get(key) ?? Infinity;
      if (score < best) { best = score; current = key; }
    }
    if (current === goalKey) {
      const result: Point[] = [];
      let cursor = current;
      while (cursor !== startKey) {
        result.unshift(navPoint(cursor % NAV_COLS, Math.floor(cursor / NAV_COLS)));
        cursor = cameFrom.get(cursor)!;
      }
      if (!collidesActorSilhouette(goal.x, goal.y, GUARD_RADIUS + 2)) result.push({ x: goal.x, y: goal.y });
      return result;
    }
    open.delete(current);
    const col = current % NAV_COLS;
    const row = Math.floor(current / NAV_COLS);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = col + dx; const nr = row + dy;
      if (!isWalkableCell(nc, nr)) continue;
      const next = nr * NAV_COLS + nc;
      const tentative = (gScore.get(current) ?? Infinity) + 1;
      if (tentative >= (gScore.get(next) ?? Infinity)) continue;
      cameFrom.set(next, current); gScore.set(next, tentative);
      fScore.set(next, tentative + Math.abs(nc - to.col) + Math.abs(nr - to.row));
      open.add(next);
    }
  }
  return [];
}

function clearPathForGuard(a: Point, b: Point) {
  const length = distance(a, b);
  const steps = Math.ceil(length / 12);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (collidesActorSilhouette(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, GUARD_RADIUS + 2)) return false;
  }
  return true;
}

function moveGuardTo(actor: GuardActor, target: Point, speed: number, dt: number) {
  actor.repathTimer -= dt;
  const targetMoved = distance(actor.pathTarget, target) > 55;
  if (actor.repathTimer <= 0 || targetMoved || actor.pathIndex >= actor.path.length) {
    actor.path = clearPathForGuard(actor, target) ? [{ x: target.x, y: target.y }] : findPath(actor, target);
    actor.pathIndex = 0;
    actor.pathTarget = { x: target.x, y: target.y };
    actor.repathTimer = actor.state === 'CHASE' ? .28 : .7;
  }
  while (actor.pathIndex < actor.path.length && distance(actor, actor.path[actor.pathIndex]) < 15) actor.pathIndex++;
  const waypoint = actor.path[actor.pathIndex];
  if (!waypoint) return distance(actor, target) < 28;
  const desired = Math.atan2(waypoint.y - actor.y, waypoint.x - actor.x);
  actor.facing += angleDelta(desired, actor.facing) * Math.min(1, dt * 9);
  const beforeMove = { x: actor.x, y: actor.y };
  moveEntity(actor, Math.cos(desired) * speed * dt, Math.sin(desired) * speed * dt, GUARD_RADIUS);
  const travelled = distance(beforeMove, actor);
  if (travelled > 0.01) {
    const motion = guardMotionFor(actor);
    motion.moving = true;
    const movementDirection = directionFromAngle(Math.atan2(actor.y - beforeMove.y, actor.x - beforeMove.x));
    if (motion.direction !== movementDirection) motion.phase = Math.floor(motion.phase / 4) * 4;
    motion.direction = movementDirection;
    const frameStride = actor.state === 'CHASE' ? 16 : actor.state === 'HIDE_CHECK' ? 11 : 12;
    motion.phase += travelled / frameStride;
  }
  return distance(actor, target) < 28;
}

function logPlaytestEvent(type: string) {
  playtestEvents.push({ time: Number(elapsed.toFixed(2)), type, x: Math.round(player.x), y: Math.round(player.y) });
}

function emitPlayerFootstep(mode: MovementMode) {
  const profile = movementNoiseProfile(mode, collectedTreasureCount());
  playerStepTimer = profile.interval;
  playerFootsteps++;
  noisePulses.push({ x: player.x, y: player.y, radius: profile.radius, age: 0, duration: .62, mode });
  audio.playerStep(mode);

  [guard, supportGuard].forEach(actor => {
    const hearingRadius = effectiveHearingRadius(profile.radius, !hasLineOfSight(actor, player), alertLevel);
    if (distance(actor, player) > hearingRadius || actor.state === 'CHASE' || actor.state === 'HIDE_CHECK') return;
    heardFootsteps++;
    if (actor.state !== 'INVESTIGATE') footstepInvestigations++;
    actor.lastSeen = { x: player.x, y: player.y };
    const detectionFloor = mode === 'crouch' ? .1 : mode === 'careful' ? .18 : .3;
    if (actor.id === guard.id) { detection = Math.max(detection, detectionFloor); setGuardState('INVESTIGATE', `${mode === 'normal' ? '큰' : '희미한'} 발소리 감지`); }
    else { supportDetection = Math.max(supportDetection, detectionFloor * .94); setSupportGuardState('INVESTIGATE', `${mode === 'normal' ? '큰' : '희미한'} 발소리 감지`); }
    logPlaytestEvent(`noise:footstep:${actor.id}:${mode}`);
  });
}

function setGuardState(next: GuardState, reason?: string) {
  if (guard.state === next) return;
  guard.state = next; guard.stateTime = 0; guard.repathTimer = 0; guard.path = []; guard.pathIndex = 0;
  if (next === 'CHASE') { spottedCount++; shake = 12; stateFlash = 1; }
  else if (next === 'SUSPICIOUS') { stateFlash = Math.max(stateFlash, .32); if (firstDetectionAt < 0) firstDetectionAt = elapsed; }
  if (next === 'SEARCH') { guard.searchOrigin = { ...guard.lastSeen }; guard.searchStep = 0; }
  if (next !== 'PATROL') showGuardFeedback(guard, reason ?? (next === 'CHASE' ? '침입자 확인!' : next === 'SEARCH' ? '시야 상실 · 수색' : next === 'HIDE_CHECK' ? '은신처 확인' : next === 'INVESTIGATE' ? '이상 신호 조사' : '움직임 발견?'), next === 'CHASE' ? 'danger' : next === 'SUSPICIOUS' ? 'warning' : 'notice');
  audio.cue(next);
  logPlaytestEvent(`guard:${next.toLowerCase()}`);
  if (next === 'CHASE') shareGuardReport(guard, guard.lastSeen);
}

function setSupportGuardState(next: GuardState, reason?: string) {
  if (supportGuard.state === next) return;
  supportGuard.state = next; supportGuard.stateTime = 0; supportGuard.repathTimer = 0; supportGuard.path = []; supportGuard.pathIndex = 0;
  if (next === 'CHASE') { spottedCount++; shake = Math.max(shake, 10); stateFlash = 1; }
  if (next === 'SUSPICIOUS' && firstDetectionAt < 0) firstDetectionAt = elapsed;
  if (next === 'SEARCH') { supportGuard.searchOrigin = { ...supportGuard.lastSeen }; supportGuard.searchStep = 0; }
  if (next !== 'PATROL') showGuardFeedback(supportGuard, reason ?? (next === 'CHASE' ? '침입자 확인!' : next === 'SEARCH' ? '시야 상실 · 수색' : next === 'INVESTIGATE' ? '이상 신호 조사' : '움직임 발견?'), next === 'CHASE' ? 'danger' : next === 'SUSPICIOUS' ? 'warning' : 'notice');
  audio.cue(next);
  logPlaytestEvent(`guard:bravo:${next.toLowerCase()}`);
  if (next === 'CHASE') shareGuardReport(supportGuard, supportGuard.lastSeen);
}

function shareGuardReport(source: GuardActor | null, point: Point) {
  if (radioCooldown > 0) return;
  radioCooldown = 1.2; radioMessages++; audio.radio();
  if (source?.id !== guard.id && guard.state !== 'CHASE' && guard.state !== 'HIDE_CHECK') {
    guard.lastSeen = { ...point }; detection = Math.max(detection, .38); sharedInvestigations++; setGuardState('INVESTIGATE', '무전 위치 확인');
  }
  if (source?.id !== supportGuard.id && supportGuard.state !== 'CHASE') {
    supportGuard.lastSeen = { ...point }; supportDetection = Math.max(supportDetection, .38); sharedInvestigations++; setSupportGuardState('INVESTIGATE', '무전 위치 확인');
  }
  logPlaytestEvent(`radio:${source?.id ?? 'security'}`);
}

function searchPoint() {
  const ring = 75 + Math.floor(guard.searchStep / 4) * 55;
  const angle = guard.searchStep * Math.PI / 2 + Math.PI / 4;
  const candidate = { x: guard.searchOrigin.x + Math.cos(angle) * ring, y: guard.searchOrigin.y + Math.sin(angle) * ring };
  if (!collidesActorSilhouette(candidate.x, candidate.y, GUARD_RADIUS + 5)) return candidate;
  return guard.searchOrigin;
}

function supportSearchPoint() {
  const ring = 70 + Math.floor(supportGuard.searchStep / 4) * 52;
  const angle = supportGuard.searchStep * Math.PI / 2 - Math.PI / 4;
  const candidate = { x: supportGuard.searchOrigin.x + Math.cos(angle) * ring, y: supportGuard.searchOrigin.y + Math.sin(angle) * ring };
  if (!collidesActorSilhouette(candidate.x, candidate.y, GUARD_RADIUS + 5)) return candidate;
  return supportGuard.searchOrigin;
}

function updateSupportGuard(dt: number) {
  const sees = !activeHidingSpot && actorCanSeePoint(supportGuard, player);
  supportGuard.stateTime += dt;
  if (sees) {
    supportGuard.lastSeen = { x: player.x, y: player.y }; supportGuard.lostSightTime = 0;
    const exposureRate = (.52 + playerExposure * .7) * playerConcealmentMultiplier();
    supportDetection = Math.min(1, supportDetection + dt * ((supportGuard.state === 'SUSPICIOUS' ? 1.9 : 2.45) + alertLevel * .13) * exposureRate);
  } else {
    supportGuard.lostSightTime += dt;
    if (supportGuard.state !== 'CHASE') supportDetection = Math.max(0, supportDetection - dt * 1.08);
  }

  switch (supportGuard.state) {
    case 'PATROL':
      if (sees || supportDetection > .12) setSupportGuardState('SUSPICIOUS', '움직임 발견?');
      else if (moveGuardTo(supportGuard, supportPatrol[supportGuard.target], 78 + alertLevel * 7, dt)) {
        supportGuard.target = (supportGuard.target + 1) % supportPatrol.length; supportGuard.repathTimer = 0;
      }
      break;
    case 'SUSPICIOUS': {
      const lookAt = Math.atan2(supportGuard.lastSeen.y - supportGuard.y, supportGuard.lastSeen.x - supportGuard.x);
      supportGuard.facing += angleDelta(lookAt, supportGuard.facing) * Math.min(1, dt * 7);
      if (supportDetection >= 1) setSupportGuardState('CHASE', '침입자 확인!');
      else if (!sees && supportGuard.stateTime > .8) {
        if (supportDetection < .25) { closeCalls++; supportDetection = 0; setSupportGuardState('PATROL'); }
        else setSupportGuardState('INVESTIGATE', '마지막 움직임 확인');
      }
      break;
    }
    case 'INVESTIGATE':
      if (supportDetection >= 1) setSupportGuardState('CHASE', '침입자 확인!');
      else if (moveGuardTo(supportGuard, supportGuard.lastSeen, 104 + alertLevel * 7, dt)) setSupportGuardState('SEARCH', '흔적 주변 수색');
      break;
    case 'CHASE':
      if (guard.state !== 'CHASE') chaseTime += dt;
      if (sees) supportGuard.lastSeen = { x: player.x, y: player.y };
      moveGuardTo(supportGuard, supportGuard.lastSeen, 170 + alertLevel * 7, dt);
      if (!sees && supportGuard.lostSightTime > 1.9) { supportDetection = .5; setSupportGuardState('INVESTIGATE', '시야 상실 · 마지막 위치'); }
      break;
    case 'SEARCH': {
      const target = supportSearchPoint();
      if (sees && supportDetection > .6) setSupportGuardState('CHASE', '다시 발견!');
      else if (sees) setSupportGuardState('SUSPICIOUS', '움직임 재확인');
      else if (moveGuardTo(supportGuard, target, 91 + alertLevel * 6, dt)) { supportGuard.searchStep++; supportGuard.repathTimer = 0; }
      if (supportGuard.stateTime > 7 + alertLevel * 1.4 || supportGuard.searchStep > 8 + alertLevel * 2) { supportDetection = 0; setSupportGuardState('PATROL'); }
      break;
    }
    case 'HIDE_CHECK': setSupportGuardState('SEARCH'); break;
  }

  maxDetection = Math.max(maxDetection, supportDetection);
  if (supportGuard.state === 'CHASE') setStatus('발각 — 협동 추격 중', true);
  else if (guard.state === 'PATROL' && supportGuard.state !== 'PATROL') setStatus('경비 브라보 조사 중', false, true);
}

function update(dt: number, now: number) {
  if (state !== 'playing') return;
  playerMotion.moving = false;
  guardMotions.forEach(motion => { motion.moving = false; });
  elapsed += dt;
  devPanelTimer = Math.max(0, devPanelTimer - dt);
  radioCooldown = Math.max(0, radioCooldown - dt);
  updateExitLockdown(dt, now);
  stateFlash = Math.max(0, stateFlash - dt * 2.2);
  if (alertLevel > 0) treasureBeat += dt;
  const xInput = activeHidingSpot ? 0 : (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const yInput = activeHidingSpot ? 0 : (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  const len = Math.hypot(xInput, yInput) || 1;
  const careful = keys.has('shift');
  const crouching = keys.has('c');
  currentMovementMode = crouching ? 'crouch' : careful ? 'careful' : 'normal';
  const speed = crouching ? BALANCE.player.crouchSpeed : careful ? BALANCE.player.carefulSpeed : BALANCE.player.normalSpeed;
  const tx = xInput / len * speed; const ty = yInput / len * speed;
  player.vx += (tx - player.vx) * Math.min(1, dt * 12);
  player.vy += (ty - player.vy) * Math.min(1, dt * 12);
  if (!xInput && !yInput) { player.vx *= Math.max(0, 1 - dt * 12); player.vy *= Math.max(0, 1 - dt * 12); }
  if (Math.hypot(player.vx, player.vy) > 5) player.facing = Math.atan2(player.vy, player.vx);
  const beforePlayerMove = { x: player.x, y: player.y };
  moveEntity(player, player.vx * dt, player.vy * dt, PLAYER_RADIUS);
  const playerTravelled = distance(beforePlayerMove, player);
  const actualPlayerSpeed = playerTravelled / Math.max(dt, 0.001);
  playerFrameDistance = playerTravelled;
  playerActualSpeed = actualPlayerSpeed;
  onboardingDistance += playerTravelled;
  playerMotion.moving = !activeHidingSpot && actualPlayerSpeed > PLAYER_ANIMATION.idleSpeedThreshold;
  if (playerMotion.moving) {
    const movementDirection = directionFromAngle(Math.atan2(player.y - beforePlayerMove.y, player.x - beforePlayerMove.x));
    if (playerMotion.direction !== movementDirection) playerMotion.phase = 0;
    playerMotion.direction = movementDirection;
    const strideLength = PLAYER_ANIMATION.strideLength[currentMovementMode];
    playerMotion.phase += playerTravelled / strideLength * PLAYER_ANIMATION.frameCount;
  }
  const playerMoving = !activeHidingSpot && actualPlayerSpeed > 35;
  playerStepTimer -= dt;
  if (playerMoving) {
    if (crouching) crouchTime += dt; else if (careful) carefulWalkTime += dt; else normalWalkTime += dt;
    if (playerStepTimer <= 0) emitPlayerFootstep(currentMovementMode);
  } else playerStepTimer = Math.min(playerStepTimer, .08);
  noisePulses.forEach(pulse => { pulse.age += dt; });
  for (let i = noisePulses.length - 1; i >= 0; i--) if (noisePulses[i].age >= noisePulses[i].duration) noisePulses.splice(i, 1);
  updateNoiseHud(currentMovementMode, playerMoving);
  if (activeHidingSpot) hidingTime += dt;
  const exposureTarget = lightLevelAt(player);
  playerExposure += (exposureTarget - playerExposure) * Math.min(1, dt * 6);
  maxExposure = Math.max(maxExposure, playerExposure);
  if (playerExposure >= .6) brightTime += dt;
  if (playerExposure < .28) darkTime += dt;
  updateExposureHud();
  updateExploration(dt);
  updateCctvs(dt, now);

  const guardDistance = distance(player, guard);
  const sees = !activeHidingSpot && guardCanSeePoint(player);
  guard.stateTime += dt;

  if (sees) {
    guard.lastSeen = { x: player.x, y: player.y };
    guard.lostSightTime = 0;
    const exposureRate = (.56 + playerExposure * .74) * playerConcealmentMultiplier();
    detection = Math.min(1, detection + dt * ((guard.state === 'SUSPICIOUS' ? 2.1 : 2.7) + alertLevel * .14) * exposureRate);
  } else {
    guard.lostSightTime += dt;
    if (guard.state !== 'CHASE') detection = Math.max(0, detection - dt * 1.15);
  }
  maxDetection = Math.max(maxDetection, detection);

  switch (guard.state) {
    case 'PATROL': {
      if (sees || detection > .12) {
        setGuardState('SUSPICIOUS', '움직임 발견?');
      } else if (moveGuardTo(guard, patrol[guard.target], 82 + alertLevel * 7, dt)) {
        const direction = alertLevel >= 2 ? -1 : 1;
        guard.target = (guard.target + direction + patrol.length) % patrol.length;
        guard.repathTimer = 0;
      }
      setStatus('미탐지', false);
      break;
    }
    case 'SUSPICIOUS': {
      const lookAt = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      guard.facing += angleDelta(lookAt, guard.facing) * Math.min(1, dt * 7);
      setStatus('의심 — 움직임 확인 중', false, true);
      if (detection >= 1) setGuardState('CHASE', '침입자 확인!');
      else if (!sees && guard.stateTime > .75) {
        if (detection < .28) {
          closeCalls++; detection = 0; setGuardState('PATROL');
        } else setGuardState('INVESTIGATE', '마지막 움직임 확인');
      }
      break;
    }
    case 'INVESTIGATE': {
      setStatus('마지막 움직임 조사 중', false, true);
      if (detection >= 1) setGuardState('CHASE', '침입자 확인!');
      else if (moveGuardTo(guard, guard.lastSeen, 108 + alertLevel * 7, dt)) {
        const nearbySpot = activeHidingSpot && distance(activeHidingSpot, guard.lastSeen) < 115 ? activeHidingSpot : null;
        const checkChance = alertLevel >= 2 ? .2 + alertLevel * .2 : 0;
        if (nearbySpot && Math.random() < checkChance) beginHideCheck(nearbySpot);
        else setGuardState('SEARCH', '흔적 주변 수색');
      }
      break;
    }
    case 'CHASE': {
      chaseTime += dt;
      setStatus('발각 — 추격 중', true);
      if (sees) guard.lastSeen = { x: player.x, y: player.y };
      moveGuardTo(guard, guard.lastSeen, 176 + alertLevel * 7, dt);
      if (!sees && guard.lostSightTime > 1.8) {
        detection = .55;
        setGuardState('INVESTIGATE', '시야 상실 · 마지막 위치');
      }
      break;
    }
    case 'SEARCH': {
      setStatus('주변 수색 중', false, true);
      const target = searchPoint();
      if (sees && detection > .62) setGuardState('CHASE', '다시 발견!');
      else if (sees) setGuardState('SUSPICIOUS', '움직임 재확인');
      else if (moveGuardTo(guard, target, 94 + alertLevel * 6, dt)) { guard.searchStep++; guard.repathTimer = 0; }
      if (guard.stateTime > 7.5 + alertLevel * 1.5 || guard.searchStep > 8 + alertLevel * 2) {
        detection = 0; setGuardState('PATROL');
      }
      break;
    }
    case 'HIDE_CHECK': {
      setStatus('은신처 확인 중', false, true);
      const spot = hidingSpots.find(item => item.id === guard.suspectedHideId);
      if (sees) {
        guard.suspectedHideId = null;
        setGuardState('CHASE');
      } else if (!spot) {
        setGuardState('SEARCH');
      } else if (moveGuardTo(guard, hidingEntryPoint(spot), 132 + alertLevel * 7, dt)) {
        audio.hideInspect();
        if (activeHidingSpot?.id === spot.id) {
          hiddenCaptures++;
          logPlaytestEvent(`hide:caught:${spot.id}`);
          finishGame(false);
        } else {
          guard.suspectedHideId = null;
          guard.lastSeen = { x: spot.x, y: spot.y };
          setGuardState('SEARCH');
        }
      }
      break;
    }
  }
  updateSupportGuard(dt);
  if (!activeHidingSpot && guard.state === 'CHASE' && guardDistance < PLAYER_RADIUS + GUARD_RADIUS + 5) finishGame(false);
  if (!activeHidingSpot && supportGuard.state === 'CHASE' && distance(player, supportGuard) < PLAYER_RADIUS + GUARD_RADIUS + 5) finishGame(false);

  const alphaCue = audio.updateGuard(guard.id, now, guardDistance, (guard.x - player.x) / 420, guard.state === 'CHASE', !hasLineOfSight(player, guard));
  const bravoDistance = distance(player, supportGuard);
  const bravoCue = audio.updateGuard(supportGuard.id, now, bravoDistance, (supportGuard.x - player.x) / 420, supportGuard.state === 'CHASE', !hasLineOfSight(player, supportGuard));
  if (alphaCue || bravoCue) recordDangerCue(playerMoving);
  updateDangerReaction(playerMoving);
  updateOnboarding();
  updateRiskDecision();
  audio.updateAlarm(now);
  audio.updateLightHum(now, playerExposure);

  const nearbyTreasure = treasures.find(item => !item.collected && distance(player, item) < 52);
  const nearbyKeycard = !keycard.collected && distance(player, keycard) < 48 ? keycard : null;
  const nearbyHide = activeHidingSpot ?? hidingSpots.find(item => distance(player, hidingEntryPoint(item)) < 52);
  const nearbyCctvPanel = cctvPanels.find(item => !item.used && distance(player, item) < 48);
  const nearbySwitch = lightSwitches.find(item => !item.used && distance(player, item) < 48);
  const nearbyDoor = doors.find(item => distance(player, doorCenter(item)) < 62);
  const nearExit = treasureTaken && distance(player, exit) < 65;
  prompt.classList.toggle('hidden', !nearbyTreasure && !nearbyKeycard && !nearbyHide && !nearbyCctvPanel && !nearbySwitch && !nearbyDoor && !nearExit);
  const switchOn = nearbySwitch ? lightSources.some(light => light.group === nearbySwitch.group && light.on) : false;
  prompt.innerHTML = activeHidingSpot ? `<b>E</b> ${activeHidingSpot.name}에서 나오기`
    : nearbyTreasure
    ? `<b>E</b> ${nearbyTreasure.name} 훔치기 · ${nearbyTreasure.value.toLocaleString('ko-KR')}`
    : nearbyKeycard ? `<b>E</b> ${nearbyKeycard.name} 획득`
    : nearbyHide ? `<b>E</b> ${nearbyHide.name}에 숨기`
    : nearbyCctvPanel ? `<b>E</b> ${nearbyCctvPanel.name} 비활성화 · 1회용`
    : nearbySwitch ? `<b>E</b> 구역 조명 ${switchOn ? '끄기' : '켜기'} · 1회용`
    : nearbyDoor ? `<b>E</b> ${nearbyDoor.name} ${nearbyDoor.open ? '닫기' : nearbyDoor.locked && !keycard.collected ? '열기 · 키카드 필요' : '열기'}`
    : nearExit ? exitLockdown > 0
      ? `<b>E</b> 출구 봉쇄 중 · ${exitLockdown.toFixed(1)}초`
      : `<b>E</b> 지금 탈출 · ${currentTake().toLocaleString('ko-KR')}점 확보`
    : '';

  const camTargetX = Math.max(0, Math.min(WORLD.w - VIEW.w, player.x - VIEW.w / 2));
  const camTargetY = Math.max(0, Math.min(WORLD.h - VIEW.h, player.y - VIEW.h / 2));
  camera.x += (camTargetX - camera.x) * Math.min(1, dt * 5);
  camera.y += (camTargetY - camera.y) * Math.min(1, dt * 5);
  shake *= Math.max(0, 1 - dt * 6);
  updateDevPanel();
}

function enterHiding(spot: HidingSpot) {
  const primaryWitness = guardCanSeePoint(player) || (guard.state === 'CHASE' && hasLineOfSight(guard, player));
  const supportWitness = actorCanSeePoint(supportGuard, player) || (supportGuard.state === 'CHASE' && hasLineOfSight(supportGuard, player));
  const witnessed = primaryWitness || supportWitness;
  activeHidingSpot = spot;
  player.x = spot.x; player.y = spot.y; player.vx = 0; player.vy = 0;
  hideEntries++; audio.hideMovement(true); logPlaytestEvent(`hide:enter:${spot.id}`);
  if (witnessed) {
    if (supportWitness) shareGuardReport(supportGuard, spot);
    beginHideCheck(spot);
  } else {
    const soundRange = hasLineOfSight(guard, spot) ? 235 : 145;
    if (distance(guard, spot) < soundRange) {
      noiseInvestigations++;
      guard.lastSeen = { x: spot.x, y: spot.y };
      detection = Math.max(detection, .3);
      setGuardState('INVESTIGATE', '은신 소리 감지');
      logPlaytestEvent(`hide:noise:${spot.id}`);
    }
  }
}

function exitHiding() {
  if (!activeHidingSpot) return;
  const spot = activeHidingSpot;
  activeHidingSpot = null;
  const preferredExit = hidingEntryPoint(spot);
  const exits = [preferredExit, { x: spot.x + spot.width / 2 + 32, y: spot.y }, { x: spot.x - spot.width / 2 - 32, y: spot.y }, { x: spot.x, y: spot.y + spot.height / 2 + 32 }, { x: spot.x, y: spot.y - spot.height / 2 - 32 }];
  const exitPoint = exits.find(point => !collidesActorSilhouette(point.x, point.y, PLAYER_RADIUS)) ?? spot;
  player.x = exitPoint.x; player.y = exitPoint.y; player.vx = 0; player.vy = 0;
  safeHides++; audio.hideMovement(false); logPlaytestEvent(`hide:exit:${spot.id}`);
  if (guardCanSeePoint(player)) {
    detection = 1; guard.lastSeen = { x: player.x, y: player.y }; setGuardState('CHASE', '은신처에서 발견!');
  } else {
    const soundRange = hasLineOfSight(guard, player) ? 255 : 155;
    if (distance(guard, player) < soundRange && guard.state !== 'HIDE_CHECK') {
      noiseInvestigations++;
      guard.lastSeen = { x: player.x, y: player.y };
      detection = Math.max(detection, .34);
      setGuardState('INVESTIGATE', '은신처 움직임 감지');
      logPlaytestEvent(`hide:exit-noise:${spot.id}`);
    }
  }
}

function doorCenter(door: Door): Point {
  return { x: door.x + door.w / 2, y: door.y + door.h / 2 };
}

function alertGuardToDoorNoise(door: Door, radius: number) {
  const point = doorCenter(door);
  let reporter: GuardActor | null = null;
  [guard, supportGuard].forEach(actor => {
    if (actor.state === 'CHASE' || actor.state === 'HIDE_CHECK') return;
    const hearingRadius = effectiveHearingRadius(radius, !hasLineOfSight(actor, point), alertLevel);
    if (distance(actor, point) > hearingRadius) return;
    doorNoiseInvestigations++; reporter ??= actor; actor.lastSeen = point;
    if (actor.id === guard.id) { detection = Math.max(detection, .32); setGuardState('INVESTIGATE', '문 소리 감지'); }
    else { supportDetection = Math.max(supportDetection, .3); setSupportGuardState('INVESTIGATE', '문 소리 감지'); }
    logPlaytestEvent(`door:heard:${actor.id}:${door.id}`);
  });
  if (reporter && radius >= 300) shareGuardReport(reporter, point);
}

function useDoor(door: Door) {
  if (!door.open && door.locked && !keycard.collected) {
    lockedAttempts++; audio.door('locked'); stateFlash = Math.max(stateFlash, .18);
    logPlaytestEvent(`door:locked:${door.id}`);
    return;
  }

  if (door.open && (circleIntersectsRect(player, PLAYER_RADIUS + 4, door) || circleIntersectsRect(guard, GUARD_RADIUS + 4, door) || circleIntersectsRect(supportGuard, GUARD_RADIUS + 4, door))) {
    audio.door('locked');
    logPlaytestEvent(`door:blocked:${door.id}`);
    return;
  }

  door.open = !door.open;
  if (door.open) doorsOpened++; else doorsClosed++;
  lightPolygonCache.clear();
  guard.repathTimer = 0; supportGuard.repathTimer = 0;
  audio.door(door.open ? 'open' : 'close');
  alertGuardToDoorNoise(door, door.open ? 255 : 315);
  logPlaytestEvent(`door:${door.open ? 'open' : 'close'}:${door.id}`);
}

function interact() {
  if (state !== 'playing') return;
  if (activeHidingSpot) { exitHiding(); return; }
  const nearbyTreasure = treasures.find(item => !item.collected && distance(player, item) < 52);
  if (nearbyTreasure) {
    const firstLoot = firstTreasureAt < 0;
    nearbyTreasure.collected = true;
    treasureTaken = true;
    if (firstTreasureAt < 0) {
      firstTreasureAt = elapsed;
      logPlaytestEvent('tension:first-treasure');
    }
    lootScore += nearbyTreasure.value;
    const collectedCount = collectedTreasureCount();
    alertLevel = Math.max(alertLevel, collectedCount);
    const allCollected = collectedCount === treasures.length;
    objectiveText.textContent = allCollected ? '모든 보물 확보 — 출구로 탈출하세요' : '탈출하거나, 더 깊이 들어가세요';
    updateMissionHud(); shake = 7 + alertLevel * 2; stateFlash = Math.max(stateFlash, .42);
    if (firstLoot) showRiskDecision();
    logPlaytestEvent(`treasure:${nearbyTreasure.id}`);
    if (guard.state !== 'CHASE') {
      guard.lastSeen = { x: nearbyTreasure.x, y: nearbyTreasure.y };
      detection = Math.max(detection, .28 + alertLevel * .12);
      guard.target = alertLevel === 3 ? 10 : (guard.target + 3) % patrol.length;
      setGuardState('INVESTIGATE', '보물 경보 수신');
    }
    shareGuardReport(null, nearbyTreasure);
    if (allCollected) triggerExitLockdown('final-loot');
    if (audio.context && audio.master) audio.sting(true);
  } else {
    if (!keycard.collected && distance(player, keycard) < 48) {
      keycard.collected = true; accessText.textContent = '키카드'; audio.door('keycard'); shake = 2;
      logPlaytestEvent(`access:${keycard.id}`);
      return;
    }
    const nearbyHide = hidingSpots.find(item => distance(player, hidingEntryPoint(item)) < 52);
    if (nearbyHide) { enterHiding(nearbyHide); return; }
    const nearbyCctvPanel = cctvPanels.find(item => !item.used && distance(player, item) < 48);
    if (nearbyCctvPanel) {
      const camera = cctvCameras.find(item => item.id === nearbyCctvPanel.cameraId);
      if (camera) {
        nearbyCctvPanel.used = true; cctvPanelsUsed++;
        camera.state = 'DISABLED'; camera.stateTime = 0; camera.detection = 0;
        camera.disabledTime = Math.max(7.5, 11 - alertLevel * .7); camera.disabledPassRecorded = false;
        camerasSeeingPlayer.delete(camera.id); audio.cameraPanel(); shake = 3;
        logPlaytestEvent(`cctv:disabled:${camera.id}`);
        const soundRange = hasLineOfSight(guard, nearbyCctvPanel) ? 245 : 145;
        if (distance(guard, nearbyCctvPanel) < soundRange && guard.state !== 'CHASE' && guard.state !== 'HIDE_CHECK') {
          guard.lastSeen = { x: nearbyCctvPanel.x, y: nearbyCctvPanel.y };
          detection = Math.max(detection, .32); setGuardState('INVESTIGATE', '제어반 소리 감지');
          logPlaytestEvent(`cctv:panel-noise:${nearbyCctvPanel.id}`);
        }
      }
      return;
    }
    const nearbySwitch = lightSwitches.find(item => !item.used && distance(player, item) < 48);
    if (nearbySwitch) {
      const groupLights = lightSources.filter(light => light.group === nearbySwitch.group);
      const powered = !groupLights.some(light => light.on);
      groupLights.forEach(light => { light.on = powered; });
      nearbySwitch.used = true; switchesUsed++; shake = 3;
      logPlaytestEvent(`light:${nearbySwitch.group}:${powered ? 'on' : 'off'}`);
      audio.switchClick(powered);
      if (guard.state !== 'CHASE') {
        guard.lastSeen = { x: nearbySwitch.x, y: nearbySwitch.y };
        detection = Math.max(detection, .34);
        setGuardState('INVESTIGATE', '조명 변화 감지');
      }
    } else {
      const nearbyDoor = doors.find(item => distance(player, doorCenter(item)) < 62);
      if (nearbyDoor) useDoor(nearbyDoor);
      else if (treasureTaken && distance(player, exit) < 65) {
        if (exitLockdown > 0) {
          blockedExitAttempts++; audio.securityCue(false); stateFlash = Math.max(stateFlash, .28);
          logPlaytestEvent('lockdown:blocked-exit');
        } else finishGame(true);
      }
    }
  }
}

function currentVisibilityPolygon() {
  const rays = 180;
  const visionRadius = currentPlayerVision();
  const points: Point[] = [];
  for (let i = 0; i <= rays; i++) points.push(castRay(player, Math.PI * 2 * i / rays, visionRadius));
  return { points, visionRadius };
}

function clipToPlayerVisibility(points: Point[]) {
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  points.forEach(point => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.clip();
}

function drawVisibleDynamicLayer(points: Point[]) {
  ctx.save();
  clipToPlayerVisibility(points);
  drawCctvSystem();
  drawTreasures();
  drawKeycard();
  drawGuardVision();
  drawGuard();
  ctx.restore();
}

function draw() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const width = canvas.clientWidth; const height = canvas.clientHeight;
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) { canvas.width = width * dpr; canvas.height = height * dpr; }
  ctx.setTransform(dpr * width / VIEW.w, 0, 0, dpr * height / VIEW.h, 0, 0);
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  const sx = shake ? (Math.random() - .5) * shake : 0; const sy = shake ? (Math.random() - .5) * shake : 0;
  const visibility = currentVisibilityPolygon();
  ctx.save(); ctx.translate(-camera.x + sx, -camera.y + sy);
  drawFloor(); drawObjects(); drawDoors(); drawLighting(); drawLightSwitches(); drawHidingSpots(); drawExit();
  if (showNoiseWaves) drawNoisePulses();
  drawVisibleDynamicLayer(visibility.points);
  drawPlayer(); drawFog(visibility.points, visibility.visionRadius);
  if (debugPaths) drawGuardPaths();
  ctx.restore();
  if (Math.max(detection, supportDetection) > 0 && state === 'playing') drawDetectionVignette();
  if (alertLevel > 0 && state === 'playing') drawAlarmAtmosphere();
  if (activeHidingSpot && state === 'playing') drawHidingOverlay();
  if (stateFlash > 0 && state === 'playing') drawStateFlash();
  requestAnimationFrame(frame);
}

function drawFloor() {
  ctx.fillStyle = '#172022'; ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  for (let y = OUTER; y < WORLD.h - OUTER; y += 40) {
    for (let x = OUTER; x < WORLD.w - OUTER; x += 40) {
      ctx.fillStyle = (Math.floor(x / 40) + Math.floor(y / 40)) % 2 === 0 ? 'rgba(132,150,145,.027)' : 'rgba(0,0,0,.025)';
      ctx.fillRect(x, y, 39, 39);
    }
  }
  galleryZones.forEach((zone, index) => {
    ctx.fillStyle = index === 4 ? 'rgba(112,76,43,.16)' : 'rgba(57,76,76,.19)';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = index === 4 ? 'rgba(214,171,84,.25)' : 'rgba(151,170,165,.12)';
    ctx.lineWidth = 2; ctx.strokeRect(zone.x + .5, zone.y + .5, zone.w - 1, zone.h - 1);
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1; ctx.strokeRect(zone.x + 8.5, zone.y + 8.5, zone.w - 17, zone.h - 17);
  });
  labels.forEach(l => { ctx.fillStyle = 'rgba(190,202,197,.26)'; ctx.font = '500 12px "Noto Sans KR"'; ctx.letterSpacing = '5px'; ctx.fillText(l.text, l.x, l.y); });
}

function drawObjects() {
  walls.forEach(w => {
    const fixture = w.w > 45 && w.h > 45;
    const depth = fixture ? 11 : 15;
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(w.x + 10, w.y + 12, w.w, w.h + depth);
    ctx.fillStyle = fixture ? '#273234' : '#303a3d'; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = fixture ? '#1b2426' : '#20292b';
    ctx.beginPath(); ctx.moveTo(w.x, w.y + w.h); ctx.lineTo(w.x + w.w, w.y + w.h); ctx.lineTo(w.x + w.w + 7, w.y + w.h + depth); ctx.lineTo(w.x + 7, w.y + w.h + depth); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fixture ? '#354447' : '#465255';
    ctx.beginPath(); ctx.moveTo(w.x + w.w, w.y); ctx.lineTo(w.x + w.w + 7, w.y + 7); ctx.lineTo(w.x + w.w + 7, w.y + w.h + depth); ctx.lineTo(w.x + w.w, w.y + w.h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fixture ? '#46575a' : '#536164'; ctx.fillRect(w.x, w.y, w.w, fixture ? 6 : 5);
    ctx.strokeStyle = fixture ? 'rgba(214,171,84,.20)' : 'rgba(171,190,185,.12)'; ctx.lineWidth = 1; ctx.strokeRect(w.x + .5, w.y + .5, w.w - 1, w.h - 1);
    if (fixture) {
      ctx.fillStyle = 'rgba(164,190,184,.06)'; ctx.fillRect(w.x + 9, w.y + 11, Math.max(0, w.w - 18), Math.max(0, w.h - 22));
      ctx.strokeStyle = 'rgba(214,171,84,.18)'; ctx.strokeRect(w.x + 8.5, w.y + 10.5, Math.max(0, w.w - 17), Math.max(0, w.h - 21));
    }
  });
}

function drawDoors() {
  doors.forEach(door => {
    const center = doorCenter(door);
    ctx.save(); ctx.translate(center.x, center.y);
    const halfW = door.w / 2; const halfH = door.h / 2;
    ctx.fillStyle = 'rgba(2,5,6,.7)'; ctx.fillRect(-halfW - 3, -halfH, door.w + 6, door.h);
    ctx.strokeStyle = '#5d6c6f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-halfW - 3, -halfH); ctx.lineTo(-halfW - 3, halfH); ctx.moveTo(halfW + 3, -halfH); ctx.lineTo(halfW + 3, halfH); ctx.stroke();
    ctx.fillStyle = '#788789'; ctx.fillRect(-halfW - 6, -halfH - 4, door.w + 12, 7); ctx.fillRect(-halfW - 6, halfH - 3, door.w + 12, 7);

    if (door.open) {
      ctx.fillStyle = '#344245'; ctx.fillRect(-halfW + 3, -halfH + 4, door.w - 6, 11);
      ctx.strokeStyle = 'rgba(131,164,157,.4)'; ctx.lineWidth = 1; ctx.strokeRect(-halfW + 4, -halfH + 5, door.w - 8, 9);
      ctx.fillStyle = '#72bea8'; ctx.shadowColor = '#72bea8'; ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.arc(0, -halfH + 9, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    } else {
      const panelColor = door.locked ? '#564839' : '#3d4c4f';
      ctx.fillStyle = 'rgba(0,0,0,.36)'; ctx.fillRect(-halfW + 6, -halfH + 8, door.w - 7, door.h - 10);
      ctx.fillStyle = panelColor; ctx.strokeStyle = door.locked ? '#b78f45' : '#748386'; ctx.lineWidth = 1.5;
      ctx.fillRect(-halfW + 2, -halfH + 5, door.w - 4, door.h - 10); ctx.strokeRect(-halfW + 3, -halfH + 6, door.w - 6, door.h - 12);
      ctx.strokeStyle = 'rgba(170,188,184,.16)';
      for (let y = -halfH + 20; y < halfH - 7; y += 17) { ctx.beginPath(); ctx.moveTo(-halfW + 5, y); ctx.lineTo(halfW - 5, y); ctx.stroke(); }
      ctx.fillStyle = door.locked ? '#ddb75e' : '#8ca09b';
      ctx.beginPath(); ctx.arc(halfW - 7, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    if (door.locked) {
      const ready = keycard.collected;
      ctx.fillStyle = '#172022'; ctx.strokeStyle = ready ? '#72bea8' : '#b78f45'; ctx.lineWidth = 1;
      ctx.fillRect(halfW + 7, -14, 17, 28); ctx.strokeRect(halfW + 7.5, -13.5, 16, 27);
      ctx.fillStyle = ready ? '#72bea8' : '#d08a62'; ctx.beginPath(); ctx.arc(halfW + 15, -6, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 5px "IBM Plex Mono"'; ctx.textAlign = 'center'; ctx.fillStyle = '#85918f'; ctx.fillText(ready ? 'OPEN' : 'LOCK', halfW + 15, 7);
    }
    ctx.restore();
  });
}

function drawKeycard() {
  if (keycard.collected) return;
  const pulse = 1 + Math.sin(visualTime * 4) * .08;
  ctx.save(); ctx.translate(keycard.x, keycard.y); ctx.scale(pulse, pulse);
  ctx.shadowColor = '#6dc5b2'; ctx.shadowBlur = 15;
  ctx.fillStyle = '#7fc8b8'; ctx.strokeStyle = '#d8eee8'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(-13, -9, 26, 18, 3); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#1d4c47'; ctx.fillRect(-8, -4, 6, 8);
  ctx.fillStyle = '#d8eee8'; ctx.fillRect(2, -4, 7, 2); ctx.fillRect(2, 1, 5, 2);
  ctx.font = '500 9px "Noto Sans KR"'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(220,238,233,.78)';
  ctx.fillText(keycard.name, 0, 29); ctx.restore();
}

function colorWithAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16); const g = parseInt(value.slice(2, 4), 16); const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawLighting() {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  lightSources.forEach(light => {
    if (!isLightActive(light)) return;
    const flicker = lightFlicker(light);
    const emergencyPulse = light.emergencyLevel ? .72 + Math.sin(visualTime * 4.8) * .22 : 1;
    const strength = light.intensity * flicker * emergencyPulse;
    let points = lightPolygonCache.get(light.id);
    if (!points) {
      const rays = 72; points = [];
      for (let i = 0; i <= rays; i++) points.push(castRay(light, Math.PI * 2 * i / rays, light.radius));
      lightPolygonCache.set(light.id, points);
    }
    ctx.beginPath(); ctx.moveTo(light.x, light.y); points.forEach(point => ctx.lineTo(point.x, point.y)); ctx.closePath();
    const glow = ctx.createRadialGradient(light.x, light.y, 4, light.x, light.y, light.radius);
    glow.addColorStop(0, colorWithAlpha(light.color, .24 * strength));
    glow.addColorStop(.45, colorWithAlpha(light.color, .11 * strength));
    glow.addColorStop(1, colorWithAlpha(light.color, 0));
    ctx.fillStyle = glow; ctx.fill();
    ctx.fillStyle = colorWithAlpha(light.color, .65 * Math.min(1, strength));
    ctx.beginPath(); ctx.arc(light.x, light.y, light.emergencyLevel ? 4 : 3, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

function drawLightSwitches() {
  lightSwitches.forEach(item => {
    const groupOn = lightSources.some(light => light.group === item.group && light.on);
    ctx.save(); ctx.translate(item.x, item.y);
    ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.beginPath(); ctx.ellipse(3, 11, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#263134'; ctx.fillRect(-11, -13, 22, 28);
    ctx.fillStyle = item.used ? '#3d4647' : '#657477'; ctx.strokeStyle = '#859391'; ctx.lineWidth = 1;
    ctx.fillRect(-10, -15, 20, 25); ctx.strokeRect(-9.5, -14.5, 19, 24);
    ctx.fillStyle = '#172022'; ctx.fillRect(-6, -10, 12, 8);
    ctx.fillStyle = groupOn ? '#82cfad' : '#d17d62'; ctx.shadowColor = groupOn ? '#82cfad' : '#d17d62'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(0, -6, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.font = '600 5px "IBM Plex Mono"'; ctx.textAlign = 'center'; ctx.fillStyle = '#aeb9b5'; ctx.fillText('LIGHT', 0, 6); ctx.restore();
  });
}

function drawHidingSpots() {
  hidingSpots.forEach(spot => {
    ctx.save(); ctx.translate(spot.x, spot.y);
    const suspected = guard.suspectedHideId === spot.id;
    ctx.shadowColor = suspected ? '#ef573f' : 'rgba(0,0,0,.7)'; ctx.shadowBlur = suspected ? 12 : 5;
    const x = -spot.width / 2; const y = -spot.height / 2;
    const body = suspected ? '#71352d' : '#293335'; const edge = suspected ? '#ef765f' : '#59686a';
    ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(x + 7, y + 8, spot.width, spot.height);
    ctx.fillStyle = body; ctx.strokeStyle = edge; ctx.lineWidth = 1.5;
    if (spot.kind === 'curtain') {
      ctx.fillRect(x, y, spot.width, spot.height); ctx.strokeRect(x + .5, y + .5, spot.width - 1, spot.height - 1);
      ctx.fillStyle = suspected ? '#9a4b3d' : '#465557'; ctx.fillRect(x - 3, y - 3, spot.width + 6, 6);
      ctx.strokeStyle = suspected ? '#ef765f' : '#1d292b'; ctx.lineWidth = 1;
      for (let fold = x + 5; fold < x + spot.width; fold += 6) { ctx.beginPath(); ctx.moveTo(fold, y + 4); ctx.lineTo(fold - 2, y + spot.height - 4); ctx.stroke(); }
      ctx.fillStyle = '#1a2224'; ctx.fillRect(x + spot.width - 5, y + 8, 5, spot.height - 16);
    } else if (spot.kind === 'display') {
      ctx.fillRect(x, y + 5, spot.width, spot.height - 5); ctx.strokeRect(x + .5, y + 5.5, spot.width - 1, spot.height - 6);
      ctx.fillStyle = suspected ? '#8b4337' : '#435154'; ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x + 7, y); ctx.lineTo(x + spot.width + 7, y); ctx.lineTo(x + spot.width, y + 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(193,221,216,.28)'; ctx.strokeRect(x + 8, y + 10, spot.width - 16, spot.height - 19);
      ctx.fillStyle = '#151d1f'; ctx.fillRect(x + spot.width - 8, y + 11, 8, spot.height - 17);
      ctx.fillStyle = '#82918c'; ctx.beginPath(); ctx.arc(-4, -2, 7, 0, Math.PI * 2); ctx.fill();
    } else if (spot.kind === 'locker') {
      ctx.fillRect(x, y, spot.width, spot.height); ctx.strokeRect(x + .5, y + .5, spot.width - 1, spot.height - 1);
      const section = spot.width / 3;
      ctx.strokeStyle = suspected ? '#ef765f' : '#435052';
      for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + section * i, y + 2); ctx.lineTo(x + section * i, y + spot.height - 2); ctx.stroke(); }
      ctx.fillStyle = '#151d1f';
      for (let i = 0; i < 3; i++) { ctx.fillRect(x + section * i + 5, y + 6, section - 10, 3); ctx.fillRect(x + section * i + 5, y + 11, section - 10, 2); }
      ctx.fillStyle = '#87938f'; for (let i = 0; i < 3; i++) ctx.fillRect(x + section * (i + 1) - 6, y + 19, 2, 5);
    } else {
      ctx.fillRect(x, y, spot.width, spot.height); ctx.strokeRect(x + .5, y + .5, spot.width - 1, spot.height - 1);
      ctx.fillStyle = '#11191b'; ctx.fillRect(x + spot.width - 7, y + 5, 7, spot.height - 10);
      ctx.strokeStyle = suspected ? '#ef765f' : '#465355';
      for (let shelf = y + 14; shelf < y + spot.height; shelf += 17) { ctx.beginPath(); ctx.moveTo(x + 3, shelf); ctx.lineTo(x + spot.width - 8, shelf); ctx.stroke(); }
      ctx.fillStyle = suspected ? '#9d5545' : '#75674d';
      for (let shelf = y + 5; shelf < y + spot.height - 8; shelf += 17) ctx.fillRect(x + 4, shelf, spot.width - 13, 7);
    }
    ctx.shadowBlur = 0;
    const entry = hidingEntryPoint(spot, 4);
    ctx.fillStyle = suspected ? '#ef765f' : '#8ca49d';
    ctx.beginPath(); ctx.arc(entry.x - spot.x, entry.y - spot.y, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

function drawCctvSystem() {
  cctvCameras.forEach(camera => {
    if (camera.state !== 'DISABLED' && camera.state !== 'COOLDOWN') {
      const range = camera.range + alertLevel * 18;
      const spread = .86; const rays = 30;
      ctx.beginPath(); ctx.moveTo(camera.x, camera.y);
      for (let i = 0; i <= rays; i++) {
        const angle = camera.facing - spread / 2 + spread * i / rays;
        const hit = castRay(camera, angle, range); ctx.lineTo(hit.x, hit.y);
      }
      ctx.closePath();
      const color = camera.state === 'ALERT' ? '#ef573f' : camera.state === 'DETECTING' ? '#e7bd62' : '#72b7c5';
      const glow = ctx.createRadialGradient(camera.x, camera.y, 8, camera.x, camera.y, range);
      glow.addColorStop(0, colorWithAlpha(color, camera.state === 'ALERT' ? .28 : .16));
      glow.addColorStop(1, colorWithAlpha(color, 0));
      ctx.fillStyle = glow; ctx.fill(); ctx.strokeStyle = colorWithAlpha(color, .24); ctx.lineWidth = 1; ctx.stroke();
    }

    ctx.save(); ctx.translate(camera.x, camera.y); ctx.rotate(camera.facing);
    const disabled = camera.state === 'DISABLED';
    const bodyColor = disabled ? '#3d484a' : camera.state === 'ALERT' ? '#e65c47' : camera.state === 'DETECTING' ? '#d8b15b' : '#7baab2';
    ctx.shadowColor = bodyColor; ctx.shadowBlur = disabled ? 0 : 9;
    ctx.fillStyle = '#20282a'; ctx.fillRect(-12, -9, 19, 18);
    ctx.fillStyle = bodyColor; ctx.beginPath(); ctx.moveTo(2, -7); ctx.lineTo(17, -5); ctx.lineTo(20, 0); ctx.lineTo(17, 5); ctx.lineTo(2, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = disabled ? '#202627' : '#d8f5f6'; ctx.beginPath(); ctx.arc(16, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    if (disabled) {
      ctx.fillStyle = 'rgba(143,157,157,.75)'; ctx.font = '500 8px "IBM Plex Mono"'; ctx.textAlign = 'center';
      ctx.fillText(`OFF ${Math.ceil(camera.disabledTime)}s`, camera.x, camera.y - 18);
    }
  });

  cctvPanels.forEach(panel => {
    ctx.save(); ctx.translate(panel.x, panel.y);
    const wallDirection = panel.wallSide === 'left' ? -1 : 1;
    ctx.fillStyle = '#303b3d'; ctx.fillRect(wallDirection * 10, -9, wallDirection * 6, 18);
    ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.fillRect(-6, -11, 20, 28);
    ctx.fillStyle = panel.used ? '#3f4849' : '#596a6e'; ctx.strokeStyle = panel.used ? '#515b5c' : '#7daeb4'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(-10, -14, 20, 28, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#11191b'; ctx.fillRect(-7, -10, 14, 9);
    ctx.fillStyle = panel.used ? '#293031' : '#83d3cf'; ctx.shadowColor = panel.used ? 'transparent' : '#83d3cf'; ctx.shadowBlur = panel.used ? 0 : 7;
    ctx.fillRect(-5, -8, 10, 5); ctx.shadowBlur = 0;
    ctx.fillStyle = panel.used ? '#596262' : '#d0e4df'; ctx.beginPath(); ctx.arc(-4, 4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = panel.used ? '#596262' : '#d6ab54'; ctx.beginPath(); ctx.arc(2, 4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '600 4px "IBM Plex Mono"'; ctx.textAlign = 'center'; ctx.fillStyle = '#aeb9b5'; ctx.fillText('CAM', 0, 11); ctx.restore();
  });
}

function drawGuardVision() {
  drawActorVision(guard);
  drawActorVision(supportGuard);
}

function drawActorVision(actor: GuardActor) {
  const rays = 32;
  const range = (actor.state === 'CHASE' ? 465 : 390) + alertLevel * 18 + Math.sin(visualTime * 7.3) * 3;
  const spread = actor.state === 'CHASE' ? 1.64 : actor.state === 'SEARCH' || actor.state === 'HIDE_CHECK' ? 1.36 : 1.12;
  ctx.beginPath(); ctx.moveTo(actor.x, actor.y);
  for (let i = 0; i <= rays; i++) {
    const a = actor.facing - spread / 2 + spread * i / rays;
    const hit = castRay(actor, a, range);
    ctx.lineTo(hit.x, hit.y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(actor.x, actor.y, 10, actor.x, actor.y, range);
  const visionColor = actor.state === 'CHASE' ? 'rgba(239,87,63,.30)' : actor.state === 'PATROL' ? 'rgba(196,174,91,.13)' : 'rgba(235,145,62,.20)';
  grad.addColorStop(0, visionColor); grad.addColorStop(1, 'rgba(100,80,40,0)');
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = actor.state === 'CHASE' ? 'rgba(255,101,78,.28)' : 'rgba(223,190,105,.15)';
  ctx.lineWidth = 1; ctx.stroke();
  const core = castRay(actor, actor.facing, range * .82);
  const coreGrad = ctx.createLinearGradient(actor.x, actor.y, core.x, core.y);
  coreGrad.addColorStop(0, actor.state === 'CHASE' ? 'rgba(255,105,75,.18)' : 'rgba(238,211,137,.15)');
  coreGrad.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.strokeStyle = coreGrad; ctx.lineWidth = actor.state === 'CHASE' ? 18 : 12;
  ctx.beginPath(); ctx.moveTo(actor.x, actor.y); ctx.lineTo(core.x, core.y); ctx.stroke();
}

function drawExit() {
  ctx.save(); ctx.translate(exit.x, exit.y);
  const locked = exitLockdown > 0;
  const available = treasureTaken && !locked;
  if (treasureTaken && !locked) {
    const pulse = .16 + (Math.sin(visualTime * 4) + 1) * .05;
    const guide = ctx.createLinearGradient(0, -48, 0, 64);
    guide.addColorStop(0, `rgba(98,185,149,${pulse})`); guide.addColorStop(1, 'rgba(98,185,149,0)');
    ctx.fillStyle = guide; ctx.beginPath(); ctx.moveTo(-34, -45); ctx.lineTo(34, -45); ctx.lineTo(48, 62); ctx.lineTo(-48, 62); ctx.closePath(); ctx.fill();
  }

  ctx.fillStyle = 'rgba(3,6,7,.66)'; ctx.fillRect(-43, 20, 86, 35);
  ctx.strokeStyle = 'rgba(132,148,144,.18)'; ctx.lineWidth = 1;
  for (let y = 27; y < 55; y += 9) { ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(40, y); ctx.stroke(); }

  const doorY = 53;
  ctx.fillStyle = '#1b2426'; ctx.fillRect(-52, doorY - 43, 104, 48);
  ctx.fillStyle = '#596568'; ctx.fillRect(-56, doorY - 47, 112, 6); ctx.fillRect(-56, doorY + 1, 112, 7);
  ctx.fillStyle = '#303b3e'; ctx.fillRect(-52, doorY - 41, 5, 42); ctx.fillRect(47, doorY - 41, 5, 42);
  ctx.fillStyle = locked ? '#4d332f' : available ? '#263b36' : '#30393b';
  ctx.strokeStyle = locked ? '#a74f42' : available ? '#619e89' : '#536164'; ctx.lineWidth = 1.5;
  ctx.fillRect(-45, doorY - 39, 43, 38); ctx.strokeRect(-44.5, doorY - 38.5, 42, 37);
  ctx.fillRect(2, doorY - 39, 43, 38); ctx.strokeRect(2.5, doorY - 38.5, 42, 37);
  ctx.strokeStyle = 'rgba(167,184,179,.16)';
  ctx.beginPath(); ctx.moveTo(-23, doorY - 37); ctx.lineTo(-23, doorY - 3); ctx.moveTo(23, doorY - 37); ctx.lineTo(23, doorY - 3); ctx.stroke();

  if (locked) {
    ctx.fillStyle = 'rgba(218,77,59,.34)';
    for (let x = -40; x <= 40; x += 10) ctx.fillRect(x, doorY - 37, 3, 34);
  }

  ctx.fillStyle = '#111718'; ctx.strokeStyle = locked ? '#cf5b49' : available ? '#72bea1' : '#687572';
  ctx.fillRect(-31, -3, 62, 18); ctx.strokeRect(-30.5, -2.5, 61, 17);
  ctx.fillStyle = locked ? '#ff8a77' : available ? '#a9e2c9' : '#aab5b1'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = available || locked ? 8 : 0;
  ctx.font = '700 8px "IBM Plex Mono"'; ctx.textAlign = 'center'; ctx.fillText(locked ? 'SECURITY LOCK' : 'SERVICE EXIT', 0, 9); ctx.shadowBlur = 0;
  ctx.fillStyle = locked ? '#ff8a77' : available ? '#72bea1' : '#65716d'; ctx.beginPath(); ctx.arc(40, 6, 3, 0, Math.PI * 2); ctx.fill();
  if (locked) {
    ctx.fillStyle = '#ff9b89'; ctx.font = '600 8px "IBM Plex Mono"'; ctx.fillText(`${exitLockdown.toFixed(1)} SEC`, 0, 27);
  } else if (!treasureTaken) {
    ctx.fillStyle = '#65716d'; ctx.font = '500 7px "IBM Plex Mono"'; ctx.fillText('LOOT REQUIRED', 0, 27);
  }
  ctx.restore();
}

function drawTreasures() {
  treasures.filter(item => !item.collected).forEach((item, index) => {
    ctx.save(); ctx.translate(item.x, item.y);
    const radius = 45 + index * 5 + Math.sin(visualTime * 2.4 + index) * 5;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    glow.addColorStop(0, `${item.color}52`); glow.addColorStop(1, `${item.color}00`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(8,12,13,.72)'; ctx.beginPath(); ctx.ellipse(0, 11, 25, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = item.color; ctx.strokeStyle = '#edf0e7'; ctx.lineWidth = 1;
    if (item.id === 'crown') {
      ctx.beginPath(); ctx.moveTo(-17, 8); ctx.lineTo(-13, -9); ctx.lineTo(-5, -2); ctx.lineTo(0, -14); ctx.lineTo(7, -2); ctx.lineTo(15, -10); ctx.lineTo(18, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f0d68f'; ctx.fillRect(-17, 5, 35, 5);
    } else if (item.id === 'jewel') {
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(14, -5); ctx.lineTo(9, 13); ctx.lineTo(-9, 13); ctx.lineTo(-14, -5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(-14, -5); ctx.lineTo(14, -5); ctx.moveTo(0, -16); ctx.lineTo(0, 13); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, -2, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#172022'; ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = item.color; ctx.fillRect(-4, 9, 8, 9);
    }
    ctx.font = '500 9px "Noto Sans KR"'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(232,235,225,.72)';
    ctx.fillText(item.name, 0, 36); ctx.restore();
  });
}

function drawPlayer() {
  if (activeHidingSpot) return;
  const speed = Math.min(1, Math.hypot(player.vx, player.vy) / 180);
  const careful = keys.has('shift');
  const crouching = keys.has('c');
  const gait = Math.sin(visualTime * (crouching ? 5.5 : careful ? 7 : 12)) * (crouching ? 3 : 5) * speed;
  const moving = playerMotion.moving;
  ctx.save(); ctx.translate(player.x, player.y);
  if (crouching) ctx.scale(1, .72);
  ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(5, 8, 18, 9, player.facing, 0, Math.PI * 2); ctx.fill();

  if (isCharacterReady(characterAssets.playerWalk)) {
    const walkFrame = moving ? Math.floor(playerMotion.phase) % characterAssets.playerWalk.columns : 0;
    ctx.shadowColor = crouching ? 'rgba(108,196,178,.45)' : 'rgba(108,196,178,.72)';
    ctx.shadowBlur = crouching ? 7 : careful ? 10 : 14;
    drawCharacterFrame(ctx, characterAssets.playerWalk, playerMotion.direction, walkFrame, {
      x: -41, y: -68, width: 82, height: 82,
    });
    ctx.shadowBlur = 0;
    if (treasureTaken) {
      ctx.fillStyle = '#d5aa52'; ctx.strokeStyle = '#fff0b3'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(-20, -41, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (isCharacterReady(characterAssets.player)) {
    ctx.translate(0, gait * .18 - speed * 1.2);
    if (Math.cos(player.facing) < 0) ctx.scale(-1, 1);
    ctx.shadowColor = crouching ? 'rgba(108,196,178,.45)' : 'rgba(108,196,178,.72)';
    ctx.shadowBlur = crouching ? 7 : careful ? 10 : 14;
    ctx.drawImage(characterAssets.player.image, -34, -61, 68, 68);
    ctx.shadowBlur = 0;
    ctx.restore();
    return;
  }

  ctx.rotate(player.facing);
  ctx.strokeStyle = '#33534f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(-11 - Math.abs(gait) * .35, -6 + gait); ctx.moveTo(-5, 5); ctx.lineTo(-11 - Math.abs(gait) * .35, 6 - gait); ctx.stroke();
  ctx.shadowColor = '#6cc4b2'; ctx.shadowBlur = crouching ? 7 : 14; ctx.fillStyle = crouching ? '#6e9c93' : careful ? '#88b9ae' : '#abd8ce';
  ctx.beginPath(); ctx.roundRect(-10, -10, 21, 20, 8); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#d7eee8'; ctx.beginPath(); ctx.arc(8, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#315b55'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.closePath(); ctx.fill();
  if (treasureTaken) {
    ctx.fillStyle = '#b98b3d'; ctx.strokeStyle = '#f0d68f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(-12, -7, 8, 14, 3); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawNoisePulses() {
  noisePulses.forEach(pulse => {
    const progress = pulse.age / pulse.duration;
    const radius = pulse.radius * (.12 + progress * .88);
    ctx.save();
    const subtle = pulse.mode !== 'normal';
    const color = pulse.mode === 'crouch' ? '104,151,143' : pulse.mode === 'careful' ? '112,190,169' : '220,178,92';
    ctx.strokeStyle = `rgba(${color},${(1 - progress) * (pulse.mode === 'crouch' ? .08 : subtle ? .12 : .18)})`;
    ctx.lineWidth = subtle ? 1 : 1.5;
    ctx.setLineDash(subtle ? [3, 8] : [5, 7]);
    ctx.beginPath(); ctx.arc(pulse.x, pulse.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
}

function drawGuardPaths() {
  const paths: Array<{ actor: GuardActor; color: string }> = [{ actor: guard, color: '#d6ab54' }, { actor: supportGuard, color: '#7da8c3' }];
  paths.forEach(({ actor, color }) => {
    const points = actor.path.slice(actor.pathIndex);
    if (!points.length) return;
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(actor.x, actor.y); points.forEach(point => ctx.lineTo(point.x, point.y)); ctx.stroke();
    points.forEach(point => { ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  });
}

function drawGuard() {
  drawGuardActor(guard, '#d6ab54');
  drawGuardActor(supportGuard, '#7da8c3');
}

function drawGuardActor(actor: GuardActor, patrolColor: string) {
  const motion = guardMotionFor(actor);
  const moving = motion.moving;
  const gait = moving ? Math.sin(visualTime * (actor.state === 'CHASE' ? 14 : 8.5) + (actor.id === supportGuard.id ? 1.4 : 0)) * (actor.state === 'CHASE' ? 5 : 3.5) : 0;
  ctx.save(); ctx.translate(actor.x, actor.y);
  ctx.fillStyle = 'rgba(0,0,0,.46)'; ctx.beginPath(); ctx.ellipse(6, 9, 20, 10, actor.facing, 0, Math.PI * 2); ctx.fill();
  const alerted = actor.state !== 'PATROL';

  if (isCharacterReady(characterAssets.guardWalk)) {
    const isWalking = motion.moving;
    const walkFrame = isWalking ? Math.floor(motion.phase) % characterAssets.guardWalk.columns : 0;
    ctx.strokeStyle = actor.state === 'CHASE' ? '#ef6b54' : alerted ? '#df954e' : patrolColor;
    ctx.globalAlpha = actor.state === 'PATROL' ? .55 : .88;
    ctx.lineWidth = actor.state === 'CHASE' ? 2.5 : 1.5;
    ctx.beginPath(); ctx.ellipse(2, 10, 18, 9, actor.facing, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = actor.state === 'CHASE' ? '#ef573f' : alerted ? '#e58d42' : patrolColor;
    ctx.shadowBlur = actor.state === 'CHASE' ? 18 : alerted ? 12 : 6;
    drawCharacterFrame(ctx, characterAssets.guardWalk, isWalking ? motion.direction : directionFromAngle(actor.facing), walkFrame, {
      x: -42, y: -69, width: 84, height: 84,
    });
    ctx.restore();
  } else if (isCharacterReady(characterAssets.guard)) {
    ctx.strokeStyle = actor.state === 'CHASE' ? '#ef6b54' : alerted ? '#df954e' : patrolColor;
    ctx.globalAlpha = actor.state === 'PATROL' ? .55 : .88;
    ctx.lineWidth = actor.state === 'CHASE' ? 2.5 : 1.5;
    ctx.beginPath(); ctx.ellipse(2, 10, 18, 9, actor.facing, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.translate(0, gait * .15 - (moving ? 1 : 0));
    if (Math.cos(actor.facing) < 0) ctx.scale(-1, 1);
    ctx.shadowColor = actor.state === 'CHASE' ? '#ef573f' : alerted ? '#e58d42' : patrolColor;
    ctx.shadowBlur = actor.state === 'CHASE' ? 18 : alerted ? 12 : 6;
    ctx.drawImage(characterAssets.guard.image, -36, -65, 72, 72);
    ctx.restore();
  } else {
    ctx.rotate(actor.facing);
    ctx.strokeStyle = alerted ? '#755138' : '#5d543b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-13, -7 + gait); ctx.moveTo(-6, 6); ctx.lineTo(-13, 7 - gait); ctx.stroke();
    ctx.shadowColor = actor.state === 'CHASE' ? '#ef573f' : alerted ? '#e58d42' : patrolColor; ctx.shadowBlur = actor.state === 'CHASE' ? 18 : alerted ? 12 : 7;
    ctx.fillStyle = actor.state === 'CHASE' ? '#ef6b54' : alerted ? '#df954e' : patrolColor; ctx.beginPath(); ctx.roundRect(-11, -11, 23, 22, 7); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#d7c79f'; ctx.beginPath(); ctx.arc(9, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#171b1c'; ctx.fillRect(5, -7, 7, 14);
    ctx.strokeStyle = '#34302a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(15, -11); ctx.stroke();
    ctx.fillStyle = '#ead891'; ctx.fillRect(14, -13, 7, 4); ctx.restore();
  }
  if (actor.state === 'SUSPICIOUS' || actor.state === 'INVESTIGATE' || actor.state === 'SEARCH' || actor.state === 'HIDE_CHECK') {
    ctx.fillStyle = '#f0b465'; ctx.font = '700 18px "IBM Plex Mono"'; ctx.textAlign = 'center';
    const usesImage = isCharacterReady(characterAssets.guardWalk) || isCharacterReady(characterAssets.guard);
    const markerY = actor.y - (usesImage ? 75 : 27);
    ctx.fillText(actor.state === 'SEARCH' ? '…' : actor.state === 'HIDE_CHECK' ? '!' : '?', actor.x, markerY);
  }
  const feedback = guardFeedback.get(actor.id);
  if (feedback && feedback.expiresAt > elapsed) {
    const remaining = feedback.expiresAt - elapsed;
    const alpha = Math.min(1, remaining * 2.4);
    const color = feedback.tone === 'danger' ? '#ff8b76' : feedback.tone === 'warning' ? '#edbd68' : '#8fc8ba';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '600 9px "Noto Sans KR"';
    const width = Math.max(72, ctx.measureText(feedback.text).width + 18);
    ctx.fillStyle = 'rgba(5,9,10,.9)'; ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(actor.x - width / 2, actor.y - 98, width, 20, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(feedback.text, actor.x, actor.y - 84);
    ctx.restore();
  }
}

function castRay(origin: Point, angle: number, maxRange: number): Point {
  return castVisionRay(origin, angle, maxRange, visionBlockers());
}

function validateCctvCoverage() {
  cctvCameras.forEach(camera => {
    const samples = 25;
    let totalDistance = 0;
    let shortRays = 0;
    for (let index = 0; index < samples; index++) {
      const angle = camera.minAngle + (camera.maxAngle - camera.minAngle) * index / (samples - 1);
      const rayDistance = distance(camera, castRay(camera, angle, camera.range));
      totalDistance += rayDistance;
      if (rayDistance < 90) shortRays++;
    }
    const averageDistance = totalDistance / samples;
    if (averageDistance < camera.range * .35 || shortRays / samples > .5) {
      console.warn(`[Shadow Heist] ${camera.name}의 시야가 벽에 과도하게 막혀 있습니다.`, { averageDistance: Math.round(averageDistance), shortRayRatio: shortRays / samples });
    }
  });
}

function drawFog(points: Point[], visionRadius: number) {
  fogCtx.clearRect(0, 0, WORLD.w, WORLD.h);
  fogCtx.globalCompositeOperation = 'source-over';
  fogCtx.fillStyle = '#020405';
  fogCtx.fillRect(0, 0, WORLD.w, WORLD.h);
  fogCtx.globalCompositeOperation = 'destination-out';
  fogCtx.beginPath(); fogCtx.moveTo(player.x, player.y); points.forEach(p => fogCtx.lineTo(p.x, p.y)); fogCtx.closePath();
  const grad = fogCtx.createRadialGradient(player.x, player.y, 55, player.x, player.y, visionRadius);
  grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(.72, 'rgba(0,0,0,.96)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  fogCtx.fillStyle = grad; fogCtx.fill();
  fogCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(fogCanvas, 0, 0);
  ctx.save(); ctx.strokeStyle = 'rgba(173,214,202,.075)'; ctx.setLineDash([3, 9]);
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.stroke(); ctx.restore();
}

function drawDetectionVignette() {
  const activeDetection = Math.max(detection, supportDetection);
  const alpha = Math.min(.72, activeDetection * .65 + (guard.state === 'CHASE' || supportGuard.state === 'CHASE' ? .15 : 0));
  const grad = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, 180, VIEW.w / 2, VIEW.h / 2, 650);
  grad.addColorStop(.4, 'rgba(150,15,8,0)'); grad.addColorStop(1, `rgba(180,26,13,${alpha})`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  if (activeDetection < 1) {
    ctx.strokeStyle = `rgba(239,87,63,${.3 + activeDetection * .6})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(VIEW.w / 2, 95, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * activeDetection); ctx.stroke();
    ctx.fillStyle = '#ffc0b3'; ctx.font = '600 9px "IBM Plex Mono"'; ctx.textAlign = 'center'; ctx.fillText('DETECTED', VIEW.w / 2, 99);
  }
}

function drawAlarmAtmosphere() {
  const interval = Math.max(1.45, 3.1 - alertLevel * .45);
  const beatPhase = treasureBeat % interval;
  const beat = Math.max(0, 1 - beatPhase * 2.2);
  ctx.fillStyle = `rgba(187,42,25,${.008 * alertLevel + beat * (.025 + alertLevel * .012)})`;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = `rgba(229,72,45,${.18 + beat * .22})`;
  ctx.fillRect(0, 0, VIEW.w, 2);
  ctx.font = '500 9px "IBM Plex Mono"'; ctx.textAlign = 'right'; ctx.fillStyle = `rgba(239,112,85,${.45 + beat * .35})`;
  ctx.fillText(`SECURITY ALERT // LEVEL ${alertLevel}`, VIEW.w - 28, 82);
}

function drawStateFlash() {
  const danger = guard.state === 'CHASE' || supportGuard.state === 'CHASE';
  ctx.strokeStyle = danger ? `rgba(255,72,48,${stateFlash * .8})` : `rgba(238,170,72,${stateFlash * .65})`;
  ctx.lineWidth = 10 * stateFlash;
  ctx.strokeRect(5, 5, VIEW.w - 10, VIEW.h - 10);
  if (danger) {
    ctx.fillStyle = `rgba(239,62,39,${stateFlash * .11})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
}

function drawHidingOverlay() {
  const guardDistance = Math.min(distance(player, guard), distance(player, supportGuard));
  const pressure = Math.max(0, 1 - guardDistance / 360);
  const pulse = .5 + Math.sin(visualTime * (3 + pressure * 5)) * .5;
  const vignette = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, 85, VIEW.w / 2, VIEW.h / 2, 520);
  vignette.addColorStop(0, 'rgba(2,5,6,.08)'); vignette.addColorStop(.55, 'rgba(2,5,6,.42)'); vignette.addColorStop(1, 'rgba(1,3,4,.91)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = `rgba(224,92,67,${pressure * pulse * .09})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.strokeStyle = 'rgba(188,202,196,.08)'; ctx.lineWidth = 2;
  for (let y = 195; y <= 525; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW.w, y); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.font = '500 9px "IBM Plex Mono"'; ctx.fillStyle = guard.suspectedHideId === activeHidingSpot?.id ? '#ef846d' : '#778684';
  ctx.fillText(guard.suspectedHideId === activeHidingSpot?.id ? 'HIDING PLACE COMPROMISED' : 'HIDDEN // LISTEN', VIEW.w / 2, VIEW.h - 34);
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function frame(now: number) {
  visualTime = now / 1000;
  const dt = Math.min(.033, (now - lastTime) / 1000); lastTime = now; update(dt, now); draw();
}

addEventListener('keydown', e => {
  if (e.key === 'F2') { e.preventDefault(); toggleDevPanel(); return; }
  keys.add(e.key.toLowerCase());
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.key.toLowerCase() === 'e' && !e.repeat) interact();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
document.querySelector('#startButton')!.addEventListener('click', startGame);
document.querySelector('#retryButton')!.addEventListener('click', startGame);
document.querySelector('#closeDevPanel')!.addEventListener('click', () => toggleDevPanel(false));
document.querySelector('#exportRuns')!.addEventListener('click', exportPlaytestRuns);
document.querySelector('#clearRuns')!.addEventListener('click', () => {
  if (confirm('저장된 플레이테스트 기록을 모두 지울까요?')) clearPlaytestRuns();
});
debugPathsInput.addEventListener('change', () => { debugPaths = debugPathsInput.checked; });
showNoiseWavesInput.addEventListener('change', () => { showNoiseWaves = showNoiseWavesInput.checked; });

validateCctvCoverage();
camera.x = 0; camera.y = WORLD.h - VIEW.h; requestAnimationFrame(frame);
