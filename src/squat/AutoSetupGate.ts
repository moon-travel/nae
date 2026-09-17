import type { QualityGateResult } from "../types";
import { analysisConfig } from "./analysisConfig";

/**
 * Emits once after continuously acceptable pose quality. This has no UI or
 * calibration side effects; callers decide what automatic setup should do.
 */
export class AutoSetupGate {
  private acceptableSince: number | null = null;
  private lastAcceptedAt: number | null = null;
  private fired = false;

  update(quality: QualityGateResult, timestamp: number): { triggered: boolean; progress: number } {
    if (this.fired) return { triggered: false, progress: 1 };
    if (!quality.accepted) { this.acceptableSince = null; this.lastAcceptedAt = null; return { triggered: false, progress: 0 }; }
    if (this.lastAcceptedAt !== null && timestamp - this.lastAcceptedAt > analysisConfig.autoSetup.maxSampleGapMs) this.acceptableSince = timestamp;
    this.acceptableSince ??= timestamp;
    this.lastAcceptedAt = timestamp;
    const progress = Math.min(1, Math.max(0, (timestamp - this.acceptableSince) / analysisConfig.autoSetup.stableQualityMs));
    if (progress < 1) return { triggered: false, progress };
    this.fired = true;
    return { triggered: true, progress: 1 };
  }

  /** Clears the one-shot latch and begins a new automatic-setup arm. */
  reset(): void { this.acceptableSince = null; this.lastAcceptedAt = null; this.fired = false; }
}
