import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { Ray } from '@babylonjs/core/Culling/ray';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { GameEngine } from './Engine';
import { buildArena } from './Arena';
import { Player } from './Player';
import { spawnBots, Bot } from './Bots';
import { Viewmodel } from './Viewmodel';
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
  private vm!: Viewmodel;
  private firedThisFrame = false;
  private hud = { kills: document.getElementById('hud-kills'), ammo: document.getElementById('hud-ammo') };

  constructor(ge: GameEngine) { this.ge = ge; }

  start() {
    const arena = buildArena(this.ge);
    this.ge.setScene(arena.scene);
    this.player = new Player(arena.scene, arena.spawns[0]);
    this.vm = new Viewmodel(arena.scene, this.player.cam);
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
        this.firedThisFrame = false;
        this.player.update(dt, this.input);
        for (const b of this.bots) b.update(dt);
        if (this.input.firing) this.tryShoot(now);
        const moving = Math.abs(this.input.moveX) > 0.1 || Math.abs(this.input.moveY) > 0.1;
        this.vm.update(dt, moving, this.player.ads);
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
    const cam = this.player.cam;
    cam.computeWorldMatrix();                       // ensure matrix is current
    const origin = cam.globalPosition.clone();
    const dir = Vector3.TransformNormal(new Vector3(0, 0, 1), cam.getWorldMatrix()).normalize(); // world forward

    const ray = new Ray(origin, dir, 120);
    const pick = scene.pickWithRay(ray, (m: AbstractMesh) => m.name === 'bot' && m.isEnabled());
    const end = pick?.hit && pick.pickedPoint ? pick.pickedPoint : origin.add(dir.scale(80));

    const right = new Vector3(dir.z, 0, -dir.x).normalize();
    const muzzle = origin.add(dir.scale(1.2)).add(right.scale(0.16)).add(new Vector3(0, -0.2, 0));
    this.spawnTracer(muzzle, end);
    if (!this.firedThisFrame) { this.vm.fire(); this.firedThisFrame = true; }

    if (pick?.hit && pick.pickedMesh) {
      const bot: Bot | undefined = pick.pickedMesh.metadata?.bot;
      if (bot && bot.hit(30)) { this.kills++; this.updateHud(); bridge.happyTime(); }
    }
  }

  private spawnTracer(from: Vector3, to: Vector3) {
    const scene = this.ge.scene;
    // Bright line tracer
    const line = MeshBuilder.CreateLines('tracer', { points: [from, to] }, scene);
    line.color = new Color3(1, 0.85, 0.4); line.isPickable = false;
    // Guaranteed-visible impact flash (solid emissive sphere) at the end point
    const flash = MeshBuilder.CreateSphere('flash', { diameter: 0.4, segments: 6 }, scene);
    flash.position.copyFrom(to); flash.isPickable = false;
    const fm = new StandardMaterial('fm', scene);
    fm.emissiveColor = new Color3(1, 0.7, 0.2); fm.disableLighting = true;
    flash.material = fm;
    setTimeout(() => { line.dispose(); flash.dispose(); fm.dispose(); }, 70);
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
    // ADS toggle
    const ads = document.getElementById('btn-ads');
    if (ads) {
      const t = (e: Event) => { e.preventDefault(); const on = this.input.toggleAds(); ads.classList.toggle('on', on); };
      ads.addEventListener('touchstart', t, { passive: false });
      ads.addEventListener('mousedown', t);
    }
    // Sprint toggle
    const sp = document.getElementById('btn-sprint');
    if (sp) {
      const t = (e: Event) => { e.preventDefault(); const on = this.input.toggleSprint(); sp.classList.toggle('on', on); };
      sp.addEventListener('touchstart', t, { passive: false });
      sp.addEventListener('mousedown', t);
    }
  }
}
