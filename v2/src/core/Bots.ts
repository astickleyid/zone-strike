import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

/** Placeholder bot: a capsule that wanders, takes raycast damage, and respawns.
 *  Real animated soldier models replace these in Phase 3. */
export class Bot {
  mesh: Mesh;
  hp = 100;
  alive = true;
  private target: Vector3;
  private speed: number;
  private mat: StandardMaterial;

  constructor(scene: Scene, pos: Vector3) {
    const m = MeshBuilder.CreateCapsule('bot', { radius: 0.45, height: 1.8 }, scene);
    m.position.copyFrom(pos);
    const mat = new StandardMaterial('botMat', scene);
    mat.diffuseColor = new Color3(0.7, 0.2, 0.15);
    mat.emissiveColor = new Color3(0.15, 0.02, 0.02);
    m.material = mat;
    m.checkCollisions = false;
    m.isPickable = true;
    (m.metadata ||= {}).bot = this;
    this.mesh = m; this.mat = mat;
    this.target = this.pickTarget();
    this.speed = 1.8 + Math.random() * 1.4;
  }

  private pickTarget(): Vector3 {
    return new Vector3((Math.random() - 0.5) * 44, 0.9, (Math.random() - 0.5) * 44);
  }

  hit(dmg: number): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.mat.emissiveColor = new Color3(0.6, 0.1, 0.1);
    setTimeout(() => { if (this.alive) this.mat.emissiveColor = new Color3(0.15, 0.02, 0.02); }, 80);
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  private die() {
    this.alive = false;
    this.mesh.setEnabled(false);
    setTimeout(() => this.respawn(), 3000);
  }

  private respawn() {
    this.hp = 100; this.alive = true;
    this.mesh.position.set((Math.random() - 0.5) * 44, 0.9, (Math.random() - 0.5) * 44);
    this.mesh.setEnabled(true);
  }

  update(dt: number) {
    if (!this.alive) return;
    const to = this.target.subtract(this.mesh.position); to.y = 0;
    if (to.lengthSquared() < 1) { this.target = this.pickTarget(); return; }
    to.normalize();
    this.mesh.position.addInPlace(to.scale(this.speed * dt));
    this.mesh.position.y = 0.9;
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
