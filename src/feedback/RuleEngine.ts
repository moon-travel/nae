import type { FeedbackCandidate, FeedbackType, SquatMetrics } from "../types";
import { feedbackConfig } from "./feedbackConfig";

interface ActiveRule { startedAt: number; }

/** Converts measurements to feedback candidates. It does not perform speech or store state outside a workout. */
export class RuleEngine {
  private active = new Map<FeedbackType, ActiveRule>();
  reset(): void { this.active.clear(); }
  evaluate(metrics: SquatMetrics | null): FeedbackCandidate[] {
    if (!metrics) { this.reset(); return []; }
    const signals: Array<{ type: FeedbackType; severity: number; enabled: boolean }> = [
      { type: "TORSO_LEAN", severity: Math.abs(metrics.torsoLean) / feedbackConfig.thresholds.torsoLeanDegrees, enabled: true },
      { type: "HIP_SHIFT", severity: Math.abs(metrics.hipShift) / feedbackConfig.thresholds.hipShiftNormalized, enabled: true },
      { type: "KNEE_ASYMMETRY", severity: Math.abs(metrics.kneeTrackingAsymmetry) / feedbackConfig.thresholds.kneeAsymmetryNormalized, enabled: feedbackConfig.enableKneeAsymmetry },
    ];
    const candidates: FeedbackCandidate[] = [];
    const present = new Set<FeedbackType>();
    for (const signal of signals) {
      if (!signal.enabled || signal.severity < 1) continue;
      present.add(signal.type);
      const rule = this.active.get(signal.type) ?? { startedAt: metrics.timestamp };
      this.active.set(signal.type, rule);
      const durationMs = metrics.timestamp - rule.startedAt;
      if (durationMs >= feedbackConfig.minimumDurationMs) candidates.push({ type: signal.type, severity: signal.severity, startedAt: rule.startedAt, durationMs });
    }
    for (const type of this.active.keys()) if (!present.has(type)) this.active.delete(type);
    return candidates.sort((a, b) => feedbackConfig.priority.indexOf(a.type) - feedbackConfig.priority.indexOf(b.type));
  }
}
