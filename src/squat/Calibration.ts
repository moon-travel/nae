import { PoseLandmark } from "../pose/landmarks";
import type { CalibrationData, CalibrationStatus, Point3D } from "../types";
import { distance2D, midpoint } from "../utils/geometry";
import { analysisConfig } from "./analysisConfig";

interface CalibrationSample { hipY: number; shoulderWidth: number; hipWidth: number; ankleWidth: number; bodyHeight: number; torsoLean: number; hipShift: number; }
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const standardDeviation = (values: number[]) => { const average = mean(values); return Math.sqrt(mean(values.map((value) => (value - average) ** 2))); };

export class Calibration {
  private samples: CalibrationSample[] = [];
  private data: CalibrationData | null = null;
  private collecting = false;
  private startedAt: number | null = null;

  start(): void { this.samples = []; this.data = null; this.collecting = true; this.startedAt = null; }
  reset(): void { this.samples = []; this.data = null; this.collecting = false; this.startedAt = null; }
  discardSamples(): void { if (this.collecting) { this.samples = []; this.startedAt = null; } }
  get status(): CalibrationStatus { return { state: this.data ? "CALIBRATED" : this.collecting ? "COLLECTING" : "IDLE", progress: Math.min(1, this.samples.length / analysisConfig.calibration.sampleCount), data: this.data }; }

  add(landmarks: Point3D[], timestamp: number, aspectRatio = 1): CalibrationData | null {
    if (!this.collecting || landmarks.length <= PoseLandmark.RIGHT_ANKLE) return this.data;
    const leftShoulder = landmarks[PoseLandmark.LEFT_SHOULDER]; const rightShoulder = landmarks[PoseLandmark.RIGHT_SHOULDER];
    const leftHip = landmarks[PoseLandmark.LEFT_HIP]; const rightHip = landmarks[PoseLandmark.RIGHT_HIP];
    const leftAnkle = landmarks[PoseLandmark.LEFT_ANKLE]; const rightAnkle = landmarks[PoseLandmark.RIGHT_ANKLE];
    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !leftAnkle || !rightAnkle) return null;
    const shoulder = midpoint(leftShoulder, rightShoulder); const hip = midpoint(leftHip, rightHip); const ankle = midpoint(leftAnkle, rightAnkle);
    this.startedAt ??= timestamp;
    this.samples.push({ hipY: hip.y, shoulderWidth: distance2D(leftShoulder, rightShoulder), hipWidth: distance2D(leftHip, rightHip), ankleWidth: distance2D(leftAnkle, rightAnkle), bodyHeight: Math.max(0, ankle.y - shoulder.y), torsoLean: (Math.atan2((shoulder.x - hip.x) * aspectRatio, hip.y - shoulder.y) * 180) / Math.PI, hipShift: hip.x - ankle.x });
    if (this.samples.length < analysisConfig.calibration.sampleCount || timestamp - this.startedAt < analysisConfig.calibration.minDurationMs) return null;
    const hipYs = this.samples.map((sample) => sample.hipY);
    if (standardDeviation(hipYs) > analysisConfig.calibration.maxHipYStdDev) { this.samples.shift(); return null; }
    this.data = { standingHipY: mean(hipYs), shoulderWidth: mean(this.samples.map((sample) => sample.shoulderWidth)), hipWidth: mean(this.samples.map((sample) => sample.hipWidth)), ankleWidth: mean(this.samples.map((sample) => sample.ankleWidth)), bodyHeight: mean(this.samples.map((sample) => sample.bodyHeight)), baselineTorsoLean: mean(this.samples.map((sample) => sample.torsoLean)), baselineHipShift: mean(this.samples.map((sample) => sample.hipShift)), sampleCount: this.samples.length };
    this.collecting = false;
    return this.data;
  }
}
