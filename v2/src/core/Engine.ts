import { Engine as BabylonEngine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';

/** Wraps the Babylon engine + canvas + render loop. */
export class GameEngine {
  readonly engine: BabylonEngine;
  readonly canvas: HTMLCanvasElement;
  scene!: Scene;
  private _onResize = () => this.engine.resize();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new BabylonEngine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
    window.addEventListener('resize', this._onResize);
  }

  setScene(scene: Scene) { this.scene = scene; }

  run() {
    this.engine.runRenderLoop(() => {
      if (this.scene && this.scene.activeCamera) this.scene.render();
    });
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.engine.dispose();
  }
}
