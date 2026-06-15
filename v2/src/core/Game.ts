import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { GameEngine } from './Engine';
import { buildArena } from './Arena';
import { Player } from './Player';
import { spawnBots, Bot } from './Bots';
import { Input } from '../systems/Input';
import { bridge } from '../platform/PortalBridge';
import { CONFIG } from '../config';

export class Game {
  private ge: GameEngine;
  private player!: Player;
  private bots: Bot[] = [];
  private input!: Input;
  private kills = 0;
  private lastShot = 0;
  private hud = { kills: document.getElementById('hud-kills'), ammo: document.getElementById('hud-ammo') };

  constructor(ge: GameEngine) { this.ge = ge; }

  start() {
    const arena = buildArena(this.ge);
    this.ge.setScene(arena.scene);
    this.player = new Player(arena.scene, arena.spawns[0]);
    this.bots = spawnBots(arena.scene, this.isMobile() ? CONFIG.match.botCountMobile : CONFIG.match.botCountDesktop);
    this.input = new Input(this.ge.canvas);
    this.wireButtons();

    let last = performance.now();
    let errored = false;
    arena.scene.onBeforeRenderObservable.add(() => {
      if (errored) return;
      try {
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.05); last = now;
        this.player.update(dt, this.input);
        for (const b of this.bots) b.update(dt);
        if (this.input.firing) this.tryShoot(now);
      } catch (e) {
        errored = true;
        const box = document.getElementById('err');
        const msg = (e && ((e as Error).stack || (e as Error).message)) || String(e);
        if (box) { box.style.display = 'block'; box.textContent += 'LOOP ERROR: ' + msg + '\n'; }
        console.error(e);
      }
    });

    arena.scene.executeWhenReady(() => {
      const l = document.getElementById('boot-loader'); if (l) l.style.display = 'none';
      bridge.gameplayStart();
    });
  }

  private isMobile() { return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || 'ontouchstart' in window; }

  private tryShoot(now: number) {
    const RPM = 600; const interval = 60000 / RPM;
    if (now - this.lastShot < interval) return;
    this.lastShot = now;
    const scene = this.ge.scene;
    // Cast through the exact center pixel where the crosshair is — guarantees alignment.
    const w = this.ge.engine.getRenderWidth();
    const h = this.ge.engine.getRenderHeight();
    const ray = scene.createPickingRay(w / 2, h / 2, null, this.player.cam);
    const pick = scene.pickWithRay(ray, (m: AbstractMesh) => m.name === 'bot' && m.isEnabled());
    // Tracer starts at a gun-muzzle offset but ends exactly where the crosshair pointed.
    const dir = ray.direction;
    const right = new Vector3(dir.z, 0, -dir.x).normalize();
    const muzzle = ray.origin.add(dir.scale(1.2)).add(right.scale(0.16)).add(new Vector3(0, -0.2, 0));
    const end = pick?.hit && pick.pickedPoint ? pick.pickedPoint : ray.origin.add(dir.scale(80));
    this.spawnTracer(muzzle, end);
    if (pick?.hit && pick.pickedMesh) {
      const bot: Bot | undefined = pick.pickedMesh.metadata?.bot;
      if (bot && bot.hit(30)) { this.kills++; this.updateHud(); bridge.happyTime(); }
    }
  }

  private spawnTracer(from: Vector3, to: Vector3) {
    const scene = this.ge.scene;
    const line = MeshBuilder.CreateLines('tracer', { points: [from, to] }, scene);
    line.color = new Color3(1, 0.8, 0.3); line.isPickable = false;
    setTimeout(() => line.dispose(), 50);
  }

  private updateHud() { if (this.hud.kills) this.hud.kills.textContent = String(this.kills); }

  private wireButtons() {
    const bind = (id: string, fn: () => void) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
      el.addEventListener('mousedown', (e) => { e.preventDefault(); fn(); });
    };
    bind('btn-jump', () => this.input.pressJump());
    bind('btn-crouch', () => this.input.pressCrouch());
    // Fire button: hold to fire (full-auto), release to stop
    const fire = document.getElementById('btn-fire');
    if (fire) {
      const down = (e: Event) => { e.preventDefault(); this.input.startFire(); };
      const up = (e: Event) => { e.preventDefault(); this.input.stopFire(); };
      fire.addEventListener('touchstart', down, { passive: false });
      fire.addEventListener('touchend', up, { passive: false });
      fire.addEventListener('touchcancel', up, { passive: false });
      fire.addEventListener('mousedown', down);
      fire.addEventListener('mouseup', up);
    }
  }
}
