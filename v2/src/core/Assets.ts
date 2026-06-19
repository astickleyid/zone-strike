import '@babylonjs/loaders/glTF';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { Scene } from '@babylonjs/core/scene';

let cached: AssetContainer | null = null;

/** Load the rigged soldier model once into an AssetContainer (reused for all bots). */
export async function loadSoldierContainer(scene: Scene): Promise<AssetContainer> {
  if (cached) return cached;
  cached = await SceneLoader.LoadAssetContainerAsync('models/', 'soldier.glb', scene);
  // keep source meshes out of the live scene; we instantiate copies per bot
  return cached;
}
