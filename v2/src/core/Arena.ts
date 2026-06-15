import '@babylonjs/core/Collisions/collisionCoordinator';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3, Color3, Color4 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { GameEngine } from './Engine';
import { CONFIG } from '../config';

export interface ArenaData {
  scene: Scene;
  spawns: Vector3[];
  zones: { name: string; pos: Vector3; radius: number }[];
}

/** Builds the military-compound arena with collision geometry + cover. */
export function buildArena(ge: GameEngine): ArenaData {
  const scene = new Scene(ge.engine);
  scene.clearColor = new Color4(0.05, 0.05, 0.04, 1);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.4, 0);

  // temp camera so scene is renderable before Player attaches
  const tmp = new FreeCamera('tmp', new Vector3(0, 2, 0), scene);
  scene.activeCamera = tmp;

  const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.6; hemi.diffuse = new Color3(0.72, 0.8, 0.95); hemi.groundColor = new Color3(0.28, 0.24, 0.18);
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -0.85, 0.35), scene);
  sun.intensity = 1.35; sun.diffuse = new Color3(1, 0.86, 0.62);

  const mat = (r: number, g: number, b: number, spec = 0.05) => {
    const m = new StandardMaterial('m', scene);
    m.diffuseColor = new Color3(r, g, b); m.specularColor = new Color3(spec, spec, spec);
    return m;
  };

  const SIZE = 54;
  const ground = MeshBuilder.CreateGround('ground', { width: SIZE, height: SIZE }, scene);
  ground.material = mat(0.30, 0.27, 0.20);
  ground.checkCollisions = true;

  const wallMat = mat(0.22, 0.21, 0.19);
  const WALL_H = 4;
  const wall = (x: number, z: number, w: number, d: number): Mesh => {
    const m = MeshBuilder.CreateBox('wall', { width: w, height: WALL_H, depth: d }, scene);
    m.position.set(x, WALL_H / 2, z); m.material = wallMat; m.checkCollisions = true;
    return m;
  };
  const H = SIZE / 2;
  wall(0, H, SIZE, 1); wall(0, -H, SIZE, 1); wall(H, 0, 1, SIZE); wall(-H, 0, 1, SIZE);

  // Interior cover — crates & barriers (collidable), arranged for sightline breaks
  const coverMat = mat(0.4, 0.34, 0.22);
  const barrierMat = mat(0.3, 0.31, 0.33);
  const cover = (x: number, z: number, w: number, h: number, d: number, m: StandardMaterial) => {
    const b = MeshBuilder.CreateBox('cover', { width: w, height: h, depth: d }, scene);
    b.position.set(x, h / 2, z); b.material = m; b.checkCollisions = true;
  };
  const layout: [number, number, number, number, number, StandardMaterial][] = [
    [0, 0, 6, 3, 6, barrierMat],
    [12, 8, 2, 1.2, 6, coverMat], [-12, -8, 2, 1.2, 6, coverMat],
    [14, -10, 4, 2.4, 4, barrierMat], [-14, 10, 4, 2.4, 4, barrierMat],
    [8, -14, 3, 1.2, 3, coverMat], [-8, 14, 3, 1.2, 3, coverMat],
    [18, 16, 5, 3, 2, barrierMat], [-18, -16, 5, 3, 2, barrierMat],
    [0, 18, 8, 1.2, 2, coverMat], [0, -18, 8, 1.2, 2, coverMat],
  ];
  for (const [x, z, w, h, d, m] of layout) cover(x, z, w, h, d, m);

  const zones = [
    { name: 'ALPHA', pos: new Vector3(16, 0, 16), radius: 5 },
    { name: 'BRAVO', pos: new Vector3(-16, 0, -16), radius: 5 },
    { name: 'CHARLIE', pos: new Vector3(0, 0, 0), radius: 5 },
  ];
  // Visual zone rings
  for (const z of zones) {
    const disc = MeshBuilder.CreateDisc('zone', { radius: z.radius, tessellation: 36 }, scene);
    disc.rotation.x = Math.PI / 2; disc.position.set(z.pos.x, 0.02, z.pos.z);
    const zm = new StandardMaterial('zm', scene);
    zm.diffuseColor = new Color3(0.9, 0.5, 0.1); zm.alpha = 0.18; zm.emissiveColor = new Color3(0.5, 0.25, 0.05);
    disc.material = zm; disc.isPickable = false;
  }

  const S = CONFIG.player.standHeight;
  const spawns = [new Vector3(20, S, 20), new Vector3(-20, S, -20), new Vector3(20, S, -20), new Vector3(-20, S, 20)];
  return { scene, spawns, zones };
}