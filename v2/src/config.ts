/** Central tunables. Every gameplay number lives here for fast balancing. */
export const CONFIG = {
  player: {
    standHeight: 1.7,
    crouchHeight: 1.05,
    walkSpeed: 5.4,
    sprintMul: 1.65,
    crouchMul: 0.55,
    jumpVelocity: 6.2,
    gravity: 18.0,
    slideDuration: 0.55,
    slideBoost: 1.9,
    mantleDuration: 0.42,
  },
  match: {
    durationSec: 180,
    botCountMobile: 3,
    botCountDesktop: 5,
    zoneScorePerTick: 30,
  },
  // Revenue-critical retention/monetization hooks
  monetization: {
    rewardedReviveEnabled: true,
    rewardedDoubleXpEnabled: true,
    battlePassEnabled: true,
    cloudSaveEnabled: true,
  },
} as const;
