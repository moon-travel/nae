import { requiredSquatLandmarks } from "../pose/landmarks";
import type { PoseFrame, QualityGateResult } from "../types";
import { clamp } from "../utils/geometry";
import { analysisConfig } from "./analysisConfig";

export class QualityGate {
  evaluate(frame: PoseFrame | null | undefined): QualityGateResult {
    if (!frame || frame.landmarks.length <= Math.max(...requiredSquatLandmarks)) return { accepted: false, score: 0, bodyOccupancy: 0, reason: "NO_POSE" };
    const points = requiredSquatLandmarks.map((index) => frame.landmarks[index]);
    if (points.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.visibility))) {
      return { accepted: false, score: 0, bodyOccupancy: 0, reason: "NO_POSE" };
    }
    const visible = points.filter((point) => point.visibility >= analysisConfig.visibilityThreshold).length;
    const score = visible / points.length;
    const occupancy = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    const inFrame = points.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
    if (score < 1) return { accepted: false, score, bodyOccupancy: clamp(occupancy, 0, 1), reason: "LOW_VISIBILITY" };
    if (!inFrame) return { accepted: false, score, bodyOccupancy: clamp(occupancy, 0, 1), reason: "OUT_OF_FRAME" };
    if (occupancy < analysisConfig.minBodyOccupancy) return { accepted: false, score, bodyOccupancy: occupancy, reason: "TOO_SMALL" };
    if (occupancy > analysisConfig.maxBodyOccupancy) return { accepted: false, score, bodyOccupancy: occupancy, reason: "TOO_LARGE" };
    // A frontal view normally has relatively similar left/right normalized z values.
    // This is only a camera-orientation hint, never a biomechanical conclusion.
    const shoulderWidth = Math.abs(points[0]!.x - points[1]!.x);
    const hipWidth = Math.abs(points[2]!.x - points[3]!.x);
    const depthMismatch = Math.max(Math.abs(points[0]!.z - points[1]!.z) / Math.max(shoulderWidth, Number.EPSILON), Math.abs(points[2]!.z - points[3]!.z) / Math.max(hipWidth, Number.EPSILON));
    if (depthMismatch > analysisConfig.frontal.maxRelativeDepthDifference) return { accepted: false, score, bodyOccupancy: occupancy, reason: "NOT_FRONTAL" };
    return { accepted: true, score, bodyOccupancy: occupancy, reason: "OK" };
  }
}
