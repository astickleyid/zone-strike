import { GameEngine } from './core/Engine';
import { createArenaScene } from './core/ArenaScene';
import { bridge } from './platform/PortalBridge';

async function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!canvas) throw new Error('canvas#game not found');

  // Init revenue/portal layer first so ads + cloud save are ready
  await bridge.init();
  console.info('[zonestrike] bridge:', bridge.name);

  const ge = new GameEngine(canvas);
  const scene = createArenaScene(ge);
  ge.setScene(scene);
  ge.run();

  // Hide the boot loader once first frame is ready
  scene.executeWhenReady(() => {
    const loader = document.getElementById('boot-loader');
    if (loader) loader.style.display = 'none';
    bridge.gameplayStart();
  });
}

boot().catch((e) => {
  console.error('[zonestrike] boot failed:', e);
  const loader = document.getElementById('boot-loader');
  if (loader) loader.textContent = 'Failed to load. Refresh to retry.';
});
