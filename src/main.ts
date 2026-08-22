import './style.css';
import { hidingSpots, type HidingSpot } from './hiding';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Treasure = Point & { id: string; name: string; value: number; color: string; collected: boolean };
type LightSource = Point & { id: string; radius: number; intensity: number; color: string; group: string; on: boolean; defaultOn: boolean; linkedTreasure?: string; emergencyLevel?: number; flicker?: boolean };
type LightSwitch = Point & { id: string; group: string; used: boolean };
type GameState = 'menu' | 'playing' | 'won' | 'caught';
type GuardState = 'PATROL' | 'SUSPICIOUS' | 'INVESTIGATE' | 'CHASE' | 'SEARCH' | 'HIDE_CHECK';
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
const soundDirection = document.querySelector<HTMLElement>('#soundDirection')!;
const soundBars = [...document.querySelectorAll<HTMLElement>('.bars i')];
const lootCount = document.querySelector<HTMLElement>('#lootCount')!;
const scorePreview = document.querySelector<HTMLElement>('#scorePreview')!;
const alertText = document.querySelector<HTMLElement>('#alertText')!;
const alertReadout = document.querySelector<HTMLElement>('.alert-readout')!;
const exposureText = document.querySelector<HTMLElement>('#exposureText')!;
const exposureReadout = document.querySelector<HTMLElement>('.exposure-readout')!;

const VIEW = { w: 1280, h: 720 };
const WORLD = { w: 1800, h: 1100 };
const fogCanvas = document.createElement('canvas');
fogCanvas.width = WORLD.w;
fogCanvas.height = WORLD.h;
const fogCtx = fogCanvas.getContext('2d')!;
const OUTER = 46;
const PLAYER_RADIUS = 14;
const GUARD_RADIUS = 16;
const MIN_PLAYER_VISION = 215;
const keys = new Set<string>();

const walls: Rect[] = [
  { x: 0, y: 0, w: WORLD.w, h: OUTER }, { x: 0, y: WORLD.h - OUTER, w: WORLD.w, h: OUTER },
  { x: 0, y: 0, w: OUTER, h: WORLD.h }, { x: WORLD.w - OUTER, y: 0, w: OUTER, h: WORLD.h },
  { x: 310, y: 46, w: 32, h: 250 }, { x: 310, y: 420, w: 32, h: 250 }, { x: 310, y: 800, w: 32, h: 254 },
  { x: 650, y: 220, w: 32, h: 255 }, { x: 650, y: 595, w: 32, h: 245 },
  { x: 1010, y: 46, w: 32, h: 205 }, { x: 1010, y: 370, w: 32, h: 285 }, { x: 1010, y: 775, w: 32, h: 279 },
  { x: 1370, y: 255, w: 32, h: 225 }, { x: 1370, y: 600, w: 32, h: 260 },
  { x: 342, y: 295, w: 190, h: 32 }, { x: 650, y: 840, w: 220, h: 32 },
  { x: 1042, y: 655, w: 190, h: 32 }, { x: 1402, y: 480, w: 352, h: 32 },
  { x: 1160, y: 160, w: 130, h: 52 }, { x: 1510, y: 180, w: 90, h: 190 },
  { x: 430, y: 720, w: 120, h: 70 }, { x: 780, y: 370, w: 110, h: 55 },
];

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
const lightPolygonCache = new Map<string, Point[]>();
const exit = { x: 135, y: 990 };
const patrol: Point[] = [
  { x: 530, y: 510 }, { x: 740, y: 520 }, { x: 930, y: 520 }, { x: 930, y: 300 },
  { x: 1200, y: 300 }, { x: 1280, y: 520 }, { x: 1300, y: 610 }, { x: 1300, y: 730 },
  { x: 900, y: 735 }, { x: 900, y: 920 }, { x: 590, y: 930 }, { x: 590, y: 565 },
  { x: 530, y: 565 },
];
const guard = {
  x: 530, y: 510, facing: 0, target: 1,
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

class AudioEngine {
  context?: AudioContext;
  master?: GainNode;
  nextStep = 0;
  nextAlarm = 0;
  nextHum = 0;

  start() {
    if (this.context) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.context.destination);
  }

  update(now: number, distance: number, pan: number, chasing: boolean, occluded: boolean) {
    if (!this.context || !this.master || state !== 'playing') return;
    const audible = Math.max(0, 1 - distance / 720);
    if (audible <= 0 || now < this.nextStep) return;
    this.nextStep = now + (chasing ? 270 : 470 + distance * .35);
    this.step(audible * (occluded ? .68 : 1), pan, chasing, occluded);
  }

  step(volume: number, pan: number, chasing: boolean, occluded: boolean) {
    if (!this.context || !this.master) return;
    const t = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const filter = this.context.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(chasing ? 75 : 58, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + .13);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.13 * volume, t + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .18);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    filter.type = 'lowpass';
    filter.frequency.value = occluded ? 420 : 1900;
    filter.Q.value = occluded ? 1.4 : .6;
    osc.connect(gain).connect(filter).connect(panner).connect(this.master);
    osc.start(t); osc.stop(t + .2);
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
    if (!this.context || !this.master || !treasureTaken || state !== 'playing' || now < this.nextAlarm) return;
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
}
const audio = new AudioEngine();

function collectedTreasureCount() { return treasures.filter(item => item.collected).length; }

function currentTake() {
  const multipliers = [0, 1, 1.15, 1.35];
  return Math.round(lootScore * multipliers[collectedTreasureCount()]);
}

function calculateFinalScore(won: boolean) {
  if (!won) return 0;
  const speedBonus = Math.max(0, Math.round(1200 - elapsed * 7));
  const stealthBonus = spottedCount === 0 ? 1000 : Math.max(0, 500 - spottedCount * 200);
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

function resetGame() {
  player.x = 135; player.y = 940; player.vx = 0; player.vy = 0; player.facing = -Math.PI / 2;
  guard.x = 530; guard.y = 510; guard.facing = 0; guard.target = 1; guard.state = 'PATROL';
  guard.stateTime = 0; guard.lostSightTime = 0; guard.searchStep = 0;
  guard.path = []; guard.pathIndex = 0; guard.repathTimer = 0; guard.suspectedHideId = null;
  audio.nextAlarm = 0; audio.nextHum = 0;
  treasures.forEach(item => { item.collected = false; });
  lightSources.forEach(light => { light.on = light.defaultOn; });
  lightSwitches.forEach(item => { item.used = false; });
  treasureTaken = false; alertLevel = 0; lootScore = 0; finalScore = 0;
  playerExposure = .12;
  maxExposure = .12; brightTime = 0; darkTime = 0; switchesUsed = 0;
  activeHidingSpot = null; hidingTime = 0; hideEntries = 0; safeHides = 0;
  hideChecks = 0; hiddenCaptures = 0; noiseInvestigations = 0;
  spottedCount = 0; elapsed = 0; detection = 0; shake = 0;
  stateFlash = 0; treasureBeat = 0;
  maxDetection = 0; chaseTime = 0; closeCalls = 0; playtestEvents = [];
  objectiveText.textContent = '보물을 훔치고 살아서 돌아오세요';
  setStatus('미탐지', false);
  updateMissionHud();
  updateExposureHud();
}

function startGame() {
  audio.start(); resetGame(); state = 'playing'; lastTime = performance.now();
  startScreen.classList.remove('visible'); resultScreen.classList.remove('visible');
}

function finishGame(won: boolean) {
  state = won ? 'won' : 'caught';
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
    version: 'prototype-02',
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
}

function setStatus(text: string, danger: boolean, warning = false) {
  statusBadge.querySelector('span')!.textContent = text;
  statusBadge.classList.toggle('danger', danger);
  statusBadge.classList.toggle('warning', warning);
}

function collidesCircle(x: number, y: number, r: number) {
  return walls.some(w => {
    const nx = Math.max(w.x, Math.min(x, w.x + w.w));
    const ny = Math.max(w.y, Math.min(y, w.y + w.h));
    return (x - nx) ** 2 + (y - ny) ** 2 < r ** 2;
  });
}

function moveEntity(entity: { x: number; y: number }, dx: number, dy: number, r: number) {
  if (!collidesCircle(entity.x + dx, entity.y, r)) entity.x += dx;
  if (!collidesCircle(entity.x, entity.y + dy, r)) entity.y += dy;
}

function segmentIntersectsRect(a: Point, b: Point, r: Rect) {
  const edges: [Point, Point][] = [
    [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }],
    [{ x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }],
    [{ x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }],
    [{ x: r.x, y: r.y + r.h }, { x: r.x, y: r.y }],
  ];
  return edges.some(([c, d]) => {
    const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(den) < .001) return false;
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
    const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / den;
    return t > .001 && t < .999 && u >= 0 && u <= 1;
  });
}

function hasLineOfSight(a: Point, b: Point) { return !walls.some(w => segmentIntersectsRect(a, b, w)); }
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
  return MIN_PLAYER_VISION + playerExposure * 112;
}

function guardCanSeePoint(point: Point, exposure = playerExposure) {
  const chaseVision = guard.state === 'CHASE';
  const range = ((chaseVision ? 465 : 390) + alertLevel * 18) * (.68 + exposure * .55);
  const angle = chaseVision ? .82 : .56;
  const direction = Math.atan2(point.y - guard.y, point.x - guard.x);
  return distance(guard, point) < range && Math.abs(angleDelta(direction, guard.facing)) < angle && hasLineOfSight(guard, point);
}

function beginHideCheck(spot: HidingSpot) {
  guard.suspectedHideId = spot.id;
  guard.lastSeen = { x: spot.x, y: spot.y };
  hideChecks++;
  setGuardState('HIDE_CHECK');
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
  return !collidesCircle(p.x, p.y, GUARD_RADIUS + 5);
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
      if (!collidesCircle(goal.x, goal.y, GUARD_RADIUS + 2)) result.push({ x: goal.x, y: goal.y });
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
    if (collidesCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, GUARD_RADIUS + 2)) return false;
  }
  return true;
}

function moveGuardTo(target: Point, speed: number, dt: number) {
  guard.repathTimer -= dt;
  const targetMoved = distance(guard.pathTarget, target) > 55;
  if (guard.repathTimer <= 0 || targetMoved || guard.pathIndex >= guard.path.length) {
    guard.path = clearPathForGuard(guard, target) ? [{ x: target.x, y: target.y }] : findPath(guard, target);
    guard.pathIndex = 0;
    guard.pathTarget = { x: target.x, y: target.y };
    guard.repathTimer = guard.state === 'CHASE' ? .28 : .7;
  }
  while (guard.pathIndex < guard.path.length && distance(guard, guard.path[guard.pathIndex]) < 15) guard.pathIndex++;
  const waypoint = guard.path[guard.pathIndex];
  if (!waypoint) return distance(guard, target) < 28;
  const desired = Math.atan2(waypoint.y - guard.y, waypoint.x - guard.x);
  guard.facing += angleDelta(desired, guard.facing) * Math.min(1, dt * 9);
  moveEntity(guard, Math.cos(desired) * speed * dt, Math.sin(desired) * speed * dt, GUARD_RADIUS);
  return distance(guard, target) < 28;
}

function logPlaytestEvent(type: string) {
  playtestEvents.push({ time: Number(elapsed.toFixed(2)), type, x: Math.round(player.x), y: Math.round(player.y) });
}

function setGuardState(next: GuardState) {
  if (guard.state === next) return;
  guard.state = next; guard.stateTime = 0; guard.repathTimer = 0; guard.path = []; guard.pathIndex = 0;
  if (next === 'CHASE') { spottedCount++; shake = 12; stateFlash = 1; }
  else if (next === 'SUSPICIOUS') stateFlash = Math.max(stateFlash, .32);
  if (next === 'SEARCH') { guard.searchOrigin = { ...guard.lastSeen }; guard.searchStep = 0; }
  audio.cue(next);
  logPlaytestEvent(`guard:${next.toLowerCase()}`);
}

function searchPoint() {
  const ring = 75 + Math.floor(guard.searchStep / 4) * 55;
  const angle = guard.searchStep * Math.PI / 2 + Math.PI / 4;
  const candidate = { x: guard.searchOrigin.x + Math.cos(angle) * ring, y: guard.searchOrigin.y + Math.sin(angle) * ring };
  if (!collidesCircle(candidate.x, candidate.y, GUARD_RADIUS + 5)) return candidate;
  return guard.searchOrigin;
}

function update(dt: number, now: number) {
  if (state !== 'playing') return;
  elapsed += dt;
  stateFlash = Math.max(0, stateFlash - dt * 2.2);
  if (treasureTaken) treasureBeat += dt;
  const xInput = activeHidingSpot ? 0 : (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const yInput = activeHidingSpot ? 0 : (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  const len = Math.hypot(xInput, yInput) || 1;
  const careful = keys.has('shift');
  const speed = careful ? 118 : 205;
  const tx = xInput / len * speed; const ty = yInput / len * speed;
  player.vx += (tx - player.vx) * Math.min(1, dt * 12);
  player.vy += (ty - player.vy) * Math.min(1, dt * 12);
  if (!xInput && !yInput) { player.vx *= Math.max(0, 1 - dt * 12); player.vy *= Math.max(0, 1 - dt * 12); }
  if (Math.hypot(player.vx, player.vy) > 5) player.facing = Math.atan2(player.vy, player.vx);
  moveEntity(player, player.vx * dt, player.vy * dt, PLAYER_RADIUS);
  if (activeHidingSpot) hidingTime += dt;
  const exposureTarget = lightLevelAt(player);
  playerExposure += (exposureTarget - playerExposure) * Math.min(1, dt * 6);
  maxExposure = Math.max(maxExposure, playerExposure);
  if (playerExposure >= .6) brightTime += dt;
  if (playerExposure < .28) darkTime += dt;
  updateExposureHud();

  const guardDistance = distance(player, guard);
  const sees = !activeHidingSpot && guardCanSeePoint(player);
  guard.stateTime += dt;

  if (sees) {
    guard.lastSeen = { x: player.x, y: player.y };
    guard.lostSightTime = 0;
    const exposureRate = .56 + playerExposure * .74;
    detection = Math.min(1, detection + dt * ((guard.state === 'SUSPICIOUS' ? 2.1 : 2.7) + alertLevel * .14) * exposureRate);
  } else {
    guard.lostSightTime += dt;
    if (guard.state !== 'CHASE') detection = Math.max(0, detection - dt * 1.15);
  }
  maxDetection = Math.max(maxDetection, detection);

  switch (guard.state) {
    case 'PATROL': {
      if (sees || detection > .12) {
        setGuardState('SUSPICIOUS');
      } else if (moveGuardTo(patrol[guard.target], 82 + alertLevel * 7, dt)) {
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
      if (detection >= 1) setGuardState('CHASE');
      else if (!sees && guard.stateTime > .75) {
        if (detection < .28) {
          closeCalls++; detection = 0; setGuardState('PATROL');
        } else setGuardState('INVESTIGATE');
      }
      break;
    }
    case 'INVESTIGATE': {
      setStatus('마지막 움직임 조사 중', false, true);
      if (detection >= 1) setGuardState('CHASE');
      else if (moveGuardTo(guard.lastSeen, 108 + alertLevel * 7, dt)) {
        const nearbySpot = activeHidingSpot && distance(activeHidingSpot, guard.lastSeen) < 115 ? activeHidingSpot : null;
        const checkChance = alertLevel >= 2 ? .2 + alertLevel * .2 : 0;
        if (nearbySpot && Math.random() < checkChance) beginHideCheck(nearbySpot);
        else setGuardState('SEARCH');
      }
      break;
    }
    case 'CHASE': {
      chaseTime += dt;
      setStatus('발각 — 추격 중', true);
      if (sees) guard.lastSeen = { x: player.x, y: player.y };
      moveGuardTo(guard.lastSeen, 176 + alertLevel * 7, dt);
      if (!sees && guard.lostSightTime > 1.8) {
        detection = .55;
        setGuardState('INVESTIGATE');
      }
      break;
    }
    case 'SEARCH': {
      setStatus('주변 수색 중', false, true);
      const target = searchPoint();
      if (sees && detection > .62) setGuardState('CHASE');
      else if (sees) setGuardState('SUSPICIOUS');
      else if (moveGuardTo(target, 94 + alertLevel * 6, dt)) { guard.searchStep++; guard.repathTimer = 0; }
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
      } else if (moveGuardTo(spot, 132 + alertLevel * 7, dt)) {
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
  if (!activeHidingSpot && guard.state === 'CHASE' && guardDistance < PLAYER_RADIUS + GUARD_RADIUS + 5) finishGame(false);

  const proximity = Math.max(0, 1 - guardDistance / 720);
  const barCount = Math.ceil(proximity * 5);
  soundBars.forEach((bar, i) => bar.classList.toggle('active', i < barCount));
  const screenDx = guard.x - player.x;
  soundDirection.textContent = proximity < .08 ? '·' : Math.abs(screenDx) < 60 ? '◆' : screenDx < 0 ? '←' : '→';
  audio.update(now, guardDistance, screenDx / 350, guard.state === 'CHASE', !hasLineOfSight(player, guard));
  audio.updateAlarm(now);
  audio.updateLightHum(now, playerExposure);

  const nearbyTreasure = treasures.find(item => !item.collected && distance(player, item) < 52);
  const nearbyHide = activeHidingSpot ?? hidingSpots.find(item => distance(player, item) < 52);
  const nearbySwitch = lightSwitches.find(item => !item.used && distance(player, item) < 48);
  const nearExit = treasureTaken && distance(player, exit) < 65;
  prompt.classList.toggle('hidden', !nearbyTreasure && !nearbyHide && !nearbySwitch && !nearExit);
  const switchOn = nearbySwitch ? lightSources.some(light => light.group === nearbySwitch.group && light.on) : false;
  prompt.innerHTML = activeHidingSpot ? `<b>E</b> ${activeHidingSpot.name}에서 나오기`
    : nearbyTreasure
    ? `<b>E</b> ${nearbyTreasure.name} 훔치기 · ${nearbyTreasure.value.toLocaleString('ko-KR')}`
    : nearbyHide ? `<b>E</b> ${nearbyHide.name}에 숨기`
    : nearbySwitch ? `<b>E</b> 구역 조명 ${switchOn ? '끄기' : '켜기'} · 1회용`
    : nearExit ? `<b>E</b> 지금 탈출 · ${currentTake().toLocaleString('ko-KR')}점 확보` : '';

  const camTargetX = Math.max(0, Math.min(WORLD.w - VIEW.w, player.x - VIEW.w / 2));
  const camTargetY = Math.max(0, Math.min(WORLD.h - VIEW.h, player.y - VIEW.h / 2));
  camera.x += (camTargetX - camera.x) * Math.min(1, dt * 5);
  camera.y += (camTargetY - camera.y) * Math.min(1, dt * 5);
  shake *= Math.max(0, 1 - dt * 6);
}

function enterHiding(spot: HidingSpot) {
  const witnessed = guardCanSeePoint(player) || (guard.state === 'CHASE' && hasLineOfSight(guard, player));
  activeHidingSpot = spot;
  player.x = spot.x; player.y = spot.y; player.vx = 0; player.vy = 0;
  hideEntries++; audio.hideMovement(true); logPlaytestEvent(`hide:enter:${spot.id}`);
  if (witnessed) {
    beginHideCheck(spot);
  } else {
    const soundRange = hasLineOfSight(guard, spot) ? 235 : 145;
    if (distance(guard, spot) < soundRange) {
      noiseInvestigations++;
      guard.lastSeen = { x: spot.x, y: spot.y };
      detection = Math.max(detection, .3);
      setGuardState('INVESTIGATE');
      logPlaytestEvent(`hide:noise:${spot.id}`);
    }
  }
}

function exitHiding() {
  if (!activeHidingSpot) return;
  const spot = activeHidingSpot;
  activeHidingSpot = null;
  const exits = [{ x: spot.x + 30, y: spot.y }, { x: spot.x - 30, y: spot.y }, { x: spot.x, y: spot.y + 30 }, { x: spot.x, y: spot.y - 30 }];
  const exitPoint = exits.find(point => !collidesCircle(point.x, point.y, PLAYER_RADIUS)) ?? spot;
  player.x = exitPoint.x; player.y = exitPoint.y; player.vx = 0; player.vy = 0;
  safeHides++; audio.hideMovement(false); logPlaytestEvent(`hide:exit:${spot.id}`);
  if (guardCanSeePoint(player)) {
    detection = 1; guard.lastSeen = { x: player.x, y: player.y }; setGuardState('CHASE');
  } else {
    const soundRange = hasLineOfSight(guard, player) ? 255 : 155;
    if (distance(guard, player) < soundRange && guard.state !== 'HIDE_CHECK') {
      noiseInvestigations++;
      guard.lastSeen = { x: player.x, y: player.y };
      detection = Math.max(detection, .34);
      setGuardState('INVESTIGATE');
      logPlaytestEvent(`hide:exit-noise:${spot.id}`);
    }
  }
}

function interact() {
  if (state !== 'playing') return;
  if (activeHidingSpot) { exitHiding(); return; }
  const nearbyTreasure = treasures.find(item => !item.collected && distance(player, item) < 52);
  if (nearbyTreasure) {
    nearbyTreasure.collected = true;
    treasureTaken = true;
    lootScore += nearbyTreasure.value;
    alertLevel = collectedTreasureCount();
    const allCollected = alertLevel === treasures.length;
    objectiveText.textContent = allCollected ? '모든 보물 확보 — 출구로 탈출하세요' : '탈출하거나, 더 깊이 들어가세요';
    updateMissionHud(); shake = 7 + alertLevel * 2; stateFlash = Math.max(stateFlash, .42);
    logPlaytestEvent(`treasure:${nearbyTreasure.id}`);
    if (guard.state !== 'CHASE') {
      guard.lastSeen = { x: nearbyTreasure.x, y: nearbyTreasure.y };
      detection = Math.max(detection, .28 + alertLevel * .12);
      guard.target = alertLevel === 3 ? 10 : (guard.target + 3) % patrol.length;
      setGuardState('INVESTIGATE');
    }
    if (audio.context && audio.master) audio.sting(true);
  } else {
    const nearbyHide = hidingSpots.find(item => distance(player, item) < 52);
    if (nearbyHide) { enterHiding(nearbyHide); return; }
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
        setGuardState('INVESTIGATE');
      }
    } else if (treasureTaken && distance(player, exit) < 65) finishGame(true);
  }
}

function draw() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const width = canvas.clientWidth; const height = canvas.clientHeight;
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) { canvas.width = width * dpr; canvas.height = height * dpr; }
  ctx.setTransform(dpr * width / VIEW.w, 0, 0, dpr * height / VIEW.h, 0, 0);
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  const sx = shake ? (Math.random() - .5) * shake : 0; const sy = shake ? (Math.random() - .5) * shake : 0;
  ctx.save(); ctx.translate(-camera.x + sx, -camera.y + sy);
  drawFloor(); drawObjects(); drawLighting(); drawLightSwitches(); drawHidingSpots(); drawGuardVision(); drawExit(); drawTreasures(); drawGuard(); drawPlayer(); drawForegroundFaces(); drawFog();
  ctx.restore();
  if (detection > 0 && state === 'playing') drawDetectionVignette();
  if (treasureTaken && state === 'playing') drawAlarmAtmosphere();
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

function drawForegroundFaces() {
  walls.forEach(w => {
    const fixture = w.w > 45 && w.h > 45;
    const depth = fixture ? 11 : 15;
    ctx.fillStyle = fixture ? '#1b2426' : '#20292b';
    ctx.beginPath(); ctx.moveTo(w.x, w.y + w.h); ctx.lineTo(w.x + w.w, w.y + w.h); ctx.lineTo(w.x + w.w + 7, w.y + w.h + depth); ctx.lineTo(w.x + 7, w.y + w.h + depth); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fixture ? '#354447' : '#465255';
    ctx.beginPath(); ctx.moveTo(w.x + w.w, w.y); ctx.lineTo(w.x + w.w + 7, w.y + 7); ctx.lineTo(w.x + w.w + 7, w.y + w.h + depth); ctx.lineTo(w.x + w.w, w.y + w.h); ctx.closePath(); ctx.fill();
  });
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
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-9, -12, 21, 27);
    ctx.fillStyle = item.used ? '#42494a' : '#899795'; ctx.fillRect(-8, -13, 16, 24);
    ctx.fillStyle = groupOn ? '#b9d9b7' : '#d18868'; ctx.beginPath(); ctx.arc(0, groupOn ? -5 : 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = '500 7px "IBM Plex Mono"'; ctx.textAlign = 'center'; ctx.fillStyle = '#1a2021'; ctx.fillText('PWR', 0, 1); ctx.restore();
  });
}

function drawHidingSpots() {
  hidingSpots.forEach(spot => {
    ctx.save(); ctx.translate(spot.x, spot.y);
    const suspected = guard.suspectedHideId === spot.id;
    ctx.shadowColor = suspected ? '#ef573f' : 'rgba(0,0,0,.7)'; ctx.shadowBlur = suspected ? 12 : 5;
    ctx.fillStyle = suspected ? '#71352d' : '#293335'; ctx.strokeStyle = suspected ? '#ef765f' : '#536164'; ctx.lineWidth = 2;
    if (spot.kind === 'curtain') {
      ctx.fillRect(-18, -14, 36, 28); ctx.strokeRect(-18, -14, 36, 28);
      ctx.strokeStyle = suspected ? '#ef765f' : '#414e50'; ctx.lineWidth = 1;
      for (let x = -12; x <= 12; x += 8) { ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x - 3, 12); ctx.stroke(); }
    } else if (spot.kind === 'display') {
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(203,220,214,.2)'; ctx.beginPath(); ctx.ellipse(0, -3, 17, 8, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (spot.kind === 'locker') {
      ctx.fillRect(-17, -19, 34, 38); ctx.strokeRect(-17, -19, 34, 38);
      ctx.fillStyle = '#697575'; ctx.beginPath(); ctx.arc(9, 1, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillRect(-21, -15, 42, 30); ctx.strokeRect(-21, -15, 42, 30);
      ctx.strokeStyle = '#465355'; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(14, -8); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.moveTo(-14, 8); ctx.lineTo(14, 8); ctx.stroke();
    }
    ctx.restore();
  });
}

function drawGuardVision() {
  const rays = 32;
  const range = (guard.state === 'CHASE' ? 465 : 390) + alertLevel * 18 + Math.sin(visualTime * 7.3) * 3;
  const spread = guard.state === 'CHASE' ? 1.64 : guard.state === 'SEARCH' || guard.state === 'HIDE_CHECK' ? 1.36 : 1.12;
  ctx.beginPath(); ctx.moveTo(guard.x, guard.y);
  for (let i = 0; i <= rays; i++) {
    const a = guard.facing - spread / 2 + spread * i / rays;
    const hit = castRay(guard, a, range);
    ctx.lineTo(hit.x, hit.y);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, range);
  const visionColor = guard.state === 'CHASE' ? 'rgba(239,87,63,.30)' : guard.state === 'PATROL' ? 'rgba(196,174,91,.13)' : 'rgba(235,145,62,.20)';
  grad.addColorStop(0, visionColor); grad.addColorStop(1, 'rgba(100,80,40,0)');
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = guard.state === 'CHASE' ? 'rgba(255,101,78,.28)' : 'rgba(223,190,105,.15)';
  ctx.lineWidth = 1; ctx.stroke();
  const core = castRay(guard, guard.facing, range * .82);
  const coreGrad = ctx.createLinearGradient(guard.x, guard.y, core.x, core.y);
  coreGrad.addColorStop(0, guard.state === 'CHASE' ? 'rgba(255,105,75,.18)' : 'rgba(238,211,137,.15)');
  coreGrad.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.strokeStyle = coreGrad; ctx.lineWidth = guard.state === 'CHASE' ? 18 : 12;
  ctx.beginPath(); ctx.moveTo(guard.x, guard.y); ctx.lineTo(core.x, core.y); ctx.stroke();
}

function drawExit() {
  ctx.save(); ctx.translate(exit.x, exit.y);
  if (treasureTaken) {
    const pulse = 34 + Math.sin(visualTime * 4) * 5;
    ctx.strokeStyle = 'rgba(98,185,149,.18)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = treasureTaken ? '#62b995' : '#53615d'; ctx.lineWidth = 2;
  ctx.strokeRect(-35, -22, 70, 44); ctx.setLineDash([5, 5]); ctx.strokeRect(-43, -30, 86, 60);
  ctx.setLineDash([]); ctx.fillStyle = treasureTaken ? '#91d9b9' : '#65716d'; ctx.font = '600 10px "IBM Plex Mono"'; ctx.textAlign = 'center'; ctx.fillText('EXIT', 0, 4); ctx.restore();
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
  const gait = Math.sin(visualTime * (careful ? 7 : 12)) * 5 * speed;
  ctx.save(); ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(5, 8, 18, 9, player.facing, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(player.facing);
  ctx.strokeStyle = '#33534f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(-11 - Math.abs(gait) * .35, -6 + gait); ctx.moveTo(-5, 5); ctx.lineTo(-11 - Math.abs(gait) * .35, 6 - gait); ctx.stroke();
  ctx.shadowColor = '#6cc4b2'; ctx.shadowBlur = 14; ctx.fillStyle = careful ? '#88b9ae' : '#abd8ce';
  ctx.beginPath(); ctx.roundRect(-10, -10, 21, 20, 8); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#d7eee8'; ctx.beginPath(); ctx.arc(8, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#315b55'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.closePath(); ctx.fill();
  if (treasureTaken) {
    ctx.fillStyle = '#b98b3d'; ctx.strokeStyle = '#f0d68f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(-12, -7, 8, 14, 3); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawGuard() {
  const moving = guard.state !== 'SUSPICIOUS';
  const gait = moving ? Math.sin(visualTime * (guard.state === 'CHASE' ? 14 : 8.5)) * (guard.state === 'CHASE' ? 5 : 3.5) : 0;
  ctx.save(); ctx.translate(guard.x, guard.y);
  ctx.fillStyle = 'rgba(0,0,0,.46)'; ctx.beginPath(); ctx.ellipse(6, 9, 20, 10, guard.facing, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(guard.facing);
  const alerted = guard.state !== 'PATROL';
  ctx.strokeStyle = alerted ? '#755138' : '#5d543b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-13, -7 + gait); ctx.moveTo(-6, 6); ctx.lineTo(-13, 7 - gait); ctx.stroke();
  ctx.shadowColor = guard.state === 'CHASE' ? '#ef573f' : alerted ? '#e58d42' : '#d6ab54'; ctx.shadowBlur = guard.state === 'CHASE' ? 18 : alerted ? 12 : 7;
  ctx.fillStyle = guard.state === 'CHASE' ? '#ef6b54' : alerted ? '#df954e' : '#b69a5e'; ctx.beginPath(); ctx.roundRect(-11, -11, 23, 22, 7); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#d7c79f'; ctx.beginPath(); ctx.arc(9, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#171b1c'; ctx.fillRect(5, -7, 7, 14);
  ctx.strokeStyle = '#34302a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(15, -11); ctx.stroke();
  ctx.fillStyle = '#ead891'; ctx.fillRect(14, -13, 7, 4); ctx.restore();
  if (guard.state === 'SUSPICIOUS' || guard.state === 'INVESTIGATE' || guard.state === 'SEARCH' || guard.state === 'HIDE_CHECK') {
    ctx.fillStyle = '#f0b465'; ctx.font = '700 18px "IBM Plex Mono"'; ctx.textAlign = 'center';
    ctx.fillText(guard.state === 'SEARCH' ? '…' : guard.state === 'HIDE_CHECK' ? '!' : '?', guard.x, guard.y - 27);
  }
}

function castRay(origin: Point, angle: number, maxRange: number): Point {
  const steps = Math.ceil(maxRange / 5);
  for (let i = 1; i <= steps; i++) {
    const d = i * 5; const x = origin.x + Math.cos(angle) * d; const y = origin.y + Math.sin(angle) * d;
    if (walls.some(w => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h)) return { x, y };
  }
  return { x: origin.x + Math.cos(angle) * maxRange, y: origin.y + Math.sin(angle) * maxRange };
}

function drawFog() {
  fogCtx.clearRect(0, 0, WORLD.w, WORLD.h);
  fogCtx.globalCompositeOperation = 'source-over';
  fogCtx.fillStyle = treasureTaken ? 'rgba(2,4,5,.87)' : 'rgba(2,4,5,.82)';
  fogCtx.fillRect(0, 0, WORLD.w, WORLD.h);
  fogCtx.globalCompositeOperation = 'destination-out';
  const rays = 180; const points: Point[] = [];
  const visionRadius = currentPlayerVision();
  for (let i = 0; i <= rays; i++) points.push(castRay(player, Math.PI * 2 * i / rays, visionRadius));
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
  const alpha = Math.min(.72, detection * .65 + (guard.state === 'CHASE' ? .15 : 0));
  const grad = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, 180, VIEW.w / 2, VIEW.h / 2, 650);
  grad.addColorStop(.4, 'rgba(150,15,8,0)'); grad.addColorStop(1, `rgba(180,26,13,${alpha})`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  if (detection < 1) {
    ctx.strokeStyle = `rgba(239,87,63,${.3 + detection * .6})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(VIEW.w / 2, 95, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * detection); ctx.stroke();
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
  ctx.fillText(`SECURITY ALERT // LEVEL ${alertLevel}`, VIEW.w - 28, VIEW.h - 28);
}

function drawStateFlash() {
  const danger = guard.state === 'CHASE';
  ctx.strokeStyle = danger ? `rgba(255,72,48,${stateFlash * .8})` : `rgba(238,170,72,${stateFlash * .65})`;
  ctx.lineWidth = 10 * stateFlash;
  ctx.strokeRect(5, 5, VIEW.w - 10, VIEW.h - 10);
  if (danger) {
    ctx.fillStyle = `rgba(239,62,39,${stateFlash * .11})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
}

function drawHidingOverlay() {
  const guardDistance = distance(player, guard);
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
  keys.add(e.key.toLowerCase());
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.key.toLowerCase() === 'e' && !e.repeat) interact();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
document.querySelector('#startButton')!.addEventListener('click', startGame);
document.querySelector('#retryButton')!.addEventListener('click', startGame);

camera.x = 0; camera.y = WORLD.h - VIEW.h; requestAnimationFrame(frame);
