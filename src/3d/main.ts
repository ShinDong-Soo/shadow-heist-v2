import './style.css';
import { Game } from './core/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
const loading = document.querySelector<HTMLElement>('#loading3D');
const loadingProgress = document.querySelector<HTMLElement>('#loadingProgress3D');
const loadingStatus = document.querySelector<HTMLElement>('#loadingStatus3D');
const fps = document.querySelector<HTMLElement>('#fps3D');
const camera = document.querySelector<HTMLElement>('#camera3D');
const meshCount = document.querySelector<HTMLElement>('#meshCount3D');
const movement = document.querySelector<HTMLElement>('#movement3D');
const position = document.querySelector<HTMLElement>('#position3D');

if (!canvas || !loading || !loadingProgress || !loadingStatus || !fps || !camera || !meshCount || !movement || !position) {
  throw new Error('Babylon 3D bootstrap elements are missing.');
}

const game = new Game(canvas, { loading, loadingProgress, loadingStatus, fps, camera, meshCount, movement, position });
game.start().catch(error => {
  console.error('[3D Foundation] Startup failed.', error);
  loadingStatus.textContent = '3D STARTUP FAILED · CONSOLE을 확인하세요';
  loading.classList.add('failed');
});

window.addEventListener('beforeunload', () => {
  game.dispose();
}, { once: true });
