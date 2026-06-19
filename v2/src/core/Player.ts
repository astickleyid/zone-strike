import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CONFIG } from '../config';
import type { Input } from '../systems/Input';

export class Player {
  cam: UniversalCamera;
  body: Mesh;
  vy = 0;
  grounded = true;
  crouching = false;
  ads = false;
  hp = 100;
  maxHp = 100;
  alive = true;
  onDamage?: () => void;
  onDeath?: () => void;
  private yaw = 0; private pitch = 0;
  private scene: Scene;
  private baseFov = 1.25;
  private spawn: Vector3;
  private regenT = 0;

  constructor(scene: Scene, spawn: Vector3) {
    this.scene = scene;
    this.spawn = spawn.clone();
    const S = CONFIG.player.standHeight;
    const body = MeshBuilder.CreateBox('player', { width: 0.8, height: S, depth: 0.8 }, scene);
    body.position.set(spawn.x, S / 2, spawn.z);
    body.isVisible = false; body.checkCollisions = true; body.isPickable = false;
    body.ellipsoid = new Vector3(0.45, S / 2, 0.45);
    this.body = body;

    const cam = new UniversalCamera('cam', body.position.clone(), scene);
    cam.fov = this.baseFov; cam.minZ = 0.05; cam.inertia = 0; cam.speed = 0;
    cam.detachControl();
    this.cam = cam;
    scene.activeCamera = cam;
    this.syncCam();
  }

  private get sens() { return 0.0022; }
  private get eyeOffset() { return (this.crouching ? CONFIG.player.crouchHeight : CONFIG.player.standHeight) / 2 - 0.12; }

  private syncCam() {
    this.cam.position.copyFrom(this.body.position);
    this.cam.position.y += this.eyeOffset;
    this.cam.rotation.set(this.pitch, this.yaw, 0);
  }

  damage(n: number) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - n);
    this.regenT = 0;
    this.onDamage?.();
    if (this.hp <= 0) { this.alive = false; this.onDeath?.(); }
  }

  respawn() {
    this.hp = this.maxHp; this.alive = true; this.vy = 0; this.crouching = false;
    this.body.ellipsoid.y = CONFIG.player.standHeight / 2;
    this.body.position.set(this.spawn.x, CONFIG.player.standHeight / 2, this.spawn.z);
    this.syncCam();
  }

  update(dt: number, input: Input) {
    if (!this.alive) return;
    const c = CONFIG.player;

    const { dx, dy } = input.consumeLook();
    this.ads = input.ads;
    const sensMul = this.ads ? 0.55 : 1;
    this.yaw += dx * this.sens * sensMul;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + dy * this.sens * sensMul));
    const targetFov = this.ads ? 0.8 : this.baseFov;
    this.cam.fov += (targetFov - this.cam.fov) * Math.min(1, dt * 12);

    if (input.takeCrouch()) {
      this.crouching = !this.crouching;
      this.body.ellipsoid.y = (this.crouching ? c.crouchHeight : c.standHeight) / 2;
    }

    const speed = c.walkSpeed * (input.sprint && !this.crouching ? c.sprintMul : this.crouching ? c.crouchMul : 1);
    const fwd = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = fwd.scale(input.moveY).add(right.scale(input.moveX));
    if (move.lengthSquared() > 1) move.normalize();
    const disp = move.scale(speed * dt);

    if (input.takeJump() && this.grounded) { this.vy = c.jumpVelocity; this.grounded = false; }
    this.vy -= c.gravity * dt;
    disp.y = this.vy * dt;
    this.body.moveWithCollisions(disp);

    const half = (this.crouching ? c.crouchHeight : c.standHeight) / 2;
    const ray = new Ray(this.body.position.clone(), new Vector3(0, -1, 0), half + 0.12);
    const hit = this.scene.pickWithRay(ray, (m: AbstractMesh) => m.checkCollisions && m.name !== 'player' && m.name !== 'bot');
    if (hit?.hit && this.vy <= 0) { this.grounded = true; this.vy = 0; } else this.grounded = false;

    // Health regen after not taking damage for a bit
    if (this.hp < this.maxHp) {
      this.regenT += dt;
      if (this.regenT > 4) this.hp = Math.min(this.maxHp, this.hp + 14 * dt);
    }

    this.syncCam();
  }

  get position() { return this.cam.position; }
}
