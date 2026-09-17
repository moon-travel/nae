/** A normalized MediaPipe landmark, decoupled from MediaPipe runtime types. */
export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseFrame {
  timestamp: number;
  landmarks: Point3D[];
  worldLandmarks: Point3D[];
  /** Source image dimensions when available, used to correct normalized x/y geometry. */
  imageWidth?: number;
  imageHeight?: number;
}

export type SquatPhase = "READY" | "DESCENDING" | "BOTTOM" | "ASCENDING";

export interface CalibrationData {
  standingHipY: number;
  shoulderWidth: number;
  hipWidth: number;
  ankleWidth: number;
  bodyHeight: number;
  baselineTorsoLean: number;
  baselineHipShift: number;
  sampleCount: number;
}

export interface CalibrationStatus {
  state: "IDLE" | "COLLECTING" | "CALIBRATED";
  progress: number;
  data: CalibrationData | null;
}

export interface QualityGateResult {
  accepted: boolean;
  score: number;
  bodyOccupancy: number;
  reason: "OK" | "NO_POSE" | "LOW_VISIBILITY" | "OUT_OF_FRAME" | "TOO_SMALL" | "TOO_LARGE" | "NOT_FRONTAL";
}

export interface SquatMetrics {
  timestamp: number;
  phase: SquatPhase;
  depth: number;
  velocity: number;
  torsoLean: number;
  hipShift: number;
  leftKneeOffset: number;
  rightKneeOffset: number;
  kneeTrackingAsymmetry: number;
  /** Estimated from MediaPipe world landmarks; it is not a motion-capture measurement. */
  estimatedLeftKneeAngle3D: number | null;
  /** Estimated from MediaPipe world landmarks; it is not a motion-capture measurement. */
  estimatedRightKneeAngle3D: number | null;
  bodyOccupancy: number;
  quality: number;
}

export interface SquatRep {
  index: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  maxDepth: number;
  maxAbsTorsoLean: number;
  maxAbsHipShift: number;
  maxKneeTrackingAsymmetry: number;
  feedbackTypes: string[];
}

export interface StoredMetricsFrame {
  timestamp: number;
  metrics: SquatMetrics;
}

export interface PerformanceStats {
  cameraFps: number;
  inferenceFps: number;
  inferenceLatencyMs: number;
  droppedFrames: number;
}

export interface WorkoutSession {
  id: string;
  participantId?: string;
  startedAt: number;
  endedAt?: number;
  deviceInfo: { width: number; height: number };
  calibration: CalibrationData;
  reps: SquatRep[];
  frames?: StoredMetricsFrame[];
}

export type FeedbackType = "TORSO_LEAN" | "HIP_SHIFT" | "KNEE_ASYMMETRY";

export interface FeedbackCandidate {
  type: FeedbackType;
  severity: number;
  startedAt: number;
  durationMs: number;
}

export interface AnalysisResult {
  timestamp: number;
  accepted: boolean;
  quality: QualityGateResult;
  calibration: CalibrationStatus;
  metrics: SquatMetrics | null;
  completedRep?: SquatRep;
}
