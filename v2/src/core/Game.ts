import { Ray } from '@babylonjs/core/Culling/ray';
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
    arena.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      this.player.update(dt, this.input);
      for (const b of this.bots) b.update(dt);
      if (this.input.firing) this.tryShoot(now);
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
    const ray = new Ray(this.player.position.clone(), this.player.forward, 100);
    const pick = scene.pickWithRay(ray, (m: AbstractMesh) => m.name === 'bot' && m.isEnabled());
    this.spawnTracer(this.player.position, pick?.hit && pick.pickedPoint ? pick.pickedPoint : this.player.position.add(this.player.forward.scale(60)));
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
  }
}
