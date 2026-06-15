import { GameEngine } from './core/Engine';
import { Game } from './core/Game';
import { bridge } from './platform/PortalBridge';

async function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!canvas) throw new Error('canvas#game not found');
  await bridge.init();
  console.info('[zonestrike] bridge:', bridge.name);
  const ge = new GameEngine(canvas);
  const game = new Game(ge);
  game.start();
  ge.run();
}

boot().catch((e) => {
  console.error('[zonestrike] boot failed:', e);
  const l = document.getElementById('boot-loader');
  if (l) l.textContent = 'Failed to load. Refresh to retry.';
});
