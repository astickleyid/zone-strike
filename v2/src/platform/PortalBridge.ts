/**
 * PortalBridge — single abstraction over every HTML5 game portal.
 *
 * Game code NEVER calls a portal SDK directly. It calls bridge.showRewardedAd(),
 * bridge.saveData(), etc. We swap the concrete implementation per deploy target
 * (CrazyGames, Poki, Playgama Bridge, or local dev) without touching game logic.
 *
 * This is the revenue layer: rewarded ads, interstitials, IAP, and cloud saves
 * all flow through here. Designed so a single build ships to every portal.
 */

export type RewardResult = { rewarded: boolean };

export interface IPortalBridge {
  readonly name: string;
  init(): Promise<void>;
  /** Call at natural breaks (round end). Portals rate-limit these. */
  showInterstitial(): Promise<void>;
  /** Opt-in: revive, double-XP, unlock. Resolves rewarded=true only if fully watched. */
  showRewardedAd(placement: string): Promise<RewardResult>;
  /** Signal gameplay start/stop so portals can pause ads during play. */
  gameplayStart(): void;
  gameplayStop(): void;
  /** Cloud save (falls back to localStorage in dev). */
  saveData(key: string, value: unknown): Promise<void>;
  loadData<T>(key: string): Promise<T | null>;
  /** Happy moment (level up, win) — some portals reward these. */
  happyTime(): void;
}

/** Local/dev implementation: localStorage + console-logged "ads". */
class LocalBridge implements IPortalBridge {
  readonly name = 'local';
  async init() { /* no-op */ }
  async showInterstitial() { console.info('[ad] interstitial'); }
  async showRewardedAd(placement: string): Promise<RewardResult> {
    console.info('[ad] rewarded:', placement, '(auto-granted in dev)');
    return { rewarded: true };
  }
  gameplayStart() {}
  gameplayStop() {}
  async saveData(key: string, value: unknown) {
    try { localStorage.setItem('zs_' + key, JSON.stringify(value)); } catch {}
  }
  async loadData<T>(key: string): Promise<T | null> {
    try { const v = localStorage.getItem('zs_' + key); return v ? JSON.parse(v) as T : null; } catch { return null; }
  }
  happyTime() {}
}

/**
 * Playgama Bridge adapter (publish-once → Poki/CrazyGames/FB Instant).
 * Loaded lazily only when the global bridge SDK is present on the page.
 * Stub now; concrete SDK calls wired when we add the portal build target.
 */
class PlaygamaBridge implements IPortalBridge {
  readonly name = 'playgama';
  private get sdk(): any { return (window as any).bridge; }
  async init() { if (this.sdk?.initialize) await this.sdk.initialize(); }
  async showInterstitial() { try { await this.sdk?.advertisement?.showInterstitial?.(); } catch {} }
  async showRewardedAd(placement: string): Promise<RewardResult> {
    try {
      const r = await this.sdk?.advertisement?.showRewarded?.({ placement });
      return { rewarded: !!r };
    } catch { return { rewarded: false }; }
  }
  gameplayStart() { try { this.sdk?.platform?.sendMessage?.('gameplay_started'); } catch {} }
  gameplayStop() { try { this.sdk?.platform?.sendMessage?.('gameplay_stopped'); } catch {} }
  async saveData(key: string, value: unknown) {
    try { await this.sdk?.storage?.set?.(key, value); }
    catch { try { localStorage.setItem('zs_' + key, JSON.stringify(value)); } catch {} }
  }
  async loadData<T>(key: string): Promise<T | null> {
    try { const v = await this.sdk?.storage?.get?.(key); return (v ?? null) as T | null; }
    catch { try { const v = localStorage.getItem('zs_' + key); return v ? JSON.parse(v) as T : null; } catch { return null; } }
  }
  happyTime() { try { this.sdk?.platform?.sendMessage?.('player_got_achievement'); } catch {} }
}

/** Detect environment and return the right bridge. */
export function createBridge(): IPortalBridge {
  if (typeof window !== 'undefined' && (window as any).bridge) {
    return new PlaygamaBridge();
  }
  return new LocalBridge();
}

export const bridge: IPortalBridge = createBridge();
