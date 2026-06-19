import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Ray } from '@babylonjs/core/Culling/ray';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';

const MODEL_SCALE = 1.0;
const FEET_OFFSET = -0.9;
const MODEL_FORWARD = Math.PI;
const SIGHT = 30;
const FIRE_RANGE = 26;
const FIRE_CD = 0.9;

/** What a bot can shoot at (the player). */
export interface Target { position: Vector3; alive: boolean; damage(n: number): void; }

/** Enemy soldier: rigged Vanguard model under a pivot we control, on a collidable hitbox. */
export class Bot {
  hitbox: Mesh;
  private pivot: TransformNode;   // we rotate THIS (model root has a baked quaternion)
  private walk?: AnimationGroup;
  hp = 100;
  alive = true;
  private target: Vector3;
  private speed: number;
  private dyingT = 0;
  private facing = 0;
  private stuckT = 0;
  private scene: Scene;
  private fireT = Math.random() * FIRE_CD;

  constructor(scene: Scene, pos: Vector3, container: AssetContainer) {
    this.scene = scene;
    const hb = MeshBuilder.CreateCapsule('bot', { radius: 0.5, height: 1.8 }, scene);
    hb.position.copyFrom(pos);
    hb.isVisible = false; hb.isPickable = true;
    hb.checkCollisions = true;
    hb.ellipsoid = new Vector3(0.5, 0.9, 0.5);
    (hb.metadata ||= {}).bot = this;
    this.hitbox = hb;

    // Pivot we control; the model's __root__ keeps its handedness quaternion underneath
    const pivot = new TransformNode('botPivot', scene);
    this.pivot = pivot;
    const inst = container.instantiateModelsToScene((n) => n, false);
    const root = inst.rootNodes[0] as TransformNode;
    root.parent = pivot;
    pivot.scaling.setAll(MODEL_SCALE);
    for (const m of root.getChildMeshes()) m.isPickable = false;
    for (const g of inst.animationGroups) {
      g.stop();
      if (/walk/i.test(g.name)) this.walk = g;
    }
    this.walk?.play(true);

    this.target = this.pickTarget();
    this.speed = 2.0 + Math.random() * 1.8;
    this.sync();
  }

  private pickTarget(): Vector3 { return new Vector3((Math.random() - 0.5) * 42, 0.9, (Math.random() - 0.5) * 42); }

  private sync() {
    const p = this.hitbox.position;
    this.pivot.position.set(p.x, p.y + FEET_OFFSET, p.z);
    this.pivot.rotation.set(this.alive ? 0 : Math.min(Math.PI / 2, this.dyingT * 6), this.facing + MODEL_FORWARD, 0);
  }

  hit(dmg: number): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  private die() { this.alive = false; this.dyingT = 0; this.walk?.stop(); setTimeout(() => this.respawn(), 3500); }

  private respawn() {
    this.hp = 100; this.alive = true; this.dyingT = 0; this.stuckT = 0;
    this.hitbox.position.set((Math.random() - 0.5) * 40, 0.9, (Math.random() - 0.5) * 40);
    this.target = this.pickTarget();
    this.hitbox.setEnabled(true); this.pivot.setEnabled(true);
    this.walk?.play(true);
    this.sync();
  }

  private canSee(target: Target): boolean {
    const from = this.hitbox.position.add(new Vector3(0, 0.6, 0));
    const to = target.position;
    const dir = to.subtract(from); const dist = dir.length();
    if (dist > SIGHT) return false;
    dir.normalize();
    const ray = new Ray(from, dir, dist - 0.6);
    const hit = this.scene.pickWithRay(ray, (m: AbstractMesh) =>
      (m.name === 'wall' || m.name === 'cover') && m.isPickable !== false);
    return !(hit?.hit);
  }

  private shoot(target: Target) {
    // accuracy falls off with distance
    const dist = Vector3.Distance(this.hitbox.position, target.position);
    const acc = Math.max(0.18, 0.7 - dist / 60);
    const muzzle = this.hitbox.position.add(new Vector3(0, 0.6, 0));
    this.tracer(muzzle, target.position);
    if (Math.random() < acc) target.damage(7 + Math.random() * 7);
  }

  private tracer(from: Vector3, to: Vector3) {
    const line = MeshBuilder.CreateLines('etracer', { points: [from, to] }, this.scene);
    line.color = new Color3(1, 0.3, 0.2); line.isPickable = false;
    setTimeout(() => line.dispose(), 45);
  }

  update(dt: number, target: Target) {
    if (!this.alive) {
      this.dyingT += dt;
      if (this.dyingT > 0.7) { this.hitbox.setEnabled(false); this.pivot.setEnabled(false); }
      this.sync();
      return;
    }

    // ── Engage the player if visible ──
    const engaged = target.alive && this.canSee(target);
    if (engaged) {
      const to = target.position.subtract(this.hitbox.position); to.y = 0;
      const dist = to.length();
      this.facing = Math.atan2(to.x, to.z);
      // strafe-advance: close distance if far, hold if in range
      if (dist > FIRE_RANGE) {
        to.normalize();
        const before = this.hitbox.position.clone();
        this.hitbox.moveWithCollisions(to.scale(this.speed * dt));
        this.hitbox.position.y = 0.9;
        if (Vector3.Distance(before, this.hitbox.position) < this.speed * dt * 0.4) { this.strafeAround(target, dt); }
      } else {
        this.strafeAround(target, dt);
      }
      this.fireT -= dt;
      if (this.fireT <= 0 && dist < FIRE_RANGE) { this.shoot(target); this.fireT = FIRE_CD * (0.8 + Math.random() * 0.5); }
      this.sync();
      return;
    }

    // ── Wander when player not seen ──
    const to = this.target.subtract(this.hitbox.position); to.y = 0;
    const dist = to.length();
    if (dist < 1.2) { this.target = this.pickTarget(); this.sync(); return; }
    to.normalize();
    this.facing = Math.atan2(to.x, to.z);
    const before = this.hitbox.position.clone();
    this.hitbox.moveWithCollisions(to.scale(this.speed * dt));
    this.hitbox.position.y = 0.9;
    const moved = Vector3.Distance(before, this.hitbox.position);
    if (moved < this.speed * dt * 0.4) { this.stuckT += dt; if (this.stuckT > 0.3) { this.target = this.pickTarget(); this.stuckT = 0; } }
    else this.stuckT = 0;
    this.sync();
  }

  private strafeAround(target: Target, dt: number) {
    // sidestep relative to the player for a bit of life
    const to = target.position.subtract(this.hitbox.position); to.y = 0; to.normalize();
    const side = new Vector3(to.z, 0, -to.x).scale((Math.sin(Date.now() * 0.001 + this.fireT) > 0 ? 1 : -1));
    const before = this.hitbox.position.clone();
    this.hitbox.moveWithCollisions(side.scale(this.speed * 0.5 * dt));
    this.hitbox.position.y = 0.9;
    if (Vector3.Distance(before, this.hitbox.position) < 0.001) { /* blocked, ignore */ }
  }
}

export function spawnBots(scene: Scene, count: number, container: AssetContainer): Bot[] {
  const bots: Bot[] = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    bots.push(new Bot(scene, new Vector3(Math.cos(ang) * 16, 0.9, Math.sin(ang) * 16), container));
  }
  return bots;
}
