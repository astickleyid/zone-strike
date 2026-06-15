import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

/** Enemy soldier: invisible capsule hitbox (named 'bot' for hitscan) with a
 *  procedural humanoid parented to it. Limbs swing while walking; tips over on death. */
export class Bot {
  hitbox: Mesh;          // pickable collision/aim target named 'bot'
  root: TransformNode;   // visual root (feet at ground)
  hp = 100;
  alive = true;
  private legL!: TransformNode; private legR!: TransformNode;
  private armL!: TransformNode; private armR!: TransformNode;
  private phase = Math.random() * 6.28;
  private target: Vector3;
  private speed: number;
  private dyingT = 0;

  constructor(scene: Scene, pos: Vector3) {
    const hb = MeshBuilder.CreateCapsule('bot', { radius: 0.5, height: 1.8 }, scene);
    hb.position.copyFrom(pos);
    hb.isVisible = false; hb.isPickable = true; hb.checkCollisions = false;
    (hb.metadata ||= {}).bot = this;
    this.hitbox = hb;

    const root = new TransformNode('botRoot', scene);
    root.parent = hb; root.position.set(0, -0.9, 0); // feet at hitbox bottom
    this.root = root;
    this.build(scene, root);

    this.target = this.pickTarget();
    this.speed = 1.8 + Math.random() * 1.6;
  }

  private mat(scene: Scene, r: number, g: number, b: number) {
    const m = new StandardMaterial('bm', scene);
    m.diffuseColor = new Color3(r, g, b); m.specularColor = new Color3(0.05, 0.05, 0.05);
    return m;
  }

  private build(scene: Scene, root: TransformNode) {
    const olive = this.mat(scene, 0.30, 0.32, 0.18);
    const vestC = this.mat(scene, 0.17, 0.19, 0.12);
    const skin = this.mat(scene, 0.66, 0.50, 0.38);
    const helmet = this.mat(scene, 0.20, 0.22, 0.15);
    const boot = this.mat(scene, 0.10, 0.10, 0.09);

    const box = (n: string, w: number, h: number, d: number, m: StandardMaterial, parent: TransformNode) => {
      const b = MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene);
      b.material = m; b.isPickable = false; b.parent = parent; return b;
    };

    // Torso + vest
    const torso = box('torso', 0.5, 0.62, 0.3, olive, root); torso.position.set(0, 1.16, 0);
    const vest = box('vest', 0.54, 0.5, 0.34, vestC, root); vest.position.set(0, 1.18, 0);
    // Head + helmet
    const head = MeshBuilder.CreateSphere('head', { diameter: 0.26, segments: 8 }, scene);
    head.material = skin; head.isPickable = false; head.parent = root; head.position.set(0, 1.62, 0);
    const hel = box('helmet', 0.30, 0.16, 0.30, helmet, root); hel.position.set(0, 1.70, 0);
    // Legs (pivot at hip)
    const mkLimb = (name: string, px: number, py: number, len: number, w: number, m: StandardMaterial, bootM?: StandardMaterial) => {
      const pivot = new TransformNode(name, scene); pivot.parent = root; pivot.position.set(px, py, 0);
      const seg = box(name + 'seg', w, len, w, m, pivot); seg.position.set(0, -len / 2, 0);
      if (bootM) { const bt = box(name + 'boot', w + 0.02, 0.12, w + 0.05, bootM, pivot); bt.position.set(0, -len, 0.02); }
      return pivot;
    };
    this.legL = mkLimb('legL', -0.14, 0.85, 0.8, 0.2, olive, boot);
    this.legR = mkLimb('legR', 0.14, 0.85, 0.8, 0.2, olive, boot);
    this.armL = mkLimb('armL', -0.34, 1.46, 0.6, 0.15, olive);
    this.armR = mkLimb('armR', 0.34, 1.46, 0.6, 0.15, olive);
    // Simple rifle in right hand
    const gun = box('botgun', 0.08, 0.08, 0.5, this.mat(scene, 0.12, 0.12, 0.12), this.armR);
    gun.position.set(0.0, -0.5, 0.18); gun.rotation.x = 0.2;
  }

  private pickTarget(): Vector3 { return new Vector3((Math.random() - 0.5) * 44, 0.9, (Math.random() - 0.5) * 44); }

  hit(dmg: number): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  private die() {
    this.alive = false; this.dyingT = 0;
    setTimeout(() => this.respawn(), 3200);
  }

  private respawn() {
    this.hp = 100; this.alive = true; this.dyingT = 0;
    this.root.rotation.set(0, 0, 0);
    this.hitbox.position.set((Math.random() - 0.5) * 44, 0.9, (Math.random() - 0.5) * 44);
    this.target = this.pickTarget();
    this.hitbox.setEnabled(true);
  }

  update(dt: number) {
    if (!this.alive) {
      // fall over, then hide
      this.dyingT += dt;
      this.root.rotation.x = Math.min(Math.PI / 2, this.dyingT * 6);
      if (this.dyingT > 0.6) this.hitbox.setEnabled(false);
      return;
    }
    const to = this.target.subtract(this.hitbox.position); to.y = 0;
    const dist = to.length();
    if (dist < 1) { this.target = this.pickTarget(); }
    else {
      to.normalize();
      this.hitbox.position.addInPlace(to.scale(this.speed * dt));
      this.hitbox.position.y = 0.9;
      // face movement direction
      this.root.rotation.y = Math.atan2(to.x, to.z);
      // walk cycle
      this.phase += dt * this.speed * 2.4;
      const s = Math.sin(this.phase) * 0.5;
      this.legL.rotation.x = s; this.legR.rotation.x = -s;
      this.armL.rotation.x = -s * 0.8; this.armR.rotation.x = s * 0.8;
    }
  }
}

export function spawnBots(scene: Scene, count: number): Bot[] {
  const bots: Bot[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    bots.push(new Bot(scene, new Vector3(Math.cos(ang) * 18, 0.9, Math.sin(ang) * 18)));
  }
  return bots;
}
