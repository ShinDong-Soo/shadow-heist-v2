import './style.css';
import { Game } from './core/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
const root = document.querySelector<HTMLElement>('#prototype3D');
const debug = document.querySelector<HTMLElement>('#debug3D');
const loading = document.querySelector<HTMLElement>('#loading3D');
const loadingProgress = document.querySelector<HTMLElement>('#loadingProgress3D');
const loadingStatus = document.querySelector<HTMLElement>('#loadingStatus3D');
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

if (!canvas || !root || !debug || !loading || !loadingProgress || !loadingStatus || !fps || !camera || !meshCount || !movement || !position || !guard || !guardB || !flashlight || !vision || !detection || !detectionFill || !detectionValue || !crown || !flow || !map || !phasePerf || !objective || !interaction || !interactionLabel || !interactionFill || !lockdown || !phase || !timer || !gateState || !announcement || !alarmOverlay || !hideOverlay || !hideAwareness || !exitMarker || !zone || !loot) {
  throw new Error('Babylon 3D bootstrap elements are missing.');
}

const game = new Game(canvas, {
  root, debug, loading, loadingProgress, loadingStatus, fps, camera, meshCount, movement, position,
  guard, guardB, flashlight, vision, detection, detectionFill, detectionValue, crown, flow, map, phasePerf, objective,
  interaction, interactionLabel, interactionFill, lockdown, phase, timer, gateState, announcement,
  alarmOverlay, hideOverlay, hideAwareness, exitMarker, zone, loot,
});
game.start().catch(error => {
  console.error('[3D Foundation] Startup failed.', error);
  loadingStatus.textContent = '3D STARTUP FAILED · CONSOLE을 확인하세요';
  loading.classList.add('failed');
});

window.addEventListener('beforeunload', () => {
  game.dispose();
}, { once: true });
