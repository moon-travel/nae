import { LandmarkEmaFilter } from "../filters/EmaFilter";
import type { AnalysisResult, CalibrationStatus, FeedbackType, PoseFrame, SquatMetrics, SquatRep } from "../types";
import { Calibration } from "./Calibration";
import { calculateMetrics } from "./MetricsCalculator";
import { QualityGate } from "./QualityGate";
import { SquatStateMachine } from "./SquatStateMachine";
import { analysisConfig } from "./analysisConfig";

interface ActiveRep { index: number; startedAt: number; maxDepth: number; maxAbsTorsoLean: number; maxAbsHipShift: number; maxKneeTrackingAsymmetry: number; feedbackTypes: Set<string>; }

/** Measures pose-derived values only. Form judgment is deliberately owned by RuleEngine. */
export class SquatAnalyzer {
  private readonly qualityGate = new QualityGate();
  private readonly calibrationEngine = new Calibration();
  private readonly landmarkFilter = new LandmarkEmaFilter(analysisConfig.emaAlpha);
  private readonly stateMachine = new SquatStateMachine();
  private repIndex = 0;
  private activeRep: ActiveRep | null = null;
  private invalidSince: number | null = null;

  startCalibration(): void { this.calibrationEngine.start(); this.stateMachine.reset(); this.landmarkFilter.reset(); this.activeRep = null; }
  get calibration(): CalibrationStatus { return this.calibrationEngine.status; }
  reset(): void { this.calibrationEngine.reset(); this.stateMachine.reset(); this.landmarkFilter.reset(); this.activeRep = null; this.repIndex = 0; }
  /** Resets workout movement state while retaining the completed standing calibration. */
  resetWorkout(): void { this.stateMachine.reset(); this.landmarkFilter.reset(); this.activeRep = null; this.repIndex = 0; this.invalidSince = null; }
  noteFeedback(type: FeedbackType): void { this.activeRep?.feedbackTypes.add(type); }

  /** `timestampIfMissing` lets callers/tests preserve the same monotonic clock as pose frames. */
  process(frame: PoseFrame | null | undefined, timestampIfMissing = performance.now()): AnalysisResult {
    const timestamp = frame?.timestamp ?? timestampIfMissing;
    const quality = this.qualityGate.evaluate(frame);
    if (!frame || !quality.accepted) {
      this.landmarkFilter.reset();
      this.stateMachine.resetVelocity();
      this.calibrationEngine.discardSamples();
      this.invalidSince ??= timestamp;
      if (timestamp - this.invalidSince >= analysisConfig.invalidFrameResetMs) {
        this.stateMachine.reset();
        this.activeRep = null;
      }
      return { timestamp, accepted: false, quality, calibration: this.calibration, metrics: null };
    }
    if (this.invalidSince !== null && timestamp - this.invalidSince >= analysisConfig.invalidFrameResetMs) {
      this.stateMachine.reset();
      this.activeRep = null;
    }
    this.invalidSince = null;
    const landmarks = this.landmarkFilter.update(frame.landmarks);
    const aspectRatio = frame.imageWidth && frame.imageHeight ? frame.imageWidth / frame.imageHeight : 1;
    if (this.calibration.state === "COLLECTING") this.calibrationEngine.add(landmarks, timestamp, aspectRatio);
    const calibration = this.calibration;
    if (!calibration.data) return { timestamp, accepted: true, quality, calibration, metrics: null };
    // Establish depth/velocity history only after a stable standing reference exists.
    const provisionalDepth = (landmarks[23]!.y + landmarks[24]!.y) / 2;
    const depth = (provisionalDepth - calibration.data.standingHipY) / calibration.data.bodyHeight;
    const state = this.stateMachine.update(depth, timestamp);
    const metrics = calculateMetrics({ timestamp, landmarks, worldLandmarks: frame.worldLandmarks, calibration: calibration.data, phase: state.phase, velocity: state.velocity, bodyOccupancy: quality.bodyOccupancy, quality: quality.score, aspectRatio });
    if (state.repStarted) this.beginRep(metrics);
    if (this.activeRep) this.updateRep(metrics);
    const completedRep = state.repCompleted && this.activeRep ? this.finishRep(timestamp) : undefined;
    return { timestamp, accepted: true, quality, calibration: this.calibration, metrics, completedRep };
  }

  private beginRep(metrics: SquatMetrics): void { this.activeRep = { index: ++this.repIndex, startedAt: metrics.timestamp, maxDepth: metrics.depth, maxAbsTorsoLean: Math.abs(metrics.torsoLean), maxAbsHipShift: Math.abs(metrics.hipShift), maxKneeTrackingAsymmetry: Math.abs(metrics.kneeTrackingAsymmetry), feedbackTypes: new Set() }; }
  private updateRep(metrics: SquatMetrics): void { if (!this.activeRep) return; this.activeRep.maxDepth = Math.max(this.activeRep.maxDepth, metrics.depth); this.activeRep.maxAbsTorsoLean = Math.max(this.activeRep.maxAbsTorsoLean, Math.abs(metrics.torsoLean)); this.activeRep.maxAbsHipShift = Math.max(this.activeRep.maxAbsHipShift, Math.abs(metrics.hipShift)); this.activeRep.maxKneeTrackingAsymmetry = Math.max(this.activeRep.maxKneeTrackingAsymmetry, Math.abs(metrics.kneeTrackingAsymmetry)); }
  private finishRep(endedAt: number): SquatRep { const active = this.activeRep!; this.activeRep = null; return { index: active.index, startedAt: active.startedAt, endedAt, durationMs: endedAt - active.startedAt, maxDepth: active.maxDepth, maxAbsTorsoLean: active.maxAbsTorsoLean, maxAbsHipShift: active.maxAbsHipShift, maxKneeTrackingAsymmetry: active.maxKneeTrackingAsymmetry, feedbackTypes: [...active.feedbackTypes] }; }
}
