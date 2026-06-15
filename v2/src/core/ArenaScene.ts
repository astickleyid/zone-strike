import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3, Color3, Color4 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { GameEngine } from './Engine';

/** Minimal arena scene — proves the render pipeline end to end. */
export function createArenaScene(ge: GameEngine): Scene {
  const scene = new Scene(ge.engine);
  scene.clearColor = new Color4(0.04, 0.04, 0.03, 1);

  const cam = new FreeCamera('cam', new Vector3(0, 1.7, -8), scene);
  cam.setTarget(new Vector3(0, 1, 0));
  cam.fov = 1.2;
  cam.minZ = 0.05;

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.55;
  hemi.diffuse = new Color3(0.7, 0.78, 0.9);
  hemi.groundColor = new Color3(0.25, 0.22, 0.18);

  const sun = new DirectionalLight('sun', new Vector3(-0.5, -0.9, 0.3), scene);
  sun.intensity = 1.3;
  sun.diffuse = new Color3(1.0, 0.85, 0.6);

  const groundMat = new StandardMaterial('gm', scene);
  groundMat.diffuseColor = new Color3(0.32, 0.29, 0.22);
  groundMat.specularColor = new Color3(0.05, 0.05, 0.05);
  const ground = MeshBuilder.CreateGround('ground', { width: 60, height: 60 }, scene);
  ground.material = groundMat;

  const boxMat = new StandardMaterial('bm', scene);
  boxMat.diffuseColor = new Color3(0.5, 0.5, 0.48);
  const box = MeshBuilder.CreateBox('box', { size: 2 }, scene);
  box.position.y = 1;
  box.material = boxMat;
  scene.registerBeforeRender(() => { box.rotation.y += 0.005; });

  return scene;
}
