import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

type Owner = 'neutral' | 'player' | 'enemy';
interface ZoneDef { name: string; pos: Vector3; radius: number; disc: Mesh; mat: StandardMaterial }

const CAP_RATE = 0.6;      // capture progress per second by one side
const SCORE_RATE = 12;     // points per owned zone per second

const COL = {
  neutral: new Color3(0.55, 0.55, 0.55),
  player: new Color3(0.32, 0.85, 0.32),
  enemy: new Color3(0.9, 0.25, 0.2),
};

/** Capture-the-zone scoring. Player or enemy presence captures a zone over time;
 *  owned zones tick score for their team. */
export class ZoneManager {
  zones: { def: ZoneDef; owner: Owner; progress: number }[];
  playerScore = 0;
  enemyScore = 0;
  onCapture?: (owner: Owner) => void;

  constructor(defs: ZoneDef[]) {
    this.zones = defs.map((d) => ({ def: d, owner: 'neutral' as Owner, progress: 0 }));
    this.refreshColors();
  }

  reset() {
    for (const z of this.zones) { z.owner = 'neutral'; z.progress = 0; }
    this.playerScore = 0; this.enemyScore = 0;
    this.refreshColors();
  }

  private inside(p: Vector3, z: ZoneDef) {
    const dx = p.x - z.pos.x, dz = p.z - z.pos.z;
    return dx * dx + dz * dz <= z.radius * z.radius;
  }

  update(dt: number, playerPos: Vector3, playerAlive: boolean, botPositions: Vector3[]) {
    let pZones = 0, eZones = 0;
    for (const z of this.zones) {
      const pIn = playerAlive && this.inside(playerPos, z.def);
      const eIn = botPositions.some((b) => this.inside(b, z.def));
      let dir = 0;
      if (pIn && !eIn) dir = 1;
      else if (eIn && !pIn) dir = -1;
      if (dir !== 0) {
        const prev = z.owner;
        z.progress = Math.max(-1, Math.min(1, z.progress + dir * CAP_RATE * dt));
        const newOwner: Owner = z.progress >= 1 ? 'player' : z.progress <= -1 ? 'enemy' : prev === 'neutral' ? 'neutral' : (Math.sign(z.progress) === 1 ? prev : prev);
        // flip ownership only at the extremes; cross through neutral at 0
        if (z.progress >= 1 && z.owner !== 'player') { z.owner = 'player'; this.onCapture?.('player'); }
        else if (z.progress <= -1 && z.owner !== 'enemy') { z.owner = 'enemy'; this.onCapture?.('enemy'); }
        else if (z.owner !== 'neutral' && Math.abs(z.progress) < 0.05) { z.owner = 'neutral'; }
        void newOwner;
      }
      this.applyColor(z);
      if (z.owner === 'player') pZones++; else if (z.owner === 'enemy') eZones++;
    }
    this.playerScore += pZones * SCORE_RATE * dt;
    this.enemyScore += eZones * SCORE_RATE * dt;
  }

  private applyColor(z: { def: ZoneDef; owner: Owner; progress: number }) {
    const c = COL[z.owner];
    z.def.mat.emissiveColor.copyFrom(c);
    z.def.mat.diffuseColor.copyFrom(c);
    z.def.mat.alpha = 0.18 + Math.abs(z.progress) * 0.22;
  }

  private refreshColors() { for (const z of this.zones) this.applyColor(z); }

  ownerOf(i: number): Owner { return this.zones[i]?.owner ?? 'neutral'; }
}
