# ZONE STRIKE — REVENUE & TECH SPEC

The single source of truth for what we're building and *why*. Every technical decision maps to a revenue goal. If a feature doesn't serve retention, load speed, first-session quality, or monetization, it's deprioritized.

---

## 1. THE BUSINESS MODEL

**Distribution = HTML5 game portals.** We build the best browser FPS; CrazyGames (300M+ gameplays/month) and Poki (100M+ monthly players) bring the traffic. This solves the distribution bottleneck directly — the portal *is* the marketing channel.

### Revenue streams (in priority order)
1. **Ad revenue share** — rewarded video + interstitials, paid monthly. Scales passively with players × retention.
2. **Launch exclusivity bonus** — CrazyGames offers +50% rev share for a 2-month launch exclusivity window.
3. **Licensing / sponsorship** — non-exclusive licenses $300–$800 per portal (sellable ~20×); exclusive sponsorships $5,000–$25,000+ for quality games. Pitch once it reviews well.
4. **In-game monetization (hybrid)** — rewarded video for the 95% who won't pay + IAP (battle pass, cosmetics) with cloud saves for the 5% who do. Battle passes can be ~35% of IAP revenue in top browser shooters.

### Non-negotiable portal requirements (these are the spec)
- **Fast load.** Lean build, streamed assets, code-split. Target: playable first frame in seconds, not tens of seconds.
- **3-minute hook.** A new player understands and enjoys the game within 3 minutes, with no early death-wall or confusion. First-session quality is what portals review hardest.
- **Retention.** The #1 metric portals optimize for. Progression, battle pass, daily challenges, unlocks are revenue-critical, not optional polish.
- **Instant play.** No account wall, no download, no forced pre-roll. Jump straight in.

---

## 2. THE STACK

| Layer | Choice | Why |
|---|---|---|
| Engine | **Babylon.js 9** | Full game engine, code-driven (no editor dependency), first-class TypeScript, WebGPU, integrated physics/animation/particles/GUI. Stops us hand-rolling buggy systems. |
| Language/Build | **TypeScript + Vite** | Type safety kills the undefined-ref class of bugs; HMR for fast iteration; tree-shaking keeps the bundle lean for portals. |
| Physics | **Havok (Babylon official, WASM)** | Real collision, vehicles, ragdolls, ballistics. Replaces hand-rolled movement. |
| Characters | **Rigged GLTF + Mixamo animations** | Walk/run/aim/reload/death. Permanently ends "boxes that vanish." |
| Audio | **Babylon spatial audio / Howler** | Spatialized, distance-attenuated. |
| Monetization | **PortalBridge abstraction → Playgama Bridge / CrazyGames / Poki SDKs** | One build ships to every portal; game code never touches a portal SDK directly. |
| Persistence | **Cloud save via bridge → Upstash backend** | Battle pass, unlocks, stats. Falls back to localStorage in dev. |
| Native (later) | **Capacitor** | Wrap the same build for iOS App Store + Google Play. |
| Multiplayer (later) | **Colyseus** | Authoritative rooms — the retention multiplier. |

**Ruled out:** PlayCanvas (editor-centric — bad fit for code-only AI dev), Unity WebGL (8MB+ empty builds fail the portal load-time bar).

---

## 3. ARCHITECTURE

```
zonestrike-v2/
├── index.html            # boot loader + canvas
├── vite.config.ts        # base './', lean build, code-split
├── tsconfig.json         # strict TS
└── src/
    ├── main.ts           # boot: bridge → engine → scene
    ├── config.ts         # ALL tunables (balance fast)
    ├── core/
    │   ├── Engine.ts     # Babylon engine + render loop
    │   ├── ArenaScene.ts # scene composition
    │   └── (Game.ts state machine, AssetManager.ts — next)
    ├── platform/
    │   └── PortalBridge.ts  # REVENUE LAYER: ads/IAP/cloud-save abstraction
    └── systems/          # input, player controller, weapons, AI, zones, modes
```

**Principle:** game logic never imports a portal SDK. It calls `bridge.showRewardedAd()`, `bridge.saveData()`. We swap the concrete bridge per deploy target without touching gameplay code.

---

## 4. BUILD ORDER (revenue-weighted)

Each phase ends with something that improves a portal-review metric.

1. **Foundation** ✅ — Vite + TS + Babylon scaffold, PortalBridge wired, build pipeline green.
2. **Core loop playable** — player controller (Havok capsule: move/jump/crouch/slide/mantle), one map, shooting, bots, zone capture. *→ the 3-minute hook.*
3. **Real assets** — animated soldier bots, weapon viewmodels with reload/draw/ADS. *→ first-session quality.*
4. **Retention systems** — XP, unlocks, battle pass, daily challenges, cloud save. *→ the #1 portal metric.*
5. **Monetization hooks** — rewarded revive / double-XP / unlock, interstitial at round end, cosmetic shop. *→ direct revenue.*
6. **Portal integration** — Playgama Bridge build target, submit to CrazyGames + Poki, take launch exclusivity. *→ live revenue.*
7. **Polish & feel** — post-FX, audio, juice. *→ retention + review score.*
8. **Scale** — more maps/modes, Capacitor native builds, Colyseus multiplayer. *→ revenue multiplier.*

---

## 5. SUCCESS METRICS

- **Load time** to first playable frame (portal review gate)
- **D1 / D7 retention** (the revenue driver)
- **Avg session length** (more sessions = more ad impressions)
- **Rewarded-ad opt-in rate** (monetization efficiency)
- **Portal review acceptance** at CrazyGames + Poki
- **Monthly ad revenue** + any licensing/sponsorship secured

---

*Living doc. The prototype (`main` branch, Three.js) stays live and playable while v2 is built on the `v2-babylon` branch. v2 becomes the product the moment it surpasses the prototype.*
