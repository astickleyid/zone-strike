// Side-effect imports required for tree-shaken Babylon build
import "@babylonjs/core/Collisions/collisionCoordinator";

import { GameEngine } from './core/Engine';
import { Game } from './core/Game';
import { bridge } from './platform/PortalBridge';

declare global { interface Window { __stage?: (s: string) => void } }
const stage = (s: string) => { try { window.__stage?.(s); } catch {} console.info('[stage]', s); };

async function boot() {
  stage('init bridge');
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!canvas) throw new Error('canvas#game not found');
  await bridge.init();

  stage('create engine');
  const ge = new GameEngine(canvas);

  stage('build game');
  const game = new Game(ge);
  game.start();

  stage('run loop');
  ge.run();
  stage('running');
}

boot().catch((e) => {
  const msg = (e && (e.stack || e.message)) || String(e);
  console.error('[zonestrike] boot failed:', e);
  const box = document.getElementById('err');
  if (box) { box.style.display = 'block'; box.textContent += 'BOOT FAILED: ' + msg + '\n'; }
});
