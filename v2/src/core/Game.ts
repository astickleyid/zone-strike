import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { Ray } from '@babylonjs/core/Culling/ray';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { GameEngine } from './Engine';
import { buildArena } from './Arena';
import { Player } from './Player';
import { spawnBots, Bot } from './Bots';
import type { Target } from './Bots';
import { loadSoldierContainer } from './Assets';
import { Viewmodel } from './Viewmodel';
import { Input } from '../systems/Input';
import { ZoneManager } from '../systems/Zones';
import { sfx } from '../systems/Audio';
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
  private zones!: ZoneManager;
  private matchTime: number = CONFIG.match.durationSec;
  private running = true;
  private readonly SCORE_TARGET = 750;
  private hud = { kills: document.getElementById('hud-kills'), ammo: document.getElementById('hud-ammo') };

  constructor(ge: GameEngine) { this.ge = ge; }

  start() {
    const arena = buildArena(this.ge);
    this.ge.setScene(arena.scene);
    this.player = new Player(arena.scene, arena.spawns[0]);
    this.vm = new Viewmodel(arena.scene, this.player.cam);
    this.input = new Input(this.ge.canvas);
    this.wireButtons();
    sfx.init();
    this.zones = new ZoneManager(arena.zones);
    this.zones.onCapture = (owner) => { if (owner === 'player') sfx.capture(); };

    // Player feedback hooks
    this.player.onDamage = () => { this.flashDamage(); sfx.hurt(); };
    this.player.onDeath = () => this.handleDeath();

    const player = this.player;
    const target: Target = {
      get position() { return player.position; },
      get alive() { return player.alive; },
      damage: (n: number) => player.damage(n),
    };

    loadSoldierContainer(arena.scene)
      .then((container) => {
        this.bots = spawnBots(arena.scene, this.isMobile() ? CONFIG.match.botCountMobile : CONFIG.match.botCountDesktop, container);
      })
      .catch((e) => console.error('[zonestrike] soldier load failed:', e));

    let last = performance.now();
    let errored = false;
    arena.scene.onBeforeRenderObservable.add(() => {
      if (errored) return;
      try {
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.05); last = now;
        this.firedThisFrame = false;
        this.player.update(dt, this.input);
        for (const b of this.bots) b.update(dt, target);
        if (this.input.firing && this.player.alive) this.tryShoot(now);
        const moving = Math.abs(this.input.moveX) > 0.1 || Math.abs(this.input.moveY) > 0.1;
        this.vm.update(dt, moving, this.player.ads);
        this.updateHealthHud();

        if (this.running) {
          // Zone capture + scoring
          const botPos = this.bots.filter((b) => b.alive).map((b) => b.hitbox.position);
          this.zones.update(dt, this.player.position, this.player.alive, botPos);
          // Match timer
          this.matchTime = Math.max(0, this.matchTime - dt);
          this.updateMatchHud();
          // Win/lose
          if (this.zones.playerScore >= this.SCORE_TARGET) this.endMatch(true);
          else if (this.zones.enemyScore >= this.SCORE_TARGET) this.endMatch(false);
          else if (this.matchTime <= 0) this.endMatch(this.zones.playerScore >= this.zones.enemyScore);
        }
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
    if (!this.firedThisFrame) { this.vm.fire(); sfx.shoot(); this.firedThisFrame = true; }

    if (pick?.hit && pick.pickedMesh) {
      const bot: Bot | undefined = pick.pickedMesh.metadata?.bot;
      if (bot) {
        this.hitmarker(); sfx.hit();
        if (bot.hit(30)) { this.kills++; this.updateHud(); sfx.kill(); bridge.happyTime(); }
      }
    }
  }

  // ── Feedback + HUD ──
  private hitmarker() {
    const hm = document.getElementById('hitmarker');
    if (!hm) return;
    hm.style.opacity = '1';
    setTimeout(() => { hm.style.opacity = '0'; }, 90);
  }

  private flashDamage() {
    const v = document.getElementById('dmg-vignette');
    if (!v) return;
    v.style.opacity = '1';
    setTimeout(() => { v.style.opacity = '0'; }, 140);
  }

  private updateHealthHud() {
    const fill = document.getElementById('hp-fill');
    const num = document.getElementById('hp-num');
    const pct = Math.max(0, Math.round((this.player.hp / this.player.maxHp) * 100));
    if (fill) { fill.style.width = pct + '%'; fill.style.background = pct > 50 ? '#7CFF6B' : pct > 25 ? '#FFD23F' : '#FF5A4A'; }
    if (num) num.textContent = String(pct);
  }

  private updateMatchHud() {
    const ps = document.getElementById('score-you');
    const es = document.getElementById('score-enemy');
    const tm = document.getElementById('match-timer');
    if (ps) ps.textContent = String(Math.floor(this.zones.playerScore));
    if (es) es.textContent = String(Math.floor(this.zones.enemyScore));
    if (tm) { const s = Math.ceil(this.matchTime); tm.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    for (let i = 0; i < this.zones.zones.length; i++) {
      const pip = document.getElementById('zpip-' + i);
      if (pip) { const o = this.zones.ownerOf(i); pip.style.background = o === 'player' ? '#52d452' : o === 'enemy' ? '#e6402f' : '#888'; }
    }
  }

  private endMatch(won: boolean) {
    if (!this.running) return;
    this.running = false;
    bridge.gameplayStop();
    won ? sfx.win() : sfx.lose();
    const o = document.getElementById('result-overlay');
    const t = document.getElementById('result-text');
    const s = document.getElementById('result-sub');
    if (t) { t.textContent = won ? 'VICTORY' : 'DEFEAT'; t.style.color = won ? '#7CFF6B' : '#ff4a3a'; }
    if (s) s.textContent = `YOU ${Math.floor(this.zones.playerScore)}  ·  ENEMY ${Math.floor(this.zones.enemyScore)}  ·  ${this.kills} KILLS`;
    if (o) o.style.display = 'flex';
    bridge.showInterstitial();
  }

  private restart() {
    this.zones.reset();
    this.matchTime = CONFIG.match.durationSec;
    this.kills = 0; this.updateHud();
    this.player.respawn();
    this.running = true;
    const o = document.getElementById('result-overlay'); if (o) o.style.display = 'none';
    bridge.gameplayStart();
  }

  private handleDeath() {
    const o = document.getElementById('death-overlay');
    if (o) o.style.display = 'flex';
    bridge.showInterstitial();
    setTimeout(() => {
      this.player.respawn();
      const o2 = document.getElementById('death-overlay');
      if (o2) o2.style.display = 'none';
    }, 2800);
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
    const again = document.getElementById('btn-again');
    if (again) {
      const r = (e: Event) => { e.preventDefault(); this.restart(); };
      again.addEventListener('touchstart', r, { passive: false });
      again.addEventListener('click', r);
    }
  }
}
