/**
 * Experimental starting parameters only. They are intentionally centralized for
 * study calibration and are not medical or injury-risk thresholds.
 */
export const analysisConfig = {
  emaAlpha: 0.3,
  visibilityThreshold: 0.6,
  minBodyOccupancy: 0.35,
  maxBodyOccupancy: 0.95,
  calibration: { sampleCount: 45, minDurationMs: 1_500, maxHipYStdDev: 0.015 },
  /** Maximum relative left/right depth mismatch used as an experimental frontal-view proxy. */
  frontal: { maxRelativeDepthDifference: 0.55 },
  /** An invalid-pose gap longer than this starts a new movement sequence. */
  invalidFrameResetMs: 750,
  /** Experimental setup dwell time; tune in study validation, not a clinical threshold. */
  autoSetup: {
    stableQualityMs: 1_200,
    /** Experimental maximum interval between accepted samples; protects against tab/worker stalls. */
    maxSampleGapMs: 600,
  },
  phase: {
    startDepth: 0.08,
    bottomMinDepth: 0.18,
    readyDepth: 0.05,
    descentVelocity: 0.04,
    ascentVelocity: 0.04,
    bottomVelocity: 0.035,
    minPhaseDurationMs: 120,
  },
} as const;

export type AnalysisConfig = typeof analysisConfig;
