import './style.css';
import { Game } from './core/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
const root = document.querySelector<HTMLElement>('#prototype3D');
const debug = document.querySelector<HTMLElement>('#debug3D');
const loading = document.querySelector<HTMLElement>('#loading3D');
const loadingProgress = document.querySelector<HTMLElement>('#loadingProgress3D');
const loadingStatus = document.querySelector<HTMLElement>('#loadingStatus3D');
const loadingPercent = document.querySelector<HTMLElement>('#loadingPercent3D');
const fps = document.querySelector<HTMLElement>('#fps3D');
const camera = document.querySelector<HTMLElement>('#camera3D');
const meshCount = document.querySelector<HTMLElement>('#meshCount3D');
const movement = document.querySelector<HTMLElement>('#movement3D');
const position = document.querySelector<HTMLElement>('#position3D');
const guard = document.querySelector<HTMLElement>('#guard3D');
const guardB = document.querySelector<HTMLElement>('#guardB3D');
const flashlight = document.querySelector<HTMLElement>('#flashlight3D');
const vision = document.querySelector<HTMLElement>('#vision3D');
const detection = document.querySelector<HTMLElement>('#detection3D');
const detectionFill = document.querySelector<HTMLElement>('#detectionFill3D');
const detectionValue = document.querySelector<HTMLElement>('#detectionValue3D');
const crown = document.querySelector<HTMLElement>('#crown3D');
const flow = document.querySelector<HTMLElement>('#flow3D');
const map = document.querySelector<HTMLElement>('#map3D');
const phasePerf = document.querySelector<HTMLElement>('#phasePerf3D');
const objective = document.querySelector<HTMLElement>('#objective3D');
const interaction = document.querySelector<HTMLElement>('#interaction3D');
const interactionLabel = document.querySelector<HTMLElement>('#interactionLabel3D');
const interactionFill = document.querySelector<HTMLElement>('#interactionFill3D');
const lockdown = document.querySelector<HTMLElement>('#lockdown3D');
const phase = document.querySelector<HTMLElement>('#phase3D');
const timer = document.querySelector<HTMLElement>('#timer3D');
const gateState = document.querySelector<HTMLElement>('#gateState3D');
const announcement = document.querySelector<HTMLElement>('#announcement3D');
const alarmOverlay = document.querySelector<HTMLElement>('#alarmOverlay3D');
const hideOverlay = document.querySelector<HTMLElement>('#hideOverlay3D');
const hideAwareness = document.querySelector<HTMLElement>('#hideAwareness3D');
const exitMarker = document.querySelector<HTMLElement>('#exitMarker3D');
const zone = document.querySelector<HTMLElement>('#zone3D');
const loot = document.querySelector<HTMLElement>('#loot3D');
const menu = document.querySelector<HTMLElement>('#menu3D');
const play = document.querySelector<HTMLButtonElement>('#play3D');
const quality = document.querySelector<HTMLSelectElement>('#quality3D');
const fullscreen = document.querySelector<HTMLButtonElement>('#fullscreen3D');
const pause = document.querySelector<HTMLElement>('#pause3D');
const resume = document.querySelector<HTMLButtonElement>('#resume3D');
const restart = document.querySelector<HTMLButtonElement>('#restart3D');
const pauseMenu = document.querySelector<HTMLButtonElement>('#pauseMenu3D');
const confirm = document.querySelector<HTMLElement>('#confirm3D');
const confirmRestart = document.querySelector<HTMLButtonElement>('#confirmRestart3D');
const cancelRestart = document.querySelector<HTMLButtonElement>('#cancelRestart3D');
const result = document.querySelector<HTMLElement>('#result3D');
const resultPanel = document.querySelector<HTMLElement>('#resultPanel3D');
const resultTitle = document.querySelector<HTMLElement>('#resultTitle3D');
const resultRank = document.querySelector<HTMLElement>('#resultRank3D');
const resultReason = document.querySelector<HTMLElement>('#resultReason3D');
const resultCrown = document.querySelector<HTMLElement>('#resultCrown3D');
const resultLoot = document.querySelector<HTMLElement>('#resultLoot3D');
const resultDetected = document.querySelector<HTMLElement>('#resultDetected3D');
const resultChases = document.querySelector<HTMLElement>('#resultChases3D');
const resultTime = document.querySelector<HTMLElement>('#resultTime3D');
const resultScore = document.querySelector<HTMLElement>('#resultScore3D');
const resultBadge = document.querySelector<HTMLElement>('#resultBadge3D');
const resultBest = document.querySelector<HTMLElement>('#resultBest3D');
const retry = document.querySelector<HTMLButtonElement>('#retry3D');
const resultMenu = document.querySelector<HTMLButtonElement>('#resultMenu3D');

if (!canvas || !root || !debug || !loading || !loadingProgress || !loadingStatus || !loadingPercent || !fps || !camera || !meshCount || !movement || !position || !guard || !guardB || !flashlight || !vision || !detection || !detectionFill || !detectionValue || !crown || !flow || !map || !phasePerf || !objective || !interaction || !interactionLabel || !interactionFill || !lockdown || !phase || !timer || !gateState || !announcement || !alarmOverlay || !hideOverlay || !hideAwareness || !exitMarker || !zone || !loot || !menu || !play || !quality || !fullscreen || !pause || !resume || !restart || !pauseMenu || !confirm || !confirmRestart || !cancelRestart || !result || !resultPanel || !resultTitle || !resultRank || !resultReason || !resultCrown || !resultLoot || !resultDetected || !resultChases || !resultTime || !resultScore || !resultBadge || !resultBest || !retry || !resultMenu) {
  throw new Error('Babylon 3D bootstrap elements are missing.');
}

const game = new Game(canvas, {
  root, debug, loading, loadingProgress, loadingStatus, loadingPercent, fps, camera, meshCount, movement, position,
  guard, guardB, flashlight, vision, detection, detectionFill, detectionValue, crown, flow, map, phasePerf, objective,
  interaction, interactionLabel, interactionFill, lockdown, phase, timer, gateState, announcement,
  alarmOverlay, hideOverlay, hideAwareness, exitMarker, zone, loot,
  menu, play, quality, fullscreen, pause, resume, restart, pauseMenu, confirm, confirmRestart, cancelRestart,
  result, resultPanel, resultTitle, resultRank, resultReason, resultCrown, resultLoot,
  resultDetected, resultChases, resultTime, resultScore, resultBadge, resultBest, retry, resultMenu,
});
game.start().catch(error => {
  console.error('[3D Foundation] Startup failed.', error);
  loadingStatus.textContent = '3D STARTUP FAILED · CONSOLE을 확인하세요';
  loading.classList.add('failed');
});

window.addEventListener('beforeunload', () => {
  game.dispose();
}, { once: true });
