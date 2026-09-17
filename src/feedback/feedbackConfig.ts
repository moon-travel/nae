/** Experimental feedback thresholds, separate from measurements and not medical guidance. */
export const feedbackConfig = {
  minimumDurationMs: 450,
  cooldownMs: 5_000,
  enableKneeAsymmetry: false,
  thresholds: { torsoLeanDegrees: 15, hipShiftNormalized: 0.18, kneeAsymmetryNormalized: 0.22 },
  priority: ["TORSO_LEAN", "HIP_SHIFT", "KNEE_ASYMMETRY"],
} as const;
