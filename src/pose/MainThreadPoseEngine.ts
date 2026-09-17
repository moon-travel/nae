import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseEngine } from './PoseEngine';
import { MODEL_URL, WASM_URL } from './PoseEngine';
import type { PoseDetection } from './poseTypes';
import type { Point3D, PoseFrame } from '../types';

export class MainThreadPoseEngine implements PoseEngine {
  readonly mode = 'main' as const;
  private constructor(private readonly landmarker: PoseLandmarker) {}

  static async create(): Promise<MainThreadPoseEngine> {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: false,
    });
    return new MainThreadPoseEngine(landmarker);
  }

  async detect(video: HTMLVideoElement, timestamp: number): Promise<PoseDetection> {
    const start = performance.now();
    const result = this.landmarker.detectForVideo(video, timestamp);
    const normalized = result.landmarks[0];
    const world = result.worldLandmarks[0];
    const mapPoint = (point: Point3D): Point3D => ({
      x: point.x, y: point.y, z: point.z, visibility: point.visibility ?? 0,
    });
    const frame: PoseFrame | null = normalized?.length === 33
      ? { timestamp, imageWidth: video.videoWidth, imageHeight: video.videoHeight, landmarks: normalized.map(mapPoint), worldLandmarks: world?.map(mapPoint) ?? [] }
      : null;
    return { frame, latencyMs: performance.now() - start };
  }

  dispose(): void { this.landmarker.close(); }
}
