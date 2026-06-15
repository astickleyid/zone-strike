import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';

const HIP = new Vector3(0.18, -0.20, 0.55);
const ADS = new Vector3(0.0, -0.105, 0.42);

/** First-person weapon viewmodel parented to the camera. Handles sway, walk
 *  bob, recoil kick, and ADS pose. Rendered in group 1 so it never clips walls. */
export class Viewmodel {
  root: TransformNode;
  private recoil = 0;
  private bobT = 0;
  private adsAmt = 0;
  private flash: import('@babylonjs/core/Meshes/mesh').Mesh;

  constructor(scene: Scene, cam: Camera) {
    const root = new TransformNode('weapon', scene);
    root.parent = cam; root.position.copyFrom(HIP);
    this.root = root;

    const metal = new StandardMaterial('wm', scene);
    metal.diffuseColor = new Color3(0.13, 0.13, 0.14); metal.specularColor = new Color3(0.2, 0.2, 0.2);
    const poly = new StandardMaterial('wp', scene);
    poly.diffuseColor = new Color3(0.07, 0.07, 0.08);

    const box = (n: string, w: number, h: number, d: number, m: StandardMaterial, px: number, py: number, pz: number) => {
      const b = MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene);
      b.material = m; b.parent = root; b.position.set(px, py, pz); b.isPickable = false; b.renderingGroupId = 1;
      return b;
    };
    box('w_body', 0.07, 0.10, 0.42, metal, 0, 0, 0.05);
    box('w_barrel', 0.035, 0.035, 0.34, metal, 0, 0.015, 0.34);
    box('w_stock', 0.05, 0.09, 0.18, poly, 0, -0.01, -0.22);
    box('w_mag', 0.05, 0.16, 0.09, poly, 0, -0.13, 0.02);
    box('w_sight', 0.02, 0.05, 0.06, metal, 0, 0.085, 0.06);
    box('w_grip', 0.045, 0.12, 0.06, poly, 0, -0.11, -0.06).rotation.x = 0.25;

    // muzzle flash (hidden until fired)
    const muzzle = new TransformNode('w_muzzle', scene);
    muzzle.parent = root; muzzle.position.set(0, 0.015, 0.52);
    const flash = MeshBuilder.CreatePlane('w_flash', { size: 0.28 }, scene);
    const fm = new StandardMaterial('fm', scene);
    fm.emissiveColor = new Color3(1, 0.75, 0.25); fm.disableLighting = true; fm.alpha = 0.9;
    flash.material = fm; flash.parent = muzzle; flash.renderingGroupId = 1; flash.isPickable = false;
    flash.setEnabled(false);
    this.flash = flash;
  }

  fire() {
    this.recoil = 1;
    this.flash.setEnabled(true);
    this.flash.rotation.z = Math.random() * Math.PI;
    setTimeout(() => this.flash.setEnabled(false), 40);
  }

  update(dt: number, moving: boolean, ads: boolean) {
    // ADS lerp
    this.adsAmt += ((ads ? 1 : 0) - this.adsAmt) * Math.min(1, dt * 12);
    const base = Vector3.Lerp(HIP, ADS, this.adsAmt);

    // walk bob
    this.bobT += dt * (moving ? 9 : 2.5);
    const bob = moving ? 0.012 * (1 - this.adsAmt) : 0.004 * (1 - this.adsAmt);
    const bx = Math.cos(this.bobT) * bob;
    const by = Math.abs(Math.sin(this.bobT)) * bob;

    // recoil decay
    this.recoil = Math.max(0, this.recoil - dt * 7);
    const rz = this.recoil * 0.06;
    const rkick = this.recoil * 0.05;

    this.root.position.set(base.x + bx, base.y + by - rkick * 0.3, base.z - rkick);
    this.root.rotation.set(-rz, 0, 0);
  }
}
